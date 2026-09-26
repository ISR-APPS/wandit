/**
 * The chat card of the app builder. The header shows the project name, the
 * pulsing turn dot with a Stop button while a turn runs, and the collapse
 * button. Below it sit the scrolling message list with one working row
 * while a turn runs, an alert row for a refused send (`errorText`), and the
 * composer pinned at the bottom. When the agent asks the user something,
 * the request tray opens on top of the composer. Rendered by
 * pages/app-builder-page.tsx, which owns the thread hook and the card
 * chrome. Renders chat-message.tsx, composer.tsx, and the request tray.
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
import { type RefObject, useEffect, useRef, useState } from "react";

import { useTranslation } from "@/lib/i18n";
import type { SendBuilderMessageInput } from "../../api/app-builder.services";
import type { BuilderMessage } from "../../api/dto";
import { type TrayQuestion, useRequestTray } from "../../lib/use-request-tray";
import { ChatMessageView } from "./chat-message";
import { Composer } from "./composer";
import { RequestTray } from "./request-tray/request-tray";
import { TrayReveal } from "./request-tray/tray-reveal";

export type ChatPaneProps = {
	/** Messages of the thread, oldest first. */
	messages: BuilderMessage[];
	/** Credits one turn costs, whole credits. Shown next to the send button. */
	turnEstimateCredits: number;
	/** Screen or element the next turn targets, shown as a chip above the textarea. */
	focusLabel: string | null;
	/** True while a turn runs. Locks the composer and shows the working indicator. */
	isSending: boolean;
	/** Phase of the running turn; picks the working row label. Null shows "Wandit is working…". */
	phase: TurnStreamPhase | null;
	/** False until the project chat id resolves. Locks the composer together with `isSending`. */
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
	className?: string;
};

export function ChatPane({
	messages,
	turnEstimateCredits,
	focusLabel,
	isSending,
	phase,
	isReady,
	projectName,
	onSend,
	onDecideApproval,
	onAnswerQuestions,
	onCancel,
	errorText,
	onCollapse,
	onPreviewVersion,
	className,
}: ChatPaneProps) {
	const { t } = useTranslation();
	const listRef = useRef<HTMLDivElement>(null);
	const contentRef = useRef<HTMLDivElement>(null);
	const [draft, setDraft] = useState("");

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
				className="scroll-warm min-h-0 flex-1 overflow-y-auto px-4 pt-4 pb-3"
			>
				<div ref={contentRef} className="flex flex-col gap-5">
					{messages.map((message) => (
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
						<WorkingIndicator
							label={
								phase === null
									? t("appBuilder.chat.working")
									: t(`appBuilder.chat.phases.${phase}`)
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
					focusLabel={focusLabel}
					// The composer also locks while the chat id resolves: a send
					// without it would clear the draft and drop the turn.
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
 */
function useAutoScroll(
	listRef: RefObject<HTMLDivElement | null>,
	contentRef: RefObject<HTMLDivElement | null>,
	/** True while a turn runs; a new send jumps to the end. */
	isSending: boolean,
) {
	// True while the list follows new content. The scroll handler and the
	// send effect set it.
	const isFollowingRef = useRef(true);

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
}

// A 3 by 3 grid. Each pixel starts later along the diagonal, so the shimmer runs corner to corner.
const PIXEL_GRID = [0, 1, 2].flatMap((row) =>
	[0, 1, 2].map((column) => ({
		key: `${row}${column}`,
		delayMs: (row + column) * 120,
	})),
);

/** Shimmering pixel grid, the working label, and the seconds since the row appeared. */
function WorkingIndicator({ label }: { label: string }) {
	const { t, locale } = useTranslation();
	const [startedAt] = useState(() => Date.now());
	const [elapsedMs, setElapsedMs] = useState(0);

	// One tick per 100 ms reads the clock, so a slow tab does not drift the counter.
	useEffect(() => {
		const timer = setInterval(() => setElapsedMs(Date.now() - startedAt), 100);
		return () => clearInterval(timer);
	}, [startedAt]);

	const seconds = new Intl.NumberFormat(locale, {
		minimumFractionDigits: 1,
		maximumFractionDigits: 1,
	}).format(elapsedMs / 1000);

	return (
		<div
			role="status"
			className="flex items-center gap-2.5 text-muted-foreground text-sm"
		>
			<span aria-hidden className="grid size-3.5 shrink-0 grid-cols-3 gap-px">
				{PIXEL_GRID.map((pixel) => (
					<span
						key={pixel.key}
						className="animate-pulse-soft rounded-[1px] bg-primary"
						style={{ animationDelay: `${pixel.delayMs}ms` }}
					/>
				))}
			</span>
			<span>{label}</span>
			<span className="font-mono text-xs tabular-nums">
				{t("appBuilder.chat.elapsed", { seconds })}
			</span>
		</div>
	);
}
