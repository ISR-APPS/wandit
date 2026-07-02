import { z } from "zod";

// Chat & Page Generation contracts (docs/features/chat-generation.md).
// Structural stub — request/response schemas are defined together with the
// endpoints when that slice lands. Messages store AI SDK v7 UIMessage parts,
// so the message shape here stays a thin mirror of the SDK type; message ids
// are plain strings (the SDK generates them), not uuids.

export const messageRoles = ["system", "user", "assistant"] as const;

export const messageRoleSchema = z.enum(messageRoles);

export type MessageRole = z.infer<typeof messageRoleSchema>;

// Draft route map — finalize with the feature slice. Generation streams over
// SSE (queue-backed), so the stream route bypasses the success envelope.
export const chatsRoutes = {
	byProject: (projectId: string) => `/api/v1/projects/${projectId}/chat`,
	messages: (chatId: string) => `/api/v1/chats/${chatId}/messages`,
	stream: (chatId: string) => `/api/v1/chats/${chatId}/stream`,
} as const;
