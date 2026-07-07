import { useTranslation } from "@wandit/internationalization/react";
import { useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
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
import {
	extractChatMessageText,
	type ChatThreadMessage,
} from "../lib/chat-message";
import { useProjectChat } from "../lib/use-project-chat";

/** Project chat: header, live thread (or empty state), and composer. */
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
		messages,
		streamingMessages,
		errorMessage,
		chatUnavailable,
		isResolvingChat,
		isLoadingMessages,
		isGenerating,
		sendMessage,
	} = useProjectChat(projectId);

	const threadMessages = useMemo<ChatThreadMessage[]>(() => {
		const persisted = messages
			.map((message) => ({
				id: message.id,
				role: message.role,
				text: extractChatMessageText(message.parts),
			}))
			.filter((message) => message.text.trim().length > 0);

		const streaming = streamingMessages.map((message) => ({
			id: `streaming-${message.messageId}`,
			role: "assistant" as const,
			text: message.text,
			isStreaming: true,
		}));

		return [...persisted, ...streaming];
	}, [messages, streamingMessages]);

	const streamingText = streamingMessages
		.map((message) => message.text)
		.join("");
	const pending = isResolvingChat || isLoadingMessages;
	const visibleError =
		errorMessage ??
		(chatUnavailable ? t("native.workspace.chat.errors.unavailable") : null);
	const hasMessages = threadMessages.length > 0;
	const showThinking = isGenerating && streamingMessages.length === 0;
	const showThread = hasMessages || showThinking || Boolean(visibleError);

	useEffect(() => {
		if (!showThread) return;
		requestAnimationFrame(() =>
			scrollRef.current?.scrollToEnd({ animated: true }),
		);
	}, [showThread, threadMessages.length, streamingText, visibleError]);

	function handleSubmit(prompt: string) {
		const accepted = sendMessage(prompt);
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
					<ChatMessages messages={threadMessages} />
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
							isSubmitting={isGenerating}
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
