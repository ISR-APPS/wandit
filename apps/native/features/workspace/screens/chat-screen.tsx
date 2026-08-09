import type { AskUserOutput } from "@wandit/contracts";
import { useTranslation } from "@wandit/internationalization/react";
import { useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { KeyboardStickyView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { RadialGlow } from "@/components/radial-glow";
import { useAppTheme } from "@/contexts/app-theme-context";
import { PromptBox, useProject } from "@/features/projects";

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
import {
	type ChatThreadMessage,
	extractChatMessageText,
	parseAskUserParts,
} from "../lib/chat-message";
import {
	MOCK_ASK_THREAD_ENABLED,
	useMockAskThread,
} from "../lib/mock-ask-thread";
import { useProjectChat } from "../lib/use-project-chat";

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
	const [sheetOpen, setSheetOpen] = useState(false);

	const projectId =
		typeof routeProjectId === "string" ? routeProjectId : undefined;
	const { data: project } = useProject(projectId);
	const projectName = project?.name ?? t("native.workspace.newProject");
	const {
		messages: liveMessages,
		streamingMessages,
		errorMessage,
		chatUnavailable,
		isResolvingChat,
		isLoadingMessages,
		isGenerating,
		sendMessage,
	} = useProjectChat(projectId);
	const mock = useMockAskThread();

	const messages = MOCK_ASK_THREAD_ENABLED ? mock.messages : liveMessages;

	// Mirror of the PromptBox draft (via onValueChange) — the tray needs to
	// know when typed text should override its chips.
	const [composerText, setComposerText] = useState("");

	// LIVE ANSWER SEAM — blocked on the /ai-stream migration. The legacy
	// transport (POST /chats/:id/messages + named-event SSE) runs a plain
	// streamText worker with NO tools: it can neither produce an ask_user
	// call nor accept its output (a dangling call even crashes its history
	// conversion). Completing a real ask means POSTing the full UI-message
	// transcript, with the tool part switched to output-available, to
	// POST /chats/:chatId/ai-stream and reading back the AI SDK chunk stream.
	// Until that lands the tray only derives from the scripted mock thread.
	const answerAskUserLive = useCallback(
		(_toolCallId: string, _output: AskUserOutput) => {},
		[],
	);

	// The live "waiting on you" state: derives the docked ask from the message
	// list and answers it through one callback (chips, free text, escape hatch
	// and dismiss all complete the same tool call).
	const tray = useRequestTray({
		messages,
		composerText,
		enabled: MOCK_ASK_THREAD_ENABLED,
		onAnswer: MOCK_ASK_THREAD_ENABLED ? mock.answerAskUser : answerAskUserLive,
	});

	const threadMessages = useMemo<ChatThreadMessage[]>(() => {
		const persisted = messages
			.map((message) => ({
				id: message.id,
				role: message.role,
				text: extractChatMessageText(message.parts),
				asks:
					message.role === "assistant"
						? parseAskUserParts(message.parts)
						: undefined,
			}))
			// An assistant message that only asked has no text — keep it for its
			// question instead of dropping it with the blank rows.
			.filter(
				(message) =>
					message.text.trim().length > 0 || (message.asks?.length ?? 0) > 0,
			);

		const streaming = streamingMessages.map((message) => ({
			id: `streaming-${message.messageId}`,
			role: "assistant" as const,
			text: message.text,
			isStreaming: true,
		}));

		return MOCK_ASK_THREAD_ENABLED ? persisted : [...persisted, ...streaming];
	}, [messages, streamingMessages]);

	const streamingText = streamingMessages
		.map((message) => message.text)
		.join("");
	const pending =
		!MOCK_ASK_THREAD_ENABLED && (isResolvingChat || isLoadingMessages);
	const visibleError = MOCK_ASK_THREAD_ENABLED
		? null
		: (errorMessage ??
			(chatUnavailable ? t("native.workspace.chat.errors.unavailable") : null));
	const isSubmitting = MOCK_ASK_THREAD_ENABLED ? false : isGenerating;
	const hasMessages = threadMessages.length > 0;
	const showThinking = isSubmitting && streamingMessages.length === 0;
	const showThread = hasMessages || showThinking || Boolean(visibleError);

	// tray.active is a re-scroll trigger too: the tray growing out of the
	// composer shrinks the thread viewport, hiding the message that asked.
	useEffect(() => {
		if (!showThread) return;
		requestAnimationFrame(() =>
			scrollRef.current?.scrollToEnd({ animated: true }),
		);
	}, [
		showThread,
		threadMessages.length,
		streamingText,
		visibleError,
		tray.active,
	]);

	// Submit routing: while an ask is docked, typed text ANSWERS it (free-text
	// ask, or typing-override on a chips ask) instead of opening a new user
	// turn; otherwise it's a normal message. `false` from sendMessage keeps
	// the draft (PromptBox clearOnSubmit contract).
	function handleSubmit(prompt: string) {
		if (tray.answerable) {
			tray.answerFreeText(prompt);
			setComposerText("");
			return true;
		}
		const accepted = MOCK_ASK_THREAD_ENABLED
			? mock.sendText(prompt)
			: sendMessage(prompt);
		if (accepted) {
			requestAnimationFrame(() =>
				scrollRef.current?.scrollToEnd({ animated: true }),
			);
		}
		return accepted;
	}

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
				previewActive={hasMessages}
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
					<ChatMessages
						messages={threadMessages}
						activeAskToolCallId={tray.toolCallId}
					/>
					{showThinking ? (
						<ChatThinkingIndicator
							label={t("native.workspace.chat.thinking")}
						/>
					) : null}
				</ScrollView>
			) : (
				<ChatEmptyState />
			)}

			<KeyboardStickyView offset={{ closed: 0, opened: insets.bottom }}>
				<View className="gap-2.5" style={{ paddingBottom: insets.bottom + 10 }}>
					<View className="px-4">
						<PromptBox
							variant="compact"
							clearOnSubmit
							placeholder={t("native.workspace.composerPlaceholder")}
							onSubmit={handleSubmit}
							onValueChange={setComposerText}
							isSubmitting={isSubmitting}
							// The tray fuses into the composer card — it grows out of the
							// top and collapses on answer/dismiss (TrayReveal's height
							// animation; the key remounts it per ask).
							topSlot={
								tray.active && tray.state ? (
									<TrayReveal key={tray.toolCallId ?? "ask"}>
										<RequestTray
											state={tray.state}
											onEscape={tray.delegate}
											onDismiss={tray.dismiss}
											bodyCallbacks={{
												onPick: tray.onPick,
												multiSelectedIds: tray.multiSelectedIds,
												onToggleMulti: tray.onToggleMulti,
												onConfirmMulti: tray.onConfirmMulti,
											}}
										/>
									</TrayReveal>
								) : null
							}
						/>
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
