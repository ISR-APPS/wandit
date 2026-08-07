import { connectorGenerationQueuedOutputSchema } from "@wandit/contracts";
import { Badge } from "@wandit/ui/components/badge";
import { Button } from "@wandit/ui/components/button";
import { cn } from "@wandit/ui/lib/utils";
import type { ChatAddToolApproveResponseFunction } from "ai";
import {
	AlertTriangle,
	Check,
	ChevronDown,
	Code,
	LockKeyhole,
	Minus,
	Plug,
	ShieldCheck,
} from "lucide-react";
import { motion } from "motion/react";
import { useEffect, useRef, useState } from "react";

import { useDictionary, useTranslation } from "@/lib/i18n";
import type { WanditUIMessage } from "../../../lib/use-ai-chat";
import { SpinnerArc } from "../request-tray/tray-signals";
import { ChatMediaGallery } from "./chat-media";
import { ConnectorGenerationCard } from "./connector-generation-card";

export type McpToolPartValue = Extract<
	WanditUIMessage["parts"][number],
	{ type: "dynamic-tool" }
>;

type ApprovalRequestedPart = Extract<
	McpToolPartValue,
	{ state: "approval-requested" }
>;

type MediaPreview = {
	kind: "image" | "video";
	url: string;
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

export type McpActivityRow = {
	connectorSlug: string | null;
	label: string;
	parts: McpToolPartValue[];
	status: ActivityStatus;
};

type McpToolLabelTranslator = ReturnType<typeof useTranslation>["t"];
type McpToolLabels = Record<string, { active?: string; past?: string }>;
type McpGenericLabelClass =
	| "fetch"
	| "create"
	| "update"
	| "delete"
	| "publish"
	| "send"
	| "generate"
	| "other";
type McpGenericLabels = Record<
	McpGenericLabelClass,
	{ active: string; past: string }
>;

const MCP_TOOL_NAME_PATTERN = /^mcp_([A-Za-z0-9]+(?:-[A-Za-z0-9]+)*)_(.+)$/;
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
const MAX_ARGUMENT_PREVIEW_LENGTH = 72;
const SEARCH_PLATFORM_TOOLS = "search_platform_tools";
const DESCRIBE_PLATFORM_TOOL = "describe_platform_tool";
const RUN_PLATFORM_TOOL = "run_platform_tool";

const CONNECTOR_DISPLAY_NAMES: Record<string, string> = {
	"tiktok-ads": "TikTok Ads",
	"meta-ads": "Meta Ads",
	higgsfield: "Higgsfield",
};

// Tiny avatar letters for the settled receipt chip (mockup 14c: the code
// badge overlapped by a dark "TT" circle).
const CONNECTOR_MONOGRAMS: Record<string, string> = {
	"tiktok-ads": "TT",
	"meta-ads": "M",
	higgsfield: "HF",
};

function connectorMonogram(connectorSlug: string): string {
	return (
		CONNECTOR_MONOGRAMS[connectorSlug] ??
		connectorSlug
			.replace(/[^a-z0-9]/gi, "")
			.slice(0, 2)
			.toUpperCase()
	);
}

// "mcp" must never surface in a user-facing label, even from an unparseable
// tool name — the product never says MCP anywhere in the UI.
const NOISE_TOKENS = new Set(["api", "mcp", "tool"]);
const CHECK_NOUNS = new Set([
	"balance",
	"health",
	"insights",
	"status",
	"transactions",
]);

const VERB_LABELS: Record<string, { active: string; past: string }> = {
	get: { active: "Getting", past: "Got" },
	list: { active: "Listing", past: "Listed" },
	fetch: { active: "Fetching", past: "Fetched" },
	read: { active: "Reading", past: "Read" },
	query: { active: "Querying", past: "Queried" },
	search: { active: "Searching", past: "Searched" },
	show: { active: "Showing", past: "Shown" },
	check: { active: "Checking", past: "Checked" },
	view: { active: "Viewing", past: "Viewed" },
	retrieve: { active: "Retrieving", past: "Retrieved" },
	download: { active: "Downloading", past: "Downloaded" },
	export: { active: "Exporting", past: "Exported" },
	preview: { active: "Previewing", past: "Previewed" },
	explore: { active: "Exploring", past: "Explored" },
	describe: { active: "Describing", past: "Described" },
	create: { active: "Creating", past: "Created" },
	update: { active: "Updating", past: "Updated" },
	delete: { active: "Deleting", past: "Deleted" },
	publish: { active: "Publishing", past: "Published" },
	deploy: { active: "Deploying", past: "Deployed" },
	upload: { active: "Uploading", past: "Uploaded" },
	generate: { active: "Generating", past: "Generated" },
	boost: { active: "Boosting", past: "Boosted" },
	schedule: { active: "Scheduling", past: "Scheduled" },
	cancel: { active: "Cancelling", past: "Cancelled" },
	connect: { active: "Connecting", past: "Connected" },
	send: { active: "Sending", past: "Sent" },
};

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

const SETTLED_PART_STATES = new Set([
	"output-available",
	"output-error",
	"output-denied",
]);

/** Still doing (or waiting on) something the user should watch live. An
    expired approval on a historical message counts as settled, and a part
    stranded mid-flight in persisted history (tab closed during the call) is
    only "active" while its turn is actually streaming. */
function isActiveMcpPart(
	part: McpToolPartValue,
	isApprovalActionable: boolean,
	live: boolean,
): boolean {
	if (part.state === "approval-requested") return isApprovalActionable;
	// An answered approval is mid-handshake: the client auto-resubmits and the
	// stream picks the call back up, but the turn is NOT "streaming" during
	// that round-trip — treating it as settled would flap the panel closed
	// with an "Interrupted" label right after the user clicked Approve. Only
	// the actionable (last) message holds it live; a stranded response in
	// dead history settles to "interrupted".
	if (part.state === "approval-responded") return isApprovalActionable;
	if (SETTLED_PART_STATES.has(part.state)) return false;
	return live;
}

/** Every call in the run reached a terminal state (success, error, or
 * denied). Only such runs fold to the bottom of a finished message — a run
 * still mid-approval or mid-flight keeps its chronological spot. */
export function isMcpRunFullySettled(parts: McpToolPartValue[]): boolean {
	return parts.every((part) => SETTLED_PART_STATES.has(part.state));
}

/**
 * Whether this run produced anything to hand the user (media previews, live
 * generation cards) — those render at the bottom of the turn, under the
 * closing prose, while the receipt rows keep their chronological spot.
 */
export function mcpRunHasDeliverables(parts: McpToolPartValue[]): boolean {
	return parts.some((part) => {
		if (part.state !== "output-available") return false;
		if (connectorGenerationQueuedOutputSchema.safeParse(part.output).success) {
			return true;
		}
		return (
			!isInputEchoTool(part.toolName, part.input) &&
			findMediaPreviews(part.output).length > 0
		);
	});
}

export function McpActivityCard({
	parts,
	isApprovalActionable,
	onToolApprovalResponse,
	section = "all",
	isTurnLive = false,
	isRunConcluded = false,
}: {
	parts: McpToolPartValue[];
	isApprovalActionable: boolean;
	onToolApprovalResponse: ChatAddToolApproveResponseFunction;
	/** Which half renders: "receipt" (the tool rows, placed chronologically
	 * in the thread) or "deliverables" (media + generation cards, placed at
	 * the bottom of the turn). "all" renders both — tests and callers that
	 * do not split. */
	section?: "all" | "receipt" | "deliverables";
	/** Whether this message's turn is still streaming. When false, parts
	 * stranded mid-flight (tab closed during the call) render as interrupted
	 * receipts instead of a forever-running panel, and the panel does not
	 * flap closed between consecutive tool calls. */
	isTurnLive?: boolean;
	/** The model started writing prose AFTER this run (so no more calls will
	 * join it). Mid-stream, a concluded receipt animates out of the thread;
	 * it reappears as the bottom chip once the turn ends. */
	isRunConcluded?: boolean;
}) {
	const { t } = useTranslation();
	const dictionary = useDictionary();
	const mcpToolDictionary = dictionary.workspace.chat.mcpTool;
	const toolLabels = mcpToolDictionary.toolLabels as McpToolLabels;
	const genericLabels = mcpToolDictionary.genericLabels as McpGenericLabels;

	// Background generations (queued by the server intercept) get their own
	// live card below the activity list instead of a static ✓ row — the row
	// would read "done" while the provider is still generating.
	const backgroundGenerations = parts.flatMap((part) => {
		if (part.state !== "output-available") return [];
		const parsed = connectorGenerationQueuedOutputSchema.safeParse(part.output);
		return parsed.success ? [{ output: parsed.data, part }] : [];
	});
	const backgroundGenerationCallIds = new Set(
		backgroundGenerations.map((entry) => entry.part.toolCallId),
	);
	const visibleParts = parts.filter(
		(part) => !backgroundGenerationCallIds.has(part.toolCallId),
	);

	// Row statuses treat an answered approval on the actionable message as
	// live (the "Approved · Waiting to continue…" line), matching
	// isActiveMcpPart — otherwise the row would flash "Interrupted" while the
	// approved call resubmits.
	const rowsLive =
		isTurnLive ||
		(isApprovalActionable &&
			visibleParts.some((part) => part.state === "approval-responded"));
	const rows = collapseMcpActivityRows(
		visibleParts,
		t,
		toolLabels,
		genericLabels,
		rowsLive,
	);
	const connectorSlugs = new Set(
		parts.map(
			(part) => resolveMcpConnectorSlug(part.toolName, part.input) ?? "",
		),
	);
	const onlyConnectorSlug =
		connectorSlugs.size === 1 ? [...connectorSlugs][0] : undefined;
	const showConnectorOnRows = !onlyConnectorSlug;
	const isReceiptSection = section !== "deliverables";

	const runningParts = visibleParts.filter((part) =>
		isActiveMcpPart(part, isApprovalActionable, isTurnLive),
	);
	const isRunning = runningParts.length > 0;
	const doneCount = visibleParts.length - runningParts.length;
	// An actionable approval must never hide behind the collapsed pill — the
	// panel stays open (and non-collapsible) until it is answered.
	const hasActionableApproval =
		isApprovalActionable &&
		visibleParts.some((part) => part.state === "approval-requested");
	// The panel stays up for the whole live turn — a run of consecutive tool
	// calls has settled-only gaps between call N and call N+1, and the card
	// must not flap pill→panel through them. It folds when the turn ends.
	const holdOpen = isRunning || isTurnLive;

	// Collapsible: the inset panel while work runs, folded into a one-line
	// pill once the run settles (mockups 14b/14c). Manual toggle wins until
	// the next live/settled transition.
	const [open, setOpen] = useState(holdOpen);
	const previousHoldOpen = useRef(holdOpen);
	useEffect(() => {
		if (previousHoldOpen.current !== holdOpen) {
			previousHoldOpen.current = holdOpen;
			setOpen(holdOpen);
		}
	}, [holdOpen]);
	const panelOpen = open || hasActionableApproval;

	// The panel header and the collapsed bar are DIFFERENT buttons — a manual
	// toggle unmounts the one holding keyboard focus. Hand focus to the
	// counterpart so keyboard users are not dropped to <body>. Auto-folds
	// (run settles) deliberately leave focus alone.
	const panelToggleRef = useRef<HTMLButtonElement | null>(null);
	const barToggleRef = useRef<HTMLButtonElement | null>(null);
	const restoreToggleFocus = useRef(false);
	useEffect(() => {
		if (!restoreToggleFocus.current) return;
		restoreToggleFocus.current = false;
		(panelOpen ? panelToggleRef : barToggleRef).current?.focus();
	}, [panelOpen]);

	// Per-row elapsed clock, measured from when the client first saw the call
	// running (the stream carries no timestamps). Only the receipt instance
	// keeps a clock — the deliverables twin renders no rows.
	const startTimesRef = useRef(new Map<string, number>());
	const [now, setNow] = useState(() => Date.now());
	useEffect(() => {
		if (!isReceiptSection) return;
		const startTimes = startTimesRef.current;
		for (const part of visibleParts) {
			if (
				isActiveMcpPart(part, isApprovalActionable, isTurnLive) &&
				!startTimes.has(part.toolCallId)
			) {
				startTimes.set(part.toolCallId, Date.now());
			}
		}
	});
	useEffect(() => {
		if (!isReceiptSection || !isRunning || !panelOpen) return;
		const timer = setInterval(() => setNow(Date.now()), 250);
		return () => clearInterval(timer);
	}, [isReceiptSection, isRunning, panelOpen]);

	// Dedupe across the WHOLE run: the same URL echoed by two tool outputs
	// (import then generate) must render one gallery item, not two.
	const seenMediaUrls = new Set<string>();
	const media = visibleParts.flatMap((part) =>
		part.state === "output-available" &&
		!isInputEchoTool(part.toolName, part.input)
			? findMediaPreviews(part.output)
					.filter((preview) => {
						if (seenMediaUrls.has(preview.url)) return false;
						seenMediaUrls.add(preview.url);
						return true;
					})
					.map((preview, index) => ({
						...preview,
						key: `${part.toolCallId}:${index}:${preview.url}`,
						label: humanizeMcpToolLabel(
							part.toolName,
							part.input,
							"past",
							t,
							toolLabels,
							genericLabels,
						),
					}))
			: [],
	);

	const showReceipt = isReceiptSection && visibleParts.length > 0;
	const showDeliverables =
		section !== "receipt" &&
		(media.length > 0 || backgroundGenerations.length > 0);

	const currentPart = runningParts[0];
	const currentLabel = currentPart
		? humanizeMcpToolLabel(
				currentPart.toolName,
				currentPart.input,
				"active",
				t,
				toolLabels,
				genericLabels,
			)
		: null;
	const singleDonePart =
		visibleParts.length === 1 && visibleParts[0]?.state === "output-available"
			? visibleParts[0]
			: undefined;
	// The live pill narrates; the settled pill must stay truthful — count
	// only tools that actually EXECUTED, and name what happened when none
	// did (declined, expired approval, failed, interrupted).
	const executedCount = visibleParts.filter(
		(part) => part.state === "output-available",
	).length;
	const showLive = isRunning || (isTurnLive && visibleParts.length > 0);
	const pillLabel = showLive
		? (currentLabel ?? t("workspace.chat.mcpTool.workingWith"))
		: singleDonePart
			? humanizeMcpToolLabel(
					singleDonePart.toolName,
					singleDonePart.input,
					"past",
					t,
					toolLabels,
					genericLabels,
				)
			: executedCount === 1
				? t("workspace.chat.mcpTool.usedTool")
				: executedCount > 1
					? t("workspace.chat.mcpTool.usedTools", { count: executedCount })
					: visibleParts.every((part) => part.state === "output-denied")
						? t("workspace.chat.mcpTool.skippedDeclined")
						: visibleParts.some((part) => part.state === "approval-requested")
							? t("workspace.chat.mcpTool.expired")
							: visibleParts.some((part) => part.state === "output-error")
								? t("workspace.chat.mcpTool.stepFailed")
								: t("workspace.chat.mcpTool.interrupted");

	const rowElapsedLabel = (row: McpActivityRow): string | null => {
		if (row.status !== "running") return null;
		const activePart = row.parts.find((part) =>
			isActiveMcpPart(part, isApprovalActionable, isTurnLive),
		);
		const start = activePart
			? startTimesRef.current.get(activePart.toolCallId)
			: undefined;
		return start === undefined ? null : formatRowElapsed(now - start);
	};

	// The big-assistant lifecycle: the receipt narrates while tools run, then
	// — once the model starts writing the answer under it — it animates out
	// of the thread. It comes back as the quiet bottom chip when the turn
	// ends. An actionable approval (or an approved call resubmitting) is
	// never concealed.
	const receiptConcealed =
		isReceiptSection &&
		isTurnLive &&
		isRunConcluded &&
		!isRunning &&
		!hasActionableApproval;

	// Slugs actually present in the run — the settled chip stacks their tiny
	// monogram avatars next to the code badge (mockup 14c).
	const presentConnectorSlugs = [...connectorSlugs].filter(
		(slug) => slug !== "",
	);

	// Nothing to draw for this section (e.g. the receipt entry of a run whose
	// only call became a background generation) — no empty shell in the flow.
	if (!showReceipt && !showDeliverables) return null;

	return (
		<div className="flex flex-col items-stretch gap-2">
			{showReceipt ? (
				// The wrapper carries the conceal/reveal animation: a pure CSS
				// collapse (height+opacity), so the exit mid-stream and the
				// fade-in at the bottom need no JS timeline. The negative margin
				// swallows the column gap the zero-height shell would leave.
				<div
					className={cn(
						"transition-all duration-300 ease-out",
						receiptConcealed
							? "-my-[5px] max-h-0 overflow-hidden opacity-0"
							: "max-h-[1000px] opacity-100",
					)}
					aria-hidden={receiptConcealed || undefined}
				>
					{panelOpen ? (
						<div className="overflow-hidden rounded-[14px] border border-border bg-background">
							{hasActionableApproval ? (
								<div className="flex min-h-11 items-center gap-2 px-3.5 py-2.5">
									<ActivityHeaderContent
										isRunning={showLive}
										doneCount={doneCount}
										totalCount={visibleParts.length}
										connectorSlug={onlyConnectorSlug}
									/>
								</div>
							) : (
								<button
									type="button"
									ref={panelToggleRef}
									onClick={() => {
										restoreToggleFocus.current = true;
										setOpen(false);
									}}
									aria-expanded={true}
									className="flex min-h-11 w-full items-center gap-2 px-3.5 py-2.5 text-start"
								>
									<ActivityHeaderContent
										isRunning={showLive}
										doneCount={doneCount}
										totalCount={visibleParts.length}
										connectorSlug={onlyConnectorSlug}
									/>
									<ChevronDown
										aria-hidden
										className="size-3.5 shrink-0 rotate-180 text-muted-foreground transition-transform"
									/>
								</button>
							)}

							{/* The live rail sits between the header and the rows (mockup
						    14b: "live rail on top" — of the row list). It doubles as
						    the header/rows divider while the run works. */}
							{showLive ? <LiveRail /> : null}

							{rows.length > 0 ? (
								<div
									className={cn(
										"divide-y divide-border",
										!showLive && "border-border border-t",
									)}
								>
									{rows.map((row) => (
										<McpActivityRowItem
											key={row.parts[0]?.toolCallId}
											row={row}
											showConnector={showConnectorOnRows}
											isApprovalActionable={isApprovalActionable}
											onToolApprovalResponse={onToolApprovalResponse}
											toolLabels={toolLabels}
											genericLabels={genericLabels}
											elapsedLabel={rowElapsedLabel(row)}
										/>
									))}
								</div>
							) : null}
						</div>
					) : (
						// One-line receipt, two shapes. LIVE: a full-width bar keeping the
						// open panel's footprint (collapse changes height, never width).
						// SETTLED: a quiet grayed chip, start-aligned at the bottom of
						// the message — the "sources footer" pattern.
						<button
							type="button"
							ref={barToggleRef}
							onClick={() => {
								restoreToggleFocus.current = true;
								setOpen(true);
							}}
							aria-expanded={false}
							dir="auto"
							className={cn(
								"flex items-center gap-2 rounded-full border text-start transition-colors",
								showLive
									? "min-h-9 w-full border-primary/35 bg-primary/5 px-3.5 py-1.5 text-[12.5px]"
									: "w-fit max-w-full self-start border-border px-3 py-1.5 text-[12px] text-muted-foreground hover:bg-muted/40 hover:text-foreground",
							)}
						>
							{showLive ? (
								<SpinnerArc className="size-3 shrink-0" />
							) : (
								// Overlapping mini-avatars (mockup 14c): the ember code
								// badge with the connector monogram(s) stacked over it.
								<span className="flex shrink-0 items-center -space-x-1">
									<span className="grid size-4.5 shrink-0 place-items-center rounded-full bg-primary/10 text-ember-text ring-1 ring-background">
										<Code className="size-2.5" aria-hidden />
									</span>
									{presentConnectorSlugs.slice(0, 2).map((slug) => (
										<span
											key={slug}
											dir="ltr"
											className="grid size-4.5 shrink-0 place-items-center rounded-full bg-foreground font-semibold text-[7.5px] text-background ring-1 ring-background"
										>
											{connectorMonogram(slug)}
										</span>
									))}
								</span>
							)}
							<span
								className={cn(
									"min-w-0 truncate font-medium",
									showLive && "text-foreground",
								)}
							>
								{pillLabel}
							</span>
							{!showLive && onlyConnectorSlug ? (
								// The separator is its own flex item (not baked into the
								// LTR-forced name span) so it stays BETWEEN label and name
								// in RTL instead of sticking to the name's left edge.
								<>
									<span aria-hidden className="shrink-0">
										·
									</span>
									<span dir="ltr" className="shrink-0">
										{connectorDisplayName(onlyConnectorSlug)}
									</span>
								</>
							) : null}
							<span className="ms-auto flex shrink-0 items-center gap-2">
								{showLive ? (
									// dir="auto", not "ltr": the AR string "{done} من {total}"
									// is RTL text and forcing LTR garbles it.
									<span
										dir="auto"
										className="font-mono text-[10.5px] text-ember-text"
									>
										{t("workspace.chat.mcpTool.progressOf", {
											done: doneCount,
											total: visibleParts.length,
										})}
									</span>
								) : null}
								<ChevronDown
									aria-hidden
									className="size-3 shrink-0 text-muted-foreground"
								/>
							</span>
						</button>
					)}
				</div>
			) : null}

			{showDeliverables ? (
				<>
					{media.length > 0 ? <ChatMediaGallery items={media} /> : null}

					{backgroundGenerations.map(({ output, part }) => (
						<ConnectorGenerationCard
							key={part.toolCallId}
							attemptId={output.attemptId}
							realtime={output.realtime}
							title={humanizeMcpToolLabel(
								part.toolName,
								part.input,
								"active",
								t,
								toolLabels,
								genericLabels,
							)}
						/>
					))}
				</>
			) : null}
		</div>
	);
}

function ActivityHeaderContent({
	isRunning,
	doneCount,
	totalCount,
	connectorSlug,
}: {
	isRunning: boolean;
	doneCount: number;
	totalCount: number;
	connectorSlug: string | undefined;
}) {
	const { t } = useTranslation();

	return (
		<>
			{/* Left cluster grows so the progress meta (and the chevron after
			    this component) always sit flush at the end, mockup 14b style. */}
			<span className="flex min-w-0 flex-1 items-center gap-2">
				<span className="grid size-5 shrink-0 place-items-center rounded-[6px] bg-primary/10 text-ember-text">
					<Code className="size-3" aria-hidden />
				</span>
				<p className="min-w-0 truncate font-medium text-[13.5px] text-foreground">
					{t("workspace.chat.mcpTool.workingWith")}
				</p>
				{connectorSlug ? (
					<ConnectorBadge connectorSlug={connectorSlug} compact />
				) : null}
			</span>
			{isRunning ? (
				// dir="auto", not "ltr": AR renders "{done} من {total}".
				<span
					dir="auto"
					className="shrink-0 font-mono text-[11px] text-ember-text"
				>
					{t("workspace.chat.mcpTool.progressOf", {
						done: doneCount,
						total: totalCount,
					})}
				</span>
			) : totalCount >= 2 ? (
				<p dir="auto" className="shrink-0 text-[11px] text-muted-foreground">
					{t("workspace.chat.mcpTool.actionCount", { count: totalCount })}
				</p>
			) : null}
		</>
	);
}

/** Thin animated bar between the panel header and the rows while the run
    works. dir="ltr" pins the sweep's coordinate system: in an RTL page the
    percentage keyframes would anchor the segment to the right edge and make
    it teleport mid-bar every loop. */
function LiveRail() {
	return (
		<div dir="ltr" className="h-0.5 w-full overflow-hidden bg-muted">
			<motion.div
				className="h-full w-1/3 bg-gradient-ember"
				animate={{ x: ["-100%", "300%"] }}
				transition={{
					duration: 1.4,
					repeat: Number.POSITIVE_INFINITY,
					ease: "easeInOut",
				}}
			/>
		</div>
	);
}

function formatRowElapsed(elapsedMs: number): string {
	const seconds = Math.max(0, elapsedMs) / 1000;
	if (seconds < 10) return `${seconds.toFixed(1)}s`;
	if (seconds < 60) return `${Math.round(seconds)}s`;
	const minutes = Math.floor(seconds / 60);
	const rest = Math.round(seconds % 60);
	return `${minutes}:${String(rest).padStart(2, "0")}`;
}

function McpActivityRowItem({
	row,
	showConnector,
	isApprovalActionable,
	onToolApprovalResponse,
	toolLabels,
	genericLabels,
	elapsedLabel,
}: {
	row: McpActivityRow;
	showConnector: boolean;
	isApprovalActionable: boolean;
	onToolApprovalResponse: ChatAddToolApproveResponseFunction;
	toolLabels: McpToolLabels;
	genericLabels: McpGenericLabels;
	/** Live elapsed clock for the row currently running, e.g. "0.8s". */
	elapsedLabel?: string | null;
}) {
	return (
		<div className={cn(row.status === "running" && "bg-primary/[0.045]")}>
			<div className="flex w-full min-w-0 items-start gap-2.5 px-3.5 py-2.5">
				<ActivityStatusIcon status={row.status} />
				<div className="min-w-0 flex-1">
					<div className="flex min-w-0 items-center gap-2">
						{/* Label grows; every meta (×N, connector, timer) right-aligns
						    like mockup 14b's rows. */}
						<p
							dir="auto"
							className="min-w-0 flex-1 truncate font-medium text-[13px] text-foreground"
						>
							{row.label}
						</p>
						{row.parts.length > 1 ? (
							<span
								dir="ltr"
								className="shrink-0 font-mono text-[11px] text-muted-foreground"
							>
								× {row.parts.length}
							</span>
						) : null}
						{showConnector && row.connectorSlug ? (
							<ConnectorBadge connectorSlug={row.connectorSlug} compact />
						) : null}
						{elapsedLabel ? (
							<span
								dir="ltr"
								className="shrink-0 font-mono text-[11px] text-ember-text"
							>
								{elapsedLabel}
							</span>
						) : null}
					</div>
					<ActivityStatusLine
						row={row}
						isApprovalActionable={isApprovalActionable}
					/>
				</div>
			</div>

			{row.status === "approval-requested" && isApprovalActionable ? (
				<div className="px-3.5 pb-2.5">
					{row.parts.map((part) =>
						part.state === "approval-requested" ? (
							<ApprovalBlock
								key={part.toolCallId}
								part={part}
								onToolApprovalResponse={onToolApprovalResponse}
								toolLabels={toolLabels}
								genericLabels={genericLabels}
							/>
						) : null,
					)}
				</div>
			) : null}
		</div>
	);
}

function ConnectorBadge({
	connectorSlug,
	compact = false,
}: {
	connectorSlug: string;
	compact?: boolean;
}) {
	return (
		<Badge
			variant="outline"
			dir="ltr"
			className={cn(
				"h-6 max-w-full gap-1.5 px-2 font-normal text-[11px] text-muted-foreground",
				compact && "h-5 gap-1 px-1.5 text-[10px]",
			)}
		>
			<Plug className={compact ? "size-2.5" : "size-3"} aria-hidden />
			{connectorDisplayName(connectorSlug)}
		</Badge>
	);
}

function ActivityStatusIcon({ status }: { status: ActivityStatus }) {
	if (status === "running") {
		return <SpinnerArc className="mt-0.5 size-3.5" />;
	}

	if (status === "done") {
		return (
			<span className="mt-0.5 grid size-3.5 shrink-0 place-items-center rounded-full bg-success/16">
				<Check className="size-2 text-success" strokeWidth={3} aria-hidden />
			</span>
		);
	}

	if (status === "error") {
		return (
			<AlertTriangle
				className="mt-0.5 size-3.5 shrink-0 text-destructive"
				aria-hidden
			/>
		);
	}

	if (status === "denied" || status === "approval-denied") {
		return (
			<LockKeyhole
				className="mt-0.5 size-3.5 shrink-0 text-muted-foreground"
				aria-hidden
			/>
		);
	}

	if (status === "interrupted") {
		return (
			<span className="mt-0.5 grid size-3.5 shrink-0 place-items-center rounded-full bg-muted">
				<Minus
					className="size-2 text-muted-foreground"
					strokeWidth={3}
					aria-hidden
				/>
			</span>
		);
	}

	return (
		<ShieldCheck
			className="mt-0.5 size-3.5 shrink-0 text-ember-text"
			aria-hidden
		/>
	);
}

function ActivityStatusLine({
	row,
	isApprovalActionable,
}: {
	row: McpActivityRow;
	isApprovalActionable: boolean;
}) {
	const { t } = useTranslation();

	if (row.status === "error") {
		return (
			<p className="mt-1 text-[11.5px] text-destructive">
				{t("workspace.chat.mcpTool.stepFailed")}
			</p>
		);
	}

	if (row.status === "denied") {
		return (
			<p className="mt-1 text-[11.5px] text-muted-foreground">
				{t("workspace.chat.mcpTool.skippedDeclined")}
			</p>
		);
	}

	if (row.status === "interrupted") {
		return (
			<p className="mt-1 text-[11.5px] text-muted-foreground">
				{t("workspace.chat.mcpTool.interrupted")}
			</p>
		);
	}

	if (row.status === "approval-requested" && !isApprovalActionable) {
		return (
			<p className="mt-1 text-[11.5px] text-muted-foreground">
				{t("workspace.chat.mcpTool.expired")}
			</p>
		);
	}

	if (row.status === "approval-approved" || row.status === "approval-denied") {
		return (
			<p className="mt-1 text-[11.5px] text-muted-foreground">
				{row.status === "approval-approved"
					? t("workspace.chat.mcpTool.approved")
					: t("workspace.chat.mcpTool.denied")}
				{" · "}
				{t("workspace.chat.mcpTool.waiting")}
			</p>
		);
	}

	return null;
}

function ApprovalBlock({
	part,
	onToolApprovalResponse,
	toolLabels,
	genericLabels,
}: {
	part: ApprovalRequestedPart;
	onToolApprovalResponse: ChatAddToolApproveResponseFunction;
	toolLabels: McpToolLabels;
	genericLabels: McpGenericLabels;
}) {
	const { t } = useTranslation();
	const connectorSlug = resolveMcpConnectorSlug(part.toolName, part.input);
	const action = humanizeMcpToolLabel(
		part.toolName,
		part.input,
		"active",
		t,
		toolLabels,
		genericLabels,
	);
	const connector = connectorSlug
		? isHiggsfieldTikTokTool(connectorSlug, part.toolName, part.input)
			? "TikTok"
			: connectorDisplayName(connectorSlug)
		: t("workspace.chat.mcpTool.workingWith");
	const argumentsPreview = isPlatformToolWrapper(part.toolName)
		? isRecord(part.input) && isRecord(part.input.params)
			? summarizeTopLevelArguments(part.input.params).filter(
					({ key }) =>
						key !== "connector" && key !== "tool_name" && key !== "params",
				)
			: []
		: summarizeTopLevelArguments(part.input);

	return (
		<div className="mt-3 border-border border-t pt-3">
			<p dir="auto" className="font-medium text-[12.5px] text-foreground">
				{t("workspace.chat.mcpTool.wantsTo", { action, connector })}
			</p>
			{argumentsPreview.length > 0 ? (
				<ul className="mt-2 space-y-1 text-[11.5px] text-muted-foreground">
					{argumentsPreview.map(({ key, value }) => (
						<li key={key} className="flex min-w-0 items-baseline gap-2">
							<span
								dir="ltr"
								className="shrink-0 font-mono text-[10.5px] text-foreground/75"
							>
								{prettifyTokens(tokenizeToolName(key))}
							</span>
							<span dir="auto" className="min-w-0 truncate">
								{value}
							</span>
						</li>
					))}
				</ul>
			) : null}
			<div className="mt-3 flex flex-wrap gap-2">
				<Button
					type="button"
					size="sm"
					className="h-8 px-3 text-xs active:scale-[0.98]"
					onClick={() => {
						void onToolApprovalResponse({
							id: part.approval.id,
							approved: true,
						});
					}}
				>
					{t("workspace.chat.mcpTool.approve")}
				</Button>
				<Button
					type="button"
					variant="outline"
					size="sm"
					className="h-8 px-3 text-xs active:scale-[0.98]"
					onClick={() => {
						void onToolApprovalResponse({
							id: part.approval.id,
							approved: false,
						});
					}}
				>
					{t("workspace.chat.mcpTool.deny")}
				</Button>
			</div>
		</div>
	);
}

export function humanizeMcpToolLabel(
	toolName: string,
	input: unknown,
	mode: "active" | "past" = "active",
	t?: McpToolLabelTranslator,
	toolLabels?: McpToolLabels,
	genericLabels?: McpGenericLabels,
): string {
	let operationName = parseMcpToolName(toolName)?.toolName ?? toolName;
	const operationTokens = tokenizeToolName(operationName);

	if (operationName === SEARCH_PLATFORM_TOOLS) {
		return mode === "past"
			? (t?.("workspace.chat.mcpTool.searchedToolCatalog") ??
					"Searched the tool catalog")
			: (t?.("workspace.chat.mcpTool.searchingToolCatalog") ??
					"Searching the tool catalog");
	}

	if (operationName === DESCRIBE_PLATFORM_TOOL) {
		const label =
			mode === "past"
				? (t?.("workspace.chat.mcpTool.readToolDetails") ?? "Read tool details")
				: (t?.("workspace.chat.mcpTool.readingToolDetails") ??
					"Reading tool details");
		const nestedToolName = getNestedToolName(input);

		if (!nestedToolName) return label;

		if (toolLabels) {
			const nestedOperationName =
				parseMcpToolName(nestedToolName)?.toolName ?? nestedToolName;
			const nestedLabel = toolLabels[nestedOperationName]?.[mode];
			return nestedLabel ? `${label} · ${nestedLabel}` : label;
		}

		return `${label} · ${humanizeMcpToolLabel(
			nestedToolName,
			undefined,
			mode,
			t,
		)}`;
	}

	if (
		operationName === RUN_PLATFORM_TOOL ||
		(operationTokens.length === 2 &&
			operationTokens[0] === "tool" &&
			operationTokens[1] === "execute")
	) {
		const nestedToolName = getNestedToolName(input);
		if (nestedToolName) {
			operationName =
				parseMcpToolName(nestedToolName)?.toolName ?? nestedToolName;
		}
	}

	const localizedLabel = toolLabels?.[operationName]?.[mode];
	if (localizedLabel) return localizedLabel;

	const tokens = tokenizeToolName(operationName).filter(
		(token) => !NOISE_TOKENS.has(token),
	);
	const verbIndex = tokens.findIndex((token) => VERB_LABELS[token]);

	if (toolLabels) {
		const verbToken = tokens[verbIndex];
		const genericClass =
			(verbToken ? VERB_GENERIC_CLASSES[verbToken] : undefined) ??
			(tokens.some((token) => CHECK_NOUNS.has(token)) ? "fetch" : "other");
		return (
			genericLabels?.[genericClass]?.[mode] ?? genericLabels?.other[mode] ?? ""
		);
	}

	if (verbIndex >= 0) {
		const verb = VERB_LABELS[tokens[verbIndex] ?? ""];
		const subject = tokens.filter((_, index) => index !== verbIndex).join(" ");
		return subject ? `${verb?.[mode]} ${subject}` : (verb?.[mode] ?? "");
	}

	const checkNounIndex = tokens.findIndex((token) => CHECK_NOUNS.has(token));
	if (checkNounIndex >= 0) {
		const remaining = tokens.filter((_, index) => index !== checkNounIndex);
		const subject =
			remaining.length > 0
				? remaining.join(" ")
				: (tokens[checkNounIndex] ?? "");
		return `${mode === "past" ? "Checked" : "Checking"} ${subject}`.trim();
	}

	return prettifyTokens(tokens) || prettifyTokens(operationTokens);
}

export function collapseMcpActivityRows(
	parts: McpToolPartValue[],
	t?: McpToolLabelTranslator,
	toolLabels?: McpToolLabels,
	genericLabels?: McpGenericLabels,
	live = true,
): McpActivityRow[] {
	const rows: McpActivityRow[] = [];

	for (const part of parts) {
		const connectorSlug = resolveMcpConnectorSlug(part.toolName, part.input);
		const status = activityStatus(part, live);
		const label = activityLabel(part, status, t, toolLabels, genericLabels);
		const previous = rows[rows.length - 1];

		if (
			previous &&
			previous.connectorSlug === connectorSlug &&
			previous.label === label &&
			previous.status === status
		) {
			previous.parts.push(part);
			continue;
		}

		rows.push({ connectorSlug, label, parts: [part], status });
	}

	return rows;
}

export function parseMcpToolName(toolName: string) {
	const match = MCP_TOOL_NAME_PATTERN.exec(toolName);
	if (!match?.[1] || !match[2]) return null;

	return {
		connectorSlug: match[1],
		toolName: match[2],
	};
}

function resolveMcpConnectorSlug(
	toolName: string,
	input: unknown,
): string | null {
	const parsedToolName = parseMcpToolName(toolName);
	const operationName = parsedToolName?.toolName ?? toolName;

	if (
		operationName === RUN_PLATFORM_TOOL &&
		isRecord(input) &&
		typeof input.connector === "string"
	) {
		const connectorSlug = input.connector.trim();
		if (connectorSlug) return connectorSlug;
	}

	return parsedToolName?.connectorSlug ?? null;
}

function activityStatus(part: McpToolPartValue, live: boolean): ActivityStatus {
	switch (part.state) {
		case "input-streaming":
		case "input-available":
			// Stranded mid-flight in persisted history (the tab closed during
			// the call): render an honest receipt, never a forever-spinner.
			return live ? "running" : "interrupted";
		case "approval-requested":
			return "approval-requested";
		case "approval-responded":
			if (!live) return "interrupted";
			return part.approval.approved ? "approval-approved" : "approval-denied";
		case "output-available":
			return "done";
		case "output-error":
			return "error";
		case "output-denied":
			return "denied";
	}
}

function activityLabel(
	part: McpToolPartValue,
	status: ActivityStatus,
	t?: McpToolLabelTranslator,
	toolLabels?: McpToolLabels,
	genericLabels?: McpGenericLabels,
): string {
	const mode = status === "done" ? "past" : "active";
	const label = humanizeMcpToolLabel(
		part.toolName,
		part.input,
		mode,
		t,
		toolLabels,
		genericLabels,
	);
	return status === "running" ||
		status === "approval-approved" ||
		status === "approval-denied"
		? `${label}…`
		: label;
}

function connectorDisplayName(connectorSlug: string): string {
	return (
		CONNECTOR_DISPLAY_NAMES[connectorSlug] ??
		prettifyTokens(tokenizeToolName(connectorSlug))
	);
}

// The TikTok publishing tools are served by the Higgsfield connector, but the
// approval card must name the platform the user recognizes.
function isHiggsfieldTikTokTool(
	connectorSlug: string,
	toolName: string,
	input: unknown,
): boolean {
	if (connectorSlug !== "higgsfield") return false;

	const operationName = parseMcpToolName(toolName)?.toolName ?? toolName;
	const effectiveName = isPlatformToolWrapper(toolName)
		? (getNestedToolName(input) ?? operationName)
		: operationName;

	return tokenizeToolName(effectiveName)[0] === "tiktok";
}

function tokenizeToolName(value: string): string[] {
	return value
		.replace(/([a-z0-9])([A-Z])/g, "$1_$2")
		.replace(/([A-Z]+)([A-Z][a-z])/g, "$1_$2")
		.split(/[^A-Za-z0-9]+/u)
		.filter(Boolean)
		.map((token) => token.toLowerCase());
}

function prettifyTokens(tokens: string[]): string {
	return tokens
		.map((token) => `${token.charAt(0).toUpperCase()}${token.slice(1)}`)
		.join(" ");
}

function getNestedToolName(input: unknown): string | null {
	return isRecord(input) && typeof input.tool_name === "string"
		? input.tool_name
		: null;
}

function isPlatformToolWrapper(toolName: string): boolean {
	const operationName = parseMcpToolName(toolName)?.toolName ?? toolName;
	const tokens = tokenizeToolName(operationName);

	return (
		operationName === RUN_PLATFORM_TOOL ||
		(tokens.length === 2 && tokens[0] === "tool" && tokens[1] === "execute")
	);
}

// Import/upload tools echo back media the user (or a previous step) already
// provided — previewing them would duplicate the source right above its own
// derived result, so their outputs never surface media.
const INPUT_ECHO_TOKENS = new Set(["import", "upload"]);

function isInputEchoTool(toolName: string, input: unknown): boolean {
	const operationName = parseMcpToolName(toolName)?.toolName ?? toolName;
	const effectiveName = isPlatformToolWrapper(toolName)
		? (getNestedToolName(input) ?? operationName)
		: operationName;

	return tokenizeToolName(effectiveName).some((token) =>
		INPUT_ECHO_TOKENS.has(token),
	);
}

function summarizeTopLevelArguments(input: unknown) {
	if (!isRecord(input)) return [];

	return Object.entries(input).map(([key, value]) => ({
		key,
		value: summarizeArgumentValue(value),
	}));
}

function summarizeArgumentValue(value: unknown): string {
	if (value !== null && typeof value === "object") return "…";
	if (value === undefined || typeof value === "function") return "…";

	const rendered =
		typeof value === "string"
			? value.replace(/\s+/gu, " ").trim()
			: String(value);
	if (rendered.length <= MAX_ARGUMENT_PREVIEW_LENGTH) return rendered;

	return `${rendered.slice(0, MAX_ARGUMENT_PREVIEW_LENGTH - 1)}…`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return value !== null && typeof value === "object" && !Array.isArray(value);
}

function findMediaPreviews(output: unknown): MediaPreview[] {
	const previews: MediaPreview[] = [];
	const seenObjects = new WeakSet<object>();
	const seenUrls = new Set<string>();

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
