/**
 * The chat card of the app builder. The header shows the project name, the
 * pulsing turn dot with a Stop button while a turn runs, and the collapse
 * button. Below it sit the scrolling message list with a "Load earlier
 * messages" button at the top while older pages exist, one working row
 * while a turn runs, an alert row for a refused send (`errorText`), and the
 * composer pinned at the bottom. When the agent asks the user something,
 * the request tray opens on top of the composer. The raw thought rows show
 * only with `showsAgentDebug`. Rendered by pages/app-builder-page.tsx,
 * which owns the thread hook and the card chrome. Renders chat-message.tsx,
 * working-row.tsx, composer.tsx, and the request tray.
 */

import type { TurnQuestionAnswer, TurnStreamPhase } from "@wandit/contracts";
import { Button } from "@wandit/ui/components/button";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@wandit/ui/components/tooltip";
import { cn } from "@wandit/ui/lib/utils";
import { PanelLeftClose, Square } from "lucide-react";
import { AnimatePresence, MotionConfig } from "motion/react";
import {
	type RefObject,
	useCallback,
	useEffect,
	useLayoutEffect,
	useRef,
	useState,
} from "react";

import { useTranslation } from "@/lib/i18n";
import type { SendBuilderMessageInput } from "../../api/app-builder.services";
import type { BuilderMessage } from "../../api/dto";
import { liveActivityOf, withoutThoughts } from "../../lib/turn-parts";
import { type TrayQuestion, useRequestTray } from "../../lib/use-request-tray";
import { ChatMessageView } from "./chat-message";
import { Composer } from "./composer";
import { RequestTray } from "./request-tray/request-tray";
import { TrayReveal } from "./request-tray/tray-reveal";
import { WorkingRow } from "./working-row";

export type ChatPaneProps = {
	/** Messages of the thread, oldest first. */
	messages: BuilderMessage[];
	/** Credits one turn costs, whole credits. Shown next to the send button. */
	turnEstimateCredits: number;
	/** Screen or element the next turn targets, shown as a chip above the textarea. */
	focusLabel: string | null;
	/** True while a turn runs. Locks the composer and shows the working row. */
	isSending: boolean;
	/** Phase of the running turn, from useBuilderThread. With `isFirstTurn` it picks the working row label. */
	phase: TurnStreamPhase | null;
	/** True on the first turn of the project, null while the history loads. From useBuilderThread. Picks the preparation lines. */
	isFirstTurn: boolean | null;
	/** True shows the raw thought rows and the seconds counter. True in local dev or for staff. */
	showsAgentDebug: boolean;
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
	}) => void;
	/** Stops the running turn. The Stop button shows only while `isSending`. */
	onCancel: () => void;
	/** Sentence of the last rejected send, or null. Shown as an alert under the list. */
	errorText: string | null;
	/** Hides the chat. The header button calls it; the page stores the choice. */
	onCollapse: () => void;
	/** Opens the preview on a saved version. The change card calls it. */
	onPreviewVersion: (versionNumber: number) => void;
	/** True while the stored chat has an older page. Shows the "Load earlier messages" button. From useBuilderThread. */
	hasOlderMessages: boolean;
	/** True while the older page loads. Disables the button. */
	isLoadingOlderMessages: boolean;
	/** Loads the next older page. The list keeps the message the user reads in place. */
	onLoadOlderMessages: () => void;
	className?: string;
};

export function ChatPane({
	messages,
	turnEstimateCredits,
	focusLabel,
	isSending,
	phase,
	isFirstTurn,
	showsAgentDebug,
	isReady,
	projectName,
	onSend,
	onDecideApproval,
	onAnswerQuestions,
	onCancel,
	errorText,
	onCollapse,
	onPreviewVersion,
	hasOlderMessages,
	isLoadingOlderMessages,
	onLoadOlderMessages,
	className,
}: ChatPaneProps) {
	const { t } = useTranslation();
	const listRef = useRef<HTMLDivElement>(null);
	const contentRef = useRef<HTMLDivElement>(null);
	const [draft, setDraft] = useState("");
	// Raw thinking is for debugging. Users see only the labels of the working row.
	const shownMessages = showsAgentDebug ? messages : withoutThoughts(messages);

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

	const keepPositionForOlder = useAutoScroll(
		listRef,
		contentRef,
		isSending,
		isLoadingOlderMessages,
	);

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
					{isSending ? (
						<>
							{/* Decorative only: the working row in the list already carries role="status". */}
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
				// The browser scroll anchor is off. It moves the list a second time
				// after the manual position fix of an older page.
				className="scroll-warm min-h-0 flex-1 overflow-y-auto px-4 pt-4 pb-3 [overflow-anchor:none]"
			>
				<div ref={contentRef} className="flex flex-col gap-5">
					{hasOlderMessages ? (
						<Button
							variant="ghost"
							size="sm"
							className="self-center text-muted-foreground"
							disabled={isLoadingOlderMessages}
							aria-busy={isLoadingOlderMessages}
							onClick={() => {
								keepPositionForOlder();
								onLoadOlderMessages();
							}}
						>
							{t(
								isLoadingOlderMessages
									? "appBuilder.chat.loadingEarlier"
									: "appBuilder.chat.loadEarlier",
							)}
						</Button>
					) : null}
					{shownMessages.map((message) => (
						<ChatMessageView
							key={message.id}
							message={message}
							onPreviewVersion={onPreviewVersion}
							// A follow-up or an accepted suggestion is a normal build turn.
							// The cards stay clickable while a turn runs, so the pane drops a second send.
							onSendText={(text) => {
								if (!isSending) onSend({ text, mode: "build" });
							}}
							// Same drop rule as onSendText: one active turn per project.
							onDecideApproval={(approvalId, approved) => {
								if (!isSending) onDecideApproval(approvalId, approved);
							}}
							trayQuestionKey={tray.questionKey}
						/>
					))}
					{isSending ? (
						<WorkingRow
							activity={liveActivityOf(messages, {
								phase,
								isFirstTurn,
								showsThoughts: showsAgentDebug,
							})}
							phase={phase}
							showsElapsed={showsAgentDebug}
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
					focusLabel={focusLabel}
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
							onAnswerQuestions({ message: input.text, answers });
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

/** A list end at most this far below the view still counts as "at the end" (px). */
const NEAR_BOTTOM_PX = 120;

/**
 * Keeps the end of the list in view while content grows: new messages,
 * streamed text, new feed rows, and a tray that shrinks the list. A scroll
 * up stops the follow, so the user can read. A new send starts it again.
 * Returns the call to make before an older page loads. The list then keeps
 * the read message in place when the page goes in above it.
 */
function useAutoScroll(
	listRef: RefObject<HTMLDivElement | null>,
	contentRef: RefObject<HTMLDivElement | null>,
	/** True while a turn runs; a new send jumps to the end. */
	isSending: boolean,
	/** True while an older page loads; its end puts the saved position back. */
	isLoadingOlder: boolean,
): () => void {
	// True while the list follows new content. The scroll handler and the
	// send effect set it.
	const isFollowingRef = useRef(true);
	// Distance in px from the scroll position to the end of the content when
	// an older page was asked for. Null while no older page loads.
	const distanceFromEndRef = useRef<number | null>(null);

	useEffect(() => {
		const list = listRef.current;
		const content = contentRef.current;
		if (!list || !content) return;
		let lastScrollTop = list.scrollTop;
		const onScroll = () => {
			const distance = list.scrollHeight - list.scrollTop - list.clientHeight;
			// A move up means the user reads, also near the end. A follow jump
			// moves down, and at most 1 px from the end counts as the end.
			isFollowingRef.current =
				distance <= 1 ||
				(list.scrollTop >= lastScrollTop && distance <= NEAR_BOTTOM_PX);
			lastScrollTop = list.scrollTop;
		};
		const follow = () => {
			if (isFollowingRef.current) list.scrollTop = list.scrollHeight;
		};
		follow();
		list.addEventListener("scroll", onScroll, { passive: true });
		// The content grows while text streams; the list shrinks when the tray opens.
		const observer = new ResizeObserver(follow);
		observer.observe(content);
		observer.observe(list);
		return () => {
			list.removeEventListener("scroll", onScroll);
			observer.disconnect();
		};
	}, [listRef, contentRef]);

	// A send shows its bubble and the working row, also after a scroll up.
	useEffect(() => {
		const list = listRef.current;
		if (!isSending || !list) return;
		isFollowingRef.current = true;
		list.scrollTop = list.scrollHeight;
	}, [isSending, listRef]);

	// The older page renders in the same commit that ends the load. A layout
	// effect puts the position back before the browser paints the jump.
	// LIMIT: text that streams in during the load moves the view by its
	// height. Upgrade: anchor on the first message node instead of the end.
	useLayoutEffect(() => {
		const list = listRef.current;
		const distanceFromEnd = distanceFromEndRef.current;
		if (isLoadingOlder || !list || distanceFromEnd === null) return;
		distanceFromEndRef.current = null;
		list.scrollTop = list.scrollHeight - distanceFromEnd;
	}, [isLoadingOlder, listRef]);

	return useCallback(() => {
		const list = listRef.current;
		if (!list) return;
		// The follow would jump to the end when the older page grows the content.
		isFollowingRef.current = false;
		distanceFromEndRef.current = list.scrollHeight - list.scrollTop;
	}, [listRef]);
}
