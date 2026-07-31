/**
 * Connector-generation contracts: background media generation performed
 * THROUGH a user's MCP connector (e.g. Higgsfield generate_video).
 *
 * The chat agent never blocks on these calls — a generate tool call is
 * intercepted, snapshotted into an attempt row, and replayed verbatim by a
 * Trigger.dev task (the blocking MCP call can run for minutes). The chat
 * card follows the run over Trigger Realtime and reads this attempt endpoint
 * once the run settles (or as a polling fallback).
 */
import { z } from "zod";
import { triggerRealtimeHandleSchema } from "./ai-chat";
import { isoDateTimeSchema, uuidSchema } from "./shared/primitives";

// Marker the chat agent's intercept stamps on the dynamic-tool output so the
// web card can recognize a queued background generation among arbitrary MCP
// tool results.
export const CONNECTOR_GENERATION_OUTPUT_KIND = "wandit_background_generation";

// Shape of the intercepted tool's immediate output (what the model sees and
// what gets persisted in the message part).
export const connectorGenerationQueuedOutputSchema = z.object({
	attemptId: z.uuid(),
	connector: z.string(),
	kind: z.literal(CONNECTOR_GENERATION_OUTPUT_KIND),
	note: z.string(),
	realtime: triggerRealtimeHandleSchema.optional(),
	status: z.literal("queued"),
	tool: z.string(),
});

export type ConnectorGenerationQueuedOutput = z.infer<
	typeof connectorGenerationQueuedOutputSchema
>;

// Mirrors connector_generation_status in
// packages/db/src/schema/connector-generation-attempts.ts.
export const connectorGenerationStatusSchema = z.enum([
	"queued",
	"running",
	"succeeded",
	"failed",
]);

export type ConnectorGenerationStatus = z.infer<
	typeof connectorGenerationStatusSchema
>;

// One https media URL extracted from the MCP tool result. URLs point at the
// provider's own CDN (they were produced on the user's connected account).
export const connectorGenerationMediaSchema = z.object({
	kind: z.enum(["image", "video"]),
	url: z.url(),
});

export type ConnectorGenerationMedia = z.infer<
	typeof connectorGenerationMediaSchema
>;

// Everything the chat card needs in one request.
export const connectorGenerationAttemptSchema = z.object({
	id: uuidSchema,
	connectorSlug: z.string(),
	toolName: z.string(),
	status: connectorGenerationStatusSchema,
	// Set on success only. May be empty when the provider returned no
	// previewable URL — the card then reports completion without media.
	media: z.array(connectorGenerationMediaSchema),
	// Human-readable failure reason, shown in the card's error state.
	error: z.string().nullable(),
	createdAt: isoDateTimeSchema,
	completedAt: isoDateTimeSchema.nullable(),
});

export type ConnectorGenerationAttempt = z.infer<
	typeof connectorGenerationAttemptSchema
>;

// Route path builders. These return strings; they do not make network calls.
export const connectorGenerationsRoutes = {
	// GET — one attempt's status (read on run settle, or as a poll fallback).
	attempt: (attemptId: string) => `/api/v1/connector-generations/${attemptId}`,
} as const;
