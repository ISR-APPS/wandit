/**
 * Shared contract for the V2 builder harness lifecycle.
 * The `builder-turn` task parses stored harness state and the turn spec
 * with these schemas; the web reads the assistant message metadata type.
 */
import { z } from "zod";

import { fileRefSchema } from "../v1/attachments";
import { composerMetadataSchema } from "../v1/chats";
import { turnUsageDataSchema } from "./turns";

/** The `builder_harness` db enum values, for JSON fields that carry one. */
export const harnessKindSchema = z.enum(["claude_code", "opencode"]);

/** One of the two `builder_harness` enum values; the task writes it on the row. */
export type HarnessKindContract = z.infer<typeof harnessKindSchema>;

/**
 * The `builder_sessions.resumeState` envelope the task writes and reads:
 * the harness kind plus the opaque adapter payload as a JSON string.
 * `saveResumeState` is the writer.
 */
export const harnessResumeEnvelopeSchema = z.object({
	harness: harnessKindSchema,
	/** `JSON.stringify(session.detach())` output; the API never reads it. */
	payload: z.string(),
});

/** The `builder_sessions.resumeState` column after the envelope parse. */
export type HarnessResumeEnvelope = z.infer<typeof harnessResumeEnvelopeSchema>;

/**
 * The `HarnessAgentResumeSessionState` wrapper stored inside the envelope
 * payload. `data` and `continueFrom` are opaque adapter state the API never
 * reads: they pass through untouched, the exception to the no-unknown rule.
 */
export const harnessResumeStateSchema = z.object({
	type: z.literal("resume-session"),
	harnessId: z.literal("claude-code"),
	specificationVersion: z.literal("harness-v1"),
	// Opaque adapter state; the task hands it back to `createSession` unread.
	data: z.record(z.string(), z.unknown()),
	// Opaque continuation state the adapter may add; pass-through like `data`.
	continueFrom: z.unknown().optional(),
});

/** The value the task hands to `createSession({ resumeFrom })` after the parse. */
export type HarnessResumeStatePayload = z.infer<
	typeof harnessResumeStateSchema
>;

/**
 * `messages.metadata` of a V2 turn assistant row. Written by
 * `insertTurnAssistantMessage`; the web parses the row with this later.
 */
export const turnAssistantMessageMetadataSchema = z.object({
	usage: turnUsageDataSchema,
	model: z.string(),
	harness: harnessKindSchema,
	// code.storage commit the turn pushed; null when the commit step failed.
	outputCommitSha: z.string().nullable(),
});

/** The `messages.metadata` value of a V2 assistant row, as the web parses it. */
export type TurnAssistantMessageMetadata = z.infer<
	typeof turnAssistantMessageMetadataSchema
>;

/**
 * The `builder_turns.spec` jsonb value. `BuilderTurnsRepository.create`
 * writes it at queue time from `BuilderTurnSpec`; the task parses it back
 * here because jsonb returns `unknown`.
 */
export const builderTurnSpecSchema = z.object({
	message: z.string(),
	attachments: z.array(fileRefSchema),
	composer: composerMetadataSchema.nullable(),
});

/** Parsed `builder_turns.spec`; `message` may be empty when attachments carry the turn. */
export type BuilderTurnSpecPayload = z.infer<typeof builderTurnSpecSchema>;
