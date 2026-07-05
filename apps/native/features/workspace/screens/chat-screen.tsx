import { useTranslation } from "@wandit/internationalization/react";
import { useLocalSearchParams } from "expo-router";
import { useRef, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { KeyboardStickyView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { RadialGlow } from "@/components/radial-glow";
import { useAppTheme } from "@/contexts/app-theme-context";
import { MOCK_PROJECTS, PromptBox } from "@/features/projects";

import { ChatHeader } from "../components/chat-header";
import {
	ChatEmptyState,
	ChatMessages,
	DateSeparator,
	SuggestionsRow,
} from "../components/chat-thread";
import { ProjectSheet } from "../components/project-sheet";
import { MOCK_THREADS, type MockChatMessage } from "../lib/mock-chat";

/** Project chat: header, thread (or empty state), suggestions, composer. */
export function ChatScreen() {
	const { projectId } = useLocalSearchParams<{ projectId: string }>();
	const { t } = useTranslation();
	const insets = useSafeAreaInsets();
	const { isDark } = useAppTheme();
	const scrollRef = useRef<ScrollView>(null);
	const [sheetOpen, setSheetOpen] = useState(false);

	const project = MOCK_PROJECTS.find((item) => item.id === projectId);
	const projectName = project?.name ?? t("native.workspace.newProject");
	const thread = projectId ? MOCK_THREADS[projectId] : undefined;
	const [messages, setMessages] = useState<MockChatMessage[]>(
		thread?.messages ?? [],
	);

	function appendUserMessage(prompt: string) {
		// TODO: send to the generation pipeline; local echo only for now.
		setMessages((current) => [
			...current,
			{ id: `local-${Date.now()}`, role: "user", text: prompt },
		]);
		requestAnimationFrame(() =>
			scrollRef.current?.scrollToEnd({ animated: true }),
		);
	}

	const hasMessages = messages.length > 0;

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

			{hasMessages ? (
				<ScrollView
					ref={scrollRef}
					className="flex-1"
					contentContainerClassName="gap-3.5 px-4 pt-2 pb-3"
				>
					{thread ? <DateSeparator label={thread.dateLabel} /> : null}
					<ChatMessages messages={messages} />
				</ScrollView>
			) : (
				<ChatEmptyState />
			)}

			<KeyboardStickyView offset={{ closed: 0, opened: insets.bottom }}>
				<View className="gap-2.5" style={{ paddingBottom: insets.bottom + 10 }}>
					{hasMessages && thread ? (
						<SuggestionsRow
							suggestions={thread.suggestions}
							onPick={appendUserMessage}
						/>
					) : null}
					<View className="px-4">
						<PromptBox
							variant="compact"
							clearOnSubmit
							placeholder={t("native.workspace.composerPlaceholder")}
							onSubmit={appendUserMessage}
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
