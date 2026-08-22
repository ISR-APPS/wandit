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
//
// ────────────────────────────────────────────────────────────────────────────
// Where this file sits in the end-to-end chat flow:
//   - CALLED BY: components/chat/chat-pane.tsx — the visible chat panel simply
//     renders whatever this hook returns (messages, typing indicator, the live
//     streaming bubble) and wires the composer to send().
//   - CALLS NEXT: ../api/chat.queries.ts (cached GETs for chatId + history)
//     and ../api/chat.services.ts (the POST that sends a message). Those hit
//     the NestJS API (apps/server, generation module). The API enqueues a
//     BullMQ job; the worker (apps/worker) calls the AI model and publishes
//     progress to Redis; the API relays those Redis events back to the browser
//     over the SSE connection this hook opens below.
//
// Gotchas to keep in mind while reading:
//   - Two sources of truth get merged here: the TanStack Query cache (the
//     persisted history from the server) and local React state (the in-flight
//     streaming bubble + phase). The "message-completed" and "done" events are
//     what reconcile them back into one consistent picture.
//   - The SSE event named "error" is overloaded: the browser fires a native
//     "error" event on ANY disconnect, and the server also sends a custom
//     "error" frame with a JSON body. onStreamError tells them apart by
//     checking whether event.data is a string.
// ────────────────────────────────────────────────────────────────────────────

// TanStack Query (react-query) = a data-fetching library that caches server
// responses under a "query key" and lets any component read — or patch — that
// cache. useMutation wraps a write (our POST) with success/error callbacks;
// useQueryClient gives direct access to the cache itself.
import { useMutation, useQueryClient } from "@tanstack/react-query";
// @wandit/contracts = the shared package of Zod schemas and route-path
// builders used by both the web app and the API server, so the two sides
// always agree on URL shapes and payload shapes. (A Zod schema is a runtime
// validator that doubles as the TypeScript type — parse untrusted data with
// it and you get both a type-safe value and a guarantee it's well-formed.)
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

// The chat's UI phase: "idle" (nothing happening), "thinking" (message sent,
// waiting for the first token), "streaming" (assistant text is arriving).
// The chat pane uses this to decide when to show the typing indicator.
export type ChatPhase = "idle" | "thinking" | "streaming";
// The one assistant message currently being streamed: its server-assigned id
// plus all the text accumulated so far from "delta" events. Rendered as a live
// bubble below the persisted messages until "message-completed" replaces it.
export type StreamingBubble = { messageId: string; text: string };

// Everything the send mutation needs: the message text, optional composer
// metadata (e.g. the mode / output options attached by the PromptBox), and the
// temporary id we gave the optimistic message so we can
// find it again in the cache on success (id swap) or failure (rollback).
type SendVars = {
	text: string;
	composer?: ComposerMetadata;
	optimisticId: string;
};

// Reunite the SSE event `data` payload with its event name so the discriminated
// union in @wandit/contracts can validate it (the server omits `type` from the
// data body since the SSE `event:` line already carries it).
//
// In plain English: every SSE frame arrives as `event: delta` + `data: {...}`,
// but the browser hands us only the data string. So we glue the `type` back on
// and run the result through the shared Zod schema (safeParse never throws —
// it returns { success, data } instead). Returning null on any bad frame means
// malformed events are silently dropped, which is the safe choice for a
// stream: one garbled frame shouldn't crash the whole chat.
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

// The main hook. Give it a projectId and it returns everything the chat pane
// needs: the resolved chatId, the sorted message history, the live streaming
// bubble, phase/loading flags, and a send() function. One mounted instance of
// this hook = one SSE connection, held open for the whole workspace visit.
export function useProjectChat(projectId: string) {
	const queryClient = useQueryClient();
	const { t } = useTranslation();
	// Keep the latest translate function in a ref so long-lived callbacks (the
	// SSE handlers below) can always read the current one WITHOUT appearing in
	// any dependency array — otherwise a language switch would tear down and
	// reopen the SSE connection just to refresh an error-message translator.
	const tRef = useRef(t);
	tRef.current = t;

	// Step 1: ask the server which chat belongs to this project (each project
	// has one chat). Step 2 — loading the message history — is chained off it:
	// the messages query stays disabled until chatId exists (see the `enabled`
	// flag in chat.queries.ts), so there's no race on first render.
	const chatByProjectQuery = useChatByProjectQuery(projectId);
	const chatId = chatByProjectQuery.data?.chatId;
	const messagesQuery = useChatMessagesQuery(chatId);

	// Local (non-cached) UI state: the in-flight assistant bubble and the state
	// machine's current phase. These live in plain React state rather than the
	// query cache because they change many times per second while tokens stream
	// in — hammering the cache that fast would be wasteful.
	const [streaming, setStreaming] = useState<StreamingBubble | null>(null);
	const [phase, setPhase] = useState<ChatPhase>("idle");
	// null = defer to the server (query) value; a boolean is a definitive local
	// override set by the stream (started/thinking → true, done/error → false).
	const [activeOverride, setActiveOverride] = useState<boolean | null>(null);

	// Merge the two "is the AI busy?" signals: live stream knowledge (override)
	// wins over the possibly-stale snapshot that came back with the history GET.
	// This is why refreshing the page mid-generation still shows the busy state
	// right away: the GET says active until the stream says otherwise.
	const queryActive = messagesQuery.data?.generationActive ?? false;
	const generationActive = activeOverride ?? queryActive;

	// Always render in server order: `seq` is a per-chat sequence number the
	// server assigns. Optimistic messages get seq = MAX_SAFE_INTEGER in send()
	// below, so this sort pins them to the bottom until the server confirms.
	// The [...list] spread matters — .sort() mutates in place, and mutating
	// data that lives inside the query cache is a classic React Query bug.
	const messages = useMemo(() => {
		const list = messagesQuery.data?.messages ?? [];
		return [...list].sort((a, b) => a.seq - b.seq);
	}, [messagesQuery.data?.messages]);

	// Small helper for immutably editing the cached message list of a chat.
	// setQueryData writes straight into the TanStack Query cache, and every
	// component subscribed to that key re-renders with the new value. If the
	// cache entry doesn't exist yet (prev is undefined) it deliberately does
	// nothing — there's no list to patch.
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

	// The POST that actually sends the user's message to the API (which then
	// persists it and enqueues the generation job). By the time this runs, the
	// optimistic message is already sitting in the cache — send() below adds it
	// first — so these callbacks only reconcile it with the server's answer.
	// NOTE: the `chatId as string` cast is safe only because send() refuses to
	// run without a chatId; the mutation itself has no guard of its own.
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
		// Roll everything back: remove the optimistic message from the cache,
		// reset the state machine, and show a human-readable toast (see
		// sendErrorMessage at the bottom: 409 = busy, 402 = out of credits).
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
