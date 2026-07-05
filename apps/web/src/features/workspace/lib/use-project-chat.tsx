// Real chat data + SSE state machine for one project's workspace visit.
//
// Lifecycle:
//   1. resolve chatId    GET /chats/by-project/:projectId  → { chatId }
//   2. load history      GET /chats/:chatId/messages       → { messages, generationActive }
//   3. subscribe once    EventSource /chats/:chatId/stream  (named events)
//
// Stream events (addEventListener per type, never onmessage):
//   status  {status}                    → mark generation active, show typing
//   delta   {messageId, delta}          → accumulate into an in-flight bubble
//   message-completed {message}         → upsert the final message, drop bubble
//   error   {code, message}             → toast, clear, unblock
//   done    {jobId}                     → unblock, reconcile the cache
//
// EventSource auto-reconnect + Last-Event-ID replay is handled server-side —
// there is no custom reconnect logic here (the native "error" event that fires
// on transient disconnects is ignored; only server-sent error frames, which
// carry a JSON body, are surfaced).

import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
	type ChatMessage,
	type ChatMessagesResponse,
	type ChatStreamEvent,
	type ComposerMetadata,
	chatStreamEventSchema,
	chatsRoutes,
} from "@wandit/contracts";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { getApiErrorMessage, isApiClientError } from "@/lib/api-client";
import { type TranslationKey, useTranslation } from "@/lib/i18n";
import { getServerUrl } from "@/lib/server-url";
import {
	chatKeys,
	useChatByProjectQuery,
	useChatMessagesQuery,
} from "../api/chat.queries";
import { sendChatMessage } from "../api/chat.services";

export type ChatPhase = "idle" | "thinking" | "streaming";
export type StreamingBubble = { messageId: string; text: string };

type SendVars = {
	text: string;
	composer?: ComposerMetadata;
	optimisticId: string;
};

// Reunite the SSE event `data` payload with its event name so the discriminated
// union in @wandit/contracts can validate it (the server omits `type` from the
// data body since the SSE `event:` line already carries it).
function parseEvent(
	type: ChatStreamEvent["type"],
	raw: string,
): ChatStreamEvent | null {
	try {
		const payload = JSON.parse(raw) as unknown;
		const candidate =
			payload && typeof payload === "object"
				? { type, ...(payload as Record<string, unknown>) }
				: { type };
		const result = chatStreamEventSchema.safeParse(candidate);
		return result.success ? result.data : null;
	} catch {
		return null;
	}
}

export function useProjectChat(projectId: string) {
	const queryClient = useQueryClient();
	const { t } = useTranslation();
	const tRef = useRef(t);
	tRef.current = t;

	const chatByProjectQuery = useChatByProjectQuery(projectId);
	const chatId = chatByProjectQuery.data?.chatId;
	const messagesQuery = useChatMessagesQuery(chatId);

	const [streaming, setStreaming] = useState<StreamingBubble | null>(null);
	const [phase, setPhase] = useState<ChatPhase>("idle");
	// null = defer to the server (query) value; a boolean is a definitive local
	// override set by the stream (started/thinking → true, done/error → false).
	const [activeOverride, setActiveOverride] = useState<boolean | null>(null);

	const queryActive = messagesQuery.data?.generationActive ?? false;
	const generationActive = activeOverride ?? queryActive;

	const messages = useMemo(() => {
		const list = messagesQuery.data?.messages ?? [];
		return [...list].sort((a, b) => a.seq - b.seq);
	}, [messagesQuery.data?.messages]);

	const patchMessages = useCallback(
		(
			id: string,
			updater: (prev: ChatMessagesResponse) => ChatMessagesResponse,
		) => {
			queryClient.setQueryData<ChatMessagesResponse>(
				chatKeys.messages(id),
				(prev) => (prev ? updater(prev) : prev),
			);
		},
		[queryClient],
	);

	const sendMutation = useMutation({
		mutationFn: (vars: SendVars) =>
			sendChatMessage(chatId as string, {
				text: vars.text,
				composer: vars.composer,
			}),
		onSuccess: (res, vars) => {
			if (!chatId) return;
			// Swap the temporary id for the server-assigned message id so a later
			// message-completed frame for the same user turn de-duplicates.
			patchMessages(chatId, (prev) => ({
				...prev,
				messages: prev.messages.map((m) =>
					m.id === vars.optimisticId ? { ...m, id: res.messageId } : m,
				),
			}));
		},
		onError: (error, vars) => {
			if (chatId) {
				patchMessages(chatId, (prev) => ({
					...prev,
					messages: prev.messages.filter((m) => m.id !== vars.optimisticId),
				}));
			}
			setActiveOverride(false);
			setPhase("idle");
			setStreaming(null);
			toast.error(sendErrorMessage(error, tRef.current));
		},
	});

	const send = useCallback(
		(text: string, composer?: ComposerMetadata) => {
			const trimmed = text.trim();
			if (!chatId || !trimmed || generationActive) return;

			const optimisticId = `optimistic-${crypto.randomUUID()}`;
			const optimistic: ChatMessage = {
				id: optimisticId,
				chatId,
				role: "user",
				parts: [{ type: "text", text: trimmed }],
				metadata: null,
				seq: Number.MAX_SAFE_INTEGER,
				createdAt: new Date().toISOString(),
			};
			queryClient.setQueryData<ChatMessagesResponse>(
				chatKeys.messages(chatId),
				(prev) =>
					prev
						? { ...prev, messages: [...prev.messages, optimistic] }
						: { generationActive: true, messages: [optimistic] },
			);
			setActiveOverride(true);
			setPhase("thinking");
			sendMutation.mutate({ text: trimmed, composer, optimisticId });
		},
		[chatId, generationActive, queryClient, sendMutation],
	);

	// --- SSE subscription: one connection per chatId for the workspace visit ---
	useEffect(() => {
		if (!chatId) return;

		const es = new EventSource(
			`${getServerUrl()}${chatsRoutes.stream(chatId)}`,
			{
				withCredentials: true,
			},
		);

		const upsert = (message: ChatMessage) => {
			queryClient.setQueryData<ChatMessagesResponse>(
				chatKeys.messages(chatId),
				(prev) => {
					if (!prev) return { generationActive: true, messages: [message] };
					const exists = prev.messages.some((m) => m.id === message.id);
					return {
						...prev,
						messages: exists
							? prev.messages.map((m) => (m.id === message.id ? message : m))
							: [...prev.messages, message],
					};
				},
			);
		};

		const onStatus = (event: MessageEvent) => {
			const ev = parseEvent("status", event.data);
			if (ev?.type !== "status") return;
			setActiveOverride(true);
			setPhase((prev) => (prev === "streaming" ? prev : "thinking"));
		};

		const onDelta = (event: MessageEvent) => {
			const ev = parseEvent("delta", event.data);
			if (ev?.type !== "delta") return;
			setPhase("streaming");
			setStreaming((prev) =>
				prev && prev.messageId === ev.messageId
					? { messageId: ev.messageId, text: prev.text + ev.delta }
					: { messageId: ev.messageId, text: ev.delta },
			);
		};

		const onCompleted = (event: MessageEvent) => {
			const ev = parseEvent("message-completed", event.data);
			if (ev?.type !== "message-completed") {
				// Shape drift — reconcile from the server rather than drop the turn.
				void queryClient.invalidateQueries({
					queryKey: chatKeys.messages(chatId),
				});
				return;
			}
			upsert(ev.message);
			setStreaming((prev) =>
				prev && prev.messageId === ev.message.id ? null : prev,
			);
		};

		const onStreamError = (event: MessageEvent) => {
			// The native "error" event (transient disconnect) has no data — ignore
			// it and let EventSource reconnect. Only server error frames carry JSON.
			if (typeof event.data !== "string") return;
			const ev = parseEvent("error", event.data);
			setStreaming(null);
			setActiveOverride(false);
			setPhase("idle");
			toast.error(
				ev?.type === "error" && ev.message
					? ev.message
					: tRef.current("workspace.chat.errors.stream"),
			);
		};

		const onDone = () => {
			setActiveOverride(false);
			setPhase("idle");
			setStreaming(null);
			void queryClient.invalidateQueries({
				queryKey: chatKeys.messages(chatId),
			});
		};

		es.addEventListener("status", onStatus);
		es.addEventListener("delta", onDelta);
		es.addEventListener("message-completed", onCompleted);
		es.addEventListener("error", onStreamError);
		es.addEventListener("done", onDone);

		return () => {
			es.removeEventListener("status", onStatus);
			es.removeEventListener("delta", onDelta);
			es.removeEventListener("message-completed", onCompleted);
			es.removeEventListener("error", onStreamError);
			es.removeEventListener("done", onDone);
			es.close();
		};
	}, [chatId, queryClient]);

	return {
		chatId,
		messages,
		isResolvingChat: chatByProjectQuery.isPending,
		chatUnavailable: chatByProjectQuery.isError,
		isLoadingMessages: Boolean(chatId) && messagesQuery.isPending,
		streamingMessage: streaming,
		phase,
		generationActive,
		isSending: sendMutation.isPending,
		isGenerating: generationActive || sendMutation.isPending,
		send,
	};
}

function sendErrorMessage(
	error: unknown,
	t: (key: TranslationKey) => string,
): string {
	if (isApiClientError(error)) {
		if (error.statusCode === 409) return t("workspace.chat.errors.busy");
		if (error.statusCode === 402) return t("workspace.chat.errors.credits");
	}
	return getApiErrorMessage(error);
}
