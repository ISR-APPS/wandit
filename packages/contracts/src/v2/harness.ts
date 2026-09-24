/**
 * Shared contract for the V2 builder harness lifecycle.
 * The `builder-turn` task parses stored harness state and the turn spec
 * with these schemas; the web reads the assistant message metadata type.
 */
import { z } from "zod";

import { askUserKindSchema } from "../v1/ai-chat";
import { fileRefSchema } from "../v1/attachments";
import { composerMetadataSchema } from "../v1/chats";
import {
	turnApprovalAnswerSchema,
	turnQuestionAnswerSchema,
	turnUsageDataSchema,
} from "./turns";

/** The `builder_harness` db enum values, for JSON fields that carry one. */
export const harnessKindSchema = z.enum(["claude_code", "opencode"]);

/** One of the two `builder_harness` enum values; the task writes it on the row. */
export type HarnessKindContract = z.infer<typeof harnessKindSchema>;

/**
 * One paused harness interaction the user must answer before the turn
 * can continue. `question` mirrors a pending `ask_user` call (or a
 * built-in `askUserQuestions` call); `approval` mirrors a pending
 * host-tool approval. `suspendTurn` writes them into the resume envelope
 * so a later turn can answer each by id.
 */
export const harnessPendingInteractionSchema = z.discriminatedUnion("kind", [
	z.object({
		kind: z.literal("question"),
		// The tool that asked. Envelopes saved before `ask_user` existed have
		// no value; only the built-in tool asked then.
		tool: z.enum(["ask_user", "askUserQuestions"]).default("askUserQuestions"),
		// Harness call id of the pending tool call.
		toolCallId: z.string().min(1),
		questions: z.array(
			z.object({
				id: z.string().min(1),
				question: z.string(),
				// Old envelopes have no kind; their questions were single choices.
				kind: askUserKindSchema.default("single-choice"),
				helper: z.string().optional(),
				maxFiles: z.int().min(1).max(6).optional(),
				options: z.array(
					z.object({
						id: z.string().min(1),
						label: z.string(),
						description: z.string().optional(),
						// Design world skill id; the task adds the world card.
						worldId: z.string().optional(),
					}),
				),
			}),
		),
	}),
	z.object({
		kind: z.literal("approval"),
		// Approval id the harness issued for the pending call.
		approvalId: z.string().min(1),
		toolCallId: z.string().min(1),
		toolName: z.string().min(1),
		// JSON text of the tool call input, as the harness reported it.
		input: z.string(),
	}),
]);

/** One paused interaction; the union of the question and approval cards. */
export type HarnessPendingInteraction = z.infer<
	typeof harnessPendingInteractionSchema
>;

/**
 * The `builder_sessions.resumeState` envelope the task writes and reads:
 * the harness kind plus the opaque adapter payload as a JSON string.
 * `saveResumeState` is the writer.
 */
export const harnessResumeEnvelopeSchema = z.object({
	harness: harnessKindSchema,
	/** `JSON.stringify(session.detach())` output; the API never reads it. */
	payload: z.string(),
	/**
	 * The question/approval cards a suspended turn waits on. A plain
	 * detach writes `[]`; `suspendTurn` fills it from the harness state.
	 */
	pending: z.array(harnessPendingInteractionSchema).default([]),
});

/** The `builder_sessions.resumeState` column after the envelope parse. */
export type HarnessResumeEnvelope = z.infer<typeof harnessResumeEnvelopeSchema>;

/**
 * The lifecycle payload stored inside the envelope. Two shapes exist:
 * `resume-session` is a detached session, `continue-turn` is a turn
 * suspended on a question or an approval. `data`, `pendingToolResults`,
 * `pendingToolApprovals`, and `turnSettings` are opaque adapter state the
 * API never reads: they pass through untouched, the exception to the
 * no-unknown rule.
 */
export const harnessResumeStateSchema = z.union([
	z.looseObject({
		type: z.literal("resume-session"),
		harnessId: z.literal("claude-code"),
		specificationVersion: z.literal("harness-v1"),
	}),
	z.looseObject({
		type: z.literal("continue-turn"),
		harnessId: z.literal("claude-code"),
		specificationVersion: z.literal("harness-v1"),
	}),
]);

/** The value the task hands to `createSession` after the envelope parse. */
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
	// The answer to a `data-approval` card.
	approval: turnApprovalAnswerSchema.optional(),
	// The answers to the `data-question` cards. Specs saved before the
	// answers existed have none; `message` then answers the cards.
	answers: z.array(turnQuestionAnswerSchema).default([]),
});

/** Parsed `builder_turns.spec`; `message` may be empty when attachments carry the turn. */
export type BuilderTurnSpecPayload = z.infer<typeof builderTurnSpecSchema>;
