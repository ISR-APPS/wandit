/**
 * chat.queries.ts — the browser-side "read" layer for the chat feature.
 *
 * WHERE THIS SITS IN THE END-TO-END FLOW:
 * - use-project-chat.tsx (the big workspace chat hook) calls the two hooks
 *   below to (1) find which chat belongs to the open project and (2) load
 *   that chat's message history via a plain HTTP GET.
 * - Both hooks delegate the actual network work to chat.services.ts, which
 *   calls the NestJS API (chats.controller.ts on the server) and validates
 *   the JSON responses with the shared Zod contracts from @wandit/contracts.
 * - Live updates do NOT flow through this file. The assistant's streaming
 *   reply arrives over SSE inside use-project-chat.tsx, which then writes
 *   straight into the cache entries owned by this file (via
 *   queryClient.setQueryData / invalidateQueries with chatKeys.messages(...)).
 *   In other words: this file defines the cache "addresses"; the SSE code
 *   writes to those addresses.
 *
 * FRAMEWORK CONCEPT — TanStack Query (a.k.a. React Query): a data-fetching
 * library that caches server responses in the browser, keyed by an array
 * called the "query key". Every component that uses the same key shares the
 * same cached data, and any code can read/update/invalidate an entry by key.
 *
 * GOTCHA: if the shape of a key built here ever changes, the SSE cache
 * patches in use-project-chat.tsx would silently stop matching (they'd write
 * to a key nobody reads). Always build keys through the chatKeys factory —
 * never hand-write the arrays elsewhere.
 */
// TanStack Query queries + keys for the real chat: resolve the chat id from a
// project, then load its message history. The SSE stream (use-project-chat.tsx)
// patches and invalidates the messages cache under these same keys.

// useQuery = TanStack Query's React hook for "fetch this data and cache it
// under this key".
import { useQuery } from "@tanstack/react-query";

import { useTokenUsageVisible } from "../lib/use-token-usage-visible";

// The raw fetch functions (no React inside) — thin wrappers around the shared
// API client that parse each response with a Zod schema before returning it.
import {
	getChatByProject,
	getChatMessages,
	getChatUsage,
} from "./chat.services";

// Cache-key factory: the ONE central place that builds the query-key arrays
// for everything chat-related. The keys nest hierarchically:
//   ["chat"]                        → root of the whole chat cache family
//   ["chat", "by-project", <id>]    → "which chat belongs to project <id>?"
//   ["chat", "messages", <chatId>]  → the message history of one chat
// Because every key starts with ["chat"], you could wipe/refresh the entire
// family at once by invalidating chatKeys.all. The `as const` bits tell
// TypeScript to keep the exact literal types (e.g. "chat" instead of just
// string), which gives better type inference throughout TanStack Query.
export const chatKeys = {
	all: ["chat"] as const,
	byProject: (projectId: string) =>
		[...chatKeys.all, "by-project", projectId] as const,
	messages: (chatId: string) => [...chatKeys.all, "messages", chatId] as const,
	usage: (chatId: string, completedAssistantMessageCount: number) =>
		[...chatKeys.all, "usage", chatId, completedAssistantMessageCount] as const,
};

// "Which chat belongs to this project?" — the workspace URL only carries a
// projectId, and each project currently has a single chat, so this query
// resolves projectId → chatId. use-project-chat.tsx reads `data.chatId` from
// here and feeds it into useChatMessagesQuery below — a classic two-step
// "dependent query" chain.
export function useChatByProjectQuery(projectId: string) {
	return useQuery({
		queryKey: chatKeys.byProject(projectId),
		queryFn: () => getChatByProject(projectId),
	});
}

// Loads the full message history for one chat (plus a `generationActive`
// flag the server includes to say "the AI is mid-reply right now"). This is
// THE cache entry that the SSE stream keeps patching while the assistant
// streams its answer, and that the composer optimistically appends the
// user's message to — so its key must match chatKeys.messages(chatId)
// exactly everywhere.
export function useChatMessagesQuery(chatId: string | undefined) {
	return useQuery({
		// While chatId is still unknown (the by-project query above hasn't
		// resolved yet), we park this query under a placeholder key with the
		// literal string "none" so the key array is always well-formed. Once
		// the real chatId arrives, the key changes and TanStack Query treats
		// it as a brand-new query; the "none" entry just sits unused.
		queryKey: chatKeys.messages(chatId ?? "none"),
		// NOTE: the `as string` cast looks unsafe, but it's protected by
		// `enabled` below — TanStack Query never runs queryFn while a query
		// is disabled, and it's only disabled exactly when chatId is missing.
		// Still fragile in the sense that removing `enabled` would break it.
		queryFn: () => getChatMessages(chatId as string),
		// `enabled: false` pauses the query entirely (no fetch, stays in
		// "pending" state); it flips on the moment a real chatId exists.
		// This is TanStack Query's standard idiom for dependent queries:
		// "only fetch B after A has resolved".
		enabled: Boolean(chatId),
	});
}

/**
 * Loads staff-only conversation spend. Including the completed assistant-turn
 * count in the key fetches a fresh aggregate exactly when a turn finishes.
 */
export function useChatUsageQuery(
	chatId: string | undefined,
	completedAssistantMessageCount: number,
) {
	const tokenUsageVisible = useTokenUsageVisible();

	return useQuery(
		createChatUsageQueryOptions(
			chatId,
			completedAssistantMessageCount,
			tokenUsageVisible,
		),
	);
}

export function createChatUsageQueryOptions(
	chatId: string | undefined,
	completedAssistantMessageCount: number,
	tokenUsageVisible: boolean,
) {
	return {
		queryKey: chatKeys.usage(chatId ?? "none", completedAssistantMessageCount),
		queryFn: () => getChatUsage(chatId as string),
		enabled: tokenUsageVisible && Boolean(chatId),
		// A hidden staff surface has no error affordance. In particular, a 404
		// for a non-staff dev session must not create a background retry loop.
		retry: false,
		refetchOnReconnect: false,
		refetchOnWindowFocus: false,
	} as const;
}
