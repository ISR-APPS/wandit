/**
 * Wire contract for the host tools the builder-turn task hands to the
 * harness. The AI SDK parses each tool call with the input schema; the
 * output schema types the result the tool returns. The sandbox never
 * sees them.
 */
import { z } from "zod";

import { type AskUserKind, askUserKindSchema } from "../v1/ai-chat";

// The literal list mirrors `BUILD_IMAGE_ASPECTS` in the V1 site builder
// (apps/server/src/modules/ai-chat/agent/site-builder/generate-image.ts):
// gpt-image-class models accept exact sizes, not free aspect ratios.
const hostImageAspects = ["1:1", "2:3", "3:2", "4:5", "16:9"] as const;

/**
 * Input of the `generate_image` host tool. `path` stays a plain string
 * here; the tool validates the prefix rules before it reserves credits.
 */
export const generateImageHostToolInputSchema = z.object({
	prompt: z.string().min(1).max(2000),
	aspect: z.enum(hostImageAspects),
	// Project-relative image target; the tool rejects `..` and absolute paths.
	path: z.string().min(1),
	// User photo URLs to edit instead of a text-only generation. The edit
	// model takes at most 4 sources.
	sourceImageUrls: z.array(z.url()).max(4).optional(),
});

/** Parsed `generate_image` input; the tool execute body reads this shape. */
export type GenerateImageHostToolInput = z.infer<
	typeof generateImageHostToolInputSchema
>;

/**
 * Output of the `generate_image` host tool. `path` is the final
 * project-relative file the task wrote into the sandbox; it can differ
 * from the requested path when the extension did not match the media type.
 */
export const generateImageHostToolOutputSchema = z.discriminatedUnion(
	"status",
	[
		z.object({
			status: z.literal("generated"),
			url: z.string(),
			width: z.number().int().nonnegative(),
			height: z.number().int().nonnegative(),
			path: z.string(),
		}),
		z.object({
			status: z.literal("failed"),
			message: z.string(),
		}),
		z.object({
			status: z.literal("unavailable"),
			message: z.string(),
		}),
	],
);

/** Parsed `generate_image` output; the union of the three statuses. */
export type GenerateImageHostToolOutput = z.infer<
	typeof generateImageHostToolOutputSchema
>;

/**
 * Input of the `request_network_host` host tool (WANDIT-180). The agent
 * asks to reach one extra egress host; the user approves the call first.
 * The tool re-checks `host` before it changes any policy.
 */
export const requestNetworkHostToolInputSchema = z.object({
	// The DNS host to allow, for example `api.github.com` or `*.plausible.io`.
	// RFC 1035 caps a host name at 253 chars.
	host: z.string().min(1).max(253),
	// One short line the approval card shows to the user.
	reason: z.string().min(1).max(500),
});

/** Parsed `request_network_host` input; the tool execute body reads this. */
export type RequestNetworkHostToolInput = z.infer<
	typeof requestNetworkHostToolInputSchema
>;

/**
 * Output of the `request_network_host` host tool. `allowed` means the
 * sandbox now reaches `host`; `denied` carries the reason the tool
 * refused, for example an invalid host or a failed policy update.
 */
export const requestNetworkHostToolOutputSchema = z.discriminatedUnion(
	"status",
	[
		z.object({
			status: z.literal("allowed"),
			host: z.string(),
		}),
		z.object({
			status: z.literal("denied"),
			reason: z.string(),
		}),
	],
);

/** Parsed `request_network_host` output; the allowed/denied union. */
export type RequestNetworkHostToolOutput = z.infer<
	typeof requestNetworkHostToolOutputSchema
>;

/**
 * One option of an `ask_user` question. `worldId` names a design world
 * skill; the task then adds the preview card of that world to the question.
 * No length limits here: Claude Code does not enforce them, and a failed
 * parse would fail the paused turn. The harness adapter cuts long values.
 */
export const askUserHostToolOptionSchema = z.object({
	// Stable id; the answer sends it back in `selected`.
	id: z.string(),
	label: z.string(),
	// One short line under the label.
	description: z.string().optional(),
	// Folder name of a design world skill, for example `zellige`.
	worldId: z.string().optional(),
});

/** One question of an `ask_user` call; the tray shows it as one step. */
export const askUserHostToolQuestionSchema = z.object({
	question: z.string(),
	// Absent: free text without options, a single choice with options.
	kind: askUserKindSchema.optional(),
	options: z.array(askUserHostToolOptionSchema).default([]),
	// One short line under the question.
	helper: z.string().optional(),
	// Upload limit of an `attachments` question; the tray uses 3 when absent.
	maxFiles: z.int().optional(),
});

/** One parsed `ask_user` question; `resolveAskUserKind` reads it. */
export type AskUserHostToolQuestion = z.infer<
	typeof askUserHostToolQuestionSchema
>;

/**
 * Input of the `ask_user` host tool: all questions of one step, in ONE
 * call. The Claude Code adapter pauses on the first host call, so a second
 * call in the same reply never reaches the user. The tool has no execute:
 * the turn pauses until the user answers in the chat.
 */
export const askUserHostToolInputSchema = z.object({
	questions: z.array(askUserHostToolQuestionSchema),
});

/** Parsed `ask_user` input; the harness adapter reads it from a paused call. */
export type AskUserHostToolInput = z.infer<typeof askUserHostToolInputSchema>;

/**
 * The tray body of an `ask_user` question. An explicit `kind` wins. Else a
 * question without options is free text and one with options a single choice.
 */
export function resolveAskUserKind(
	question: Pick<AskUserHostToolQuestion, "kind" | "options">,
): AskUserKind {
	return (
		question.kind ??
		(question.options.length === 0 ? "free-text" : "single-choice")
	);
}

/**
 * How the user closed an `ask_user` question. `delegated`: the user lets
 * the agent decide. `dismissed`: the user skipped the question.
 */
export const askUserHostToolActionSchema = z.enum([
	"answered",
	"delegated",
	"dismissed",
]);

/**
 * One file the user sent as an answer. `path` is the project-relative copy
 * the task wrote into the sandbox. It is null when the copy failed.
 */
export const askUserHostToolFileSchema = z.object({
	filename: z.string(),
	mediaType: z.string(),
	url: z.url(),
	path: z.string().nullable(),
});

/**
 * Output of the `ask_user` host tool, the tool result the agent reads: one
 * answer per question of the call. `text` holds what the user typed, also
 * for a skipped question; "" when the user typed nothing.
 */
export const askUserHostToolOutputSchema = z.object({
	answers: z.array(
		z.object({
			// The `question-N` id the adapter gave the question.
			questionId: z.string(),
			question: z.string(),
			action: askUserHostToolActionSchema,
			// The picked options, in the order of the question.
			selected: z.array(z.object({ id: z.string(), label: z.string() })),
			text: z.string(),
			files: z.array(askUserHostToolFileSchema),
		}),
	),
});

/** Parsed `ask_user` output; the task builds it from the user's answers. */
export type AskUserHostToolOutput = z.infer<typeof askUserHostToolOutputSchema>;
