import { useTranslation } from "@wandit/internationalization/react";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
	AccessibilityInfo,
	Platform,
	ScrollView,
	Text,
	View,
} from "react-native";
import { KeyboardStickyView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { RadialGlow } from "@/components/radial-glow";
import { useAppTheme } from "@/contexts/app-theme-context";
import { OutOfCreditsBanner, useOutOfCredits } from "@/features/credits";
import {
	CHAT_PROMPT_MAX_LENGTH,
	PromptBox,
	type PromptDraft,
	useProject,
} from "@/features/projects";

import { ChatHeader } from "../components/chat-header";
import {
	ChatEmptyState,
	ChatErrorBanner,
	ChatLoadingState,
	ChatMessages,
	ChatThinkingIndicator,
} from "../components/chat-thread";
import { ProjectSheet } from "../components/project-sheet";
import { RequestTray } from "../components/request-tray/request-tray";
import { TrayReveal } from "../components/request-tray/tray-reveal";
import { useRequestTray } from "../components/request-tray/use-request-tray";
import { StatusMessageHeader } from "../components/status-message-header";
import {
	assistantTurnHasThinkingDismissal,
	coalesceMessageParts,
	entryRendersContent,
} from "../lib/chat-message";
import { pageCommentHandoff } from "../lib/page-preview/comment-handoff";
import { chatStreamErrorKey, useAiChat } from "../lib/use-ai-chat";

/** Project chat: header, live thread (or empty state), and composer — with
    the request tray docked into the top of the composer while an ask_user
    call waits on the user (same pattern as the web ChatPane). */
export function ChatScreen() {
	const { projectId: routeProjectId } = useLocalSearchParams<{
		projectId?: string;
	}>();
	const { t } = useTranslation();
	const insets = useSafeAreaInsets();
	const { isDark } = useAppTheme();
	const scrollRef = useRef<ScrollView>(null);
	const wasSubmittingRef = useRef(false);
	const [sheetOpen, setSheetOpen] = useState(false);

	const projectId =
		typeof routeProjectId === "string" ? routeProjectId : undefined;
	const { data: project } = useProject(projectId);
	const projectName = project?.name ?? t("native.workspace.newProject");
	const {
		messages,
		status,
		streamError,
		historyError,
		billingIntent,
		isResolvingChat,
		isLoadingMessages,
		sendText,
		answerAskUser,
		addToolApprovalResponse,
	} = useAiChat(projectId);

	// Mirror of the PromptBox draft (via onValueChange) — the tray needs to
	// know when typed text should override its chips.
	const [composerText, setComposerText] = useState("");

	// The balance, not the refusal, is the composer lock's authority (web
	// parity): the 15s poll plus billing-error invalidation engage it, and a
	// recovered balance lifts it with no manual unlock path — a refusal-driven
	// lock would trap the user, since billingIntent only clears on send. The
	// same signal expires a stale insufficient-credits banner once the balance
	// recovers; a member-limit refusal is not balance-shaped, so its banner
	// stays until the next send clears the intent.
	const { outOfCredits } = useOutOfCredits();
	const bannerIntent =
		billingIntent &&
		(billingIntent.code === "MEMBER_CREDIT_LIMIT_REACHED" || outOfCredits)
			? billingIntent
			: null;

	const tray = useRequestTray({
		messages,
		composerText,
		onAnswer: answerAskUser,
	});

	const pending = isResolvingChat || isLoadingMessages;
	// History failures (the transcript could not load) and stream failures (the
	// live turn broke) are different problems with different fixes — the web
	// pane separates them and so do we. The generic stream banner stays hidden
	// while a billing refusal is active: the composer banner already tells the
	// user exactly what happened, and two banners would say it twice.
	const visibleError = historyError
		? t("native.workspace.chat.errors.unavailable")
		: null;
	const streamErrorMessage =
		streamError && !billingIntent ? t(chatStreamErrorKey(streamError)) : null;
	const thinkingLabel = t("native.workspace.chat.thinking");
	const isSubmitting = status === "submitted" || status === "streaming";
	const lastMessage = messages.at(-1);
	const showThinking =
		isSubmitting && !assistantTurnHasThinkingDismissal(lastMessage);

	useEffect(() => {
		if (Platform.OS === "ios" && isSubmitting && !wasSubmittingRef.current) {
			AccessibilityInfo.announceForAccessibility(thinkingLabel);
		}
		wasSubmittingRef.current = isSubmitting;
	}, [isSubmitting, thinkingLabel]);

	const hasMessages = useMemo(
		() =>
			messages.some((message) =>
				coalesceMessageParts(message.parts).some(entryRendersContent),
			),
		[messages],
	);
	const showThread =
		hasMessages ||
		showThinking ||
		Boolean(visibleError) ||
		Boolean(streamErrorMessage);
	const scrollVersion = JSON.stringify({
		messageCount: messages.length,
		parts: lastMessage?.parts ?? [],
		trayActive: tray.active,
		visibleError,
		streamErrorMessage,
	});

	// tray.active is a re-scroll trigger too: the tray growing out of the
	// composer shrinks the thread viewport, hiding the message that asked.
	useEffect(() => {
		if (!showThread || scrollVersion.length === 0) return;
		requestAnimationFrame(() =>
			scrollRef.current?.scrollToEnd({ animated: true }),
		);
	}, [showThread, scrollVersion]);

	// Page comment batches (§5a "Send to Wandit") arrive when the preview
	// screen pops back to the chat: consume the handoff once per focus and
	// ship it as ONE user message carrying the ordered wid targets (agent
	// metadata) + display snapshots (history chips) — the web batch format.
	// A failed send re-stashes so the batch survives a retry.
	useFocusEffect(
		useCallback(() => {
			if (!projectId) return;
			const pending = pageCommentHandoff.consume(projectId);
			if (!pending) return;
			void (async () => {
				const accepted = await sendText(pending.text, {
					selectedWids: pending.selectedWids,
					selectedTargets: pending.selectedTargets,
				});
				if (!accepted) pageCommentHandoff.stash(projectId, pending);
			})();
		}, [projectId, sendText]),
	);

	// Submit routing: while an ask is docked, PromptBox routes submits through
	// submitOverride (the answer CTA) instead of onSubmit — this path only
	// handles normal user turns. `false` from sendMessage keeps the draft
	// (PromptBox clearOnSubmit contract).
	async function handleSubmit({ text, composer, files }: PromptDraft) {
		if (tray.answerable) {
			tray.answerFreeText(text);
			setComposerText("");
			return true;
		}
		const accepted = await sendText(text, { composer, files });
		if (accepted) {
			requestAnimationFrame(() =>
				scrollRef.current?.scrollToEnd({ animated: true }),
			);
		}
		return accepted;
	}

	// The send arrow becomes the answer CTA while an ask is docked — its
	// label names the confirm action for the current answer mode (web parity).
	const answerCtaLabel =
		tray.answerMode === "text"
			? t("native.workspace.chat.tray.answer")
			: tray.answerMode === "attachments"
				? t("native.workspace.chat.tray.sendFiles", {
						count: tray.readyFileCount,
					})
				: tray.selectedCount > 0
					? t("native.workspace.chat.tray.chooseSelected", {
							count: tray.selectedCount,
						})
					: tray.answerMode === "single"
						? t("native.workspace.chat.tray.chooseAnOption")
						: t("native.workspace.chat.tray.chooseOptions");

	return (
		<View className="flex-1 bg-background">
			{isDark ? (
				// Ember dusk mood behind the composer (dark prototype §1c).
				<>
					<RadialGlow
						cx="50%"
						cy="130%"
						rx="140%"
						ry="75%"
						stops={[
							{ offset: "0%", color: "#FF7041", opacity: 0.55 },
							{ offset: "42%", color: "#DF6862", opacity: 0.28 },
							{ offset: "62%", color: "#6C5594", opacity: 0.12 },
							{ offset: "80%", color: "#6C5594", opacity: 0 },
						]}
					/>
					<RadialGlow
						cx="50%"
						cy="118%"
						rx="90%"
						ry="40%"
						stops={[
							{ offset: "0%", color: "#FFCF77", opacity: 0.35 },
							{ offset: "70%", color: "#FFCF77", opacity: 0 },
						]}
					/>
				</>
			) : null}

			<ChatHeader
				projectName={projectName}
				onOpenProjectSheet={() => setSheetOpen(true)}
				onOpenPreview={() => {
					if (projectId) router.push(`/project/${projectId}/page`);
				}}
				previewActive={hasMessages}
				trayActive={tray.active}
			/>

			{pending ? (
				<ChatLoadingState />
			) : showThread ? (
				<ScrollView
					ref={scrollRef}
					className="flex-1"
					contentContainerClassName="gap-3.5 px-4 pt-2 pb-3"
				>
					{visibleError ? <ChatErrorBanner message={visibleError} /> : null}
					{projectId ? (
						<ChatMessages
							messages={messages}
							status={status}
							projectId={projectId}
							activeAskToolCallId={tray.toolCallId}
							onToolApprovalResponse={addToolApprovalResponse}
						/>
					) : null}
					{showThinking ? (
						<ChatThinkingIndicator label={thinkingLabel} />
					) : null}
					{streamErrorMessage ? (
						// The live turn broke — the report sits at the bottom of the
						// thread where the user was reading, byline + kicker + body
						// (web parity with the pane's stream-error footer).
						<View className="gap-1.5">
							<StatusMessageHeader
								tone="danger"
								kicker={t("native.workspace.chat.errors.streamKicker")}
							/>
							<Text className="text-[13px] text-muted leading-[19px]">
								{streamErrorMessage}
							</Text>
						</View>
					) : null}
				</ScrollView>
			) : (
				<ChatEmptyState
					onSuggestion={(suggestion) => {
						void sendText(suggestion);
					}}
				/>
			)}

			<KeyboardStickyView offset={{ closed: 0, opened: insets.bottom }}>
				<View className="gap-2.5" style={{ paddingBottom: insets.bottom + 10 }}>
					<View className="px-4">
						<OutOfCreditsBanner active={outOfCredits} intent={bannerIntent}>
							<PromptBox
								variant="compact"
								clearOnSubmit
								disabled={outOfCredits}
								maxLength={CHAT_PROMPT_MAX_LENGTH}
								placeholder={t("native.workspace.composerPlaceholder")}
								onSubmit={handleSubmit}
								submitOverride={
									tray.active
										? {
												label: answerCtaLabel,
												disabled: !tray.canConfirm,
												onSubmit: tray.confirmDraft,
											}
										: undefined
								}
								onValueChange={setComposerText}
								isSubmitting={isSubmitting}
								// The tray fuses into the composer card — it grows out of the
								// top and collapses on answer/dismiss. TrayReveal stays mounted
								// and owns both motions: revealKey names the docked ask, and
								// the outgoing tray collapses inert (no touches).
								topSlot={
									<TrayReveal
										revealKey={
											tray.active && tray.state
												? (tray.toolCallId ?? "ask")
												: null
										}
									>
										{tray.active && tray.state ? (
											<RequestTray
												state={tray.state}
												notice={tray.notice}
												onEscape={tray.delegate}
												onDismiss={tray.dismiss}
												bodyCallbacks={{
													onPick: tray.onPick,
													multiSelectedIds: tray.multiSelectedIds,
													onToggleMulti: tray.onToggleMulti,
													onAttachCamera: () => void tray.onAttachCamera(),
													onAttachLibrary: () => void tray.onAttachLibrary(),
													onAttachBrowse: () => void tray.onAttachBrowse(),
													onRemoveAttachment: tray.onRemoveAttachment,
												}}
											/>
										) : null}
									</TrayReveal>
								}
							/>
						</OutOfCreditsBanner>
						<View className="mt-[13px] flex-row justify-center">
							<Text className="font-mono text-[9.5px] text-muted">
								{t("native.workspace.hints.arfr")}
								{"  ·  "}
								{t("native.workspace.hints.cod")}
								{"  ·  "}
								{t("native.workspace.hints.publish")}
							</Text>
						</View>
					</View>
				</View>
			</KeyboardStickyView>

			{projectId ? (
				<ProjectSheet
					isOpen={sheetOpen}
					onOpenChange={setSheetOpen}
					projectId={projectId}
				/>
			) : null}
		</View>
	);
}
