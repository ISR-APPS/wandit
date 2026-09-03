import { z } from "zod";
import {
	paginatedResultSchema,
	paginationQuerySchema,
} from "../http/pagination";
import { optionalCsvEnum } from "./admin";
import { aiErrorDataSchema } from "./ai-errors";
import { isoDateTimeSchema, uuidSchema } from "./shared/primitives";

export const adminChatOwnerSchema = z.object({
	id: z.string().nullable(),
	name: z.string(),
	email: z.string(),
	image: z.string().nullable(),
});

export type AdminChatOwner = z.infer<typeof adminChatOwnerSchema>;

export const adminChatSummarySchema = z.object({
	id: uuidSchema,
	projectId: uuidSchema,
	projectName: z.string().nullable(),
	messageCount: z.number().int(),
	failedTurnCount: z.number().int(),
	totalTokens: z.number().int().nullable(),
	totalCreditsCenti: z.number().int().nullable(),
	lastMessageAt: isoDateTimeSchema.nullable(),
	createdAt: isoDateTimeSchema,
	owner: adminChatOwnerSchema.nullable(),
});

export type AdminChatSummary = z.infer<typeof adminChatSummarySchema>;

export const adminChatDetailSchema = z.object({
	chat: z.object({
		id: uuidSchema,
		createdAt: isoDateTimeSchema,
		updatedAt: isoDateTimeSchema,
	}),
	project: z
		.object({
			id: uuidSchema,
			name: z.string(),
		})
		.nullable(),
	owner: adminChatOwnerSchema.nullable(),
	messageCount: z.number().int(),
	failedTurnCount: z.number().int(),
	totalTokens: z.number().int().nullable(),
	cacheReadTokens: z.number().int().nullable(),
	cacheWriteTokens: z.number().int().nullable(),
	totalCostUsdMicros: z.number().int().nullable(),
	totalCreditsCenti: z.number().int().nullable(),
	usageSummary: z.array(
		z.object({
			operation: z.string(),
			model: z.string().nullable(),
			calls: z.number().int(),
			inputTokens: z.number().int().nullable(),
			outputTokens: z.number().int().nullable(),
			cacheReadTokens: z.number().int().nullable(),
			cacheWriteTokens: z.number().int().nullable(),
			costUsdMicros: z.number().int().nullable(),
			creditsCenti: z.number().int().nullable(),
		}),
	),
});

export type AdminChatDetail = z.infer<typeof adminChatDetailSchema>;

export const adminChatMessageSchema = z.object({
	id: z.string().min(1),
	role: z.enum(["user", "assistant", "system"]),
	seq: z.number().int(),
	createdAt: isoDateTimeSchema,
	parts: z.array(z.unknown()),
	metadata: z.unknown().nullable(),
	failure: aiErrorDataSchema.nullable(),
	sentryEventId: z.string().nullable(),
});

export type AdminChatMessage = z.infer<typeof adminChatMessageSchema>;

export const adminAiCallSchema = z.object({
	id: uuidSchema,
	operation: z.string(),
	model: z.string().nullable(),
	provider: z.string().nullable(),
	inputTokens: z.number().int().nullable(),
	outputTokens: z.number().int().nullable(),
	cacheReadTokens: z.number().int().nullable(),
	cacheWriteTokens: z.number().int().nullable(),
	reasoningTokens: z.number().int().nullable(),
	totalTokens: z.number().int().nullable(),
	costUsd: z.number().nullable(),
	creditsCenti: z.number().int().nullable(),
	messageId: z.string().min(1).nullable(),
	gatewayGenerationId: z.string().nullable(),
	createdAt: isoDateTimeSchema,
});

export type AdminAiCall = z.infer<typeof adminAiCallSchema>;

export const adminAiFailureSurfaces = [
	"chat",
	"image",
	"media",
	"marketing",
	"connector",
	"page",
] as const;

export const adminAiFailureSurfaceSchema = z.enum(adminAiFailureSurfaces);

export type AdminAiFailureSurface = z.infer<typeof adminAiFailureSurfaceSchema>;

export const adminAiFailureSchema = z.object({
	surface: adminAiFailureSurfaceSchema,
	id: z.string(),
	chatId: uuidSchema.nullable(),
	projectId: uuidSchema.nullable(),
	userId: z.string().nullable(),
	kind: z.string(),
	source: z.string(),
	provider: z.string().nullable(),
	providerMessage: z.string().nullable(),
	requestId: z.string().nullable(),
	sentryEventId: z.string().nullable(),
	createdAt: isoDateTimeSchema,
});

export type AdminAiFailure = z.infer<typeof adminAiFailureSchema>;

export const adminListChatFailuresQuerySchema = paginationQuerySchema.extend({
	kind: z.string().optional(),
	source: z.string().optional(),
	provider: z.string().optional(),
	surface: optionalCsvEnum(adminAiFailureSurfaces),
	since: isoDateTimeSchema.optional(),
});

export type AdminListChatFailuresQuery = z.infer<
	typeof adminListChatFailuresQuerySchema
>;

export const adminGenerationSurfaces = [
	"image",
	"media",
	"marketing",
	"connector",
	"page",
] as const;

export const adminGenerationSurfaceSchema = z.enum(adminGenerationSurfaces);

export type AdminGenerationSurface = z.infer<
	typeof adminGenerationSurfaceSchema
>;

export const adminGenerationAttemptDetailSchema = z.object({
	surface: adminGenerationSurfaceSchema,
	id: z.string(),
	status: z.string(),
	error: z.string().nullable(),
	kind: z.string().nullable(),
	source: z.string().nullable(),
	provider: z.string().nullable(),
	providerMessage: z.string().nullable(),
	requestId: z.string().nullable(),
	sentryEventId: z.string().nullable(),
	createdAt: isoDateTimeSchema,
	updatedAt: isoDateTimeSchema.nullable(),
	projectId: uuidSchema.nullable(),
	userId: z.string().nullable(),
	raw: z.record(z.string(), z.unknown()),
});

export type AdminGenerationAttemptDetail = z.infer<
	typeof adminGenerationAttemptDetailSchema
>;

export const adminListProjectChatsResponseSchema = paginatedResultSchema(
	adminChatSummarySchema,
);

export type AdminListProjectChatsResponse = z.infer<
	typeof adminListProjectChatsResponseSchema
>;

export const adminListUserChatsResponseSchema = paginatedResultSchema(
	adminChatSummarySchema,
);

export type AdminListUserChatsResponse = z.infer<
	typeof adminListUserChatsResponseSchema
>;

export const adminChatMessagesResponseSchema = paginatedResultSchema(
	adminChatMessageSchema,
);

export type AdminChatMessagesResponse = z.infer<
	typeof adminChatMessagesResponseSchema
>;

export const adminChatCallsResponseSchema =
	paginatedResultSchema(adminAiCallSchema);

export type AdminChatCallsResponse = z.infer<
	typeof adminChatCallsResponseSchema
>;

export const adminAiFailuresResponseSchema =
	paginatedResultSchema(adminAiFailureSchema);

export type AdminAiFailuresResponse = z.infer<
	typeof adminAiFailuresResponseSchema
>;
