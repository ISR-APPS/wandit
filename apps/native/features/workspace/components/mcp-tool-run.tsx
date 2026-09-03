import { Ionicons } from "@expo/vector-icons";
import {
	useDictionary,
	useTranslation,
} from "@wandit/internationalization/react";
import { Button, Chip, useThemeColor } from "heroui-native";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { Pressable, Text, View } from "react-native";
import Animated, {
	Easing,
	useAnimatedStyle,
	useSharedValue,
	withTiming,
} from "react-native-reanimated";

import { WanditIcon } from "@/components/wandit-icon";
import { chatErrorPresentation, readAiErrorData } from "../lib/ai-error-copy";
import { originalGenerationPrompt } from "../lib/generation-prefill";

import { AsyncGenerationCard } from "./async-generation-card";
import { ChatMediaGallery, type ChatMediaGalleryItem } from "./chat-media";
import { ElapsedTimer } from "./elapsed-timer";
import { SpinnerArc } from "./spinner-arc";
import { SweepBar } from "./sweep-bar";

export type McpToolPartState =
	| "input-streaming"
	| "input-available"
	| "approval-requested"
	| "approval-responded"
	| "output-available"
	| "output-error"
	| "output-denied";

export type McpToolPart = Readonly<{
	type: "dynamic-tool";
	toolName: string;
	toolCallId: string;
	state: McpToolPartState;
	input?: unknown;
	output?: unknown;
	approval?: Readonly<{
		id: string;
		approved?: boolean;
		reason?: string;
	}>;
}>;

export type McpToolRunProps = {
	/** One adjacent dynamic-tool run. Invalid/future entries are ignored. */
	parts: readonly unknown[];
	projectId: string;
	isTurnLive: boolean;
	/** The turn's narrative moved past this run (prose, a question round, the
	 * next batch), so no more calls can join it. Mid-stream a concluded
	 * receipt animates out of the thread; it returns as the settled pill at
	 * the bottom once the turn ends. */
	isRunConcluded?: boolean;
	/** Which half renders: "receipt" (the tool rows, placed by the run's
	 * lifecycle) or "deliverables" (background-generation cards, placed at
	 * the bottom of the turn). "all" renders both. */
	section?: "all" | "receipt" | "deliverables";
	isLastAssistantMessage: boolean;
	onApprovalResponse: (response: {
		id: string;
		approved: boolean;
	}) => void | Promise<void>;
	onPrefillComposer?: (prompt: string) => void;
};

type ActivityStatus =
	| "running"
	| "done"
	| "error"
	| "denied"
	| "interrupted"
	| "approval-requested"
	| "approval-approved"
	| "approval-denied";

type ActivityRow = {
	connectorSlug: string | null;
	label: string;
	parts: McpToolPart[];
	status: ActivityStatus;
};

type PrimitiveArgument = {
	key: string;
	value: string;
};

type ToolLabelDictionary = Record<string, { active?: string; past?: string }>;

const PART_STATES = new Set<McpToolPartState>([
	"input-streaming",
	"input-available",
	"approval-requested",
	"approval-responded",
	"output-available",
	"output-error",
	"output-denied",
]);
const TERMINAL_STATES = new Set<McpToolPartState>([
	"output-available",
	"output-error",
	"output-denied",
]);
const MCP_TOOL_NAME_PATTERN = /^mcp_([A-Za-z0-9]+(?:-[A-Za-z0-9]+)*)_(.+)$/;
const PLATFORM_TOOL_WRAPPERS = new Set(["run_platform_tool", "tool_execute"]);
const CONNECTOR_DISPLAY_NAMES: Record<string, string> = {
	"meta-ads": "Meta Ads",
	"tiktok-ads": "TikTok Ads",
	higgsfield: "Higgsfield",
};
const ARGUMENT_PREVIEW_LIMIT = 5;
const ARGUMENT_VALUE_LIMIT = 72;

// Tiny avatar letters for the settled receipt chip (web parity: the code
// badge overlapped by a dark connector circle).
const CONNECTOR_MONOGRAMS: Record<string, string> = {
	"tiktok-ads": "TT",
	"meta-ads": "M",
	higgsfield: "HF",
};

// Ad platforms charge in US dollars, so a bare "Budget 50" on the approval
// card is dangerously ambiguous for merchants who think in DA — this is the
// user's LAST look before money moves. Numbers only; text passes untouched.
const AD_CONNECTOR_SLUGS = new Set(["meta-ads", "tiktok-ads"]);
const MONEY_ARGUMENT_KEY_PATTERN = /budget|spend|bid/i;

// Media-preview extraction from MCP outputs (web findMediaPreviews parity).
const HTTPS_URL_PATTERN = /https:\/\/[^\s<>"']+/giu;
const VIDEO_EXTENSION_PATTERN = /\.(?:mp4|webm)$/i;
const IMAGE_EXTENSION_PATTERN = /\.(?:png|jpe?g|webp|gif|svg)$/i;
// Catalog/preview assets are never a result — mirrors the server-side
// extract-media-urls filter (Higgsfield preset demo clips, _min thumbnails).
const PREVIEW_ASSET_PATH_PATTERNS = [
	/(^|[/_-])presets?([/_-]|$)/i,
	/_min\.[a-z0-9]+$/i,
	/(^|[/_.-])(thumbs?|thumbnails?|previews?)([/_.-]|$)/i,
];
const MAX_MEDIA_PREVIEWS = 4;

// Import/upload tools echo back media the user (or a previous step) already
// provided — previewing them would duplicate the source right above its own
// derived result, so their outputs never surface media.
const INPUT_ECHO_TOKENS = new Set(["import", "upload"]);

// Verb → generic label class for tools with no per-tool dictionary entry —
// "Fetched data" instead of a raw Title Case op name (web MCP-16 parity).
type McpGenericLabelClass =
	| "fetch"
	| "create"
	| "update"
	| "delete"
	| "publish"
	| "send"
	| "generate"
	| "other";

const CHECK_NOUNS = new Set([
	"balance",
	"health",
	"insights",
	"status",
	"transactions",
]);

const VERB_GENERIC_CLASSES: Record<string, McpGenericLabelClass> = {
	get: "fetch",
	list: "fetch",
	fetch: "fetch",
	read: "fetch",
	query: "fetch",
	search: "fetch",
	show: "fetch",
	check: "fetch",
	view: "fetch",
	retrieve: "fetch",
	download: "fetch",
	export: "fetch",
	preview: "fetch",
	explore: "fetch",
	describe: "fetch",
	create: "create",
	update: "update",
	delete: "delete",
	publish: "publish",
	deploy: "publish",
	upload: "send",
	send: "send",
	connect: "send",
	generate: "generate",
	boost: "other",
	schedule: "other",
	cancel: "other",
};

type GenericLabelDictionary = Partial<
	Record<McpGenericLabelClass, { active?: string; past?: string }>
>;

export function McpToolRun({
	parts: rawParts,
	projectId,
	isTurnLive,
	isRunConcluded = false,
	section = "all",
	isLastAssistantMessage,
	onApprovalResponse,
	onPrefillComposer,
}: McpToolRunProps) {
	const { t } = useTranslation();
	const dictionary = useDictionary();
	const muted = useThemeColor("muted");
	const toolLabels = dictionary.workspace.chat.mcpTool
		.toolLabels as ToolLabelDictionary;
	const genericLabels = dictionary.workspace.chat.mcpTool
		.genericLabels as GenericLabelDictionary;
	const [respondingApprovalId, setRespondingApprovalId] = useState<
		string | null
	>(null);
	const parts = rawParts.flatMap((part) => {
		const parsed = parseMcpToolPart(part);
		return parsed ? [parsed] : [];
	});
	const onlyConnectorSlug = runOnlyConnectorSlug(parts);
	const backgroundParts = parts.filter(isBackgroundGenerationPart);
	const visibleParts = parts.filter(
		(part) => !isBackgroundGenerationPart(part),
	);
	// An answered approval on the actionable last message stays live while the
	// automatic continuation moves through its brief ready-to-submitted gap.
	const rowsLive =
		isTurnLive ||
		(isLastAssistantMessage &&
			visibleParts.some((part) => part.state === "approval-responded"));
	const rows = collapseRows(
		visibleParts,
		rowsLive,
		toolLabels,
		genericLabels,
		t,
	);
	// Run-wide media extracted from settled tool outputs — connector results
	// (rendered clips, uploaded creatives) surface as a gallery in the
	// deliverables half of the turn.
	const mediaPreviews = collectRunMediaPreviews(visibleParts);
	const failedCount = visibleParts.filter(
		(part) =>
			part.state === "output-error" ||
			(part.state === "output-available" && isMcpErrorOutput(part.output)),
	).length;
	const doneCount = visibleParts.filter((part) =>
		TERMINAL_STATES.has(part.state),
	).length;
	const runningParts = visibleParts.filter((part) =>
		isActiveMcpPart(part, isLastAssistantMessage, isTurnLive),
	);
	const isRunning = runningParts.length > 0;
	const [startTimes, setStartTimes] = useState<ReadonlyMap<string, string>>(
		() => new Map(),
	);
	useEffect(() => {
		if (section === "deliverables" || runningParts.length === 0) return;

		setStartTimes((current) => {
			const missingParts = runningParts.filter(
				(part) => !current.has(part.toolCallId),
			);
			if (missingParts.length === 0) return current;

			const next = new Map(current);
			const startedAt = new Date().toISOString();
			for (const part of missingParts) next.set(part.toolCallId, startedAt);
			return next;
		});
	}, [runningParts, section]);
	// An actionable approval must never hide behind the collapsed pill (or the
	// mid-stream conceal) — the panel stays up until it is answered.
	const hasActionableApproval =
		isLastAssistantMessage &&
		visibleParts.some((part) => part.state === "approval-requested");

	// The panel stays up while THIS run still has live work, and through the
	// pre-conclusion stretch of the turn (nothing renders after the run yet,
	// so the next call may still join it). Once the run concludes it folds.
	// panelOpen is DERIVED every render — an effect-synced copy can diverge
	// for whole batches when status flaps around ask answers/resubmits, which
	// left settled runs stuck as forever-loading bars.
	const holdOpen = isRunning || (isTurnLive && !isRunConcluded);
	// Manual toggle wins until the next auto transition, then resets. The
	// previous-holdOpen mirror is STATE adjusted during render (the canonical
	// derive-from-props pattern), not a ref — a ref mutated during render can
	// leak from an abandoned concurrent render and desync the pair.
	const [manualOpen, setManualOpen] = useState<boolean | null>(null);
	const [previousHoldOpen, setPreviousHoldOpen] = useState(holdOpen);
	if (previousHoldOpen !== holdOpen) {
		setPreviousHoldOpen(holdOpen);
		if (manualOpen !== null) setManualOpen(null);
	}
	const panelOpen = hasActionableApproval || (manualOpen ?? holdOpen);

	// The big-assistant lifecycle (web parity): the receipt narrates while
	// tools run, then — once the turn's narrative moves past the run (prose,
	// a question round, the next batch) — it animates out of the thread. It
	// comes back as the quiet bottom pill when the turn ends
	// (orderMessagePartEntries re-seats it).
	const receiptConcealed =
		isTurnLive && isRunConcluded && !isRunning && !hasActionableApproval;

	// A concealed receipt still occupies a slot in the message column — swallow
	// its share of the column gap so the thread shows no blank line while the
	// receipt is hidden mid-stream. (Half the 9px column gap per side.)
	const swallowGap = section !== "deliverables" && receiptConcealed;
	const gapCollapse = useSharedValue(swallowGap ? -4.5 : 0);
	useEffect(() => {
		gapCollapse.value = withTiming(swallowGap ? -4.5 : 0, {
			duration: RECEIPT_MS,
			easing: RECEIPT_EASE,
		});
	}, [swallowGap, gapCollapse]);
	const rootStyle = useAnimatedStyle(() => ({
		marginVertical: gapCollapse.value,
	}));

	if (parts.length === 0) return null;

	// Live styling follows holdOpen exactly: run-scoped, so a fully-settled
	// batch reads as done (quiet pill, past-tense label) even while a later
	// batch of the same turn is still working — but held live through the
	// settled-only gaps between call N and call N+1 of a still-growing run,
	// so a manually collapsed bar doesn't flap live→settled→live.
	const showLive = holdOpen;
	const currentPart = runningParts[0];
	const liveLabel = currentPart
		? activityLabel(
				currentPart,
				activityStatus(currentPart, rowsLive),
				toolLabels,
				genericLabels,
				t,
			)
		: t("workspace.chat.mcpTool.workingWith");

	const handleApprovalResponse = async (id: string, approved: boolean) => {
		if (respondingApprovalId) return;
		setRespondingApprovalId(id);
		try {
			await onApprovalResponse({ id, approved });
		} catch {
			// The owning chat hook exposes continuation failures at chat level.
		} finally {
			setRespondingApprovalId(null);
		}
	};

	const showReceipt = section !== "deliverables" && rows.length > 0;
	const showDeliverables =
		section !== "receipt" &&
		(backgroundParts.length > 0 || mediaPreviews.length > 0);
	if (!showReceipt && !showDeliverables) return null;

	return (
		<Animated.View style={rootStyle} className="gap-2">
			{showReceipt ? (
				<ConcealableReveal concealed={receiptConcealed}>
					{panelOpen ? (
						<View className="overflow-hidden rounded-[14px] border border-border bg-surface">
							<Pressable
								accessibilityRole="button"
								accessibilityState={{ expanded: true }}
								disabled={hasActionableApproval}
								onPress={() => setManualOpen(false)}
								className="flex-row items-center gap-2 border-border border-b px-3.5 py-2.5"
							>
								<ToolBadge />
								<Text
									numberOfLines={1}
									className="min-w-0 flex-1 font-sans-semibold text-[13px] text-foreground"
								>
									{t("workspace.chat.mcpTool.workingWith")}
								</Text>
								{showLive ? (
									// auto, not ltr: the AR string "{done} من {total}" is RTL text.
									<Text
										className="font-mono text-[10.5px] text-muted"
										style={{ writingDirection: "auto" }}
									>
										{t("workspace.chat.mcpTool.progressOf", {
											done: doneCount,
											total: visibleParts.length,
										})}
									</Text>
								) : visibleParts.length >= 2 ? (
									<Text
										className="text-[10.5px] text-muted"
										style={{ writingDirection: "auto" }}
									>
										{t("workspace.chat.mcpTool.actionCount", {
											count: visibleParts.length,
										})}
									</Text>
								) : null}
								{hasActionableApproval ? null : (
									<View style={{ transform: [{ rotate: "180deg" }] }}>
										<WanditIcon
											name="caretDown"
											size={12}
											color={muted}
											strokeWidth={2}
										/>
									</View>
								)}
							</Pressable>
							{showLive && isRunning ? (
								// Indeterminate ember sweep under the header while the run
								// works (web LiveRail parity).
								<SweepBar height={2} />
							) : null}
							<View>
								{rows.map((row, index) => {
									const activePart =
										row.status === "running"
											? row.parts.find((part) =>
													isActiveMcpPart(
														part,
														isLastAssistantMessage,
														isTurnLive,
													),
												)
											: undefined;

									return (
										<ActivityRowView
											key={`${row.parts[0]?.toolCallId ?? index}:${row.status}`}
											row={row}
											showTopBorder={index > 0}
											isLastAssistantMessage={isLastAssistantMessage}
											isResponding={row.parts.some(
												(part) => part.approval?.id === respondingApprovalId,
											)}
											startedAt={
												activePart
													? startTimes.get(activePart.toolCallId)
													: undefined
											}
											toolLabels={toolLabels}
											onPrefillComposer={onPrefillComposer}
											onApprovalResponse={(id, approved) => {
												void handleApprovalResponse(id, approved);
											}}
										/>
									);
								})}
							</View>
						</View>
					) : (
						<CollapsedReceipt
							live={showLive}
							label={
								showLive
									? liveLabel
									: settledPillLabel(visibleParts, toolLabels, genericLabels, t)
							}
							progressLabel={
								showLive
									? t("workspace.chat.mcpTool.progressOf", {
											done: doneCount,
											total: visibleParts.length,
										})
									: null
							}
							failed={failedCount > 0}
							connectorSlugs={runConnectorSlugs(visibleParts)}
							onlyConnectorSlug={onlyConnectorSlug}
							onPress={() => setManualOpen(true)}
						/>
					)}
				</ConcealableReveal>
			) : null}

			{showDeliverables ? (
				<>
					{backgroundParts.map((part) => (
						<AsyncGenerationCard
							key={part.toolCallId}
							kind="connector"
							part={part}
							projectId={projectId}
							onPrefillComposer={onPrefillComposer}
						/>
					))}
					{mediaPreviews.length > 0 ? (
						<ChatMediaGallery items={mediaPreviews} />
					) : null}
				</>
			) : null}
		</Animated.View>
	);
}

/**
 * Every media URL a settled tool output surfaced, deduped run-wide and
 * capped per output (web findMediaPreviews parity). Import/upload echoes are
 * suppressed — their outputs would duplicate the source right above its own
 * derived result. Only humanized media ever reaches the thread; raw tool
 * JSON stays off-screen.
 */
function collectRunMediaPreviews(parts: McpToolPart[]): ChatMediaGalleryItem[] {
	const items: ChatMediaGalleryItem[] = [];
	const seenUrls = new Set<string>();

	for (const part of parts) {
		if (part.state !== "output-available") continue;
		if (isMcpErrorOutput(part.output)) continue;
		if (isBackgroundGenerationPart(part)) continue;
		if (isInputEchoTool(part)) continue;

		for (const preview of findMediaPreviews(part.output, seenUrls)) {
			items.push({
				key: `${part.toolCallId}:${preview.url}`,
				kind: preview.kind,
				url: preview.url,
				label: humanizeToolName(effectiveToolName(part)),
			});
		}
	}

	return items;
}

function isInputEchoTool(part: McpToolPart): boolean {
	return tokenizeToolName(effectiveToolName(part)).some((token) =>
		INPUT_ECHO_TOKENS.has(token),
	);
}

type MediaPreview = { kind: "image" | "video"; url: string };

function findMediaPreviews(
	output: unknown,
	seenUrls: Set<string>,
): MediaPreview[] {
	const previews: MediaPreview[] = [];
	const seenObjects = new WeakSet<object>();

	function visit(value: unknown) {
		if (previews.length >= MAX_MEDIA_PREVIEWS) return;

		if (typeof value === "string") {
			for (const match of value.matchAll(HTTPS_URL_PATTERN)) {
				const candidate = match[0].replace(/[),.;!?\]}]+$/u, "");
				let parsed: URL;

				try {
					parsed = new URL(candidate);
				} catch {
					continue;
				}

				if (parsed.protocol !== "https:" || seenUrls.has(parsed.href)) continue;

				if (
					PREVIEW_ASSET_PATH_PATTERNS.some((pattern) =>
						pattern.test(parsed.pathname),
					)
				) {
					continue;
				}

				const kind = mediaKind(parsed.pathname);
				if (!kind) continue;

				seenUrls.add(parsed.href);
				previews.push({ kind, url: parsed.href });
				if (previews.length >= MAX_MEDIA_PREVIEWS) return;
			}
			return;
		}

		if (value === null || typeof value !== "object") return;
		if (seenObjects.has(value)) return;
		seenObjects.add(value);

		if (Array.isArray(value)) {
			for (const item of value) {
				visit(item);
				if (previews.length >= MAX_MEDIA_PREVIEWS) return;
			}
			return;
		}

		for (const nestedValue of Object.values(value)) {
			visit(nestedValue);
			if (previews.length >= MAX_MEDIA_PREVIEWS) return;
		}
	}

	visit(output);
	return previews;
}

function mediaKind(pathname: string): MediaPreview["kind"] | null {
	if (VIDEO_EXTENSION_PATTERN.test(pathname)) return "video";
	if (IMAGE_EXTENSION_PATTERN.test(pathname)) return "image";
	return null;
}

function tokenizeToolName(value: string): string[] {
	return value
		.replace(/([a-z0-9])([A-Z])/g, "$1_$2")
		.replace(/([A-Z]+)([A-Z][a-z])/g, "$1_$2")
		.split(/[^A-Za-z0-9]+/u)
		.filter(Boolean)
		.map((token) => token.toLowerCase());
}

/** Still doing (or waiting on) something the user should watch live — the
    web isActiveMcpPart. An answered approval on the actionable last message
    is mid-handshake (the client auto-resubmits), so it stays live; a part
    stranded mid-flight in dead history is only "active" while its turn
    actually streams. */
function isActiveMcpPart(
	part: McpToolPart,
	isApprovalActionable: boolean,
	isTurnLive: boolean,
): boolean {
	if (part.state === "approval-requested") return isApprovalActionable;
	if (part.state === "approval-responded") return isApprovalActionable;
	if (TERMINAL_STATES.has(part.state)) return false;
	return isTurnLive;
}

/** The settled pill must stay truthful — count only tools that actually
    EXECUTED, and name what happened when none did (web pillLabel parity). */
function settledPillLabel(
	visibleParts: McpToolPart[],
	toolLabels: ToolLabelDictionary,
	genericLabels: GenericLabelDictionary,
	t: ReturnType<typeof useTranslation>["t"],
): string {
	const singleDone =
		visibleParts.length === 1 &&
		visibleParts[0]?.state === "output-available" &&
		!isMcpErrorOutput(visibleParts[0].output)
			? visibleParts[0]
			: undefined;
	if (singleDone) {
		return activityLabel(singleDone, "done", toolLabels, genericLabels, t);
	}

	const executedCount = visibleParts.filter(
		(part) =>
			part.state === "output-available" && !isMcpErrorOutput(part.output),
	).length;
	if (executedCount === 1) return t("workspace.chat.mcpTool.usedTool");
	if (executedCount > 1) {
		return t("workspace.chat.mcpTool.usedTools", { count: executedCount });
	}
	if (visibleParts.every((part) => part.state === "output-denied")) {
		return t("workspace.chat.mcpTool.skippedDeclined");
	}
	if (visibleParts.some((part) => part.state === "approval-requested")) {
		return t("workspace.chat.mcpTool.expired");
	}
	if (
		visibleParts.some(
			(part) =>
				part.state === "output-error" ||
				(part.state === "output-available" && isMcpErrorOutput(part.output)),
		)
	) {
		return t("workspace.chat.mcpTool.stepFailed");
	}
	return t("workspace.chat.mcpTool.interrupted");
}

/** Calm, no-bounce ease — same curve as the tray chrome. */
const RECEIPT_EASE = Easing.bezier(0.32, 0.72, 0, 1);
const RECEIPT_MS = 300;

/**
 * Conceal/reveal + resize motion for the receipt. The content renders inside
 * an absolutely-positioned measuring view whose onLayout height drives an
 * animated container height (the TrayReveal technique), so the mid-stream
 * exit, the reveal at the bottom of the message, and every panel⇄pill toggle
 * all resolve as one smooth height+opacity animation instead of a snap. The
 * first layout of an already-visible receipt paints at full height directly
 * — history must not ripple with grow animations on load.
 */
function ConcealableReveal({
	concealed,
	children,
}: {
	concealed: boolean;
	children: ReactNode;
}) {
	const contentHeight = useSharedValue(0);
	const height = useSharedValue(0);
	const opacity = useSharedValue(concealed ? 0 : 1);
	const hasPaintedVisible = useRef(false);
	const concealedRef = useRef(concealed);
	concealedRef.current = concealed;

	useEffect(() => {
		height.value = withTiming(concealed ? 0 : contentHeight.value, {
			duration: RECEIPT_MS,
			easing: RECEIPT_EASE,
		});
		opacity.value = withTiming(concealed ? 0 : 1, { duration: RECEIPT_MS });
	}, [concealed, contentHeight, height, opacity]);

	const animatedStyle = useAnimatedStyle(() => ({
		height: height.value,
		opacity: opacity.value,
	}));

	return (
		<Animated.View
			style={[animatedStyle, { pointerEvents: concealed ? "none" : "auto" }]}
			className="overflow-hidden"
			aria-hidden={concealed}
		>
			<View
				// Absolute so the content lays out at its natural height, unclamped
				// by the animated container — its measurement IS the target height.
				style={{ position: "absolute", top: 0, left: 0, right: 0 }}
				onLayout={(event) => {
					const next = event.nativeEvent.layout.height;
					contentHeight.value = next;
					if (concealedRef.current) return;
					if (!hasPaintedVisible.current) {
						hasPaintedVisible.current = true;
						height.value = next;
						return;
					}
					height.value = withTiming(next, {
						duration: RECEIPT_MS,
						easing: RECEIPT_EASE,
					});
				}}
			>
				{children}
			</View>
		</Animated.View>
	);
}

/** One-line receipt, two shapes. LIVE (manual collapse mid-run): a
    full-width bar keeping the open panel's footprint. SETTLED: the quiet
    grayed pill at the bottom of the message — the "sources footer". Both
    reopen the row panel on tap. */
function CollapsedReceipt({
	live,
	label,
	progressLabel,
	failed,
	connectorSlugs,
	onlyConnectorSlug,
	onPress,
}: {
	live: boolean;
	label: string;
	progressLabel: string | null;
	failed: boolean;
	connectorSlugs: string[];
	onlyConnectorSlug: string | null;
	onPress: () => void;
}) {
	const danger = useThemeColor("danger");
	const muted = useThemeColor("muted");

	if (live) {
		return (
			<Pressable
				accessibilityRole="button"
				accessibilityState={{ expanded: false }}
				onPress={onPress}
				className="w-full flex-row items-center gap-2 rounded-full border border-accent/35 bg-accent/5 px-3.5 py-2"
			>
				<SpinnerArc size={14} />
				<Text
					numberOfLines={1}
					className="min-w-0 flex-1 font-sans-medium text-[12.5px] text-foreground"
					style={{ writingDirection: "auto" }}
				>
					{label}
				</Text>
				{progressLabel ? (
					<Text
						className="font-mono text-[10.5px] text-accent"
						style={{ writingDirection: "auto" }}
					>
						{progressLabel}
					</Text>
				) : null}
				<Ionicons name="chevron-down" size={12} color={muted} />
			</Pressable>
		);
	}

	return (
		<Pressable
			accessibilityRole="button"
			accessibilityState={{ expanded: false }}
			onPress={onPress}
			className="flex-row items-center gap-2 self-start rounded-full border border-border bg-surface px-3 py-1.5"
		>
			{failed ? (
				<Ionicons name="alert-circle-outline" size={13} color={danger} />
			) : (
				<ReceiptAvatars connectorSlugs={connectorSlugs} />
			)}
			<Text
				numberOfLines={1}
				className="text-[12px] text-muted"
				style={{ flexShrink: 1, writingDirection: "auto" }}
			>
				{label}
			</Text>
			{onlyConnectorSlug ? (
				<>
					<Text className="shrink-0 text-[12px] text-muted">·</Text>
					<Text
						numberOfLines={1}
						className="shrink-0 text-[12px] text-muted"
						style={{ writingDirection: "ltr" }}
					>
						{connectorDisplayName(onlyConnectorSlug)}
					</Text>
				</>
			) : null}
			<Ionicons name="chevron-down" size={11} color={muted} />
		</Pressable>
	);
}

/** Overlapping mini-avatars on the settled chip: the code badge plus up to
    two connector monograms (web parity with the -space-x-1 avatar stack). */
function ReceiptAvatars({ connectorSlugs }: { connectorSlugs: string[] }) {
	const muted = useThemeColor("muted");

	return (
		<View className="flex-row items-center">
			<View className="h-[18px] w-[18px] items-center justify-center rounded-full border border-border bg-surface-secondary">
				<Ionicons name="code-slash-outline" size={10} color={muted} />
			</View>
			{connectorSlugs.slice(0, 2).map((slug) => (
				<View
					key={slug}
					className="h-[18px] w-[18px] items-center justify-center rounded-full border border-border bg-surface-tertiary"
					style={{ marginStart: -4 }}
				>
					<Text
						className="font-mono-semibold text-[8px] text-muted"
						style={{ writingDirection: "ltr" }}
					>
						{connectorMonogram(slug)}
					</Text>
				</View>
			))}
		</View>
	);
}

function runConnectorSlugs(parts: McpToolPart[]): string[] {
	const slugs: string[] = [];
	for (const part of parts) {
		const slug = resolveConnectorSlug(part);
		if (slug && !slugs.includes(slug)) slugs.push(slug);
	}
	return slugs;
}

function runOnlyConnectorSlug(parts: McpToolPart[]): string | null {
	const connectorSlugs = new Set(parts.map(resolveConnectorSlug));
	if (connectorSlugs.size !== 1) return null;

	const [onlyConnectorSlug] = connectorSlugs;
	return onlyConnectorSlug ?? null;
}

function connectorMonogram(connectorSlug: string): string {
	return (
		CONNECTOR_MONOGRAMS[connectorSlug] ??
		connectorSlug
			.replace(/[^a-z0-9]/gi, "")
			.slice(0, 2)
			.toUpperCase()
	);
}

function ActivityRowView({
	row,
	showTopBorder,
	isLastAssistantMessage,
	isResponding,
	startedAt,
	toolLabels,
	onPrefillComposer,
	onApprovalResponse,
}: {
	row: ActivityRow;
	showTopBorder: boolean;
	isLastAssistantMessage: boolean;
	isResponding: boolean;
	startedAt?: string;
	toolLabels: ToolLabelDictionary;
	onPrefillComposer?: (prompt: string) => void;
	onApprovalResponse: (id: string, approved: boolean) => void;
}) {
	const { t } = useTranslation();
	const actionableApprovals = isLastAssistantMessage
		? row.parts.filter(
				(part) =>
					part.state === "approval-requested" && Boolean(part.approval?.id),
			)
		: [];
	const failedPart = row.parts.find((part) =>
		Boolean(readOutputWanditError(part.output)),
	);
	const wanditError = failedPart
		? readOutputWanditError(failedPart.output)
		: null;
	const errorPresentation = wanditError
		? chatErrorPresentation(null, wanditError, t)
		: null;
	const originalPrompt = failedPart
		? originalGenerationPrompt("connector", failedPart.input)
		: undefined;
	const statusLabel =
		row.status === "error" && errorPresentation
			? [errorPresentation.body, errorPresentation.attribution]
					.filter((line): line is string => Boolean(line))
					.join(" ")
			: activityStatusLabel(row.status, actionableApprovals.length > 0, t);

	return (
		<View
			className={`px-3.5 py-2.5 ${showTopBorder ? "border-border border-t" : ""} ${
				row.status === "running" ? "bg-accent/5" : ""
			}`}
		>
			<View className="flex-row items-start gap-2.5">
				<ActivityStatusIcon status={row.status} />
				<View className="min-w-0 flex-1 gap-1">
					<View className="flex-row items-center gap-2">
						<Text
							numberOfLines={1}
							className="min-w-0 flex-1 font-sans-medium text-[13px] text-foreground"
							style={{ writingDirection: "auto" }}
						>
							{row.label}
						</Text>
						{row.parts.length > 1 ? (
							<Text
								className="font-mono text-[10.5px] text-muted"
								style={{ writingDirection: "ltr" }}
							>
								×{row.parts.length}
							</Text>
						) : null}
						{row.connectorSlug ? (
							<ConnectorChip connectorSlug={row.connectorSlug} />
						) : null}
						{row.status === "running" && startedAt ? (
							<ElapsedTimer
								key={startedAt}
								since={startedAt}
								format="compact"
								className="shrink-0 font-mono text-[11px] text-accent"
							/>
						) : null}
					</View>
					<Text
						numberOfLines={2}
						className={
							row.status === "error"
								? "text-[11.5px] text-danger"
								: "text-[11.5px] text-muted"
						}
					>
						{statusLabel}
					</Text>
					{errorPresentation?.retryable &&
					originalPrompt &&
					onPrefillComposer ? (
						<View className="mt-1 items-start gap-1">
							<Pressable
								accessibilityRole="button"
								onPress={() => onPrefillComposer(originalPrompt)}
								className="min-h-9 items-center justify-center rounded-lg border border-border px-3 active:bg-surface-secondary"
							>
								<Text className="font-sans-semibold text-[12px] text-foreground">
									{t("native.workspace.chat.aiError.tryAgainPrefill.connector")}
								</Text>
							</Pressable>
							<Text className="text-[10.5px] text-muted leading-[15px]">
								{t("native.workspace.chat.aiError.tryAgainPrefill.hint")}
							</Text>
						</View>
					) : null}
				</View>
			</View>

			{actionableApprovals.map((part) => (
				<ApprovalControls
					key={part.approval?.id ?? part.toolCallId}
					part={part}
					isResponding={isResponding}
					toolLabels={toolLabels}
					onApprovalResponse={onApprovalResponse}
				/>
			))}
		</View>
	);
}

function ApprovalControls({
	part,
	isResponding,
	toolLabels,
	onApprovalResponse,
}: {
	part: McpToolPart;
	isResponding: boolean;
	toolLabels: ToolLabelDictionary;
	onApprovalResponse: (id: string, approved: boolean) => void;
}) {
	const { t } = useTranslation();
	const approvalId = part.approval?.id;
	const connectorSlug = resolveConnectorSlug(part);
	const argumentsPreview = primitiveArguments(part);
	const [argumentsExpanded, setArgumentsExpanded] = useState(false);
	const displayedArguments = argumentsExpanded
		? argumentsPreview
		: argumentsPreview.slice(0, ARGUMENT_PREVIEW_LIMIT);
	const hiddenArgumentCount =
		argumentsPreview.length - displayedArguments.length;
	const moreArgumentsLabel =
		hiddenArgumentCount > 0
			? t("workspace.chat.mcpTool.moreArguments", {
					count: hiddenArgumentCount,
				})
			: null;
	// Consent copy must use the LOCALIZED action label when one exists — the
	// raw humanized tool name would show English inside an FR/AR sentence for
	// a side-effectful action.
	const operationName = effectiveToolName(part);
	const action =
		toolLabels[operationName]?.active ?? humanizeToolName(operationName);

	if (!approvalId) return null;

	return (
		<View className="mt-3 gap-2.5 border-border border-t pt-3">
			<Text
				className="font-sans-medium text-[12.5px] text-foreground"
				style={{ writingDirection: "auto" }}
			>
				{t("workspace.chat.mcpTool.wantsTo", {
					action,
					connector: isHiggsfieldTikTokTool(part)
						? "TikTok"
						: connectorSlug
							? connectorDisplayName(connectorSlug)
							: t("workspace.chat.mcpTool.workingWith"),
				})}
			</Text>
			{argumentsPreview.length > 0 ? (
				<View className="gap-1.5">
					{displayedArguments.map((argument) => (
						<View key={argument.key} className="flex-row items-baseline gap-2">
							<Text
								numberOfLines={1}
								className="w-[34%] font-mono text-[10.5px] text-foreground/70"
								style={{ writingDirection: "ltr" }}
							>
								{humanizeToolName(argument.key)}
							</Text>
							<Text
								numberOfLines={1}
								className="min-w-0 flex-1 text-[11.5px] text-muted"
								style={{ writingDirection: "auto" }}
							>
								{argument.value}
							</Text>
						</View>
					))}
					{moreArgumentsLabel ? (
						<Pressable
							accessibilityLabel={moreArgumentsLabel}
							accessibilityRole="button"
							accessibilityState={{ expanded: false }}
							hitSlop={8}
							onPress={() => setArgumentsExpanded(true)}
							className="self-start"
						>
							<Text
								className="font-mono text-[10.5px] text-muted"
								style={{ writingDirection: "auto" }}
							>
								{moreArgumentsLabel}
							</Text>
						</Pressable>
					) : null}
				</View>
			) : null}
			<View className="flex-row gap-2">
				<Button
					className="h-8 min-h-0 px-3"
					isDisabled={isResponding}
					onPress={() => onApprovalResponse(approvalId, true)}
					size="sm"
					variant="primary"
				>
					<Button.Label className="text-[12px]">
						{t("workspace.chat.mcpTool.approve")}
					</Button.Label>
				</Button>
				<Button
					className="h-8 min-h-0 px-3"
					isDisabled={isResponding}
					onPress={() => onApprovalResponse(approvalId, false)}
					size="sm"
					variant="outline"
				>
					<Button.Label className="text-[12px]">
						{t("workspace.chat.mcpTool.deny")}
					</Button.Label>
				</Button>
			</View>
		</View>
	);
}

function ToolBadge() {
	const accent = useThemeColor("accent");

	return (
		<View className="h-5 w-5 items-center justify-center rounded-md bg-accent/10">
			<Ionicons name="code-slash-outline" size={12} color={accent} />
		</View>
	);
}

function ConnectorChip({ connectorSlug }: { connectorSlug: string }) {
	const muted = useThemeColor("muted");

	return (
		<Chip
			accessibilityRole="text"
			animation="disable-all"
			className="h-5 max-w-[42%] gap-1 px-1.5"
			color="default"
			size="sm"
			variant="secondary"
		>
			<Ionicons name="extension-puzzle-outline" size={10} color={muted} />
			<Chip.Label
				numberOfLines={1}
				className="font-sans text-[10px] text-muted"
				style={{ writingDirection: "ltr" }}
			>
				{connectorDisplayName(connectorSlug)}
			</Chip.Label>
		</Chip>
	);
}

function ActivityStatusIcon({ status }: { status: ActivityStatus }) {
	const accent = useThemeColor("accent");
	const danger = useThemeColor("danger");
	const muted = useThemeColor("muted");
	const success = useThemeColor("success");

	if (status === "running") {
		return (
			<View className="h-4 w-4 items-center justify-center">
				<SpinnerArc size={14} />
			</View>
		);
	}

	if (status === "done") {
		return (
			<View className="h-4 w-4 items-center justify-center rounded-full bg-success/15">
				<Ionicons name="checkmark" size={11} color={success} />
			</View>
		);
	}

	if (status === "error") {
		return <Ionicons name="alert-circle-outline" size={16} color={danger} />;
	}

	if (status === "denied" || status === "approval-denied") {
		return <Ionicons name="lock-closed-outline" size={15} color={muted} />;
	}

	if (status === "interrupted") {
		return <Ionicons name="remove-circle-outline" size={16} color={muted} />;
	}

	return <Ionicons name="shield-checkmark-outline" size={16} color={accent} />;
}

function parseMcpToolPart(value: unknown): McpToolPart | null {
	if (!isRecord(value) || value.type !== "dynamic-tool") return null;
	if (typeof value.toolName !== "string" || !value.toolName) return null;
	if (typeof value.toolCallId !== "string" || !value.toolCallId) return null;
	if (
		typeof value.state !== "string" ||
		!PART_STATES.has(value.state as McpToolPartState)
	) {
		return null;
	}

	const approval = parseApproval(value.approval);

	return {
		type: "dynamic-tool",
		toolName: value.toolName,
		toolCallId: value.toolCallId,
		state: value.state as McpToolPartState,
		input: value.input,
		output: value.output,
		approval,
	};
}

function parseApproval(value: unknown): McpToolPart["approval"] | undefined {
	if (!isRecord(value) || typeof value.id !== "string" || !value.id) {
		return undefined;
	}

	return {
		id: value.id,
		approved: typeof value.approved === "boolean" ? value.approved : undefined,
		reason: typeof value.reason === "string" ? value.reason : undefined,
	};
}

function collapseRows(
	parts: McpToolPart[],
	isTurnLive: boolean,
	toolLabels: ToolLabelDictionary,
	genericLabels: GenericLabelDictionary,
	t: ReturnType<typeof useTranslation>["t"],
): ActivityRow[] {
	const rows: ActivityRow[] = [];

	for (const part of parts) {
		const status = activityStatus(part, isTurnLive);
		const connectorSlug = resolveConnectorSlug(part);
		const label = activityLabel(part, status, toolLabels, genericLabels, t);
		const previous = rows[rows.length - 1];

		if (
			previous &&
			previous.status === status &&
			previous.connectorSlug === connectorSlug &&
			previous.label === label
		) {
			previous.parts.push(part);
		} else {
			rows.push({ connectorSlug, label, parts: [part], status });
		}
	}

	return rows;
}

function activityStatus(
	part: McpToolPart,
	isTurnLive: boolean,
): ActivityStatus {
	switch (part.state) {
		case "input-streaming":
		case "input-available":
			return isTurnLive ? "running" : "interrupted";
		case "approval-requested":
			return "approval-requested";
		case "approval-responded":
			if (!isTurnLive) return "interrupted";
			return part.approval?.approved ? "approval-approved" : "approval-denied";
		case "output-available":
			return isMcpErrorOutput(part.output) ? "error" : "done";
		case "output-error":
			return "error";
		case "output-denied":
			return "denied";
	}
}

function activityLabel(
	part: McpToolPart,
	status: ActivityStatus,
	toolLabels: ToolLabelDictionary,
	genericLabels: GenericLabelDictionary,
	t: ReturnType<typeof useTranslation>["t"],
) {
	const mode = status === "done" ? "past" : "active";
	const operationName = effectiveToolName(part);

	if (operationName === "search_platform_tools") {
		return mode === "past"
			? t("workspace.chat.mcpTool.searchedToolCatalog")
			: t("workspace.chat.mcpTool.searchingToolCatalog");
	}

	if (operationName === "describe_platform_tool") {
		return mode === "past"
			? t("workspace.chat.mcpTool.readToolDetails")
			: t("workspace.chat.mcpTool.readingToolDetails");
	}

	return (
		toolLabels[operationName]?.[mode] ??
		genericToolLabel(operationName, mode, genericLabels) ??
		humanizeToolName(operationName)
	);
}

/** Unknown tool names resolve through their verb to a localized generic
    class ("Fetched data") instead of raw Title Case (web parity). */
function genericToolLabel(
	operationName: string,
	mode: "active" | "past",
	genericLabels: GenericLabelDictionary,
): string | undefined {
	const tokens = tokenizeToolName(operationName);
	const verbToken = tokens.find((token) => VERB_GENERIC_CLASSES[token]);
	const labelClass =
		(verbToken ? VERB_GENERIC_CLASSES[verbToken] : undefined) ??
		(tokens.some((token) => CHECK_NOUNS.has(token)) ? "fetch" : "other");

	return genericLabels[labelClass]?.[mode];
}

function activityStatusLabel(
	status: ActivityStatus,
	isApprovalActionable: boolean,
	t: ReturnType<typeof useTranslation>["t"],
) {
	switch (status) {
		case "running":
			return t("workspace.chat.mcpTool.running");
		case "done":
			return t("workspace.chat.mcpTool.result");
		case "error":
			return t("workspace.chat.mcpTool.stepFailed");
		case "denied":
			return t("workspace.chat.mcpTool.skippedDeclined");
		case "interrupted":
			return t("workspace.chat.mcpTool.interrupted");
		case "approval-requested":
			return isApprovalActionable
				? t("workspace.chat.mcpTool.approvalTitle")
				: t("workspace.chat.mcpTool.expired");
		case "approval-approved":
			return `${t("workspace.chat.mcpTool.approved")} · ${t(
				"workspace.chat.mcpTool.waiting",
			)}`;
		case "approval-denied":
			return `${t("workspace.chat.mcpTool.denied")} · ${t(
				"workspace.chat.mcpTool.waiting",
			)}`;
	}
}

function isBackgroundGenerationPart(part: McpToolPart) {
	return (
		part.state === "output-available" &&
		isRecord(part.output) &&
		part.output.kind === "wandit_background_generation" &&
		typeof part.output.attemptId === "string" &&
		Boolean(part.output.attemptId)
	);
}

function resolveConnectorSlug(part: McpToolPart): string | null {
	const parsed = parseMcpToolName(part.toolName);
	const operationName = parsed?.toolName ?? part.toolName;

	if (
		PLATFORM_TOOL_WRAPPERS.has(operationName) &&
		isRecord(part.input) &&
		typeof part.input.connector === "string" &&
		part.input.connector.trim()
	) {
		return part.input.connector.trim();
	}

	return parsed?.connectorSlug ?? null;
}

function effectiveToolName(part: McpToolPart) {
	const operationName =
		parseMcpToolName(part.toolName)?.toolName ?? part.toolName;

	if (
		PLATFORM_TOOL_WRAPPERS.has(operationName) &&
		isRecord(part.input) &&
		typeof part.input.tool_name === "string" &&
		part.input.tool_name.trim()
	) {
		return (
			parseMcpToolName(part.input.tool_name)?.toolName ??
			part.input.tool_name.trim()
		);
	}

	return operationName;
}

function parseMcpToolName(toolName: string) {
	const match = MCP_TOOL_NAME_PATTERN.exec(toolName);
	if (!match?.[1] || !match[2]) return null;

	return {
		connectorSlug: match[1],
		toolName: match[2],
	};
}

function primitiveArguments(part: McpToolPart): PrimitiveArgument[] {
	const operationName =
		parseMcpToolName(part.toolName)?.toolName ?? part.toolName;
	const connectorSlug = resolveConnectorSlug(part);
	const source =
		PLATFORM_TOOL_WRAPPERS.has(operationName) &&
		isRecord(part.input) &&
		isRecord(part.input.params)
			? part.input.params
			: part.input;

	if (!isRecord(source)) return [];

	const preview: PrimitiveArgument[] = [];
	for (const [key, value] of Object.entries(source)) {
		if (key === "connector" || key === "tool_name" || key === "params") {
			continue;
		}

		const rendered = renderPrimitive(value);
		if (rendered === null) continue;
		preview.push(withAdBudgetUnit(connectorSlug, { key, value: rendered }));
	}

	return preview;
}

/** Money safety on the last screen before money moves: ad-platform budget
    numbers render with their real unit — "50" becomes "50 USD". */
function withAdBudgetUnit(
	connectorSlug: string | null,
	entry: PrimitiveArgument,
): PrimitiveArgument {
	if (!connectorSlug || !AD_CONNECTOR_SLUGS.has(connectorSlug)) return entry;
	if (!MONEY_ARGUMENT_KEY_PATTERN.test(entry.key)) return entry;
	if (!/^\d+(\.\d+)?$/.test(entry.value)) return entry;

	return { ...entry, value: `${entry.value} USD` };
}

// The TikTok publishing tools are served by the Higgsfield connector, but the
// approval card must name the platform the user recognizes.
function isHiggsfieldTikTokTool(part: McpToolPart): boolean {
	if (resolveConnectorSlug(part) !== "higgsfield") return false;
	return tokenizeToolName(effectiveToolName(part))[0] === "tiktok";
}

function renderPrimitive(value: unknown): string | null {
	if (value === null) return "null";
	if (
		typeof value !== "string" &&
		typeof value !== "number" &&
		typeof value !== "boolean"
	) {
		return null;
	}

	const rendered =
		typeof value === "string"
			? value.replace(/\s+/gu, " ").trim()
			: String(value);

	return rendered.length <= ARGUMENT_VALUE_LIMIT
		? rendered
		: `${rendered.slice(0, ARGUMENT_VALUE_LIMIT - 1)}…`;
}

function connectorDisplayName(connectorSlug: string) {
	return (
		CONNECTOR_DISPLAY_NAMES[connectorSlug] ?? humanizeToolName(connectorSlug)
	);
}

function humanizeToolName(value: string) {
	return value
		.replace(/([a-z0-9])([A-Z])/g, "$1 $2")
		.split(/[^A-Za-z0-9]+/u)
		.filter(Boolean)
		.map((token) => `${token.charAt(0).toUpperCase()}${token.slice(1)}`)
		.join(" ");
}

function isMcpErrorOutput(output: unknown): boolean {
	return isRecord(output) && output.isError === true;
}

function readOutputWanditError(output: unknown) {
	return isRecord(output) ? readAiErrorData(output.wanditError) : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return value !== null && typeof value === "object" && !Array.isArray(value);
}
