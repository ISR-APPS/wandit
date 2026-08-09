/**
 * chat.keys.ts — TanStack Query cache keys for workspace chat.
 *
 * The SSE hook patches the messages cache directly, so keep these key shapes
 * centralized and import them everywhere instead of hand-writing arrays.
 */
export const chatKeys = {
	all: ["chat"] as const,
	byProject: (projectId: string) =>
		[...chatKeys.all, "by-project", projectId] as const,
	messages: (chatId: string) => [...chatKeys.all, "messages", chatId] as const,
};
