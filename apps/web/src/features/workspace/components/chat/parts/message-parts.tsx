import { Button } from "@wandit/ui/components/button";
import type { ChatAddToolApproveResponseFunction, ChatStatus } from "ai";
import { AlertTriangle } from "lucide-react";

import { useTranslation } from "@/lib/i18n";
import { useSharedAiChat } from "../../../lib/ai-chat-context";
import { chatErrorPresentation } from "../../../lib/ai-error-copy";
import {
	messageHasQueuedToolWork,
	type WanditUIMessage,
} from "../../../lib/use-ai-chat";
import { WanditMessageHeader } from "../real-message";
import { StatusMessageHeader } from "../status-message-header";
import { TargetChip } from "../target-chip";
import { MessageTokenUsage } from "../token-usage";
import { AskUserGroupCard } from "./ask-user-part";
import { FilePart, ImageFileGrid } from "./file-part";
import { GenerateImagePart } from "./generate-image-part";
import { GenerateMarketingAssetPart } from "./generate-marketing-asset-part";
import { GeneratePagePart } from "./generate-page-part";
import { type GenerateImageToolPart, ImageBatchPart } from "./image-batch-part";
import {
	isMcpRunFullySettled,
	McpActivityCard,
	mcpRunHasDeliverables,
} from "./mcp-tool-part";
import {
	isPageEditToolPart,
	PageEditActivityCard,
	type PageEditToolPart,
} from "./page-edit-part";
import { ScrapeLeadsPart } from "./scrape-leads-part";
import { TextPart } from "./text-part";

type MessagePart = WanditUIMessage["parts"][number];
type McpToolPart = Extract<MessagePart, { type: "dynamic-tool" }>;
type AskUserToolPart = Extract<MessagePart, { type: "tool-ask_user" }>;
type ImageFilePart = Extract<MessagePart, { type: "file" }>;

const TRANSPARENT_PART_TYPES = new Set([
	"step-start",
	"reasoning",
	"tool-read_skill",
	"tool-read_attachment",
	"tool-read_lead_performance",
	"tool-get_direction_candidates",
	"data-billing-error",
	// Transient settle signal consumed in use-ai-chat's onData — never inline.
	"data-credits-settled",
]);

export function isTransparentMessagePart(part: MessagePart): boolean {
	// The scoped error belongs to its tool card. It must not split adjacent MCP
	// calls into separate receipt groups; turn-level errors remain renderable.
	if (part.type === "data-ai-error") return Boolean(part.data.toolCallId);
	return TRANSPARENT_PART_TYPES.has(part.type);
}

export type MessagePartRenderEntry =
	| { kind: "part"; part: MessagePart; index: number }
	| { kind: "image-run"; parts: ImageFilePart[]; firstIndex: number }
	| {
			kind: "image-batch";
			parts: GenerateImageToolPart[];
			firstIndex: number;
	  }
	| {
			kind: "page-edit-run";
			parts: PageEditToolPart[];
			firstIndex: number;
	  }
	| {
			kind: "mcp-run";
			parts: McpToolPart[];
			firstIndex: number;
			/** Which half of the run this entry renders: the receipt rows keep
			 * their chronological spot; media and generation cards move to the
			 * bottom of the turn as a separate entry. */
			section: "receipt" | "deliverables";
	  }
	| { kind: "ask-run"; parts: AskUserToolPart[]; firstIndex: number };

// Tool cards whose real result arrives AFTER the turn ends (background jobs).
// The model's closing prose promises "it will appear here" — so these cards
// must sit BELOW that prose, at the bottom of the turn, where the reader is
// looking. Everything else (questions, files, text, tool receipts) keeps
// chronological order.
const ASYNC_CARD_PART_TYPES = new Set([
	"tool-generate_page",
	"tool-generate_marketing_asset",
	"tool-generate_image",
	"tool-scrape_leads",
]);

function isAsyncCardEntry(entry: MessagePartRenderEntry): boolean {
	if (entry.kind === "mcp-run") return entry.section === "deliverables";
	if (entry.kind === "image-batch") return true;
	if (
		entry.kind === "ask-run" ||
		entry.kind === "image-run" ||
		entry.kind === "page-edit-run"
	)
		return false;
	return ASYNC_CARD_PART_TYPES.has(entry.part.type);
}

/** Whether an entry draws something in the thread — decides if the turn gets
 * a wrapper + Wandit header at all (a turn of transparent parts renders
 * nothing, and an empty wrapper would still cost a gap slot in the column). */
function entryRendersContent(entry: MessagePartRenderEntry): boolean {
	if (
		entry.kind === "mcp-run" ||
		entry.kind === "ask-run" ||
		entry.kind === "image-run" ||
		entry.kind === "image-batch" ||
		entry.kind === "page-edit-run"
	)
		return true;
	const { part } = entry;
	if (part.type === "text") return part.text.length > 0;
	if (part.type === "data-ai-error") {
		return (
			part.data.terminal &&
			!part.data.toolCallId &&
			part.data.kind !== "cancelled" &&
			part.data.kind !== "billing"
		);
	}
	return part.type === "file" || ASYNC_CARD_PART_TYPES.has(part.type);
}

/**
 * Stable partition: conversational entries first, async deliverable cards
 * last. An MCP run with deliverables contributes to BOTH halves — a second
 * entry carries the media/generation cards to the bottom.
 *
 * Receipt placement follows the turn's lifecycle (the ChatGPT/Claude
 * pattern): while the turn STREAMS the receipts stay chronological at the
 * top, narrating the work as it happens; once the turn is done
 * (`receiptsAtBottom`) they fold into a quiet chip at the very bottom of the
 * message — after the prose and the deliverables — like a sources footer.
 */
export function orderMessagePartEntries(
	entries: MessagePartRenderEntry[],
	{ receiptsAtBottom = false }: { receiptsAtBottom?: boolean } = {},
): MessagePartRenderEntry[] {
	const withDeliverables = entries.flatMap<MessagePartRenderEntry>((entry) =>
		entry.kind === "mcp-run" && mcpRunHasDeliverables(entry.parts)
			? [entry, { ...entry, section: "deliverables" }]
			: [entry],
	);

	const conversational: MessagePartRenderEntry[] = [];
	const asyncCards: MessagePartRenderEntry[] = [];
	const foldedReceipts: MessagePartRenderEntry[] = [];
	for (const entry of withDeliverables) {
		if (
			receiptsAtBottom &&
			entry.kind === "mcp-run" &&
			entry.section === "receipt" &&
			// Only fully-settled runs fold down. A run mid-approval (requested
			// or responded-and-resubmitting) keeps its chronological spot —
			// folding it would make the card jump bottom→top when the stream
			// resumes after an Approve click.
			isMcpRunFullySettled(entry.parts)
		) {
			foldedReceipts.push(entry);
		} else if (isAsyncCardEntry(entry)) {
			asyncCards.push(entry);
		} else {
			conversational.push(entry);
		}
	}
	return [...conversational, ...asyncCards, ...foldedReceipts];
}

const warnedPartTypes = new Set<string>();

export function MessageParts({
	message,
	tokenUsageVisible,
	isStreaming,
	isLastAssistantMessage,
	chatStatus = "ready",
	onRetry,
	suppressAiError = false,
	activeAskToolCallId,
	onToolApprovalResponse,
}: {
	message: WanditUIMessage;
	tokenUsageVisible: boolean;
	isStreaming: boolean;
	isLastAssistantMessage: boolean;
	chatStatus?: ChatStatus;
	onRetry?: () => void;
	/** The live turn-level banner owns this part; persisted rows leave it false. */
	suppressAiError?: boolean;
	/** The ask_user call currently docked on the composer tray (if any) — its
	 * in-thread rendering shows a pointer chip instead of a receipt. */
	activeAskToolCallId?: string;
	onToolApprovalResponse: ChatAddToolApproveResponseFunction;
}) {
	const { prefillComposer } = useSharedAiChat();
	// Only the turn that OWNS the docked ask marks its later pending asks as
	// waiting ("Up next"). Unanswered asks stranded in older messages keep
	// rendering nothing — the server repairs those on the next send.
	const ownsActiveAsk =
		activeAskToolCallId !== undefined &&
		message.parts.some(
			(part) =>
				part.type === "tool-ask_user" &&
				part.toolCallId === activeAskToolCallId,
		);
	const activeAskPartIndex = activeAskToolCallId
		? message.parts.findIndex(
				(part) =>
					part.type === "tool-ask_user" &&
					part.toolCallId === activeAskToolCallId,
			)
		: -1;

	const entries = orderMessagePartEntries(coalesceMessageParts(message.parts), {
		// Live turn: receipts narrate chronologically at the top. Done turn:
		// they fold into a quiet chip at the bottom of the message.
		receiptsAtBottom: !isStreaming,
	});
	const firstContentEntry = entries.find((entry) => {
		if (
			suppressAiError &&
			entry.kind === "part" &&
			entry.part.type === "data-ai-error"
		) {
			return false;
		}
		return entryRendersContent(entry);
	});
	if (!firstContentEntry) return null;

	// The whole turn is ONE block: Wandit header on top, then everything the
	// assistant did — tool receipts, questions, prose, deliverables — tightly
	// grouped under it. Without this, receipts float in the thread's
	// inter-message gap, visually detached from the answer that used them.
	// The header is hoisted for EVERY assistant turn; AskUserGroupCard's own
	// header is suppressed below so a mid-turn ask never doubles it.
	const showTurnHeader = message.role === "assistant";

	// A run is "concluded" once the model writes prose after it — the
	// coalescer breaks runs on non-empty text, so no further call can join
	// it. Mid-stream, a concluded receipt animates out of the thread and
	// returns as the bottom chip when the turn ends.
	const isRunConcluded = (runParts: McpToolPart[]): boolean => {
		const lastPart = runParts[runParts.length - 1];
		if (!lastPart) return false;
		const lastIndex = message.parts.lastIndexOf(lastPart);
		return message.parts
			.slice(lastIndex + 1)
			.some((part) => part.type === "text" && part.text.length > 0);
	};

	const renderedEntries = entries.map((entry) => {
		if (entry.kind === "mcp-run") {
			return (
				<McpActivityCard
					key={`${entry.parts[0]?.toolCallId}:${entry.section}`}
					parts={entry.parts}
					isApprovalActionable={isLastAssistantMessage}
					onToolApprovalResponse={onToolApprovalResponse}
					section={entry.section}
					isTurnLive={isStreaming}
					isRunConcluded={isRunConcluded(entry.parts)}
					onPrefillComposer={prefillComposer}
				/>
			);
		}

		if (entry.kind === "ask-run") {
			return (
				<AskUserGroupCard
					key={entry.parts[0]?.toolCallId}
					parts={entry.parts}
					activeAskToolCallId={activeAskToolCallId}
					ownsActiveAsk={ownsActiveAsk}
					isAfterActiveAsk={
						activeAskPartIndex >= 0 && entry.firstIndex > activeAskPartIndex
					}
					showHeader={!showTurnHeader}
				/>
			);
		}

		if (entry.kind === "image-run") {
			return (
				<ImageFileGrid
					key={`${message.id}:image-run:${entry.firstIndex}`}
					parts={entry.parts}
				/>
			);
		}

		if (entry.kind === "image-batch") {
			return (
				<ImageBatchPart
					key={`${message.id}:image-batch:${entry.firstIndex}`}
					parts={entry.parts}
					messageParts={message.parts}
				/>
			);
		}

		if (entry.kind === "page-edit-run") {
			return (
				<PageEditActivityCard
					key={`${message.id}:page-edit-run:${entry.firstIndex}`}
					parts={entry.parts}
				/>
			);
		}

		const { part, index } = entry;
		const isLastPart = index === message.parts.length - 1;

		switch (part.type) {
			case "data-ai-error":
				if (suppressAiError || !part.data.terminal || part.data.toolCallId)
					return null;
				return (
					<PersistedAiErrorPart
						key={`${message.id}:${index}`}
						error={part.data}
						isLastAssistantMessage={isLastAssistantMessage}
						chatStatus={chatStatus}
						hasQueuedWork={messageHasQueuedToolWork(message)}
						onRetry={onRetry}
					/>
				);
			case "text":
				// An empty text part (the stream sends "text-start" before any
				// characters) would render a bare Wandit header next to the
				// thinking dots — skip it until it has content.
				if (!part.text) return null;
				return (
					<TextPart
						key={`${message.id}:${index}`}
						messageRole={message.role}
						part={part}
						isStreaming={
							part.state === "streaming" || (isStreaming && isLastPart)
						}
						showHeader={false}
					/>
				);
			case "file":
				// User-attached assets (contract §10.4) — thumbnails for images,
				// filename chips for documents.
				return <FilePart key={`${message.id}:${index}`} part={part} />;
			case "tool-generate_page":
				return (
					<GeneratePagePart
						key={part.toolCallId}
						part={part}
						messageParts={message.parts}
					/>
				);
			case "tool-generate_marketing_asset":
				return (
					<GenerateMarketingAssetPart
						key={part.toolCallId}
						part={part}
						messageParts={message.parts}
					/>
				);
			case "tool-generate_image":
				return (
					<GenerateImagePart
						key={part.toolCallId}
						part={part}
						messageParts={message.parts}
					/>
				);
			case "tool-scrape_leads":
				return (
					<ScrapeLeadsPart
						key={part.toolCallId}
						part={part}
						messageParts={message.parts}
					/>
				);
			case "tool-read_skill":
			case "tool-read_attachment":
			case "tool-read_lead_performance":
			case "tool-get_direction_candidates":
				// Server-side context tools — deliberately invisible in the thread
				// (the model narrates what it did in prose when it matters).
				return null;
			default:
				if (isTransparentMessagePart(part)) return null;
				// Every future rich state (building, versions, media, credits, publish)
				// plugs into this registry as another typed message-part renderer.
				warnUnknownPart(part.type);
				return null;
		}
	});

	return (
		<div>
			{showTurnHeader ? <WanditMessageHeader /> : null}
			{message.role === "user" && message.metadata?.selectedTargets ? (
				<ol className="mb-1.5 flex list-none flex-wrap justify-end gap-1.5">
					{message.metadata.selectedTargets.map((target, index) => (
						<li
							key={target.wid}
							aria-label={`Target ${index + 1}: ${target.tag}${
								target.excerpt?.trim() ? ` — ${target.excerpt.trim()}` : ""
							}`}
							className="flex min-w-0 items-center gap-1"
						>
							<span aria-hidden className="shrink-0 text-primary text-xs">
								{String.fromCodePoint(0x2460 + index)}
							</span>
							<TargetChip target={target} />
						</li>
					))}
				</ol>
			) : message.role === "user" && message.metadata?.selectedTarget ? (
				<div className="mb-1.5 flex justify-end">
					<TargetChip target={message.metadata.selectedTarget} />
				</div>
			) : null}
			<div className="flex flex-col gap-2.5">{renderedEntries}</div>
			{/* Staff observability; regular users never see raw token counts. */}
			{tokenUsageVisible &&
			message.role === "assistant" &&
			message.metadata?.usage ? (
				<MessageTokenUsage
					usage={message.metadata.usage}
					stepCount={message.metadata.stepCount}
				/>
			) : null}
		</div>
	);
}

function PersistedAiErrorPart({
	error,
	isLastAssistantMessage,
	chatStatus,
	hasQueuedWork,
	onRetry,
}: {
	error: Extract<MessagePart, { type: "data-ai-error" }>["data"];
	isLastAssistantMessage: boolean;
	chatStatus: ChatStatus;
	hasQueuedWork: boolean;
	onRetry?: () => void;
}) {
	const { t } = useTranslation();
	const presentation = chatErrorPresentation(null, error, t);
	if (!presentation.showBanner) return null;

	const isIdle = chatStatus !== "submitted" && chatStatus !== "streaming";
	const showRetry =
		presentation.showRetry &&
		isIdle &&
		isLastAssistantMessage &&
		!hasQueuedWork &&
		onRetry !== undefined;
	const showQueuedHint =
		presentation.retryable && isIdle && isLastAssistantMessage && hasQueuedWork;

	return (
		<div>
			<StatusMessageHeader
				avatarClass="border-destructive/38 bg-destructive/14 text-destructive"
				kickerClass="text-destructive"
				kicker={presentation.kicker}
			>
				<AlertTriangle className="size-3" aria-hidden />
			</StatusMessageHeader>
			<p dir="auto" className="text-[13px] text-muted-foreground leading-[1.5]">
				{presentation.body}
			</p>
			{presentation.attribution ? (
				<p
					dir="auto"
					className="mt-1 text-[12px] text-muted-foreground leading-[1.5]"
				>
					{presentation.attribution}
				</p>
			) : null}
			{showRetry ? (
				<div className="mt-3 flex flex-col items-start gap-1">
					<Button type="button" variant="outline" size="sm" onClick={onRetry}>
						{t("workspace.chat.aiError.retry")}
					</Button>
					<span className="text-[11px] text-muted-foreground">
						{t("workspace.chat.aiError.retryHint")}
					</span>
				</div>
			) : showQueuedHint ? (
				<p className="mt-2 text-[11px] text-muted-foreground">
					{t("workspace.chat.aiError.queuedHint")}
				</p>
			) : null}
		</div>
	);
}

export function coalesceMessageParts(
	parts: WanditUIMessage["parts"],
): MessagePartRenderEntry[] {
	const entries: MessagePartRenderEntry[] = [];
	const imageParts = parts.filter(
		(part): part is GenerateImageToolPart =>
			part.type === "tool-generate_image",
	);
	const shouldBatchImages = imageParts.length > 1;
	let emittedImageBatch = false;
	let index = 0;

	while (index < parts.length) {
		const part = parts[index];
		if (!part) {
			index += 1;
			continue;
		}

		if (part.type === "tool-generate_image" && shouldBatchImages) {
			if (!emittedImageBatch) {
				entries.push({
					kind: "image-batch",
					parts: imageParts,
					firstIndex: index,
				});
				emittedImageBatch = true;
			}
			index += 1;
			continue;
		}

		if (part.type === "file" && part.mediaType.startsWith("image/")) {
			const firstIndex = index;
			const runParts: ImageFilePart[] = [part];
			let cursor = index + 1;

			while (cursor < parts.length) {
				const candidate = parts[cursor];
				if (
					candidate?.type !== "file" ||
					!candidate.mediaType.startsWith("image/")
				)
					break;

				runParts.push(candidate);
				cursor += 1;
			}

			entries.push({ kind: "image-run", parts: runParts, firstIndex });
			index = cursor;
			continue;
		}

		if (isPageEditToolPart(part)) {
			const firstIndex = index;
			const runParts: PageEditToolPart[] = [part];
			let cursor = index + 1;

			while (cursor < parts.length) {
				const candidate = parts[cursor];
				if (candidate && isPageEditToolPart(candidate)) {
					runParts.push(candidate);
					cursor += 1;
					continue;
				}

				if (!candidate || !isTransparentMessagePart(candidate)) break;

				let nextPartIndex = cursor + 1;
				while (
					parts[nextPartIndex] &&
					isTransparentMessagePart(parts[nextPartIndex])
				) {
					nextPartIndex += 1;
				}
				const nextPart = parts[nextPartIndex];
				if (!nextPart || !isPageEditToolPart(nextPart)) break;

				runParts.push(nextPart);
				cursor = nextPartIndex + 1;
			}

			entries.push({ kind: "page-edit-run", parts: runParts, firstIndex });
			index = cursor;
			continue;
		}

		const runKind =
			part.type === "dynamic-tool"
				? "mcp-run"
				: part.type === "tool-ask_user"
					? "ask-run"
					: null;

		if (!runKind) {
			entries.push({ kind: "part", part, index });
			index += 1;
			continue;
		}

		const firstIndex = index;
		const runParts: Array<McpToolPart | AskUserToolPart> = [
			part as McpToolPart | AskUserToolPart,
		];
		let cursor = index + 1;

		while (cursor < parts.length) {
			const candidate = parts[cursor];
			if (candidate?.type === part.type) {
				runParts.push(candidate as McpToolPart | AskUserToolPart);
				cursor += 1;
				continue;
			}

			if (!candidate || !isTransparentMessagePart(candidate)) break;

			let nextPartIndex = cursor + 1;
			while (
				parts[nextPartIndex] &&
				isTransparentMessagePart(parts[nextPartIndex])
			) {
				nextPartIndex += 1;
			}
			const nextPart = parts[nextPartIndex];
			if (nextPart?.type !== part.type) break;

			runParts.push(nextPart as McpToolPart | AskUserToolPart);
			cursor = nextPartIndex + 1;
		}

		if (runKind === "mcp-run") {
			entries.push({
				kind: runKind,
				parts: runParts as McpToolPart[],
				firstIndex,
				section: "receipt",
			});
		} else {
			entries.push({
				kind: runKind,
				parts: runParts as AskUserToolPart[],
				firstIndex,
			});
		}
		index = cursor;
	}

	return entries;
}

function warnUnknownPart(type: string) {
	if (!import.meta.env.DEV || warnedPartTypes.has(type)) return;

	warnedPartTypes.add(type);
	console.warn(`[ai-chat] No renderer registered for message part: ${type}`);
}
