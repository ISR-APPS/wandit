/**
 * Shared contract for V2 builder turns.
 *
 * A turn is one user message worked by the HarnessAgent inside the project
 * sandbox. The API validates turn requests, the builder-turn task writes
 * stream events, and the browser parses them with the AI SDK.
 */
import { z } from "zod";
import { askUserKindSchema, worldCardSchema } from "../v1/ai-chat";
import { fileRefSchema } from "../v1/attachments";
import { composerMetadataSchema } from "../v1/chats";
import { uuidSchema } from "../v1/shared/primitives";
import {
	askUserHostToolActionSchema,
	presentPlanHostToolInputSchema,
} from "./host-tools";
import { PREVIEW_TARGETS_MAX, previewTargetSchema } from "./preview";
import {
	type TurnSecurityReportData,
	turnSecurityReportDataPartSchema,
} from "./security-scan";
import { appCommitNumstatEntrySchema, commitShaSchema } from "./versions";

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
 * How the agent works on a turn. `plan` is Plan Mode: the agent interviews
 * the user and presents a plan, and it cannot change files. `build` builds.
 * `security_scan` runs the host checks and the Cloudflare skill audit, and it
 * cannot change project files (see `security-scan.ts`).
 */
export const builderTurnModes = ["plan", "build", "security_scan"] as const;

/** Runtime validator for a builder turn mode. */
export const builderTurnModeSchema = z.enum(builderTurnModes);

/** `plan`, `build`, or `security_scan`; see `builderTurnModes`. */
export type BuilderTurnMode = z.infer<typeof builderTurnModeSchema>;

/**
 * Max length of a V2 user message or typed answer, in UTF-16 chars. About
 * 12K to 15K tokens. One field of this length stays under the 1 MiB JSON
 * body limit of Fastify (apps/server/src/main.ts). V1, native, and MCP keep
 * `projectPromptMaxLength`.
 */
// LIMIT: 8 answers of 50K chars can pass the 1 MiB body limit. Upgrade: a total cap per round.
export const builderMessageMaxLength = 50_000;

/** The answer to a `data-approval` card: the card id and the decision. */
export const turnApprovalAnswerSchema = z.object({
	approvalId: z.string().min(1),
	approved: z.boolean(),
});

/**
 * Sent as `approval` in the create-turn body with an empty message; answers
 * one `data-approval` card.
 */
export type TurnApprovalAnswer = z.infer<typeof turnApprovalAnswerSchema>;

/**
 * The answer to one `data-question` card. The tray sends one per question
 * in `answers`; the task turns it into the result of the paused tool call.
 */
export const turnQuestionAnswerSchema = z.object({
	// Harness call id of the paused `ask_user` or `askUserQuestions` call.
	toolCallId: z.string().min(1).max(128),
	// Question id inside that call, for example `question-0`.
	questionId: z.string().min(1).max(64),
	action: askUserHostToolActionSchema,
	// Ids of the picked options; empty for a typed, delegated, or skipped answer.
	optionIds: z.array(z.string().min(1).max(64)).max(6),
	// The text the user typed as the answer; "" when none.
	text: z.string().max(builderMessageMaxLength),
	// Uploaded files that answer an `attachments` question.
	files: z.array(fileRefSchema).max(6),
});

/** One answer in the create-turn body; see `turnQuestionAnswerSchema`. */
export type TurnQuestionAnswer = z.infer<typeof turnQuestionAnswerSchema>;

/**
 * Body of `POST /api/v2/projects/:id/turns`. Same admission rule as V1
 * project creation: a non-empty message or at least one attachment. An
 * `approval` decision alone is also enough: it answers a `data-approval`
 * card and needs no text. `answers` alone is enough too.
 */
export const createTurnRequestSchema = z
	.object({
		chatId: uuidSchema,
		message: z.string().max(builderMessageMaxLength),
		attachments: z.array(fileRefSchema).max(6).optional(),
		composer: composerMetadataSchema.optional(),
		// The model the user picked; absent means the deploy default. Any
		// model with a price row is legal (`GET /api/v2/models` lists them).
		// Another id answers 400 `V2_MODEL_DENIED`.
		model: z.string().min(1).optional(),
		// The Plan toggle of the composer; absent means `build`.
		mode: builderTurnModeSchema.optional(),
		// The answer to a `data-approval` card.
		approval: turnApprovalAnswerSchema.optional(),
		// The answers to the open `data-question` cards. Without them, the
		// message text answers the cards.
		answers: z.array(turnQuestionAnswerSchema).min(1).max(8).optional(),
		// Elements the user picked in the preview. The task names them in the
		// prompt, so the agent edits that JSX. They never admit a turn alone.
		targets: z
			.array(previewTargetSchema)
			.min(1)
			.max(PREVIEW_TARGETS_MAX)
			.optional(),
	})
	.refine(
		(body) =>
			body.message.trim().length > 0 ||
			(body.attachments?.length ?? 0) > 0 ||
			body.approval !== undefined ||
			body.answers !== undefined,
		{
			message: "message, an attachment, an approval, or an answer is required",
			path: ["message"],
		},
	);

/** TypeScript create-turn body. */
export type CreateTurnRequest = z.infer<typeof createTurnRequestSchema>;

/**
 * Pre-send cost hint of one turn: the hold the turn reserves. The create
 * answer carries it, and `GET /api/v2/projects/:id/turns/estimate` gives
 * it before send.
 */
export const turnEstimateSchema = z.object({
	// Whole credits: the ceil of the centi-credit hold.
	credits: z.int().nonnegative(),
	// `fixed`: the default hold; `history`: median of the project's
	// last settled turns.
	basis: z.enum(["fixed", "history"]),
	// The model the turn runs on.
	modelId: z.string().min(1),
	// Output USD/MTok of `modelId` over the default model's; 1 for the
	// default.
	multiplier: z.number().positive(),
});

/** TypeScript turn estimate; the composer shows `credits`. */
export type TurnEstimate = z.infer<typeof turnEstimateSchema>;

/**
 * Answer of `GET /api/v2/projects/:id/turns/estimate`: the hold that the
 * next turn on the default model reserves. Null when the deploy sets no
 * default model; the create answer then has no estimate either.
 */
export const turnEstimateResponseSchema = z.object({
	estimate: turnEstimateSchema.nullable(),
	// The pool that pays for this project's turns, which can differ from the
	// header pool (workspaces-sharing.md 4). The composer reads it to lock
	// and to sell credits. Optional: older servers omit it.
	payer: z
		.object({
			// True when the caller's own pool pays.
			isActor: z.boolean(),
			// True when the payer pool has no credits for a new turn.
			outOfCredits: z.boolean(),
		})
		.optional(),
});

/** TypeScript estimate answer. */
export type TurnEstimateResponse = z.infer<typeof turnEstimateResponseSchema>;

/**
 * Answer of `GET /api/v2/projects/:projectId/chats/:chatId/cost`: the full
 * cost of one chat, so a user can compare models. The money and token sums
 * come from the `llm_proxy_requests` rows of the chat's turns.
 */
export const chatCostResponseSchema = z.object({
	// Provider cost in USD micros (1 USD = 1,000,000 micros), all priced rows.
	usdMicros: z.int().nonnegative(),
	// Centi-credits (1 credit = 100 cc): the sum of the turns' settled cost so far.
	credits: z.int().nonnegative(),
	// Count of `builder_turns` rows of the chat, in every status.
	turnCount: z.int().nonnegative(),
	// Fresh input tokens, summed over the proxy rows.
	inputTokens: z.int().nonnegative(),
	// Output tokens, summed over the proxy rows.
	outputTokens: z.int().nonnegative(),
	// Prompt-cache read tokens, summed over the proxy rows.
	cacheReadTokens: z.int().nonnegative(),
	// Prompt-cache write tokens, summed over the proxy rows.
	cacheWriteTokens: z.int().nonnegative(),
	// One entry per model the proxy sent requests to, ordered by model id.
	byModel: z.array(
		z.object({
			// Model id sent upstream, in allow-list form.
			model: z.string().min(1),
			// Provider cost of this model in USD micros.
			usdMicros: z.int().nonnegative(),
			// Count of proxy requests sent to this model.
			requestCount: z.int().nonnegative(),
		}),
	),
});

/** TypeScript chat-cost answer. */
export type ChatCostResponse = z.infer<typeof chatCostResponseSchema>;

/**
 * `data` of the first browser frame `data-turn-created` on the create
 * route (the POST answers with the turn's stream, not a JSON body).
 * The resume route sends it too, with no estimate, so the browser knows
 * the turn id after a reload.
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
	estimate: turnEstimateSchema.optional(),
	// The mode of the new turn; the chat shows "Planning" for `plan`. Absent: `build`.
	mode: builderTurnModeSchema.optional(),
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
 * Answer of `GET /api/v2/projects/:id/turns/active`. The builder page polls
 * it to show a turn or a commit of another client, such as a coding agent
 * over MCP or a teammate.
 */
export const activeTurnStateResponseSchema = z.object({
	// The turn that holds the project slot: queued, running, or cancelling. Null when no turn runs.
	activeTurnId: uuidSchema.nullable(),
	// `app_branches(main).head_sha`. Null before the first commit of the project.
	headSha: commitShaSchema.nullable(),
});

/** TypeScript poll answer of the builder page. */
export type ActiveTurnStateResponse = z.infer<
	typeof activeTurnStateResponseSchema
>;

/**
 * Coarse phases the task reports between AI SDK chunks (D20: one box for
 * the whole stream). The UI shows them as progress labels. A checkpoint
 * debit has no phase: it sends a `usage` event, and the turn keeps running.
 */
export const turnStreamPhases = [
	"sandbox_waking",
	"session_starting",
	"running",
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
	// The mode of the failed turn. The stored reply has no other place for it,
	// and Retry sends a failed `security_scan` turn as a scan again.
	// Absent on rows stored before it and on errors the relay makes.
	mode: builderTurnModeSchema.optional(),
});

/** Inferred from `turnErrorDataSchema`; `retryable` tells the UI whether a resend can help. */
export type TurnErrorData = z.infer<typeof turnErrorDataSchema>;

/**
 * The `code` of a turn error when the LLM proxy refused a request on the
 * daily spend cap of the user. The builder-turn runtime writes it; the web
 * shows the reset time at 00:00 UTC and no Retry.
 */
export const DAILY_CAP_TURN_ERROR_CODE = "daily_cap";

/**
 * Payload of a `done` envelope event and of the `data-turn-done` browser
 * part. When the turn row — not the stream — reports the end, the relay
 * fills only `status` and `outputCommitSha`; `receipt` is task-written.
 */
export const turnDoneDataSchema = z.object({
	status: builderTurnStatusSchema,
	// code.storage commit the turn produced; absent when nothing changed.
	outputCommitSha: z.string().optional(),
	// Final debit receipt. Absent on early failure.
	receipt: z
		.object({
			// Centi-credits settled from the llm_proxy_requests rows.
			credits: z.int().nonnegative(),
			// The model the turn ran on.
			modelId: z.string().min(1),
			// Token counts summed from the proxy rows.
			inputTokens: z.int().nonnegative(),
			outputTokens: z.int().nonnegative(),
			cacheReadTokens: z.int().nonnegative(),
			cacheWriteTokens: z.int().nonnegative(),
			// The payer's settled balance in centi-credits after the settle;
			// can be negative after an accepted overdraft.
			balanceCredits: z.int(),
		})
		.optional(),
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
 * One option of a `data-question` card. `card` is the preview of the
 * design world the option names; the tray then shows a world card.
 * `theme` is the theme.json of a theme card; the tray then draws its mockup.
 */
export const turnQuestionOptionSchema = z.object({
	id: z.string(),
	label: z.string(),
	description: z.string().optional(),
	card: worldCardSchema.optional(),
	// The whole AppThemeFile of "@wandit/contracts/v2/app-theme". This file
	// checks only the version and the name: index.ts exports it, and that
	// schema pulls the 177 KB look catalog into every bundle. The lazy theme
	// card parses the file with `appThemeFileSchema` before it reads more.
	theme: z.looseObject({ version: z.literal(1), name: z.string() }).optional(),
	// True on the option the agent advises; the tray shows a badge on it.
	recommended: z.boolean().optional(),
});

/** Inferred from `turnQuestionOptionSchema`; one chip or card in the tray. */
export type TurnQuestionOption = z.infer<typeof turnQuestionOptionSchema>;

/**
 * `data` of the `data-question` card the UI renders when the agent asks
 * the user through the `ask_user` host tool (or the older built-in
 * `askUserQuestions`). The builder-turn task writes the part and the
 * message part; `answers` of the next create-turn body answers it.
 */
export const turnQuestionDataSchema = z.object({
	// Harness call id of the paused tool call.
	toolCallId: z.string(),
	// Question id inside that call.
	questionId: z.string(),
	question: z.string(),
	// Rows stored before the kinds existed have none; they were single choices.
	kind: askUserKindSchema.default("single-choice"),
	// One short line under the question.
	helper: z.string().optional(),
	// Upload limit of an `attachments` question.
	maxFiles: z.int().min(1).max(6).optional(),
	// In the order the agent offered them. Rows stored before the option ids
	// existed hold plain labels; the label then is also the id.
	options: z.array(
		z.union([
			turnQuestionOptionSchema,
			z.string().transform((label) => ({ id: label, label })),
		]),
	),
	answer: z.string().nullable(),
});

/** One `data-question` card; id is `${toolCallId}:${questionId}`. */
export const turnQuestionDataPartSchema = z.object({
	type: z.literal("data-question"),
	id: z.string(),
	data: turnQuestionDataSchema,
});

/** Inferred from `turnQuestionDataSchema`; the question card payload. */
export type TurnQuestionData = z.infer<typeof turnQuestionDataSchema>;

/**
 * `data` of the `data-approval` card the UI renders when a host tool
 * asks for approval. The builder-turn task writes the part and the
 * message part; the next turn's `approval` field carries the decision.
 */
export const turnApprovalDataSchema = z.object({
	// Approval id the harness issued for the pending call.
	approvalId: z.string(),
	// Harness call id of the tool call waiting for the decision.
	toolCallId: z.string(),
	toolName: z.string(),
	// JSON text of the tool call input, as the harness reported it.
	input: z.string(),
	decision: z.enum(["approved", "denied"]).nullable(),
});

/** One `data-approval` card; id is the approvalId. */
export const turnApprovalDataPartSchema = z.object({
	type: z.literal("data-approval"),
	id: z.string(),
	data: turnApprovalDataSchema,
});

/** Inferred from `turnApprovalDataSchema`; the approval card payload. */
export type TurnApprovalData = z.infer<typeof turnApprovalDataSchema>;

/**
 * `data` of the `data-plan` card: the plan a Plan Mode turn shows for
 * approval. The builder-turn task writes it from a paused `present_plan`
 * call. "Build this plan" sends a `build` turn; a typed `plan` turn sends
 * change requests.
 */
export const turnPlanDataSchema = presentPlanHostToolInputSchema.extend({
	// Harness call id of the paused `present_plan` call.
	toolCallId: z.string(),
});

/** One `data-plan` card; id is `plan-${toolCallId}`. */
export const turnPlanDataPartSchema = z.object({
	type: z.literal("data-plan"),
	id: z.string(),
	data: turnPlanDataSchema,
});

/** Inferred from `turnPlanDataSchema`; the plan card payload. */
export type TurnPlanData = z.infer<typeof turnPlanDataSchema>;

/**
 * `data` of the `data-thought` part the task writes right after a
 * reasoning block ends. The UI shows "Thought for {seconds}s" on that block.
 */
export const turnThoughtDataSchema = z.object({
	// The `id` of the reasoning chunks and of the stored reasoning part.
	reasoningId: z.string(),
	// Whole seconds from reasoning-start to reasoning-end, at least 1.
	seconds: z.int().nonnegative(),
});

/** One `data-thought` part; id is `thought-${reasoningId}`. */
export const turnThoughtDataPartSchema = z.object({
	type: z.literal("data-thought"),
	id: z.string(),
	data: turnThoughtDataSchema,
});

/** Inferred from `turnThoughtDataSchema`; the duration of one reasoning block. */
export type TurnThoughtData = z.infer<typeof turnThoughtDataSchema>;

/**
 * `data` of the `data-targets` part of a user message: the elements the user
 * picked in the preview for that turn. The API stores the part in the user
 * row, so the bubble shows the chips after a reload too.
 */
export const turnTargetsDataSchema = z.object({
	targets: z.array(previewTargetSchema).min(1).max(PREVIEW_TARGETS_MAX),
});

/** The `data-targets` part of a user message; see `turnTargetsDataSchema`. */
export const turnTargetsDataPartSchema = z.object({
	type: z.literal("data-targets"),
	id: z.literal("targets"),
	data: turnTargetsDataSchema,
});

/** The picks of one user message, 1 to 10, in pick order. */
export type TurnTargetsData = z.infer<typeof turnTargetsDataSchema>;

/**
 * `data` of the `data-turn-summary` part the task writes once, after the
 * commit of a turn that ended normally. The chat shows it as "Worked for
 * 1 min · 6 files changed". The stored assistant message keeps it too.
 */
export const turnSummaryDataSchema = z.object({
	// The files of the turn commit; empty when the turn changed no file or
	// the commit failed.
	files: z.array(appCommitNumstatEntrySchema),
	// Whole seconds from the task start to the commit end, at least 1. The
	// queue wait before the task start is not in it.
	workedSeconds: z.int().positive(),
	// The mode of the turn. After a reload, the Plan toggle starts from the
	// mode of the last turn. Rows stored before Plan Mode existed were builds.
	mode: builderTurnModeSchema.default("build"),
});

/** One `data-turn-summary` part; id is `summary-${turnId}`. */
export const turnSummaryDataPartSchema = z.object({
	type: z.literal("data-turn-summary"),
	id: z.string(),
	data: turnSummaryDataSchema,
});

/** Inferred from `turnSummaryDataSchema`; the work time and the changed files of one turn. */
export type TurnSummaryData = z.infer<typeof turnSummaryDataSchema>;

/**
 * `data` of the `data-turn-context` part the task writes once, at the end
 * of a turn that ended normally. A turn that pauses for the user writes none.
 * Both counts come from Claude Code. The
 * chat shows a "context getting full" notice when `tokens` nears
 * `compactAtTokens`. `ClaudeCodeHarness` parses the bridge value with it too.
 */
export const turnContextDataSchema = z.object({
	// Tokens of the conversation that Claude Code sends on its next model call.
	tokens: z.int().nonnegative(),
	// Claude Code summarizes the conversation when `tokens` reaches this
	// count: 300,000 on a 1M-window Claude model, 167,000 on other models.
	compactAtTokens: z.int().positive(),
});

/** One `data-turn-context` part; id is `context-${turnId}`. */
export const turnContextDataPartSchema = z.object({
	type: z.literal("data-turn-context"),
	id: z.string(),
	data: turnContextDataSchema,
});

/** Inferred from `turnContextDataSchema`; the conversation size after one turn. */
export type TurnContextData = z.infer<typeof turnContextDataSchema>;

/**
 * Name of the dynamic tool part that `HarnessAgent` (`@ai-sdk/harness`)
 * writes when Claude Code compacts the conversation. The stored reply keeps
 * the part, so the chat shows the compaction line after a reload too.
 */
export const HARNESS_COMPACTION_TOOL_NAME = "compaction";

/**
 * `output` of the compaction tool part. The vendor output also holds the
 * summary text; the chat does not show it, so the parse drops it.
 */
export const harnessCompactionOutputSchema = z.object({
	// `auto` when Claude Code reached its compaction point, `manual` for `/compact`.
	trigger: z.enum(["auto", "manual"]),
	// Conversation tokens before and after the summary. Claude Code can omit them.
	tokensBefore: z.int().nonnegative().optional(),
	tokensAfter: z.int().nonnegative().optional(),
});

/** Inferred from `harnessCompactionOutputSchema`; one compaction of the conversation. */
export type HarnessCompactionOutput = z.infer<
	typeof harnessCompactionOutputSchema
>;

/**
 * The `data-*` chunks the API relay writes on the browser stream.
 * `useChat` + `DefaultChatTransport` accept them as custom data parts;
 * every other frame on the wire is a raw AI SDK chunk or `[DONE]`.
 * `data-targets` is the exception: only the user message row holds it, and
 * `hydrateTurnMessages` parses it.
 */
export const turnDataPartSchema = z.discriminatedUnion("type", [
	turnCreatedDataPartSchema,
	turnStatusDataPartSchema,
	turnUsageDataPartSchema,
	turnErrorDataPartSchema,
	turnDoneDataPartSchema,
	turnQuestionDataPartSchema,
	turnApprovalDataPartSchema,
	turnPlanDataPartSchema,
	turnThoughtDataPartSchema,
	turnTargetsDataPartSchema,
	turnSummaryDataPartSchema,
	turnContextDataPartSchema,
	turnSecurityReportDataPartSchema,
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
	question: TurnQuestionData;
	approval: TurnApprovalData;
	plan: TurnPlanData;
	thought: TurnThoughtData;
	targets: TurnTargetsData;
	// The input type: live parts skip the zod parse, so `mode` can be absent
	// on a summary from a worker before Plan Mode.
	"turn-summary": z.input<typeof turnSummaryDataSchema>;
	"turn-context": TurnContextData;
	"security-report": TurnSecurityReportData;
};
