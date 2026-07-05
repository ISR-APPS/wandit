import { z } from "zod";
import { isoDateTimeSchema, uuidSchema } from "./shared/primitives";

// Chat & Page Generation contracts (docs/features/chat-generation.md).
// Messages store AI SDK v7 UIMessage parts, so the message shape here stays a
// thin mirror of the SDK type; message ids are plain strings (the SDK generates
// them), not uuids. Text parts follow the AI SDK convention:
// `{ type: "text", text: string, state?: "streaming" | "done" }`.

export const messageRoles = ["system", "user", "assistant"] as const;

export const messageRoleSchema = z.enum(messageRoles);

export type MessageRole = z.infer<typeof messageRoleSchema>;

export const composerModes = [
	"auto",
	"page",
	"marketing",
	"image",
	"video",
] as const;

export const composerModeSchema = z.enum(composerModes);

export type ComposerMode = z.infer<typeof composerModeSchema>;

export const composerQualities = ["standard", "max"] as const;

export const composerQualitySchema = z.enum(composerQualities);

export type ComposerQuality = z.infer<typeof composerQualitySchema>;

export const composerMetadataSchema = z.object({
	mode: composerModeSchema,
	quality: composerQualitySchema.default("standard"),
	output: z.string().min(1).optional(),
	skills: z.array(z.string().min(1)).optional(),
	options: z.record(z.string(), z.unknown()).optional(),
});

export type ComposerMetadata = z.infer<typeof composerMetadataSchema>;

export const messagePartsSchema = z.array(z.record(z.string(), z.unknown()));

export type MessagePart = z.infer<typeof messagePartsSchema>[number];

export const messageMetadataSchema = z
	.record(z.string(), z.unknown())
	.nullable();

export const chatMessageSchema = z.object({
	id: z.string().min(1),
	chatId: uuidSchema,
	role: messageRoleSchema,
	parts: messagePartsSchema,
	metadata: messageMetadataSchema,
	seq: z.int().nonnegative(),
	createdAt: isoDateTimeSchema,
});

export type ChatMessage = z.infer<typeof chatMessageSchema>;

export const sendChatMessageBodySchema = z.object({
	text: z.string().min(1).max(8000),
	composer: composerMetadataSchema.optional(),
});

export type SendChatMessageBody = z.infer<typeof sendChatMessageBodySchema>;

export const sendChatMessageResponseSchema = z.object({
	messageId: z.string().min(1),
	jobId: z.string().min(1),
});

export type SendChatMessageResponse = z.infer<
	typeof sendChatMessageResponseSchema
>;

export const chatByProjectResponseSchema = z.object({
	chatId: uuidSchema,
	projectId: uuidSchema,
});

export type ChatByProjectResponse = z.infer<typeof chatByProjectResponseSchema>;

export const chatMessagesResponseSchema = z.object({
	generationActive: z.boolean(),
	messages: z.array(chatMessageSchema),
});

export type ChatMessagesResponse = z.infer<typeof chatMessagesResponseSchema>;

export const chatStreamEventSchema = z.discriminatedUnion("type", [
	z.object({
		type: z.literal("status"),
		status: z.enum(["started", "thinking"]),
	}),
	z.object({
		type: z.literal("delta"),
		messageId: z.string().min(1),
		delta: z.string(),
	}),
	z.object({
		type: z.literal("message-completed"),
		message: chatMessageSchema,
	}),
	z.object({
		type: z.literal("error"),
		code: z.string().min(1),
		message: z.string().min(1),
	}),
	z.object({
		type: z.literal("done"),
		jobId: z.string().min(1),
	}),
]);

export type ChatStreamEvent = z.infer<typeof chatStreamEventSchema>;

// Generation streams over SSE (queue-backed), so the stream route bypasses the
// success envelope.
export const chatsRoutes = {
	byProject: (projectId: string) => `/api/v1/chats/by-project/${projectId}`,
	messages: (chatId: string) => `/api/v1/chats/${chatId}/messages`,
	stream: (chatId: string) => `/api/v1/chats/${chatId}/stream`,
} as const;
