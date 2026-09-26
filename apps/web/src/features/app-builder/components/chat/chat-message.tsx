/**
 * One message of the builder thread. A user message is a bubble at the end
 * side. An assistant message starts with the Wandit byline, then renders its
 * parts in stream order: markdown text, the activity feed (thought rows and
 * step rows, grouped tight), the change card, one short line per question
 * (the user answers it in the tray), the approval, suggestion, and diff
 * cards, the error row and the receipt line, then the action row and the
 * follow-ups. Rendered by chat-pane.tsx. Actions with no backend show
 * the notWired toast.
 */

import { CornerDownLeft } from "lucide-react";
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
				<div
					dir="auto"
					className="max-w-[88%] whitespace-pre-wrap break-words rounded-[18px] rounded-ee-md border bg-bubble px-3.5 py-2.5 text-[14.5px] leading-[1.5]"
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
			<div className="flex items-center gap-2">
				<span className="grid size-[22px] shrink-0 place-items-center rounded-full bg-gradient-ember">
					<Spark className="size-3 text-background" />
				</span>
				<span className="font-medium text-sm">Wandit</span>
			</div>
			{blocksOf(message.parts).map((block) => {
				// Parts carry no stable id. The index is stable inside one message.
				const key = `${message.id}-${block.index}`;
				if (block.kind === "feed") {
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
				}
				const part = block.part;
				switch (part.type) {
					case "text":
						return (
							<Streamdown
								key={key}
								dir="auto"
								className="space-y-2 break-words text-[14.5px] leading-[1.55]"
							>
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
								className="text-destructive text-sm"
							>
								<p>
									{t("appBuilder.chat.turnError", {
										message: part.data.message,
									})}
								</p>
								{part.data.retryable ? (
									<p>{t("appBuilder.chat.turnErrorRetry")}</p>
								) : null}
							</div>
						);
					case "data-receipt":
						return (
							<p key={key} className="text-muted-foreground text-xs">
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
				<div className="flex flex-col">
					<span className="mb-1 text-muted-foreground text-xs">
						{t("appBuilder.chat.followUps")}
					</span>
					{followUps.map((prompt) => (
						<button
							key={prompt}
							type="button"
							onClick={() => onSendText(prompt)}
							className="flex items-center gap-2 border-t py-2 text-start text-sm outline-none transition-colors hover:text-primary focus-visible:ring-2 focus-visible:ring-ring/50"
						>
							<CornerDownLeft
								className="size-3.5 shrink-0 text-muted-foreground rtl:-scale-x-100"
								aria-hidden
							/>
							<span dir="auto">{prompt}</span>
						</button>
					))}
				</div>
			) : null}
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
