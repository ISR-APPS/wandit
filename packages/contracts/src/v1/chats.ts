/**
 * Shared contract for the chat API.
 *
 * This file defines the JSON shapes used by frontend, API, and worker.
 * Zod validates real runtime data. TypeScript types are created from the same
 * schemas so the code and runtime checks stay together.
 *
 * Important: sending a message does not return the AI answer. It only returns
 * ids. The assistant answer arrives later through stream events.
 */
// Zod validates untrusted JSON while the app runs.
import { z } from "zod";
// Shared UUID/date validators.
import { isoDateTimeSchema, uuidSchema } from "./shared/primitives";

// Chat & Page Generation contracts (docs/features/chat-generation.md).
// Messages store AI SDK v7 UIMessage parts, so the message shape here stays a
// thin mirror of the SDK type; message ids are plain strings (the SDK generates
// them), not uuids. Text parts follow the AI SDK convention:
// `{ type: "text", text: string, state?: "streaming" | "done" }`.

// Allowed message authors.
export const messageRoles = ["system", "user", "assistant"] as const;

// Runtime validator for message role strings.
export const messageRoleSchema = z.enum(messageRoles);

// TypeScript type created from the schema.
export type MessageRole = z.infer<typeof messageRoleSchema>;

// Prompt box modes.
export const composerModes = [
	"auto",
	"page",
	"marketing",
	"image",
	"video",
] as const;

// Runtime validator for composer mode.
export const composerModeSchema = z.enum(composerModes);

// TypeScript type for composer mode.
export type ComposerMode = z.infer<typeof composerModeSchema>;

// Stable idempotency token carried only by Video composer submissions.
// It lives inside `options` so old clients and non-video modes stay compatible.
export const videoSubmissionIdSchema = uuidSchema;

// Extra settings attached to a prompt.
export const composerMetadataSchema = z.object({
	mode: composerModeSchema,
	// Flexible fields for future prompt-box options.
	output: z.string().min(1).optional(),
	skills: z.array(z.string().min(1)).optional(),
	options: z.record(z.string(), z.unknown()).optional(),
});

// Validated composer metadata.
export type ComposerMetadata = z.infer<typeof composerMetadataSchema>;

// AI SDK message parts. Kept flexible for future text/images/tools/etc.
export const messagePartsSchema = z.array(z.record(z.string(), z.unknown()));

// Type of one message part.
export type MessagePart = z.infer<typeof messagePartsSchema>[number];

// Optional message metadata from database/model.
export const messageMetadataSchema = z
	.record(z.string(), z.unknown())
	.nullable();

// Message shape returned by the API and stream completion events.
export const chatMessageSchema = z.object({
	// Plain string, not UUID. AI SDK/worker can create message ids.
	id: z.string().min(1),
	chatId: uuidSchema,
	role: messageRoleSchema,
	parts: messagePartsSchema,
	metadata: messageMetadataSchema,
	seq: z.int().nonnegative(),
	createdAt: isoDateTimeSchema,
});

// TypeScript chat message type.
export type ChatMessage = z.infer<typeof chatMessageSchema>;

// Body for sending a new user message.
export const sendChatMessageBodySchema = z.object({
	// Keep this aligned with the UI textarea limit.
	text: z.string().min(1).max(8000),
	composer: composerMetadataSchema.optional(),
});

// TypeScript send-message body.
export type SendChatMessageBody = z.infer<typeof sendChatMessageBodySchema>;

// Immediate response after queueing a message. The AI answer comes later.
export const sendChatMessageResponseSchema = z.object({
	messageId: z.string().min(1),
	jobId: z.string().min(1),
});

// TypeScript send-message response.
export type SendChatMessageResponse = z.infer<
	typeof sendChatMessageResponseSchema
>;

// Response for projectId -> chatId lookup.
export const chatByProjectResponseSchema = z.object({
	chatId: uuidSchema,
	projectId: uuidSchema,
});

// TypeScript project chat lookup response.
export type ChatByProjectResponse = z.infer<typeof chatByProjectResponseSchema>;

// Response for loading saved chat history.
export const chatMessagesResponseSchema = z.object({
	generationActive: z.boolean(),
	messages: z.array(chatMessageSchema),
});

// TypeScript chat history response.
export type ChatMessagesResponse = z.infer<typeof chatMessagesResponseSchema>;

// Staff-only aggregate of all metered work attached to one conversation.
export const chatUsageResponseSchema = z.object({
	inputTokens: z.number().int().nonnegative().nullable(),
	outputTokens: z.number().int().nonnegative().nullable(),
	cacheReadTokens: z.number().int().nonnegative().nullable(),
	cacheWriteTokens: z.number().int().nonnegative().nullable(),
	costUsdMicros: z.number().int().nonnegative().nullable(),
	creditsCenti: z.number().int().nonnegative().nullable(),
});

export type ChatUsageResponse = z.infer<typeof chatUsageResponseSchema>;

// Events that can arrive over the chat stream.
// `type` tells the frontend which event shape it is.
export const chatStreamEventSchema = z.discriminatedUnion("type", [
	// Job started or model is thinking.
	z.object({
		type: z.literal("status"),
		status: z.enum(["started", "thinking"]),
	}),
	// One small piece of assistant text.
	z.object({
		type: z.literal("delta"),
		messageId: z.string().min(1),
		delta: z.string(),
	}),
	// Final saved assistant message.
	z.object({
		type: z.literal("message-completed"),
		message: chatMessageSchema,
	}),
	// Generation failed.
	z.object({
		type: z.literal("error"),
		code: z.string().min(1),
		message: z.string().min(1),
	}),
	// Job finished. UI can clear busy state.
	z.object({
		type: z.literal("done"),
		jobId: z.string().min(1),
	}),
]);

// TypeScript union of all stream events.
export type ChatStreamEvent = z.infer<typeof chatStreamEventSchema>;

// Route path builders. These return strings; they do not make network calls.
export const chatsRoutes = {
	// Get chat id for project.
	byProject: (projectId: string) => `/api/v1/chats/by-project/${projectId}`,
	// GET loads history, POST sends a message.
	messages: (chatId: string) => `/api/v1/chats/${chatId}/messages`,
	// Staff-only conversation cost and token aggregate.
	usage: (chatId: string) => `/api/v1/chats/${chatId}/usage`,
	// SSE stream endpoint.
	stream: (chatId: string) => `/api/v1/chats/${chatId}/stream`,
} as const;
