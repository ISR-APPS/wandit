// Collapsible chat pane: persisted history, live AI SDK stream parts and the
// compact ember PromptBox. Sizing/positioning (resizable panel on desktop,
// full-screen overlay on mobile) is owned by the parent layout — this
// component only fills its container (desktop passes card chrome via
// className) and self-inerts when collapsed.

import { useQueryClient } from "@tanstack/react-query";
import type {
	ComposerMetadata,
	UploadAttachmentResponse,
} from "@wandit/contracts";
import { Button } from "@wandit/ui/components/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@wandit/ui/components/dropdown-menu";
import { Skeleton } from "@wandit/ui/components/skeleton";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@wandit/ui/components/tooltip";
import { cn } from "@wandit/ui/lib/utils";
import {
	AlertTriangle,
	Crosshair,
	MoreHorizontal,
	PanelLeftClose,
} from "lucide-react";
import { AnimatePresence } from "motion/react";
import { Fragment, useEffect, useMemo, useRef, useState } from "react";

import { Spark } from "@/components/logo";
import { OutOfCreditsBanner, useOutOfCredits } from "@/features/credits";
import { PromptBox } from "@/features/projects";
import { useDictionary, useTranslation } from "@/lib/i18n";
import { readStoredBuilderGatewayModel } from "@/lib/model-labels";
import { pageKeys } from "../../api/pages.queries";
import { useSharedAiChat } from "../../lib/ai-chat-context";
import { chatErrorPresentation } from "../../lib/ai-error-copy";
import { useWorkspace } from "../../lib/store";
import {
	aiErrorNoticeKey,
	findLastTerminalAiErrorMessage,
	messageHasQueuedToolWork,
} from "../../lib/use-ai-chat";
import { usePageEditor } from "../../lib/use-page-editor";
import { ThinkingIndicator } from "./chat-message";
import { MOCK_CHAT_THREAD_ENABLED, MockChatThread } from "./mock-thread";
import { ConversationModelIndicator } from "./model-indicator";
import { MessageParts } from "./parts/message-parts";
import { isVisibleAssistantReplyPart } from "./parts/visible-reply-part";
import { RequestTray } from "./request-tray/request-tray";
import { TrayReveal } from "./request-tray/tray-reveal";
import { TrayStatusPill } from "./request-tray/tray-signals";
import { useRequestTray } from "./request-tray/use-request-tray";
import { StatusMessageHeader } from "./status-message-header";
import { TargetChip } from "./target-chip";
import { ConversationContextMeter } from "./token-usage";

export function ChatPane({ className }: { className?: string }) {
	const { t, dir } = useTranslation();
	const dictionary = useDictionary();
	const { chatOpen, toggleChat, project, projectId } = useWorkspace();
	const {
		messages,
		status,
		error,
		billingError,
		aiError,
		notices,
		isResolvingChat,
		isLoadingMessages,
		composerPrefill,
		retryTurn,
		sendText,
		answerAskUser,
		addToolApprovalResponse,
	} = useSharedAiChat();
	const editor = usePageEditor();
	// Empty pool: the composer locks and the banner above it owns the upgrade
	// CTA. Derived from the polled balance query, so a resubscribe or top-up
	// unlocks it without any manual refresh.
	const { outOfCredits } = useOutOfCredits();

	const errorPresentation = chatErrorPresentation(error, aiError, t);
	const failedMessage = useMemo(
		() => findLastTerminalAiErrorMessage(messages),
		[messages],
	);
	const failedMessageIsLast =
		failedMessage !== undefined && failedMessage.id === messages.at(-1)?.id;
	const failedMessageHasQueuedWork = messageHasQueuedToolWork(failedMessage);
	const retryIsIdle = status !== "submitted" && status !== "streaming";
	const showRetry =
		errorPresentation.showRetry &&
		retryIsIdle &&
		failedMessageIsLast &&
		!failedMessageHasQueuedWork;
	const showQueuedHint =
		errorPresentation.retryable &&
		retryIsIdle &&
		failedMessageIsLast &&
		failedMessageHasQueuedWork;

	// Mirror of the PromptBox draft (via onValueChange) — the tray needs to
	// know when typed text should override its chips (design 10n state 2).
	const [composerText, setComposerText] = useState("");
	// biome-ignore lint/correctness/useExhaustiveDependencies: revision must replay an identical prefill after the user edited the previous draft
	useEffect(() => {
		setComposerText(composerPrefill.value);
	}, [composerPrefill.revision, composerPrefill.value]);
	const [pickerBuilderModel, setPickerBuilderModel] = useState<
		string | undefined
	>(() => (import.meta.env.DEV ? readStoredBuilderGatewayModel() : undefined));

	// The live "waiting on you" state: derives the docked ask from the message
	// list and answers it through answerAskUser (chips, free text, escape
	// hatch and dismiss all complete the same tool call).
	const tray = useRequestTray({
		messages,
		composerText,
		onAnswer: answerAskUser,
	});

	const scrollRef = useRef<HTMLDivElement>(null);
	const pending = isResolvingChat || isLoadingMessages;
	const isSubmitting = status === "submitted" || status === "streaming";

	// The stream opens with invisible parts (step-start, reasoning) well before
	// the first visible word, and `status` flips from "submitted" to "streaming"
	// on the first of those — so gating the dots on "submitted" alone leaves a
	// blank gap. Keep them up until the reply has something to show, so the
	// dots are replaced by the streamed text instead of empty space.
	const lastMessage = messages[messages.length - 1];
	const replyHasVisibleContent =
		lastMessage?.role === "assistant" &&
		lastMessage.parts.some(isVisibleAssistantReplyPart);
	const showThinking = isSubmitting && !replyHasVisibleContent;

	// Click-to-target (contract §12): the active selection renders as a
	// removable chip above the composer and rides the NEXT send as
	// metadata.selectedWids (WS3 wires the transport; the ref records it now).
	// Submit routing: while an ask is docked, typed text ANSWERS it (free-text
	// ask, or typing-override on a chips ask) instead of opening a new user
	// turn; otherwise it's a normal message carrying the composer metadata and
	// any uploaded attachments as AI SDK file parts. `false` from sendText
	// keeps the draft (PromptBox clearOnSubmit contract).
	const handleComposerSubmit = async (
		prompt: string,
		composer: ComposerMetadata,
		attachments: UploadAttachmentResponse[],
	) => {
		if (tray.answerable) {
			tray.answerFreeText(prompt, attachments);
			setComposerText("");
			return true;
		}
		// Select (Cibler) is the only mode whose selection rides the main
		// composer. An edit-mode selection belongs to the manual inspector.
		const isTargeting = editor.mode === "select";
		const target = isTargeting ? editor.selection : null;
		const selectedTarget = target
			? {
					wid: target.wid,
					tag: target.tag,
					excerpt: target.excerpt,
				}
			: undefined;
		const sent = await sendText(prompt, {
			files: attachments,
			composer,
			selectedWids: target ? [target.wid] : undefined,
			selectedTargets: selectedTarget ? [selectedTarget] : undefined,
		});
		// Selection is per-message: a successful send consumes the chip.
		if (sent && isTargeting) editor.clearSelection();
		return sent;
	};

	// While ask_user is docked, the normal send arrow becomes the answer CTA.
	// In a multi-question turn it doubles as "Next": confirming re-derives the
	// tray from the updated messages, so the next pending ask docks in place —
	// no index is stored anywhere that could go stale when parts update. Text
	// overrides chip drafts; otherwise labels reflect single vs. multi
	// selection, while the hook remains the source of truth for validity.
	const answerSubmitLabel =
		tray.answerMode === "text"
			? t("workspace.chat.tray.answer")
			: tray.answerMode === "attachments"
				? t("workspace.chat.tray.sendFiles", { count: tray.readyFileCount })
				: tray.selectedCount > 0
					? t("workspace.chat.tray.chooseSelected", {
							count: tray.selectedCount,
						})
					: tray.answerMode === "single"
						? t("workspace.chat.tray.chooseAnOption")
						: t("workspace.chat.tray.chooseOptions");

	// Keep the newest message in view while history grows or text streams in.
	// biome-ignore lint/correctness/useExhaustiveDependencies: every dep is an intentional re-scroll trigger
	useEffect(() => {
		const el = scrollRef.current;
		if (el) el.scrollTop = el.scrollHeight;
	}, [messages, status, pending, error, aiError, notices]);

	// The Page tab's overview query only POLLS once it has seen a running
	// attempt — so a build queued right now would go unnoticed (the tab stays
	// mounted, focus-refetch is off). When the stream reports "queued", poke
	// the overview cache awake; its own refetchInterval takes over from there.
	const queryClient = useQueryClient();
	const queuedAttemptId = useMemo(() => {
		for (let i = messages.length - 1; i >= 0; i--) {
			const parts = messages[i]?.parts ?? [];
			for (let j = parts.length - 1; j >= 0; j--) {
				const part = parts[j];
				if (
					part?.type === "tool-generate_page" &&
					part.state === "output-available" &&
					part.output.status === "queued"
				) {
					return part.output.attemptId;
				}
			}
		}
		return undefined;
	}, [messages]);

	useEffect(() => {
		if (!queuedAttemptId) return;
		void queryClient.invalidateQueries({
			queryKey: pageKeys.overview(projectId),
		});
	}, [queuedAttemptId, queryClient, projectId]);

	const isEmpty = !pending && messages.length === 0 && !error;
	let noticeOwnerMessageId: string | undefined;
	for (let index = messages.length - 1; index >= 0; index -= 1) {
		if (messages[index]?.role === "assistant") {
			noticeOwnerMessageId = messages[index]?.id;
			break;
		}
	}
	const noticeRows = notices.map((notice) => {
		const presentation = chatErrorPresentation(null, notice, t);
		return (
			<div key={aiErrorNoticeKey(notice)}>
				<StatusMessageHeader
					avatarClass="border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300"
					kickerClass="text-amber-700 dark:text-amber-300"
					kicker={presentation.kicker}
				>
					<AlertTriangle className="size-3" aria-hidden />
				</StatusMessageHeader>
				<p
					dir="auto"
					className="text-[13px] text-muted-foreground leading-[1.5]"
				>
					{presentation.body}
				</p>
			</div>
		);
	});

	return (
		<aside
			// inert removes the collapsed pane's controls from tab order and AT —
			// the resizable panel shrinks it to zero width rather than unmounting it.
			inert={!chatOpen}
			className={cn(
				"relative z-30 flex h-full min-h-0 w-full flex-col overflow-hidden bg-card",
				className,
			)}
		>
			<div className="flex h-full w-full flex-col">
				{/* Screenreader announcement for the otherwise-visual stream states. */}
				<span aria-live="polite" className="sr-only">
					{status === "submitted" || status === "streaming"
						? t("workspace.chat.thinking")
						: ""}
				</span>
				<div className="flex h-12 shrink-0 items-center justify-between border-b px-4">
					<span className="flex min-w-0 items-baseline gap-2 font-medium text-[15px]">
						{t("workspace.chat.title")}
						{project?.name ? (
							<span
								dir="auto"
								className="min-w-0 truncate font-normal text-[13px] text-muted-foreground"
							>
								· {project.name}
							</span>
						) : null}
					</span>
					<div className="flex items-center gap-0.5">
						{/* Companion signal to the docked tray (design: pill lives in the
                chat header while an ask waits on the composer). */}
						{tray.active && tray.state ? (
							<TrayStatusPill label={tray.state.label} className="me-1.5" />
						) : null}
						<DropdownMenu>
							<DropdownMenuTrigger asChild>
								<Button
									variant="ghost"
									size="icon-sm"
									className="text-muted-foreground"
									aria-label={t("workspace.chat.menuLabel")}
								>
									<MoreHorizontal className="size-4" />
								</Button>
							</DropdownMenuTrigger>
							<DropdownMenuContent align="end">
								<DropdownMenuItem onSelect={toggleChat}>
									<PanelLeftClose className="size-4" />
									{t("workspace.chat.collapse")}
								</DropdownMenuItem>
							</DropdownMenuContent>
						</DropdownMenu>
						<Tooltip>
							<TooltipTrigger asChild>
								<Button
									variant="ghost"
									size="icon-sm"
									className="text-muted-foreground"
									onClick={toggleChat}
									aria-label={t("workspace.chat.collapse")}
								>
									<PanelLeftClose className="size-[15px]" />
								</Button>
							</TooltipTrigger>
							<TooltipContent side={dir === "rtl" ? "left" : "right"}>
								{t("workspace.chat.collapse")}
							</TooltipContent>
						</Tooltip>
					</div>
				</div>

				<div
					ref={scrollRef}
					className="scroll-warm min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pt-5 pb-2"
				>
					{MOCK_CHAT_THREAD_ENABLED ? (
						<MockChatThread onSend={sendText} />
					) : pending ? (
						<div className="flex flex-col gap-4">
							<Skeleton className="ms-auto h-14 w-3/4 rounded-2xl" />
							<Skeleton className="h-20 w-5/6 rounded-xl" />
							<Skeleton className="ms-auto h-10 w-2/3 rounded-2xl" />
						</div>
					) : isEmpty ? (
						<div className="flex h-full flex-col items-center justify-center gap-2 text-center">
							<Spark className="size-5 text-primary/60" />
							<p className="font-display font-semibold text-sm">
								{t("workspace.chat.emptyTitle")}
							</p>
							<p className="max-w-56 text-muted-foreground text-xs leading-relaxed">
								{t("workspace.chat.emptyBody")}
							</p>
							<p className="mt-4 font-mono text-[10px] text-muted-foreground/70 uppercase tracking-widest">
								{t("workspace.chat.suggestionsKicker")}
							</p>
							<div className="flex flex-col items-center gap-1.5">
								{dictionary.workspace.chat.suggestions.map((suggestion) => (
									<Button
										key={suggestion}
										type="button"
										variant="outline"
										size="sm"
										className="h-7 rounded-full bg-card px-3 font-normal text-muted-foreground text-xs shadow-none hover:text-foreground"
										onClick={() => void sendText(suggestion)}
									>
										{suggestion}
									</Button>
								))}
							</div>
						</div>
					) : (
						<div className="flex flex-col gap-5">
							{messages.map((message, index) => (
								<Fragment key={message.id}>
									{message.id === noticeOwnerMessageId ? noticeRows : null}
									<MessageParts
										message={message}
										isStreaming={
											status === "streaming" && index === messages.length - 1
										}
										isLastAssistantMessage={
											message.role === "assistant" &&
											index === messages.length - 1
										}
										chatStatus={status}
										onRetry={retryTurn}
										suppressAiError={
											aiError !== null && message.id === failedMessage?.id
										}
										activeAskToolCallId={tray.toolCallId}
										onToolApprovalResponse={addToolApprovalResponse}
									/>
								</Fragment>
							))}
							{noticeOwnerMessageId ? null : noticeRows}
							{showThinking ? (
								<ThinkingIndicator label={t("workspace.chat.thinking")} />
							) : null}
							{(aiError ?? error) &&
							errorPresentation.showBanner &&
							!billingError ? (
								<div>
									<StatusMessageHeader
										avatarClass="border-destructive/38 bg-destructive/14 text-destructive"
										kickerClass="text-destructive"
										kicker={errorPresentation.kicker}
									>
										<AlertTriangle className="size-3" aria-hidden />
									</StatusMessageHeader>
									<p
										dir="auto"
										className="text-[13px] text-muted-foreground leading-[1.5]"
									>
										{errorPresentation.body}
									</p>
									{errorPresentation.attribution ? (
										<p
											dir="auto"
											className="mt-1 text-[12px] text-muted-foreground leading-[1.5]"
										>
											{errorPresentation.attribution}
										</p>
									) : null}
									{showRetry ? (
										<div className="mt-3 flex flex-col items-start gap-1">
											<Button
												type="button"
												variant="outline"
												size="sm"
												onClick={retryTurn}
											>
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
							) : null}
						</div>
					)}
				</div>

				<div className="shrink-0 px-4 pt-3.5 pb-4">
					{import.meta.env.DEV ? (
						<>
							<ConversationContextMeter messages={messages} />
							<ConversationModelIndicator
								messages={messages}
								pickerBuilderModel={pickerBuilderModel}
							/>
						</>
					) : null}
					{/* Click-to-target chip (contract §12) — sibling of the tray slot
					    on purpose: the tray owns topSlot. Edit-mode selection stays
					    within the manual inspector. */}
					{editor.mode === "select" && editor.selection ? (
						<div className="mb-2 flex items-center">
							<TargetChip
								target={{
									wid: editor.selection.wid,
									tag: editor.selection.tag,
									excerpt: editor.selection.excerpt,
								}}
								accessibleLabel={t("workspace.page.editor.selectedElement")}
								onClear={editor.clearSelection}
								clearLabel={t("workspace.page.editor.clearTarget")}
								className="pe-1"
							/>
						</div>
					) : editor.mode === "select" ? (
						<div className="mb-2 flex items-center gap-1.5 text-muted-foreground text-xs">
							<Crosshair className="size-3 shrink-0" aria-hidden />
							{t("workspace.page.editor.targetHint")}
						</div>
					) : null}
					<OutOfCreditsBanner active={outOfCredits}>
						<PromptBox
							key={composerPrefill.revision}
							variant="compact"
							showEngines
							clearOnSubmit
							attachmentsEnabled
							disabled={outOfCredits}
							placeholder={t("workspace.chat.placeholder")}
							initialValue={composerPrefill.value}
							onSubmit={handleComposerSubmit}
							onValueChange={setComposerText}
							onBuilderModelChange={
								import.meta.env.DEV ? setPickerBuilderModel : undefined
							}
							isSubmitting={isSubmitting}
							submitOverride={
								tray.active
									? {
											label: answerSubmitLabel,
											disabled: !tray.canConfirm,
											onSubmit: tray.confirmDraft,
										}
									: undefined
							}
							// The tray fuses into the composer card (design turn 10) — it
							// grows out of the top and collapses on answer/dismiss thanks to
							// AnimatePresence + TrayReveal's height animation. Keying by
							// toolCallId also makes each stepper advance exit/re-enter.
							topSlot={
								<AnimatePresence initial={false}>
									{tray.active && tray.state ? (
										<TrayReveal key={tray.toolCallId ?? "ask"}>
											<RequestTray
												state={tray.state}
												onEscape={tray.delegate}
												onDismiss={tray.dismiss}
												bodyCallbacks={{
													onPick: tray.onPick,
													multiSelectedIds: tray.multiSelectedIds,
													onToggleMulti: tray.onToggleMulti,
													onBrowseFiles: tray.onBrowseFiles,
													onRemoveAttachment: tray.onRemoveAttachment,
												}}
											/>
										</TrayReveal>
									) : null}
								</AnimatePresence>
							}
						/>
					</OutOfCreditsBanner>
				</div>
			</div>
		</aside>
	);
}
