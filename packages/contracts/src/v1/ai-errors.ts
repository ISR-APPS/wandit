import { z } from "zod";

export const aiErrorKinds = [
	"internal",
	"auth_config",
	"invalid_request",
	"model_not_found",
	"rate_limited",
	"capacity",
	"provider_error",
	"content_moderated",
	"timeout",
	"network",
	"cancelled",
	"billing",
	"connector_unreachable",
	"connector_account",
	"connector_rejected",
	"unknown",
] as const;

export const aiErrorKindSchema = z.enum(aiErrorKinds);

export type AiErrorKind = z.infer<typeof aiErrorKindSchema>;

export const aiErrorSourceSchema = z.union([
	z.enum(["ours", "gateway", "openrouter", "higgsfield", "unknown"]),
	z.string().regex(/^provider:[a-z0-9_-]{1,40}$/),
]);

export type AiErrorSource = z.infer<typeof aiErrorSourceSchema>;

/** What the client receives (data part, tool output, attempt row, HTTP details). */
export const aiErrorDataSchema = z.object({
	kind: aiErrorKindSchema,
	source: aiErrorSourceSchema,
	/** Display name: "Kling", "Higgsfield", "OpenAI", "Vercel AI Gateway". Null → client fallback "The AI provider". */
	providerLabel: z.string().max(40).nullable(),
	retryable: z.boolean(),
	/** true = the turn or generation ended. false = a notice on a turn that continues (connector_unreachable). */
	terminal: z.boolean(),
	/** Set when the caller knows the hold outcome. Drives the "not charged" sentence. */
	refunded: z.boolean().nullable(),
	/** "input" | "output" for content_moderated. null = stage unknown (renders the input-stage body). */
	moderationStage: z.enum(["input", "output"]).nullable(),
	/** Sanitized, max 240 chars, present only for `forward` kinds. */
	providerMessage: z.string().max(240).nullable(),
	/** Correlation id for support staff. The client does not render it. */
	requestId: z.string().max(80).nullable(),
	/** Which tool call failed, for tool-scoped errors inside a chat turn. */
	toolCallId: z.string().nullable().optional(),
});

export type AiErrorData = z.infer<typeof aiErrorDataSchema>;
