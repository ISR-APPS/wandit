/**
 * The chat card of the app builder. The header shows the project name, the
 * dev view switch in local dev, the pulsing turn dot with a Stop button
 * while a turn runs, and the collapse button. Below it sit the scrolling
 * message list with one status line while a turn runs, an alert row for a
 * refused send (`errorText`), and the composer pinned at the bottom. When
 * the agent asks the user something, the request tray opens on top of the
 * composer. A failed last reply gets a Retry button that sends its user
 * message again. In the production view, the live reply shows only as the
 * status line. Rendered by pages/app-builder-page.tsx, which owns the
 * thread hook, the details panel, and the card chrome. Renders chat-message.tsx,
 * working-row.tsx, composer.tsx, and the request tray.
 */

import type {
	PreviewTarget,
	TurnQuestionAnswer,
	TurnStreamPhase,
} from "@wandit/contracts";
import { Button } from "@wandit/ui/components/button";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@wandit/ui/components/tooltip";
import { cn } from "@wandit/ui/lib/utils";
import type { FileUIPart } from "ai";
import { PanelLeftClose, Square } from "lucide-react";
import { AnimatePresence, MotionConfig } from "motion/react";
import { useRef, useState } from "react";

import { useTranslation } from "@/lib/i18n";
import type { SendBuilderMessageInput } from "../../api/app-builder.services";
import type { BuilderMessage } from "../../api/dto";
import { isActivityPart, liveStatusOf } from "../../lib/turn-parts";
import { useAutoScroll } from "../../lib/use-auto-scroll";
import { type TrayQuestion, useRequestTray } from "../../lib/use-request-tray";
import { SegmentedControl } from "../shell/segmented-control";
import { ChatMessageView } from "./chat-message";
import { Composer } from "./composer";
import { RequestTray } from "./request-tray/request-tray";
import { TrayReveal } from "./request-tray/tray-reveal";
import { WorkingRow } from "./working-row";

/** Props of the chat card. pages/app-builder-page.tsx binds them to useBuilderThread. */
export type ChatPaneProps = {
	/** Messages of the thread, oldest first. */
	messages: BuilderMessage[];
	/** Credits the next turn holds, whole credits. Shown next to the send button; null hides it. */
	turnEstimateCredits: number | null;
	/** Elements picked in the preview for the next turn. The composer shows them as chips. */
	targets: PreviewTarget[];
	/** Removes the target at this index of `targets`. */
	onRemoveTarget: (index: number) => void;
	/** True while a turn runs. Locks the composer and shows the status line. */
	isSending: boolean;
	/** Phase of the running turn, from useBuilderThread. With `isFirstTurn` it picks the status line label before the reply has steps. */
	phase: TurnStreamPhase | null;
	/** True on the first turn of the project, null while the history loads. From useBuilderThread. Picks the preparation lines. */
	isFirstTurn: boolean | null;
	/** Id of the reply that streams now, from useBuilderThread; null while no reply streams. */
	liveMessageId: string | null;
	/** True shows every step inline with the thinking text, and the seconds counter. Only the local dev switch sets it. */
	isDeveloperView: boolean;
	/** Changes the chat view. Null outside local dev: the switch then does not render. */
	onChangeDeveloperView: ((isDeveloperView: boolean) => void) | null;
	/** Opens the details panel of one assistant reply. The summary line and the status line call it. */
	onOpenActivity: (messageId: string) => void;
	/** False until the project chat id resolves and the history loads or fails. Locks the composer together with `isSending`. */
	isReady: boolean;
	/** Name of the open project. Shown after "Chat" in the card header. */
	projectName: string;
	onSend: (input: SendBuilderMessageInput) => void;
	/** Sends an approval card decision; the pane drops it while a turn runs. */
	onDecideApproval: (approvalId: string, approved: boolean) => void;
	/** Sends the answers of the request tray, with the summary for the user bubble. */
	onAnswerQuestions: (input: {
		message: string;
		answers: TurnQuestionAnswer[];
		/** Files of a typed message that also answers a skipped round. */
		files?: FileUIPart[];
	}) => void;
	/** Stops the running turn. The Stop button shows only while `isSending`. */
	onCancel: () => void;
	/** Sentence of the last rejected send, or null. Shown as an alert under the list. */
	errorText: string | null;
	/** Hides the chat. The header button calls it; the page stores the choice. */
	onCollapse: () => void;
	/** Opens the Secrets panel from a step row. Absent while the Cloud panels are off. */
	onOpenSecrets?: () => void;
	className?: string;
};

/** The chat card: header, message list with the status line, and the composer. */
export function ChatPane({
	messages,
	turnEstimateCredits,
	targets,
	onRemoveTarget,
	isSending,
	phase,
	isFirstTurn,
	liveMessageId,
	isDeveloperView,
	onChangeDeveloperView,
	onOpenActivity,
	isReady,
	projectName,
	onSend,
	onDecideApproval,
	onAnswerQuestions,
	onCancel,
	errorText,
	onCollapse,
	onOpenSecrets,
	className,
}: ChatPaneProps) {
	const { t } = useTranslation();
	const listRef = useRef<HTMLDivElement>(null);
	const contentRef = useRef<HTMLDivElement>(null);
	const [draft, setDraft] = useState("");
	// Product rule: in production the live reply shows only as the status line.
	// The developer view renders it as it streams, with every step.
	const shownMessages = isDeveloperView
		? messages
		: messages.filter((message) => message.id !== liveMessageId);
	const liveMessage =
		messages.find((message) => message.id === liveMessageId) ?? null;
	const retryInput = isSending ? null : retryInputOf(messages);
	const lastMessageId = messages.at(-1)?.id;

	// The tray shows the open questions of the last reply. A rejected answer
	// leaves its user bubble after that reply, and the questions stay open.
	const lastReply = messages.findLast(
		(message) => message.role === "assistant",
	);
	const openQuestions: TrayQuestion[] =
		lastReply?.parts.flatMap((part) =>
			part.type === "data-question" && part.data.isOpen ? [part.data] : [],
		) ?? [];
	const tray = useRequestTray({
		questions: openQuestions,
		draft,
		onSubmit: onAnswerQuestions,
	});

	useAutoScroll(listRef, contentRef, isSending);

	return (
		<div className={cn("flex min-h-0 flex-col overflow-hidden", className)}>
			<div className="flex h-12 shrink-0 items-center gap-2 border-b px-4">
				<span className="font-medium text-[15px]">
					{t("appBuilder.chat.title")}
				</span>
				<span className="min-w-0 truncate text-[13px] text-muted-foreground">
					· {projectName}
				</span>
				<span className="ms-auto flex items-center gap-0.5">
					{onChangeDeveloperView !== null ? (
						<SegmentedControl
							className="me-1"
							ariaLabel={t("appBuilder.chat.devView.label")}
							options={[
								{
									value: "production",
									label: t("appBuilder.chat.devView.production"),
								},
								{
									value: "developer",
									label: t("appBuilder.chat.devView.developer"),
								},
							]}
							value={isDeveloperView ? "developer" : "production"}
							onChange={(next) => onChangeDeveloperView(next === "developer")}
						/>
					) : null}
					{isSending ? (
						<>
							{/* Decorative only: the status line in the list already carries role="status". */}
							<span
								aria-hidden
								className="me-1.5 size-[7px] animate-pulse-soft rounded-full bg-primary"
							/>
							<Tooltip>
								<TooltipTrigger asChild>
									<Button
										variant="ghost"
										size="icon-sm"
										aria-label={t("appBuilder.chat.stop")}
										onClick={onCancel}
									>
										<Square className="size-4" />
									</Button>
								</TooltipTrigger>
								<TooltipContent side="bottom">
									{t("appBuilder.chat.stop")}
								</TooltipContent>
							</Tooltip>
						</>
					) : null}
					<Tooltip>
						<TooltipTrigger asChild>
							<Button
								variant="ghost"
								size="icon-sm"
								aria-label={t("appBuilder.topBar.collapseChat")}
								onClick={onCollapse}
							>
								{/* In RTL the chat sits on the right, so the icon mirrors. */}
								<PanelLeftClose className="size-4 rtl:-scale-x-100" />
							</Button>
						</TooltipTrigger>
						<TooltipContent side="bottom">
							{t("appBuilder.topBar.collapseChat")}
						</TooltipContent>
					</Tooltip>
				</span>
			</div>
			<div
				ref={listRef}
				className="scroll-warm min-h-0 flex-1 overflow-y-auto px-4 pt-4 pb-3"
			>
				<div ref={contentRef} className="flex flex-col gap-5">
					{shownMessages.map((message) => (
						<ChatMessageView
							key={message.id}
							message={message}
							isDeveloperView={isDeveloperView}
							onOpenActivity={onOpenActivity}
							onOpenSecrets={onOpenSecrets}
							onRetry={
								message.id === lastMessageId && retryInput !== null
									? () => onSend(retryInput)
									: undefined
							}
							// One active turn per project. The card stays clickable while a
							// turn runs, so the pane drops a second send.
							onDecideApproval={(approvalId, approved) => {
								if (!isSending) onDecideApproval(approvalId, approved);
							}}
							trayQuestionKey={tray.questionKey}
						/>
					))}
					{isSending ? (
						<WorkingRow
							status={liveStatusOf(liveMessage, { phase, isFirstTurn })}
							// The developer view shows the live reply with its own byline.
							showsByline={!isDeveloperView || liveMessage === null}
							showsElapsed={isDeveloperView}
							// The details panel needs at least one thought, step, or note to show.
							onOpen={
								!isDeveloperView &&
								liveMessage !== null &&
								liveMessage.parts.some(isActivityPart)
									? () => onOpenActivity(liveMessage.id)
									: null
							}
						/>
					) : null}
				</div>
			</div>
			{errorText !== null ? (
				<p
					role="alert"
					dir="auto"
					className="shrink-0 px-4 pb-2 text-destructive text-sm"
				>
					{errorText}
				</p>
			) : null}
			<div className="shrink-0 px-4 pt-2 pb-4">
				<Composer
					turnEstimateCredits={turnEstimateCredits}
					targets={targets}
					onRemoveTarget={onRemoveTarget}
					// The composer also locks while the chat id and the history load.
					// A send without the id drops the turn; a send before the history
					// puts the reply above it.
					isSending={isSending || !isReady}
					onSend={(input) => {
						// A plain message after the skip X also answers the skipped
						// round, so the paused agent hears it.
						const answers = tray.dismissedAnswersFor(input.text);
						if (answers === null) {
							onSend(input);
						} else {
							onAnswerQuestions({
								message: input.text,
								answers,
								files: input.files,
							});
						}
					}}
					onDraftChange={setDraft}
					submitOverride={tray.submit}
					topSlot={
						<MotionConfig reducedMotion="user">
							<AnimatePresence initial={false}>
								{tray.state !== null ? (
									<TrayReveal key={tray.roundKey}>
										<RequestTray
											state={tray.state}
											onDelegate={tray.delegate}
											onDismiss={tray.dismiss}
											bodyCallbacks={tray.bodyCallbacks}
										/>
									</TrayReveal>
								) : null}
							</AnimatePresence>
						</MotionConfig>
					}
				/>
			</div>
		</div>
	);
}

/**
 * The message that the Retry button of the last reply sends again, or null.
 * The last reply must hold an error, and the message before it must be the
 * user message of that turn. An approval answer has no user bubble, so its
 * failed reply gets no Retry. A stopped turn has no error: no Retry either.
 */
function retryInputOf(
	messages: readonly BuilderMessage[],
): SendBuilderMessageInput | null {
	const reply = messages.at(-1);
	const userMessage = messages.at(-2);
	if (reply?.role !== "assistant" || userMessage?.role !== "user") return null;
	// Every failure can be sent again, also a stop on a credit cap: the
	// agent then continues from the files that the stop committed.
	if (!reply.parts.some((part) => part.type === "data-error")) return null;
	return {
		text: userMessage.parts
			.flatMap((part) => (part.type === "text" ? [part.text] : []))
			.join("\n\n"),
		files: userMessage.parts.filter(
			(part): part is FileUIPart => part.type === "file",
		),
	};
}
