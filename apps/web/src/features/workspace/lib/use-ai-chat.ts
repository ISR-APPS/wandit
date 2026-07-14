import { useChat } from "@ai-sdk/react";
import {
	type AiChatTools,
	type AskUserOutput,
	aiChatRoutes,
} from "@wandit/contracts";
import {
	DefaultChatTransport,
	lastAssistantMessageIsCompleteWithToolCalls,
	type UIMessage,
} from "ai";
import { useCallback, useEffect, useMemo, useRef } from "react";

import { chatAutostart } from "@/features/projects";
import { getServerUrl } from "@/lib/server-url";
import {
	useChatByProjectQuery,
	useChatMessagesQuery,
} from "../api/chat.queries";

export type WanditUIMessage = UIMessage<never, never, AiChatTools>;

export function useAiChat(projectId: string) {
	const chatByProjectQuery = useChatByProjectQuery(projectId);
	const chatId = chatByProjectQuery.data?.chatId;
	const messagesQuery = useChatMessagesQuery(chatId);

	const initialMessages = useMemo(
		() =>
			(messagesQuery.data?.messages ?? []).flatMap<WanditUIMessage>(
				(message) =>
					message.role === "system" || message.parts.length === 0
						? []
						: [
								{
									id: message.id,
									role: message.role,
									parts: message.parts as WanditUIMessage["parts"],
								},
							],
			),
		[messagesQuery.data?.messages],
	);

	const transport = useMemo(
		() =>
			new DefaultChatTransport<WanditUIMessage>({
				api: chatId ? buildStreamUrl(chatId) : undefined,
				credentials: "include",
			}),
		[chatId],
	);

	const {
		messages,
		status,
		error,
		sendMessage,
		addToolOutput,
		setMessages,
		regenerate,
	} = useChat<WanditUIMessage>({
		id: chatId ?? `project:${projectId}`,
		messages: initialMessages,
		transport,
		sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithToolCalls,
	});

	const seededChatId = useRef<string | null>(null);

	useEffect(() => {
		if (!chatId || !messagesQuery.data || seededChatId.current === chatId) {
			return;
		}

		// The query resolves after useChat is created, so seed each chat once when
		// its persisted history becomes available without replacing later live turns.
		setMessages(initialMessages);
		seededChatId.current = chatId;

		// A project fresh from the dashboard arrives with its prompt already
		// persisted as the last user message but no assistant reply yet. When the
		// one-shot autostart flag matches this chat, continue that existing turn.
		// regenerate() posts the transcript as-is — sendMessage() would append a
		// duplicate user message.
		if (
			initialMessages.at(-1)?.role === "user" &&
			chatAutostart.consume(projectId, chatId)
		) {
			void regenerate();
		}
	}, [
		chatId,
		initialMessages,
		messagesQuery.data,
		projectId,
		regenerate,
		setMessages,
	]);

	const sendText = useCallback(
		(text: string) => {
			const trimmed = text.trim();
			if (!chatId || !messagesQuery.data || !trimmed) return false;

			void sendMessage({ text: trimmed });
		},
		[chatId, messagesQuery.data, sendMessage],
	);

	const answerAskUser = useCallback(
		(toolCallId: string, output: AskUserOutput) => {
			// This completes the client-side tool call. sendAutomaticallyWhen then
			// posts the updated transcript so the agent can continue its next step.
			// Callers build the output shape (pick / selections / text / delegated /
			// dismissed — see request-tray/use-request-tray.ts) so one path covers
			// every way the tray can be answered.
			void addToolOutput({
				tool: "ask_user",
				toolCallId,
				output,
			});
		},
		[addToolOutput],
	);

	return {
		messages,
		status,
		error,
		sendText,
		answerAskUser,
		isResolvingChat: chatByProjectQuery.isPending,
		isLoadingMessages: Boolean(chatId) && messagesQuery.isPending,
	};
}

function buildStreamUrl(chatId: string) {
	return `${getServerUrl().replace(/\/$/, "")}${aiChatRoutes.stream(chatId)}`;
}
