/**
 * One message of the builder thread. A user message is a bubble at the end
 * side. An assistant message starts with the Wandit byline, then renders its
 * parts in order: markdown text, the thinking trace, the tool chips, change,
 * progress, question, approval, suggestion, and diff cards, the error row
 * and the receipt line, then the action row and the follow-ups. Rendered by
 * chat-pane.tsx. Actions with no backend show the notWired toast.
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
import { ProgressCard } from "./progress-card";
import { QuestionCard } from "./question-card";
import { SuggestionCard } from "./suggestion-card";
import { ToolChips } from "./tool-chips";
import { TraceCard } from "./trace-card";

export type ChatMessageViewProps = {
	message: BuilderMessage;
	/** Opens the preview on the version of a change card. */
	onPreviewVersion: (versionNumber: number) => void;
	/** Sends a follow-up, an answer, or an accepted suggestion as a new build turn. */
	onSendText: (text: string) => void;
	/** Sends an approval card decision as the next turn's approval answer. */
	onDecideApproval: (approvalId: string, approved: boolean) => void;
};

export function ChatMessageView({
	message,
	onPreviewVersion,
	onSendText,
	onDecideApproval,
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
			{message.parts.map((part, index) => {
				// Text parts carry no id. The index is stable inside one message.
				const key = `${message.id}-${index}`;
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
					case "data-trace":
						return (
							<TraceCard
								key={key}
								seconds={part.data.seconds}
								steps={part.data.steps}
							/>
						);
					case "data-tools":
						return (
							<ToolChips
								key={key}
								calls={part.data.calls}
								files={part.data.files}
							/>
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
					case "data-progress":
						return (
							<ProgressCard
								key={key}
								title={part.data.title}
								percent={part.data.percent}
								steps={part.data.steps}
							/>
						);
					case "data-question":
						return (
							<QuestionCard
								key={key}
								question={part.data.question}
								options={part.data.options}
								answer={part.data.answer}
								onAnswer={onSendText}
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

/** The text parts of a message joined with a blank line. Other parts are skipped. */
function textOf(parts: BuilderMessagePart[]): string {
	return parts
		.flatMap((part) => (part.type === "text" ? [part.text] : []))
		.join("\n\n");
}
