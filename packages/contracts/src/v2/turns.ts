/**
 * Shared contract for V2 builder turns.
 *
 * A turn is one user message worked by the HarnessAgent inside the project
 * sandbox. The API validates turn requests, the builder-turn task writes
 * stream events, and the browser parses them with the AI SDK.
 */
import { z } from "zod";
import { fileRefSchema } from "../v1/attachments";
import { composerMetadataSchema } from "../v1/chats";
import { projectPromptMaxLength } from "../v1/projects";
import { uuidSchema } from "../v1/shared/primitives";

/**
 * Every status a `builder_turns` row can hold, in lifecycle order. Matches
 * the `builder_turn_status` database enum (WANDIT-163).
 */
export const builderTurnStatuses = [
	"queued",
	"waiting",
	"running",
	"cancelling",
	"waiting_for_answer",
	"waiting_for_approval",
	"succeeded",
	"failed",
	"canceled",
	"stalled",
	"stopped_no_credits",
	"stopped_project_cap",
	"stopped_disabled",
] as const;

/** Runtime validator for a builder turn status. */
export const builderTurnStatusSchema = z.enum(builderTurnStatuses);

/** TypeScript builder turn status type. */
export type BuilderTurnStatus = z.infer<typeof builderTurnStatusSchema>;

/**
 * Body of `POST /api/v2/projects/:id/turns`. Same admission rule as V1
 * project creation: a non-empty message or at least one attachment, never
 * both empty.
 */
export const createTurnRequestSchema = z
	.object({
		chatId: uuidSchema,
		message: z.string().max(projectPromptMaxLength),
		attachments: z.array(fileRefSchema).max(6).optional(),
		composer: composerMetadataSchema.optional(),
	})
	.refine(
		(body) =>
			body.message.trim().length > 0 || (body.attachments?.length ?? 0) > 0,
		{
			message: "message or at least one attachment is required",
			path: ["message"],
		},
	);

/** TypeScript create-turn body. */
export type CreateTurnRequest = z.infer<typeof createTurnRequestSchema>;

/**
 * `data` of the first browser frame `data-turn-created` on the create
 * route (the POST answers with the turn's stream, not a JSON body).
 * `runId` is the Trigger.dev run id — null while the turn waits for one.
 * `streamUrl` is the reconnect route (`appBuilderRoutes.activeTurnStream`):
 * a GET the browser reopens after a reload; it answers 204 when the
 * project has no active turn.
 */
export const createTurnResponseSchema = z.object({
	turnId: uuidSchema,
	chatId: uuidSchema,
	runId: z.string().nullable(),
	status: builderTurnStatusSchema,
	streamUrl: z.string(),
	// Present when the turn joined a queue behind a running turn (D13).
	queued: z.boolean().optional(),
	// Server-side cost hint so the composer can warn before send.
	estimate: z
		.object({
			credits: z.int().nonnegative(),
			// `fixed`: a flat per-turn guess; `history`: median of past turns.
			basis: z.enum(["fixed", "history"]),
		})
		.optional(),
});

/** TypeScript create-turn response. */
export type CreateTurnResponse = z.infer<typeof createTurnResponseSchema>;

/** Answer of `POST /api/v2/projects/:id/turns/:turnId/cancel`. */
export const cancelTurnResponseSchema = z.object({
	turnId: uuidSchema,
	status: builderTurnStatusSchema,
});

/** TypeScript cancel-turn response. */
export type CancelTurnResponse = z.infer<typeof cancelTurnResponseSchema>;

/**
 * Coarse phases the task reports between AI SDK chunks (D20: one box for
 * the whole stream). The UI shows them as progress labels.
 */
export const turnStreamPhases = [
	"sandbox_waking",
	"session_starting",
	"running",
	"checkpoint",
	"committing",
] as const;

/** Runtime validator for a stream progress phase. */
export const turnStreamPhaseSchema = z.enum(turnStreamPhases);

/** TypeScript stream progress phase. */
export type TurnStreamPhase = z.infer<typeof turnStreamPhaseSchema>;

const turnStreamPartEventSchema = z.object({
	type: z.literal("part"),
	// Stream position. Informational; the reader may replay from the start.
	id: z.string(),
	// Task-side stamp: `Date.now()` in ms. The API logs the delay to measure
	// chunk lag (D20).
	at: z.int().nonnegative(),
	// One AI SDK `UIMessageChunk`. The API passes it through and never reads
	// it; the browser parses it with the AI SDK.
	data: z.unknown(),
});

/**
 * Payload of a `status` envelope event and of the `data-turn-status`
 * browser part. Shared so the two legs of the stream cannot drift apart.
 */
export const turnStatusDataSchema = z.object({
	phase: turnStreamPhaseSchema,
	// Human-readable progress line the UI may show next to the phase.
	message: z.string().optional(),
});

/** Inferred from `turnStatusDataSchema`; the browser reads it from the `data-turn-status` part. */
export type TurnStatusData = z.infer<typeof turnStatusDataSchema>;

/**
 * Payload of a `usage` envelope event and of the `data-turn-usage`
 * browser part.
 */
export const turnUsageDataSchema = z.object({
	inputTokens: z.int().nonnegative(),
	outputTokens: z.int().nonnegative(),
	cacheReadTokens: z.int().nonnegative(),
	cacheWriteTokens: z.int().nonnegative(),
	// Turn cost so far in centi-credits (1 credit = 100 centi-credits).
	credits: z.int().nonnegative(),
});

/** Inferred from `turnUsageDataSchema`; token counts and centi-credits so far. */
export type TurnUsageData = z.infer<typeof turnUsageDataSchema>;

/**
 * Payload of an `error` envelope event and of the `data-turn-error`
 * browser part. The relay also emits an AI SDK `error` chunk so `useChat`
 * surfaces the failure.
 */
export const turnErrorDataSchema = z.object({
	code: z.string(),
	message: z.string(),
	retryable: z.boolean(),
});

/** Inferred from `turnErrorDataSchema`; `retryable` tells the UI whether a resend can help. */
export type TurnErrorData = z.infer<typeof turnErrorDataSchema>;

/**
 * Payload of a `done` envelope event and of the `data-turn-done` browser
 * part. When the turn row — not the stream — reports the end, the relay
 * fills only `status` and `outputCommitSha`; `receipt` is task-written.
 */
export const turnDoneDataSchema = z.object({
	status: builderTurnStatusSchema,
	// code.storage commit the turn produced; absent when nothing changed.
	outputCommitSha: z.string().optional(),
	// Final debit receipt, in centi-credits. Absent on early failure.
	receipt: z.object({ credits: z.int().nonnegative() }).optional(),
});

/** Inferred from `turnDoneDataSchema`; the last frame before `[DONE]`. */
export type TurnDoneData = z.infer<typeof turnDoneDataSchema>;

const turnStreamStatusEventSchema = z.object({
	type: z.literal("status"),
	id: z.string(),
	at: z.int().nonnegative(),
	data: turnStatusDataSchema,
});

const turnStreamUsageEventSchema = z.object({
	type: z.literal("usage"),
	id: z.string(),
	at: z.int().nonnegative(),
	data: turnUsageDataSchema,
});

const turnStreamErrorEventSchema = z.object({
	type: z.literal("error"),
	id: z.string(),
	at: z.int().nonnegative(),
	data: turnErrorDataSchema,
});

const turnStreamDoneEventSchema = z.object({
	type: z.literal("done"),
	id: z.string(),
	at: z.int().nonnegative(),
	data: turnDoneDataSchema,
});

/**
 * The envelope that travels from the task to the API over the Trigger
 * stream `ui`. The API relay unwraps it for the browser: see
 * `turnDataPartSchema` and the module README.
 */
export const turnStreamEventSchema = z.discriminatedUnion("type", [
	turnStreamPartEventSchema,
	turnStreamStatusEventSchema,
	turnStreamUsageEventSchema,
	turnStreamErrorEventSchema,
	turnStreamDoneEventSchema,
]);

/** TypeScript turn stream event (the union). */
export type TurnStreamEvent = z.infer<typeof turnStreamEventSchema>;

/** One AI SDK chunk pass-through event. */
export type TurnStreamPartEvent = z.infer<typeof turnStreamPartEventSchema>;

/** Progress phase event. */
export type TurnStreamStatusEvent = z.infer<typeof turnStreamStatusEventSchema>;

/** Token and credit usage event. */
export type TurnStreamUsageEvent = z.infer<typeof turnStreamUsageEventSchema>;

/** Terminal-or-recoverable failure event. */
export type TurnStreamErrorEvent = z.infer<typeof turnStreamErrorEventSchema>;

/** Final event of a turn stream; carries the result status. */
export type TurnStreamDoneEvent = z.infer<typeof turnStreamDoneEventSchema>;

/**
 * First frame of the create route's stream: the `CreateTurnResponse`
 * delivered as a data part, before any relayed chunk.
 */
export const turnCreatedDataPartSchema = z.object({
	type: z.literal("data-turn-created"),
	id: z.literal("turn-created"),
	data: createTurnResponseSchema,
});

/** Browser frame for a `status` envelope event. */
export const turnStatusDataPartSchema = z.object({
	type: z.literal("data-turn-status"),
	id: z.literal("turn-status"),
	data: turnStatusDataSchema,
});

/** Browser frame for a `usage` envelope event. */
export const turnUsageDataPartSchema = z.object({
	type: z.literal("data-turn-usage"),
	id: z.literal("turn-usage"),
	data: turnUsageDataSchema,
});

/** Browser frame for an `error` envelope event; an AI SDK `error` chunk follows it. */
export const turnErrorDataPartSchema = z.object({
	type: z.literal("data-turn-error"),
	id: z.literal("turn-error"),
	data: turnErrorDataSchema,
});

/** Browser frame for a `done` envelope event; the `[DONE]` terminator follows it. */
export const turnDoneDataPartSchema = z.object({
	type: z.literal("data-turn-done"),
	id: z.literal("turn-done"),
	data: turnDoneDataSchema,
});

/**
 * The `data-*` chunks the API relay writes on the browser stream.
 * `useChat` + `DefaultChatTransport` accept them as custom data parts;
 * every other frame on the wire is a raw AI SDK chunk or `[DONE]`.
 */
export const turnDataPartSchema = z.discriminatedUnion("type", [
	turnCreatedDataPartSchema,
	turnStatusDataPartSchema,
	turnUsageDataPartSchema,
	turnErrorDataPartSchema,
	turnDoneDataPartSchema,
]);

/** TypeScript browser data part (the union). */
export type TurnDataPart = z.infer<typeof turnDataPartSchema>;

/**
 * Type argument for `useChat<UIMessage<never, TurnDataParts>>` in the web
 * app; the keys are the `data-` chunk names without the prefix.
 */
export type TurnDataParts = {
	"turn-created": CreateTurnResponse;
	"turn-status": TurnStatusData;
	"turn-usage": TurnUsageData;
	"turn-error": TurnErrorData;
	"turn-done": TurnDoneData;
};
