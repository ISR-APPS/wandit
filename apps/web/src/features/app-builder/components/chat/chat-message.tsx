/**
 * One message of the builder thread. A user message is a bubble at the end
 * side. An assistant message starts with the Wandit byline. In the
 * production view, one summary line opens the details panel, and only the
 * parts the user reads or acts on follow: the final answer, the question
 * lines, the approval card, the error, and the receipt. The developer view
 * (local dev only) renders every part in stream order, with the thinking
 * text. A Copy action ends a reply that has a final answer. Rendered by
 * chat-pane.tsx; working-row.tsx reuses the byline.
 */

import { ChevronRight } from "lucide-react";
import { Streamdown } from "streamdown";

import { Spark } from "@/components/logo";
import { formatNumber, useTranslation } from "@/lib/i18n";
import { getModelLabel } from "@/lib/model-labels";
import type { BuilderMessage, BuilderMessagePart } from "../../api/dto";
import { isActivityPart } from "../../lib/turn-parts";
import { ChangedFiles, summaryOf, WorkSummaryLabel } from "./activity-panel";
import { ApprovalCard } from "./approval-card";
import { MessageActions } from "./message-actions";
import { QuestionReceipt } from "./question-receipt";
import { StepRow } from "./step-row";
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
	/** Id of the `data-question` part the tray shows now, or null while the tray hides. */
	trayQuestionKey: string | null;
};

/** One user bubble or one assistant reply, in the production or the developer view. */
export function ChatMessageView({
	message,
	isDeveloperView,
	onOpenActivity,
	onDecideApproval,
	trayQuestionKey,
}: ChatMessageViewProps) {
	if (message.role === "user") {
		return (
			<div className="flex justify-end">
				<div
					dir="auto"
					className="max-w-[88%] whitespace-pre-wrap break-words rounded-[18px] rounded-ee-md border bg-bubble px-3.5 py-2.5 text-[14.5px] leading-[1.5]"
				>
					{textOf(message.parts)}
				</div>
			</div>
		);
	}

	const finalText = textOf(message.parts);
	const partView = (part: BuilderMessagePart, key: string) => (
		<MessagePartView
			key={key}
			part={part}
			onDecideApproval={onDecideApproval}
			trayQuestionKey={trayQuestionKey}
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
						<div key={key} className="flex flex-col">
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
				})
			) : (
				<>
					<SummaryLine message={message} onOpenActivity={onOpenActivity} />
					{/* The steps, the notes, and the summary show in the details panel only. */}
					{message.parts.map((part, index) =>
						isActivityPart(part) || part.type === "data-summary"
							? null
							: partView(part, `${message.id}-${index}`),
					)}
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
			className="flex items-center gap-1 self-start rounded-md text-start text-muted-foreground text-sm outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50"
		>
			<WorkSummaryLabel summary={summary} />
			<ChevronRight
				className="size-3.5 shrink-0 rtl:-scale-x-100"
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
	trayQuestionKey,
}: Pick<ChatMessageViewProps, "onDecideApproval" | "trayQuestionKey"> & {
	part: BuilderMessagePart;
}) {
	const { t, locale } = useTranslation();
	switch (part.type) {
		case "text":
		case "data-note":
			return (
				<Streamdown
					dir="auto"
					className="space-y-2 break-words text-[14.5px] leading-[1.55]"
				>
					{part.type === "text" ? part.text : part.data.text}
				</Streamdown>
			);
		case "data-summary":
			return (
				<div className="flex flex-col gap-1">
					<p className="text-muted-foreground text-sm">
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
		case "data-error":
			return (
				<div role="alert" dir="auto" className="text-destructive text-sm">
					<p>
						{t("appBuilder.chat.turnError", { message: part.data.message })}
					</p>
					{part.data.retryable ? (
						<p>{t("appBuilder.chat.turnErrorRetry")}</p>
					) : null}
				</div>
			);
		case "data-receipt":
			return (
				<p className="text-muted-foreground text-xs">
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
}

/**
 * The Spark avatar and the "Wandit" name above a reply. working-row.tsx
 * shows it too, before the reply has parts.
 */
export function AssistantByline() {
	return (
		<div className="flex items-center gap-2">
			<span className="grid size-[22px] shrink-0 place-items-center rounded-full bg-gradient-ember">
				<Spark className="size-3 text-background" />
			</span>
			<span className="font-medium text-sm">Wandit</span>
		</div>
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
