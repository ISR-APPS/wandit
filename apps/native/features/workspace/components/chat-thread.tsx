import {
	useDictionary,
	useTranslation,
} from "@wandit/internationalization/react";
import { useThemeColor } from "heroui-native";
import { useRef, useState } from "react";
import { Image, Linking, Pressable, Text, View } from "react-native";
import Animated, {
	type CSSAnimationKeyframes,
	useReducedMotion,
} from "react-native-reanimated";

import { WanditIcon } from "@/components/wandit-icon";
import {
	coalesceMessageParts,
	entryRendersContent,
	isTransparentMessagePart,
	type MessagePartRecord,
	orderMessagePartEntries,
	parseAskUserParts,
	parseFilePart,
	partConcludesRun,
} from "../lib/chat-message";
import type { WanditUIMessage } from "../lib/use-ai-chat";
import { useAnimatedText } from "../lib/use-animated-text";
import { AskUserGroupCard } from "./ask-user-card";
import {
	AsyncGenerationCard,
	type AsyncGenerationKind,
} from "./async-generation-card";
import { ChatMessageTokenUsage } from "./chat-dev-diagnostics";
import { ChatMarkdown } from "./chat-markdown";
import { ChatMediaViewer } from "./chat-media";
import { McpToolRun } from "./mcp-tool-run";
import { TargetChip } from "./target-chip";

type ChatStatus = "submitted" | "streaming" | "ready" | "error";
type ApprovalResponse = { id: string; approved: boolean; reason?: string };

const ASYNC_KIND_BY_TYPE: Record<string, AsyncGenerationKind | undefined> = {
	"tool-generate_page": "page",
	"tool-generate_marketing_asset": "marketing",
	"tool-generate_image": "image",
	"tool-scrape_leads": "leads",
	"tool-animate_image": "animate",
	"tool-generate_video": "video",
};

const THINKING_DOT_DELAYS = [-300, -150, 0] as const;
const THINKING_DOT_BOUNCE: CSSAnimationKeyframes = {
	"0%": { transform: [{ translateY: 0 }] },
	"40%": { transform: [{ translateY: -3 }] },
	"80%": { transform: [{ translateY: 0 }] },
	"100%": { transform: [{ translateY: 0 }] },
};

const warnedPartTypes = new Set<string>();

function warnUnknownPart(type: string) {
	if (!__DEV__ || warnedPartTypes.has(type)) return;

	warnedPartTypes.add(type);
	console.warn(`[ai-chat] No renderer registered for message part: ${type}`);
}

export function UserBubble({ text }: { text: string }) {
	return (
		<View className="max-w-[78%] self-end rounded-[18px] rounded-ee-[5px] bg-surface-secondary px-3.5 py-[11px] dark:bg-surface-tertiary">
			<Text
				className="text-[14.5px] text-foreground leading-[21px]"
				style={{ writingDirection: "auto" }}
			>
				{text}
			</Text>
		</View>
	);
}

export function AssistantText({ text }: { text: string }) {
	// Assistant turns stream GFM markdown — rendered, not shown raw (web parity
	// with Streamdown in real-message.tsx).
	return <ChatMarkdown text={text} />;
}

/**
 * Streaming assistant prose: a code-point cursor glides toward the current
 * text length so chunky network arrivals read as steady typing, with a block
 * caret riding the tail (web parity with text-part.tsx + useAnimatedText).
 */
function StreamingAssistantText({
	text,
	isStreaming,
}: {
	text: string;
	isStreaming: boolean;
}) {
	// Latch, not a live flag: once this part has streamed, keep the animated
	// reveal on even after the stream ends, so the cursor finishes its
	// catch-up tail instead of snapping to the full text. Parts mounted from
	// history never animate.
	const hasStreamed = useRef(isStreaming);
	if (isStreaming) hasStreamed.current = true;

	const revealed = useAnimatedText(text, hasStreamed.current);
	const animating = isStreaming || revealed !== text;

	return (
		<ChatMarkdown
			text={animating && shouldShowCaret(revealed) ? `${revealed} ▋` : revealed}
		/>
	);
}

/** The caret would corrupt an open code fence and reads as junk inside a
 * table row — suppress it there (web parity with the block-caret rule). */
function shouldShowCaret(text: string): boolean {
	const fenceCount = (text.match(/```/g) ?? []).length;
	if (fenceCount % 2 === 1) return false;
	const lastLine = text.slice(text.lastIndexOf("\n") + 1);
	return !lastLine.trimStart().startsWith("|");
}

function WanditHeader() {
	const accent = useThemeColor("accent");
	return (
		<View className="flex-row items-center gap-2">
			<View className="h-[22px] w-[22px] items-center justify-center rounded-full border border-accent/40 bg-accent/12">
				<WanditIcon name="spark" size={12} color={accent} />
			</View>
			<Text className="font-mono text-[10px] text-muted">wandit</Text>
		</View>
	);
}

/** CSV/XLSX chips get a spreadsheet glyph; everything else the page glyph. */
function documentIconName(mediaType: string): "spreadsheet" | "page" {
	return mediaType === "text/csv" ||
		mediaType ===
			"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
		? "spreadsheet"
		: "page";
}

function FilePart({ value, alignEnd }: { value: unknown; alignEnd: boolean }) {
	const part = parseFilePart(value);
	const muted = useThemeColor("muted");
	const [viewerOpen, setViewerOpen] = useState(false);
	if (!part) return null;

	if (part.mediaType.startsWith("image/")) {
		return (
			<>
				<Pressable
					accessibilityRole="imagebutton"
					accessibilityLabel={part.filename ?? "Image"}
					onPress={() => setViewerOpen(true)}
					className={`w-[172px] overflow-hidden rounded-[14px] border border-border bg-surface-secondary active:opacity-85 ${
						alignEnd ? "self-end" : ""
					}`}
				>
					<Image
						source={{ uri: part.url }}
						resizeMode="cover"
						className="h-[132px] w-full"
						accessibilityLabel={part.filename ?? "Image"}
					/>
				</Pressable>
				{viewerOpen ? (
					<ChatMediaViewer
						items={[
							{
								key: part.url,
								kind: "image",
								url: part.url,
								label: part.filename ?? "Image",
							},
						]}
						index={0}
						onNavigate={() => undefined}
						onClose={() => setViewerOpen(false)}
					/>
				) : null}
			</>
		);
	}

	return (
		<Pressable
			accessibilityRole="link"
			onPress={() => {
				void Linking.openURL(part.url).catch(() => undefined);
			}}
			className={`max-w-[82%] flex-row items-center gap-2 rounded-[12px] border border-border bg-surface px-3 py-2.5 active:bg-surface-secondary ${
				alignEnd ? "self-end" : ""
			}`}
		>
			<WanditIcon
				name={documentIconName(part.mediaType)}
				size={15}
				color={muted}
			/>
			<Text
				numberOfLines={1}
				className="flex-1 text-[12.5px] text-foreground"
				style={{ writingDirection: "auto" }}
			>
				{part.filename ?? part.mediaType}
			</Text>
		</Pressable>
	);
}

/**
 * Consecutive image attachments in one turn: a single image keeps the plain
 * tile; two or more become a two-column square grid (web parity with
 * file-part.tsx's ImageFileGrid). Tapping a tile opens the full-screen
 * viewer at that image, with the whole run swipeable.
 */
function ImageFileGrid({
	parts,
	alignEnd,
}: {
	parts: readonly unknown[];
	alignEnd: boolean;
}) {
	const [viewerIndex, setViewerIndex] = useState<number | null>(null);
	const files = parts
		.map((value) => parseFilePart(value))
		.filter((file): file is NonNullable<typeof file> => file !== null);

	if (files.length === 0) return null;
	if (files.length === 1) {
		return <FilePart value={parts[0]} alignEnd={alignEnd} />;
	}

	// Duplicate URLs are legal (the same asset attached twice) — key by
	// occurrence index as well so React never collapses them.
	return (
		<>
			<View
				className={`w-[86%] flex-row flex-wrap gap-1.5 ${
					alignEnd ? "justify-end self-end" : ""
				}`}
			>
				{files.map((file, index) => (
					<Pressable
						// biome-ignore lint/suspicious/noArrayIndexKey: duplicate URLs are legal; the occurrence index disambiguates them
						key={`${file.url}:${index}`}
						accessibilityRole="imagebutton"
						accessibilityLabel={file.filename ?? "Image"}
						onPress={() => setViewerIndex(index)}
						className="aspect-square w-[48%] overflow-hidden rounded-[14px] border border-border bg-surface-secondary active:opacity-85"
					>
						<Image
							source={{ uri: file.url }}
							resizeMode="cover"
							style={{ width: "100%", height: "100%" }}
							accessibilityLabel={file.filename ?? "Image"}
						/>
					</Pressable>
				))}
			</View>
			{viewerIndex !== null ? (
				<ChatMediaViewer
					items={files.map((file, index) => ({
						key: `${file.url}:${index}`,
						kind: "image" as const,
						url: file.url,
						label: file.filename ?? "Image",
					}))}
					index={viewerIndex}
					onNavigate={setViewerIndex}
					onClose={() => setViewerIndex(null)}
				/>
			) : null}
		</>
	);
}

function ChatMessageParts({
	message,
	messageIndex,
	messageCount,
	status,
	projectId,
	activeAskToolCallId,
	onToolApprovalResponse,
}: {
	message: WanditUIMessage;
	messageIndex: number;
	messageCount: number;
	status: ChatStatus;
	projectId: string;
	activeAskToolCallId?: string;
	onToolApprovalResponse: (response: ApprovalResponse) => void;
}) {
	const { t } = useTranslation();
	const turnLive =
		(status === "submitted" || status === "streaming") &&
		messageIndex === messageCount - 1;
	const isLastAssistantMessage =
		message.role === "assistant" && messageIndex === messageCount - 1;

	// Live turn: tool receipts narrate chronologically. Done turn: settled
	// runs fold into the quiet pill at the bottom of the message.
	const entries = orderMessagePartEntries(coalesceMessageParts(message.parts), {
		receiptsAtBottom: !turnLive,
	});
	if (!entries.some(entryRendersContent)) return null;

	// A run is "concluded" once anything visible renders after it — prose, a
	// question round, the next batch of calls — because the coalescer then
	// guarantees no further call can join it. Mid-stream, a concluded receipt
	// animates out of the thread and returns as the bottom pill when the turn
	// ends.
	const isRunConcluded = (runParts: MessagePartRecord[]): boolean => {
		const lastPart = runParts[runParts.length - 1];
		if (!lastPart) return false;
		const allParts: readonly unknown[] = message.parts;
		const lastIndex = allParts.lastIndexOf(lastPart);
		if (lastIndex < 0) return false;
		return allParts.slice(lastIndex + 1).some(partConcludesRun);
	};

	// Only the turn that OWNS the docked ask marks its later pending asks as
	// waiting ("Up next"). Unanswered asks stranded in older messages render
	// nothing special — the server repairs those on the next send.
	const activeAskPartIndex = activeAskToolCallId
		? (parseAskUserParts(message.parts).find(
				(ask) => ask.toolCallId === activeAskToolCallId,
			)?.index ?? -1)
		: -1;
	const ownsActiveAsk = activeAskPartIndex >= 0;

	const rendered = entries.map((entry) => {
		if (entry.kind === "image-run") {
			return (
				<ImageFileGrid
					key={`${message.id}:image-run:${entry.firstIndex}`}
					parts={entry.parts}
					alignEnd={message.role === "user"}
				/>
			);
		}

		if (entry.kind === "ask-run") {
			const asks = parseAskUserParts(entry.parts);
			if (asks.length === 0) return null;
			return (
				<AskUserGroupCard
					key={asks[0]?.toolCallId ?? `ask:${entry.firstIndex}`}
					parts={asks}
					activeAskToolCallId={activeAskToolCallId}
					ownsActiveAsk={ownsActiveAsk}
					isAfterActiveAsk={
						activeAskPartIndex >= 0 && entry.firstIndex > activeAskPartIndex
					}
				/>
			);
		}

		if (entry.kind === "mcp-run") {
			return (
				<McpToolRun
					key={`mcp:${entry.firstIndex}:${entry.section}`}
					parts={entry.parts}
					projectId={projectId}
					isTurnLive={turnLive}
					isRunConcluded={isRunConcluded(entry.parts)}
					section={entry.section}
					isLastAssistantMessage={isLastAssistantMessage}
					onApprovalResponse={onToolApprovalResponse}
				/>
			);
		}

		const { part, index } = entry;
		if (part.type === "text") {
			if (typeof part.text !== "string" || !part.text) return null;
			if (message.role === "user") {
				return <UserBubble key={`${message.id}:${index}`} text={part.text} />;
			}
			const isLastPart = index === message.parts.length - 1;
			return (
				<StreamingAssistantText
					key={`${message.id}:${index}`}
					text={part.text}
					isStreaming={part.state === "streaming" || (turnLive && isLastPart)}
				/>
			);
		}

		if (part.type === "file") {
			return (
				<FilePart
					key={`${message.id}:${index}`}
					value={part}
					alignEnd={message.role === "user"}
				/>
			);
		}

		const asyncKind = ASYNC_KIND_BY_TYPE[part.type];
		if (asyncKind) {
			return (
				<AsyncGenerationCard
					key={
						typeof part.toolCallId === "string"
							? part.toolCallId
							: `${message.id}:${index}`
					}
					kind={asyncKind}
					projectId={projectId}
					part={{
						state: part.state,
						input: part.input,
						output: part.output,
						errorText: part.errorText,
					}}
				/>
			);
		}

		if (isTransparentMessagePart(part)) {
			return null;
		}

		// Unknown AI SDK and future part types are forward-compatible no-ops —
		// but loud in dev so the next contract addition is noticed immediately.
		warnUnknownPart(part.type);
		return null;
	});

	if (message.role === "user") {
		// Selected-target snapshots ride user-turn metadata: newer sends carry
		// selectedTargets, older turns persisted the single selectedTarget.
		return (
			<View className="gap-2">
				{message.metadata?.selectedTargets ? (
					<View className="flex-row flex-wrap justify-end gap-1.5">
						{message.metadata.selectedTargets.map((target, index) => (
							<View
								key={target.wid}
								className="min-w-0 flex-row items-center gap-1"
							>
								{/* The chip label already announces the index — the visual
								    numeral is decoration (web parity: aria-hidden). */}
								<Text
									accessibilityElementsHidden
									importantForAccessibility="no"
									className="shrink-0 text-[12px] text-accent"
								>
									{String.fromCodePoint(0x2460 + index)}
								</Text>
								<TargetChip
									target={target}
									accessibleLabel={`${t("workspace.page.editor.selectedElement")} ${index + 1}`}
								/>
							</View>
						))}
					</View>
				) : message.metadata?.selectedTarget ? (
					<View className="flex-row justify-end">
						<TargetChip
							target={message.metadata.selectedTarget}
							accessibleLabel={t("workspace.page.editor.selectedElement")}
						/>
					</View>
				) : null}
				{rendered}
			</View>
		);
	}

	return (
		<View className="gap-[9px]">
			<WanditHeader />
			{rendered}
			{__DEV__ && message.metadata?.usage ? (
				<ChatMessageTokenUsage usage={message.metadata.usage} />
			) : null}
		</View>
	);
}

export function ChatEmptyState({
	onSuggestion,
}: {
	/** Sends the tapped suggestion immediately (it does not fill the composer). */
	onSuggestion?: (suggestion: string) => void;
}) {
	const { t } = useTranslation();
	const dictionary = useDictionary();
	const accent = useThemeColor("accent");
	// Raw array, not t(): the suggestions are a list, not a single string.
	const suggestions = dictionary.workspace.chat.suggestions;

	return (
		<View className="flex-1 items-center justify-center px-7">
			<View className="w-full items-center">
				<View
					accessibilityElementsHidden
					importantForAccessibility="no-hide-descendants"
					className="opacity-60"
				>
					<WanditIcon name="spark" size={20} color={accent} />
				</View>
				<Text className="mt-2 font-display text-[17px] text-foreground">
					{t("workspace.chat.emptyTitle")}
				</Text>
				<Text
					className="mt-1 max-w-[260px] text-center text-[13px] text-muted leading-5"
					style={{ writingDirection: "auto" }}
				>
					{t("workspace.chat.emptyBody")}
				</Text>
				{onSuggestion ? (
					<>
						<Text
							className="mt-5 font-mono text-[10px] text-muted/70 uppercase"
							style={{ letterSpacing: 1.4 }}
						>
							{t("workspace.chat.suggestionsKicker")}
						</Text>
						<View className="mt-2 w-full gap-2">
							{suggestions.map((suggestion) => (
								<Pressable
									key={suggestion}
									accessibilityRole="button"
									onPress={() => onSuggestion(suggestion)}
									className="min-h-11 w-full items-center justify-center rounded-full border border-border bg-surface px-4 py-2.5 active:bg-surface-secondary"
								>
									<Text
										className="text-center font-sans-medium text-[12.5px] text-foreground leading-5"
										style={{ writingDirection: "auto" }}
									>
										{suggestion}
									</Text>
								</Pressable>
							))}
						</View>
					</>
				) : null}
			</View>
		</View>
	);
}

export function ChatThinkingIndicator({ label }: { label: string }) {
	const reduceMotion = useReducedMotion();
	return (
		<View
			accessible
			accessibilityLabel={label}
			accessibilityLiveRegion="polite"
			className="gap-[9px]"
		>
			<WanditHeader />
			<View className="flex-row items-center gap-2">
				<View
					accessibilityElementsHidden
					importantForAccessibility="no-hide-descendants"
					className="flex-row items-center gap-1"
				>
					{THINKING_DOT_DELAYS.map((delay) => (
						<Animated.View
							key={delay}
							className="h-1 w-1 rounded-full bg-accent"
							style={{
								animationName: reduceMotion ? "none" : THINKING_DOT_BOUNCE,
								animationDuration: "900ms",
								animationDelay: `${delay}ms`,
								animationIterationCount: "infinite",
								animationTimingFunction: "ease-in-out",
							}}
						/>
					))}
				</View>
				<Text className="text-[12.5px] text-muted">{label}</Text>
			</View>
		</View>
	);
}

export function ChatErrorBanner({ message }: { message: string }) {
	return (
		<View className="rounded-[14px] border border-danger/35 bg-danger/10 px-3 py-2.5">
			<Text className="text-[13px] text-foreground/90 leading-5">
				{message}
			</Text>
		</View>
	);
}

export function ChatLoadingState() {
	// Thread-shaped shimmer blocks instead of a bare spinner (web skeleton
	// parity): a user turn, an assistant reply, a shorter user turn.
	return (
		<View className="flex-1 gap-4 px-4 pt-4">
			<View className="h-14 w-3/4 self-end rounded-2xl bg-surface-secondary" />
			<View className="h-20 w-5/6 rounded-xl bg-surface-secondary" />
			<View className="h-10 w-2/3 self-end rounded-2xl bg-surface-secondary" />
		</View>
	);
}

export function ChatMessages({
	messages,
	status,
	projectId,
	activeAskToolCallId,
	onToolApprovalResponse,
}: {
	messages: WanditUIMessage[];
	status: ChatStatus;
	projectId: string;
	activeAskToolCallId?: string;
	onToolApprovalResponse: (response: ApprovalResponse) => void;
}) {
	return (
		<>
			{messages.map((message, index) => (
				<ChatMessageParts
					key={message.id}
					message={message}
					messageIndex={index}
					messageCount={messages.length}
					status={status}
					projectId={projectId}
					activeAskToolCallId={activeAskToolCallId}
					onToolApprovalResponse={onToolApprovalResponse}
				/>
			))}
		</>
	);
}
