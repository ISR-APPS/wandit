/**
 * One message of the builder thread. A user message is a cream bubble at
 * the end side. Its files sit above it, and the chips of its preview picks
 * sit above the files. An assistant message starts with the Wandit byline.
 * In the production view, one summary line opens the details panel, and
 * only the parts the user reads or acts on follow: the final answer, a
 * missing secret, the question lines, the approval card, the plan card,
 * the error with Retry, the stopped line, and the receipt. The developer
 * view (local dev only) renders every part in stream order, with the
 * thinking text. A Copy action ends a reply that has a final answer.
 * Rendered by chat-pane.tsx; working-row.tsx reuses the byline.
 */

import { ArrowCounterClockwiseIcon } from "@phosphor-icons/react/ArrowCounterClockwise";
import { CaretRightIcon } from "@phosphor-icons/react/CaretRight";
import { LightningIcon } from "@phosphor-icons/react/Lightning";
import { PaperclipIcon } from "@phosphor-icons/react/Paperclip";
import { WarningCircleIcon } from "@phosphor-icons/react/WarningCircle";
import { Button } from "@wandit/ui/components/button";
import { cn } from "@wandit/ui/lib/utils";
import type { FileUIPart } from "ai";
import { Streamdown } from "streamdown";

import { Spark } from "@/components/logo";
import { formatNumber, useTranslation } from "@/lib/i18n";
import { getModelLabel } from "@/lib/model-labels";
import type { BuilderMessage, BuilderMessagePart } from "../../api/dto";
import { isActivityPart } from "../../lib/turn-parts";
import { ChangedFiles, summaryOf, WorkSummaryLabel } from "./activity-panel";
import { ApprovalCard } from "./approval-card";
import { MessageActions } from "./message-actions";
import { CARD_SECONDARY_PILL_CLASS } from "./message-card";
import { PlanCard } from "./plan-card";
import { QuestionReceipt } from "./question-receipt";
import { StepRow } from "./step-row";
import { TargetChip } from "./target-chip";
import { ThoughtRow } from "./thought-row";

/** Props of one message, as chat-pane.tsx passes them. */
export type ChatMessageViewProps = {
	message: BuilderMessage;
	/** True renders every part inline, with the thinking text. Only the local dev switch sets it. */
	isDeveloperView: boolean;
	/** Opens the details panel of this message. The production summary line calls it with `message.id`. */
	onOpenActivity: (messageId: string) => void;
	/** Sends an approval card decision as the next turn's approval answer. */
	onDecideApproval: (approvalId: string, approved: boolean) => void;
	/** Sends the build turn of an open plan card. Null while a send is in flight: the button is disabled. */
	onBuildPlan: (() => void) | null;
	/** Id of the `data-question` part the tray shows now, or null while the tray hides. */
	trayQuestionKey: string | null;
	/** Sends the user message of this failed reply again. Set only on the last reply when it holds an error. */
	onRetry?: () => void;
	/** Opens the Secrets panel from a step row. Absent while the Cloud panels are off. */
	onOpenSecrets?: () => void;
};

/** One thread message: the user bubble, or the byline and the parts of a reply, in the production or the developer view. */
export function ChatMessageView({
	message,
	isDeveloperView,
	onOpenActivity,
	onDecideApproval,
	onBuildPlan,
	trayQuestionKey,
	onRetry,
	onOpenSecrets,
}: ChatMessageViewProps) {
	if (message.role === "user") {
		const text = textOf(message.parts);
		const files = message.parts.filter(
			(part): part is FileUIPart => part.type === "file",
		);
		const targets = message.parts.flatMap((part) =>
			part.type === "data-targets" ? part.data.targets : [],
		);
		return (
			<div className="flex flex-col items-end gap-1.5">
				{targets.length > 0 ? (
					<div className="flex max-w-[85%] flex-wrap justify-end gap-1.5">
						{targets.map((target) => (
							<TargetChip
								key={`${target.src}|${target.label}`}
								target={target}
							/>
						))}
					</div>
				) : null}
				{files.length > 0 ? (
					<div className="flex max-w-[85%] flex-wrap justify-end gap-1.5">
						{files.map((file) => (
							<SentFile key={file.url} file={file} />
						))}
					</div>
				) : null}
				{/* A message with files only has no text bubble. */}
				{text !== "" ? (
					// Full cream, not a tint: a lighter cream fades into the sand desk.
					<div
						dir="auto"
						className="max-w-[85%] whitespace-pre-wrap break-words rounded-[20px] rounded-ee-[6px] bg-cream px-4 py-2.5 font-sans text-[15px] text-night leading-relaxed dark:bg-white/[0.07] dark:text-foreground"
					>
						{text}
					</div>
				) : null}
			</div>
		);
	}

	const finalText = textOf(message.parts);
	const partView = (part: BuilderMessagePart, key: string) => (
		<MessagePartView
			key={key}
			part={part}
			onDecideApproval={onDecideApproval}
			onBuildPlan={onBuildPlan}
			trayQuestionKey={trayQuestionKey}
			onRetry={onRetry}
		/>
	);

	return (
		<div className="flex flex-col gap-3">
			<AssistantByline />
			{isDeveloperView ? (
				blocksOf(message.parts).map((block) => {
					// Parts carry no stable id. The index is stable inside one message.
					const key = `${message.id}-${block.index}`;
					if (block.kind === "part") return partView(block.part, key);
					return (
						// Each feed row is at least 28 px high with its own padding. The
						// negative margin keeps the gap to the prose near the message gap.
						<div key={key} className="-my-1 flex flex-col">
							{block.rows.map(({ part: row, index }) =>
								row.type === "data-thought" ? (
									<ThoughtRow
										key={`${message.id}-${index}`}
										text={row.data.text}
										seconds={row.data.seconds}
										isStreaming={row.data.isStreaming}
									/>
								) : (
									<StepRow
										key={`${message.id}-${index}`}
										{...row.data}
										onOpenSecrets={onOpenSecrets}
									/>
								),
							)}
						</div>
					);
				})
			) : (
				<>
					<SummaryLine message={message} onOpenActivity={onOpenActivity} />
					{/* The steps, the notes, and the summary show in the details panel only. */}
					{message.parts.map((part, index) => {
						const key = `${message.id}-${index}`;
						// The user must add a missing secret, so that one step row stays in the chat.
						if (
							part.type === "data-step" &&
							part.data.isSecretMissing === true &&
							onOpenSecrets !== undefined
						) {
							return (
								<StepRow
									key={key}
									{...part.data}
									onOpenSecrets={onOpenSecrets}
								/>
							);
						}
						return isActivityPart(part) || part.type === "data-summary"
							? null
							: partView(part, key);
					})}
				</>
			)}
			{finalText.trim() !== "" ? <MessageActions text={finalText} /> : null}
		</div>
	);
}

/**
 * The production line that opens the details panel, for example "Worked
 * for 1 min · 6 files changed ›". Null when the reply has no step, no
 * note, no thought, and no summary.
 */
function SummaryLine({
	message,
	onOpenActivity,
}: Pick<ChatMessageViewProps, "message" | "onOpenActivity">) {
	const summary = summaryOf(message);
	if (summary === null && !message.parts.some(isActivityPart)) return null;
	return (
		<button
			type="button"
			onClick={() => onOpenActivity(message.id)}
			className="group flex items-center gap-1 self-start rounded-[8px] text-start font-grotesk text-[13px] text-night/70 outline-none transition-colors duration-150 hover:text-night focus-visible:ring-2 focus-visible:ring-ember/30 dark:text-foreground/70 dark:hover:text-foreground"
		>
			<WorkSummaryLabel summary={summary} />
			<CaretRightIcon
				weight="bold"
				className="size-3 shrink-0 text-night/35 transition-colors group-hover:text-night/70 rtl:-scale-x-100 dark:text-foreground/35 dark:group-hover:text-foreground/70"
				aria-hidden
			/>
		</button>
	);
}

/**
 * One part of an assistant message outside the feed rows. Both views use
 * it; the production view never passes a note or a summary. A part type
 * this switch does not know renders nothing.
 */
function MessagePartView({
	part,
	onDecideApproval,
	onBuildPlan,
	trayQuestionKey,
	onRetry,
}: Pick<
	ChatMessageViewProps,
	"onDecideApproval" | "onBuildPlan" | "trayQuestionKey" | "onRetry"
> & {
	part: BuilderMessagePart;
}) {
	const { t, locale } = useTranslation();
	switch (part.type) {
		case "text":
		case "data-note":
			return (
				<Streamdown dir="auto" className={PROSE_CLASS}>
					{part.type === "text" ? part.text : part.data.text}
				</Streamdown>
			);
		case "data-summary":
			return (
				<div className="flex flex-col gap-1">
					<p className="font-grotesk text-[13px] text-night/70 dark:text-foreground/70">
						<WorkSummaryLabel summary={part.data} />
					</p>
					{part.data.files.length > 0 ? (
						<ChangedFiles files={part.data.files} />
					) : null}
				</div>
			);
		case "data-question":
			return (
				<QuestionReceipt
					question={part.data.question}
					isAnswered={part.data.isAnswered}
					isInTray={part.id === trayQuestionKey}
				/>
			);
		case "data-approval":
			return (
				<ApprovalCard
					toolName={part.data.toolName}
					input={part.data.input}
					decision={part.data.decision}
					isOpen={part.data.isOpen}
					onDecide={(approved) =>
						onDecideApproval(part.data.approvalId, approved)
					}
				/>
			);
		case "data-plan":
			return (
				<PlanCard
					plan={part.data}
					isOpen={part.data.isOpen}
					onBuild={onBuildPlan}
				/>
			);
		case "data-error":
			return (
				<div
					role="alert"
					dir="auto"
					className="flex items-start gap-2.5 rounded-[14px] bg-destructive/[0.07] px-3 py-2.5 font-sans text-[13.5px] text-destructive leading-snug dark:bg-destructive/[0.12]"
				>
					<WarningCircleIcon
						weight="fill"
						className="mt-px size-4 shrink-0"
						aria-hidden
					/>
					<div className="min-w-0">
						<p>
							{t("appBuilder.chat.turnError", { message: part.data.message })}
						</p>
						{onRetry ? (
							<Button
								variant="outline"
								size="sm"
								onClick={onRetry}
								className={cn("mt-2", CARD_SECONDARY_PILL_CLASS)}
							>
								{/* The arrow turns back against the reading direction, so it mirrors in RTL. */}
								<ArrowCounterClockwiseIcon
									weight="bold"
									className="rtl:-scale-x-100"
									aria-hidden
								/>
								{t("appBuilder.chat.retry")}
							</Button>
						) : null}
					</div>
				</div>
			);
		case "data-stopped":
			return (
				<p className="font-grotesk text-[13px] text-night/50 dark:text-foreground/50">
					{t("appBuilder.chat.stopped")}
				</p>
			);
		case "data-receipt":
			return (
				<p className="flex items-center gap-1.5 font-grotesk text-[11px] text-night/45 tabular-nums dark:text-foreground/45">
					<LightningIcon
						weight="fill"
						className="size-3 shrink-0 text-spark"
						aria-hidden
					/>
					{t("appBuilder.chat.receipt", {
						credits: t("appBuilder.chat.estimate", {
							count: part.data.credits,
						}),
						tokens: formatNumber(
							part.data.inputTokens + part.data.outputTokens,
							locale,
						),
					})}
					{/* The input count leaves out the cached prompt tokens, so they show on their own. */}
					{part.data.cacheReadTokens + part.data.cacheWriteTokens > 0
						? ` · ${t("appBuilder.chat.receiptCache", {
								read: formatNumber(part.data.cacheReadTokens, locale),
								write: formatNumber(part.data.cacheWriteTokens, locale),
							})}`
						: null}
					{part.data.modelId !== null
						? ` · ${getModelLabel(part.data.modelId)}`
						: null}
				</p>
			);
		default:
			return null;
	}
}

/**
 * The night brand tile with the Spark and the "Wandit" name above a reply,
 * like the logo tile of the dashboard sidebar. working-row.tsx shows it too,
 * before the reply has parts.
 */
export function AssistantByline() {
	return (
		<div className="flex items-center gap-2">
			<span className="grid size-6 shrink-0 place-items-center rounded-[8px] bg-night dark:ring-1 dark:ring-white/10">
				<Spark className="size-3.5 text-spark" />
			</span>
			<span className="font-grotesk font-semibold text-[13px] text-night dark:text-foreground">
				Wandit
			</span>
		</div>
	);
}

// Streamdown wraps each markdown block in a `display: contents` div, so a
// space-y margin never reaches the paragraphs. A flex column gap spaces them.
// Streamdown styles its own tags with Tailwind classes. An attribute selector
// below is more specific than one class, so these rules win.
const PROSE_CLASS = cn(
	"flex flex-col gap-3 break-words font-sans text-[15px] text-night/85 leading-[1.65] dark:text-foreground/85",
	// Bold text and headings in the ink color; headings in the grotesk face.
	"[&_[data-streamdown=strong]]:font-semibold [&_[data-streamdown=strong]]:text-night dark:[&_[data-streamdown=strong]]:text-foreground",
	"[&_[data-streamdown^=heading]]:my-0 [&_[data-streamdown^=heading]]:pt-1 [&_[data-streamdown^=heading]]:font-grotesk [&_[data-streamdown^=heading]]:font-semibold [&_[data-streamdown^=heading]]:text-[15px] [&_[data-streamdown^=heading]]:text-night [&_[data-streamdown^=heading]]:leading-snug dark:[&_[data-streamdown^=heading]]:text-foreground",
	"[&_[data-streamdown=heading-1]]:text-[17px] [&_[data-streamdown=heading-2]]:text-[16px]",
	// Lists: the markers hang outside the text, so a wrapped line aligns with the first one.
	// pe-0 cancels the physical pl-6 that Streamdown puts on a nested list, which lands on the end side in RTL.
	"[&_[data-streamdown$=-list]]:list-outside [&_[data-streamdown$=-list]]:space-y-1 [&_[data-streamdown$=-list]]:ps-5 [&_[data-streamdown$=-list]]:pe-0",
	"[&_[data-streamdown=list-item]>[data-streamdown$=-list]]:mt-1 [&_[data-streamdown=list-item]]:py-0 [&_[data-streamdown=list-item]]:ps-1",
	"[&_[data-streamdown=unordered-list]>li]:marker:text-ember dark:[&_[data-streamdown=unordered-list]>li]:marker:text-spark",
	"[&_[data-streamdown=ordered-list]>li]:marker:font-grotesk [&_[data-streamdown=ordered-list]>li]:marker:font-medium [&_[data-streamdown=ordered-list]>li]:marker:text-night/45 dark:[&_[data-streamdown=ordered-list]>li]:marker:text-foreground/45",
	// Inline code is a chip. The clone keeps the chip ends on each line of a wrapped value.
	"[&_[data-streamdown=inline-code]]:rounded-md [&_[data-streamdown=inline-code]]:bg-night/[0.06] [&_[data-streamdown=inline-code]]:box-decoration-clone [&_[data-streamdown=inline-code]]:px-1.5 [&_[data-streamdown=inline-code]]:py-0.5 [&_[data-streamdown=inline-code]]:font-mono [&_[data-streamdown=inline-code]]:text-[0.85em] [&_[data-streamdown=inline-code]]:text-night [&_[data-streamdown=inline-code]]:[overflow-wrap:anywhere] dark:[&_[data-streamdown=inline-code]]:bg-white/[0.08] dark:[&_[data-streamdown=inline-code]]:text-foreground",
	"[&_[data-streamdown=link]:hover]:decoration-ember [&_[data-streamdown=link]]:font-medium [&_[data-streamdown=link]]:text-ember-text [&_[data-streamdown=link]]:decoration-ember/30 [&_[data-streamdown=link]]:underline-offset-2",
	// Code blocks and tables sit in a white hairline card, like the message cards on the sand desk.
	"[&_[data-streamdown=code-block]]:my-0 [&_[data-streamdown=code-block]]:rounded-[16px] [&_[data-streamdown=code-block]]:border-night/[0.08] [&_[data-streamdown=code-block]]:bg-white dark:[&_[data-streamdown=code-block]]:border-white/[0.08] dark:[&_[data-streamdown=code-block]]:bg-white/[0.04]",
	"[&_[data-streamdown=table-wrapper]]:my-0 [&_[data-streamdown=table-wrapper]]:rounded-[16px] [&_[data-streamdown=table-wrapper]]:border-night/[0.08] [&_[data-streamdown=table-wrapper]]:bg-white dark:[&_[data-streamdown=table-wrapper]]:border-white/[0.08] dark:[&_[data-streamdown=table-wrapper]]:bg-white/[0.04]",
	// The outer card is the one frame: the code body, the table box, and the table lose their own border and fill.
	"[&_[data-streamdown=code-block-body]]:border-0 [&_[data-streamdown=code-block-body]]:bg-transparent [&_[data-streamdown=code-block-body]]:px-2 [&_[data-streamdown=code-block-body]]:py-1 [&_[data-streamdown=code-block-body]]:text-[12.5px] [&_[data-streamdown=code-block-header]]:px-2 [&_[data-streamdown=code-block-header]]:font-mono",
	"[&_[data-streamdown=table-wrapper]>div:last-child]:rounded-none [&_[data-streamdown=table-wrapper]>div:last-child]:border-0 [&_[data-streamdown=table-wrapper]>div:last-child]:bg-transparent [&_[data-streamdown=table]]:border-0",
	"[&_[data-streamdown=table-cell]]:text-[14px] [&_[data-streamdown=table-header-cell]]:text-start [&_[data-streamdown=table-header-cell]]:font-grotesk [&_[data-streamdown=table-header-cell]]:font-medium [&_[data-streamdown=table-header-cell]]:text-[12.5px] [&_[data-streamdown=table-header-cell]]:text-night/60 dark:[&_[data-streamdown=table-header-cell]]:text-foreground/60 [&_[data-streamdown=table-header]]:bg-night/[0.03] dark:[&_[data-streamdown=table-header]]:bg-white/[0.04] [&_[data-streamdown^=table]]:border-night/[0.08] dark:[&_[data-streamdown^=table]]:border-white/[0.08]",
	"[&_[data-streamdown=blockquote]]:my-0 [&_[data-streamdown=blockquote]]:border-0 [&_[data-streamdown=blockquote]]:border-spark [&_[data-streamdown=blockquote]]:border-s-2 [&_[data-streamdown=blockquote]]:ps-3 [&_[data-streamdown=blockquote]]:text-night/70 [&_[data-streamdown=blockquote]]:not-italic dark:[&_[data-streamdown=blockquote]]:text-foreground/70",
	"[&_[data-streamdown=horizontal-rule]]:my-1 [&_[data-streamdown=horizontal-rule]]:border-night/[0.08] dark:[&_[data-streamdown=horizontal-rule]]:border-white/[0.08]",
);

/** One file of a user message: an image thumbnail, or a link with the file name. */
function SentFile({ file }: { file: FileUIPart }) {
	const name = file.filename ?? file.url.split("/").at(-1) ?? file.url;
	if (file.mediaType.startsWith("image/")) {
		return (
			<a href={file.url} target="_blank" rel="noopener noreferrer">
				<img
					src={file.url}
					alt={name}
					className="size-16 rounded-[12px] border border-night/[0.08] object-cover dark:border-white/[0.08]"
				/>
			</a>
		);
	}
	return (
		<a
			href={file.url}
			target="_blank"
			rel="noopener noreferrer"
			className="flex h-9 max-w-56 items-center gap-1.5 rounded-[12px] bg-night/[0.05] px-2.5 font-grotesk text-[12px] text-night outline-none transition-colors hover:text-ember-text focus-visible:ring-2 focus-visible:ring-ember/30 dark:bg-white/[0.06] dark:text-foreground"
		>
			<PaperclipIcon
				weight="bold"
				className="size-3.5 shrink-0 text-night/50 dark:text-foreground/50"
				aria-hidden
			/>
			<span dir="auto" className="truncate">
				{name}
			</span>
		</a>
	);
}

/** A row of the activity feed: one thought or one step. */
type FeedRow = Extract<
	BuilderMessagePart,
	{ type: "data-thought" } | { type: "data-step" }
>;

/**
 * One render block: a run of feed rows, or any other part alone. Each
 * `index` is a position in `message.parts`; it keys the rendered element.
 */
type MessageBlock =
	| { kind: "feed"; index: number; rows: { part: FeedRow; index: number }[] }
	| { kind: "part"; index: number; part: BuilderMessagePart };

/**
 * Groups the parts for the developer view. Thought and step rows that
 * follow each other form one block: they sit close together like one
 * activity list, while every other part keeps the message gap.
 */
function blocksOf(parts: BuilderMessagePart[]): MessageBlock[] {
	const blocks: MessageBlock[] = [];
	parts.forEach((part, index) => {
		if (part.type !== "data-thought" && part.type !== "data-step") {
			blocks.push({ kind: "part", index, part });
			return;
		}
		const last = blocks.at(-1);
		if (last?.kind === "feed") {
			last.rows.push({ part, index });
		} else {
			blocks.push({ kind: "feed", index, rows: [{ part, index }] });
		}
	});
	return blocks;
}

/** The text parts of a message joined with a blank line. Other parts are skipped. */
function textOf(parts: BuilderMessagePart[]): string {
	return parts
		.flatMap((part) => (part.type === "text" ? [part.text] : []))
		.join("\n\n");
}
