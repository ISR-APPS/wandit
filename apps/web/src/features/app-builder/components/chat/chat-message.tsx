/**
 * One message of the builder thread. A user message is a cream bubble at the end side.
 * An assistant message starts with the Wandit byline and renders its parts in stream order.
 * The parts are prose, the activity feed, cards, question lines, errors, and the receipt.
 * The action row and the follow-up chips come last.
 * Rendered by chat-pane.tsx; working-row.tsx reuses the byline.
 */

import { ArrowBendDownRightIcon } from "@phosphor-icons/react/ArrowBendDownRight";
import { LightningIcon } from "@phosphor-icons/react/Lightning";
import { WarningCircleIcon } from "@phosphor-icons/react/WarningCircle";
import { cn } from "@wandit/ui/lib/utils";
import { toast } from "sonner";
import { Streamdown } from "streamdown";

import { Spark } from "@/components/logo";
import { formatNumber, useTranslation } from "@/lib/i18n";
import { getModelLabel } from "@/lib/model-labels";
import type { BuilderMessage, BuilderMessagePart } from "../../api/dto";
import { ApprovalCard } from "./approval-card";
import { ChangeCard } from "./change-card";
import { DiffCard } from "./diff-card";
import { MessageActions } from "./message-actions";
import { QuestionReceipt } from "./question-receipt";
import { StepRow } from "./step-row";
import { SuggestionCard } from "./suggestion-card";
import { ThoughtRow } from "./thought-row";

export type ChatMessageViewProps = {
	message: BuilderMessage;
	/** Opens the preview on the version of a change card. */
	onPreviewVersion: (versionNumber: number) => void;
	/** Sends a follow-up or an accepted suggestion as a new build turn. */
	onSendText: (text: string) => void;
	/** Sends an approval card decision as the next turn's approval answer. */
	onDecideApproval: (approvalId: string, approved: boolean) => void;
	/** Id of the `data-question` part the tray shows now, or null while the tray hides. */
	trayQuestionKey: string | null;
};

/** One thread message: the user bubble, or the byline and the parts of a reply. */
export function ChatMessageView({
	message,
	onPreviewVersion,
	onSendText,
	onDecideApproval,
	trayQuestionKey,
}: ChatMessageViewProps) {
	const { t, locale } = useTranslation();

	if (message.role === "user") {
		return (
			<div className="flex justify-end">
				{/* Full cream, not a tint: a lighter cream fades into the sand desk. */}
				<div
					dir="auto"
					className="max-w-[85%] whitespace-pre-wrap break-words rounded-[20px] rounded-ee-[6px] bg-cream px-4 py-2.5 font-sans text-[15px] text-night leading-relaxed dark:bg-white/[0.07] dark:text-foreground"
				>
					{textOf(message.parts)}
				</div>
			</div>
		);
	}

	const notWired = () => toast(t("appBuilder.mock.notWired"));
	// Only a message that saved a version gets the revert, like, and copy row.
	const hasChange = message.parts.some((part) => part.type === "data-change");
	const followUps = message.metadata?.followUps ?? [];

	return (
		<div className="flex flex-col gap-3">
			<AssistantByline />
			{blocksOf(message.parts).map((block) => {
				// Parts carry no stable id. The index is stable inside one message.
				const key = `${message.id}-${block.index}`;
				if (block.kind === "feed") {
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
									<StepRow key={`${message.id}-${index}`} {...row.data} />
								),
							)}
						</div>
					);
				}
				const part = block.part;
				switch (part.type) {
					case "text":
						return (
							<Streamdown key={key} dir="auto" className={PROSE_CLASS}>
								{part.text}
							</Streamdown>
						);
					case "data-change":
						return (
							<ChangeCard
								key={key}
								title={part.data.title}
								versionNumber={part.data.versionNumber}
								onDetails={notWired}
								onPreview={onPreviewVersion}
								onBookmark={notWired}
							/>
						);
					case "data-question":
						return (
							<QuestionReceipt
								key={key}
								question={part.data.question}
								isAnswered={part.data.isAnswered}
								isInTray={part.id === trayQuestionKey}
							/>
						);
					case "data-approval":
						return (
							<ApprovalCard
								key={key}
								toolName={part.data.toolName}
								input={part.data.input}
								decision={part.data.decision}
								isOpen={part.data.isOpen}
								onDecide={(approved) =>
									onDecideApproval(part.data.approvalId, approved)
								}
							/>
						);
					case "data-suggestion":
						return (
							<SuggestionCard
								key={key}
								title={part.data.title}
								body={part.data.body}
								confidence={part.data.confidence}
								// The body is the instruction, so accepting sends it as the next turn.
								onAccept={() => onSendText(part.data.body)}
								onAlternatives={notWired}
							/>
						);
					case "data-diff":
						return (
							<DiffCard
								key={key}
								path={part.data.path}
								lines={part.data.lines}
							/>
						);
					case "data-error":
						return (
							<div
								key={key}
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
										{t("appBuilder.chat.turnError", {
											message: part.data.message,
										})}
									</p>
									{part.data.retryable ? (
										<p className="mt-0.5 text-destructive/80">
											{t("appBuilder.chat.turnErrorRetry")}
										</p>
									) : null}
								</div>
							</div>
						);
					case "data-receipt":
						return (
							<p
								key={key}
								className="flex items-center gap-1.5 font-grotesk text-[11px] text-night/45 tabular-nums dark:text-foreground/45"
							>
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
								{part.data.modelId !== null
									? ` · ${getModelLabel(part.data.modelId)}`
									: null}
							</p>
						);
					default:
						return null;
				}
			})}
			{hasChange ? (
				<MessageActions
					onRevert={notWired}
					onLike={notWired}
					text={textOf(message.parts)}
				/>
			) : null}
			{followUps.length > 0 ? (
				<div className="flex flex-col gap-2">
					<span className="font-grotesk text-[12px] text-night/45 dark:text-foreground/45">
						{t("appBuilder.chat.followUps")}
					</span>
					<div className="flex flex-wrap gap-2">
						{followUps.map((prompt) => (
							<button
								key={prompt}
								type="button"
								onClick={() => onSendText(prompt)}
								className="flex min-w-0 max-w-full items-center gap-1.5 rounded-full border border-night/[0.1] px-3 py-1.5 text-start font-grotesk text-[13px] text-night/80 leading-snug outline-none transition-colors duration-150 hover:border-spark/40 hover:bg-spark/[0.14] hover:text-night focus-visible:ring-[3px] focus-visible:ring-ember/20 dark:border-white/[0.1] dark:text-foreground/80 dark:hover:text-foreground"
							>
								<ArrowBendDownRightIcon
									weight="bold"
									className="size-3.5 shrink-0 text-night/40 rtl:-scale-x-100 dark:text-foreground/40"
									aria-hidden
								/>
								<span dir="auto" className="min-w-0">
									{prompt}
								</span>
							</button>
						))}
					</div>
				</div>
			) : null}
		</div>
	);
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
 * Groups the parts for rendering. Thought and step rows that follow each
 * other form one block: they sit close together like one activity list,
 * while every other part keeps the message gap.
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
