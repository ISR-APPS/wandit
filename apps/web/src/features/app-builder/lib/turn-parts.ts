/**
 * Maps the real turn stream messages (`TurnMessage`) to the card shapes the
 * chat components render (`BuilderMessage`). use-builder-thread.ts calls
 * `toBuilderMessages` and `livePhaseOf`. Pure functions, no React, no copy:
 * the components translate each row by its kind.
 */

import {
	applyMigrationToolInputSchema,
	generateImageHostToolInputSchema,
	requestNetworkHostToolInputSchema,
	runSqlToolInputSchema,
	type TurnStreamPhase,
} from "@wandit/contracts";
import {
	type DynamicToolUIPart,
	getToolName,
	isToolUIPart,
	type ToolUIPart,
} from "ai";
import { z } from "zod";

import type {
	BuilderDataParts,
	BuilderDiffLine,
	BuilderMessage,
	BuilderStepKind,
	BuilderStepState,
	TurnMessage,
	TurnMessagePart,
} from "../api/dto";

// Harness tool names by row kind. The 8 common built-ins arrive camelCase,
// every other Claude Code built-in keeps its PascalCase native name, and a
// host tool arrives with its bare name. A name that is not here is "other".
const STEP_KIND_BY_TOOL_NAME = new Map<string, BuilderStepKind>([
	["edit", "edit"],
	["write", "edit"],
	["NotebookEdit", "edit"],
	["read", "explore"],
	["glob", "explore"],
	["grep", "explore"],
	["LSP", "explore"],
	["bash", "run"],
	["Monitor", "run"],
	["webSearch", "web"],
	["WebFetch", "web"],
	["generate_image", "image"],
	["apply_migration", "database"],
	["apply_destructive_migration", "database"],
	["run_sql_write", "database"],
	["run_sql", "databaseCheck"],
	["get_advisors", "databaseCheck"],
	["deploy_function", "deploy"],
	["set_secret", "secret"],
	["request_network_host", "network"],
	["Skill", "guide"],
	["Agent", "task"],
]);

// Tools that get no row. The to-do list, the task list, the tool search, and
// the plan mode are agent bookkeeping. The questions show in the tray.
const HIDDEN_TOOL_NAMES = new Set([
	"TodoWrite",
	"TaskCreate",
	"TaskGet",
	"TaskUpdate",
	"TaskList",
	"TaskStop",
	"TaskOutput",
	"ToolSearch",
	"EnterPlanMode",
	"ExitPlanMode",
	"ask_user",
	"askUserQuestions",
]);

// Host tools report a failure as a normal output with a status. These
// statuses mean that the call did not do its job.
const FAILED_OUTPUT_STATUSES = new Set([
	"failed",
	"unavailable",
	"denied",
	"missing",
	"backend_not_ready",
	"backend_paused",
	"rate_limited",
]);

// These statuses mean that the call stopped before it ran.
const SKIPPED_OUTPUT_STATUSES = new Set(["needs_approval", "skipped"]);

/** Most detail lines one row shows behind its chevron; a longer block is cut. */
const DETAIL_MAX_LINES = 40;

const toolOutputStatusSchema = z.object({ status: z.string() });

// The input fields of the Claude Code built-ins that a row reads. During
// `input-streaming` the input is partial, so every field is optional.
const builtinToolInputSchema = z.object({
	file_path: z.string().optional(),
	notebook_path: z.string().optional(),
	filePath: z.string().optional(),
	old_string: z.string().optional(),
	new_string: z.string().optional(),
	content: z.string().optional(),
	new_source: z.string().optional(),
	command: z.string().optional(),
	description: z.string().optional(),
	pattern: z.string().optional(),
	path: z.string().optional(),
	query: z.string().optional(),
	url: z.string().optional(),
	prompt: z.string().optional(),
	skill: z.string().optional(),
});

type BuiltinToolInput = z.infer<typeof builtinToolInputSchema>;

/**
 * One tool part of a turn message: a `tool-<name>` part, or a `dynamic-tool`
 * part for a call whose input failed the tool schema.
 */
type ToolPart = ToolUIPart | DynamicToolUIPart;

/** The step data of one row, without the parts the component adds. */
type Step = BuilderDataParts["step"];

/** The last segment of a slash path, for example `styles.css`. */
function fileNameOf(path: string): string {
	return path.split("/").at(-1) || path;
}

/** The host of a URL, or null when the text is not a URL. */
function hostOf(url: string): string | null {
	return URL.canParse(url) ? new URL(url).host : null;
}

/** One line per text line, all in the same tone. */
function linesOf(
	text: string,
	kind: BuilderDiffLine["kind"],
): BuilderDiffLine[] {
	return text.split("\n").map((line) => ({ kind, text: line }));
}

/** The first DETAIL_MAX_LINES lines, then one "…" line when lines were cut. */
function capLines(lines: BuilderDiffLine[]): BuilderDiffLine[] {
	return lines.length > DETAIL_MAX_LINES
		? [...lines.slice(0, DETAIL_MAX_LINES), { kind: "context", text: "…" }]
		: lines;
}

/**
 * The state of one tool part, or null when the part gets no row. A call
 * that waits for an approval hides: the approval card of the message
 * covers it. A call that never got its output ran when the turn stopped.
 */
function stepStateOf(part: ToolPart, isLive: boolean): BuilderStepState | null {
	switch (part.state) {
		case "input-streaming":
		case "input-available":
			return isLive ? "running" : "skipped";
		case "approval-requested":
		case "approval-responded":
			return null;
		case "output-denied":
			return "skipped";
		case "output-error":
			return "error";
		case "output-available": {
			const output = toolOutputStatusSchema.safeParse(part.output);
			if (!output.success) return "done";
			if (FAILED_OUTPUT_STATUSES.has(output.data.status)) return "error";
			if (SKIPPED_OUTPUT_STATUSES.has(output.data.status)) return "skipped";
			return "done";
		}
	}
}

/** The target, the description, and the detail lines of one tool call. */
function stepContentOf(
	toolName: string,
	kind: BuilderStepKind,
	input: BuiltinToolInput,
	rawInput: unknown,
): Pick<Step, "target" | "description" | "detail"> {
	switch (kind) {
		case "edit": {
			const path = input.file_path ?? input.notebook_path;
			const detail =
				toolName === "edit"
					? [
							...linesOf(input.old_string ?? "", "remove"),
							...linesOf(input.new_string ?? "", "add"),
						]
					: linesOf(input.content ?? input.new_source ?? "", "add");
			return {
				target: path === undefined ? null : fileNameOf(path),
				description: null,
				detail: capLines(detail),
			};
		}
		case "explore": {
			// A single read names its file. A search names no file: the pattern
			// goes to the detail lines.
			const path = input.file_path ?? input.filePath;
			const searched = [input.pattern, input.path].filter(
				(value): value is string => value !== undefined,
			);
			return {
				target:
					toolName === "read" && path !== undefined ? fileNameOf(path) : null,
				description: null,
				detail: capLines(
					linesOf(path ?? searched.join("  "), "context").filter(
						(line) => line.text !== "",
					),
				),
			};
		}
		case "run":
			return {
				target: null,
				description: input.description ?? null,
				detail: capLines(linesOf(input.command ?? "", "context")),
			};
		case "web": {
			const host = input.url === undefined ? null : hostOf(input.url);
			return {
				target: host,
				description: null,
				detail: capLines(linesOf(input.url ?? input.query ?? "", "context")),
			};
		}
		case "image": {
			const parsed = generateImageHostToolInputSchema.safeParse(rawInput);
			return {
				target: null,
				description: null,
				detail: parsed.success
					? capLines(linesOf(parsed.data.prompt, "context"))
					: [],
			};
		}
		case "database":
		case "databaseCheck": {
			// The migration tools send `sql`; the SQL tools send `query`.
			const migration = applyMigrationToolInputSchema.safeParse(rawInput);
			const query = runSqlToolInputSchema.safeParse(rawInput);
			const sql = migration.success
				? migration.data.sql
				: query.success
					? query.data.query
					: "";
			return {
				target: null,
				description: null,
				detail: capLines(linesOf(sql, "context")),
			};
		}
		case "network": {
			const parsed = requestNetworkHostToolInputSchema.safeParse(rawInput);
			return {
				target: parsed.success ? parsed.data.host : null,
				description: null,
				detail: parsed.success
					? capLines(linesOf(parsed.data.reason, "context"))
					: [],
			};
		}
		case "guide":
			return { target: input.skill ?? null, description: null, detail: [] };
		case "task":
			return {
				target: null,
				description: input.description ?? null,
				detail: capLines(linesOf(input.prompt ?? "", "context")),
			};
		case "deploy":
		case "secret":
			return { target: null, description: null, detail: [] };
		case "other":
			// The raw name stays behind the chevron; the label never shows it.
			return {
				target: null,
				description: null,
				detail: [{ kind: "context", text: toolName }],
			};
	}
}

/**
 * The step row of one tool part, or null when the part gets no row: a
 * hidden tool, or a call that waits for an approval.
 */
export function stepOf(part: ToolPart, isLive: boolean): Step | null {
	const toolName = getToolName(part);
	if (HIDDEN_TOOL_NAMES.has(toolName)) return null;
	const state = stepStateOf(part, isLive);
	if (state === null) return null;
	const kind = STEP_KIND_BY_TOOL_NAME.get(toolName) ?? "other";
	const parsed = builtinToolInputSchema.safeParse(part.input);
	const content = stepContentOf(
		toolName,
		kind,
		parsed.success ? parsed.data : {},
		part.input,
	);
	const errorLines: BuilderDiffLine[] =
		part.state === "output-error"
			? linesOf(part.errorText, "remove").slice(0, DETAIL_MAX_LINES)
			: [];
	return {
		kind,
		state,
		...content,
		detail: [...content.detail, ...errorLines],
	};
}

/**
 * Merges a read or a search into the explore row before it. The merged row
 * names no file, keeps the detail lines of both, and runs while one of its
 * calls runs.
 */
function mergeExplore(previous: Step, next: Step): Step {
	const states = [previous.state, next.state];
	const state: BuilderStepState = states.includes("running")
		? "running"
		: states.includes("error")
			? "error"
			: states.every((value) => value === "skipped")
				? "skipped"
				: "done";
	return {
		...previous,
		state,
		target: null,
		detail: capLines([...previous.detail, ...next.detail]),
	};
}

/** The payload of the last `data-turn-error` part of one message, or null. */
export function errorOf(
	parts: readonly TurnMessagePart[],
): BuilderDataParts["error"] | null {
	const error = parts.findLast(
		(part): part is Extract<TurnMessagePart, { type: "data-turn-error" }> =>
			part.type === "data-turn-error",
	);
	return error?.data ?? null;
}

/**
 * The receipt line of one message: the last `data-turn-usage` part, or the
 * settled `data-turn-done` receipt when it exists (it also brings the
 * model id). Null when the message holds neither.
 */
export function receiptOf(
	parts: readonly TurnMessagePart[],
): BuilderDataParts["receipt"] | null {
	const done = parts.findLast(
		(part): part is Extract<TurnMessagePart, { type: "data-turn-done" }> =>
			part.type === "data-turn-done",
	);
	const usage = parts.findLast(
		(part): part is Extract<TurnMessagePart, { type: "data-turn-usage" }> =>
			part.type === "data-turn-usage",
	);
	const settled = done?.data.receipt;
	const source = settled ?? usage?.data;
	if (source === undefined) return null;
	// The stream counts centi-credits (1 credit = 100); the card shows whole credits.
	return {
		credits: Math.ceil(source.credits / 100),
		modelId: settled?.modelId ?? null,
		inputTokens: source.inputTokens,
		outputTokens: source.outputTokens,
	};
}

/**
 * The phase of the running turn: the last `data-turn-status` part of the
 * last message while a turn runs. Null when no turn runs or no status
 * arrived yet. The pane shows it in its one working row.
 */
export function livePhaseOf(
	messages: readonly TurnMessage[],
	isRunning: boolean,
): TurnStreamPhase | null {
	if (!isRunning) return null;
	const status = messages
		.at(-1)
		?.parts.findLast(
			(part): part is Extract<TurnMessagePart, { type: "data-turn-status" }> =>
				part.type === "data-turn-status",
		);
	return status?.data.phase ?? null;
}

/** The text parts of a message joined with a blank line, trimmed. */
function messageTextOf(message: TurnMessage): string {
	return message.parts
		.flatMap((part) => (part.type === "text" ? [part.text] : []))
		.join("\n\n")
		.trim();
}

/**
 * True when an assistant message sits after `messages[index]`. A send the
 * API rejects keeps its user message but gets no reply, so only a later
 * reply proves that the card got its answer.
 */
function hasAssistantMessageAfter(
	messages: readonly TurnMessage[],
	index: number,
): boolean {
	return messages
		.slice(index + 1)
		.some((message) => message.role === "assistant");
}

/**
 * The parts of one assistant message in stream order: text, a thought row
 * per reasoning block, a step row per visible tool call (a run of reads
 * and searches merges into one row), the question and approval cards, then
 * the error and the receipt. `isLive` is true only for the last message of
 * a running turn.
 */
function assistantPartsOf(
	messages: readonly TurnMessage[],
	index: number,
	isRunning: boolean,
): BuilderMessage["parts"] {
	const message = messages[index];
	const isLive = isRunning && index === messages.length - 1;
	const secondsByReasoningId = new Map<string, number>();
	for (const part of message.parts) {
		if (part.type === "data-thought") {
			secondsByReasoningId.set(part.data.reasoningId, part.data.seconds);
		}
	}
	const hasReplyAfter = hasAssistantMessageAfter(messages, index);

	const parts: BuilderMessage["parts"] = [];
	for (const part of message.parts) {
		if (part.type === "text") {
			parts.push(part);
			continue;
		}
		if (part.type === "reasoning") {
			const seconds =
				part.id === undefined
					? null
					: (secondsByReasoningId.get(part.id) ?? null);
			const isStreaming = isLive && part.state === "streaming";
			// An old row with an empty block has nothing to show.
			if (part.text.trim() === "" && seconds === null && !isStreaming) {
				continue;
			}
			parts.push({
				type: "data-thought",
				data: { text: part.text, seconds, isStreaming },
			});
			continue;
		}
		if (isToolUIPart(part)) {
			const step = stepOf(part, isLive);
			if (step === null) continue;
			const previous = parts.at(-1);
			if (
				step.kind === "explore" &&
				previous?.type === "data-step" &&
				previous.data.kind === "explore"
			) {
				parts[parts.length - 1] = {
					type: "data-step",
					data: mergeExplore(previous.data, step),
				};
				continue;
			}
			parts.push({ type: "data-step", data: step });
			continue;
		}
		if (part.type === "data-question") {
			parts.push({
				type: "data-question",
				id: part.id,
				data: {
					toolCallId: part.data.toolCallId,
					questionId: part.data.questionId,
					question: part.data.question,
					kind: part.data.kind,
					helper: part.data.helper ?? null,
					maxFiles: part.data.maxFiles ?? null,
					options: part.data.options,
					// A running turn answers it or settles it; the tray waits for the end.
					isOpen: !isRunning && !hasReplyAfter,
					isAnswered: hasReplyAfter,
				},
			});
			continue;
		}
		if (part.type === "data-approval") {
			parts.push({
				type: "data-approval",
				id: part.id,
				data: {
					approvalId: part.data.approvalId,
					toolName: part.data.toolName,
					input: part.data.input,
					decision: part.data.decision,
					// The card closes only when a later reply exists; a rejected send
					// leaves no reply, so the user can decide again.
					isOpen: part.data.decision === null && !hasReplyAfter,
				},
			});
		}
	}
	const error = errorOf(message.parts);
	if (error !== null) {
		parts.push({ type: "data-error", id: `${message.id}-error`, data: error });
	}
	const receipt = receiptOf(message.parts);
	if (receipt !== null) {
		parts.push({
			type: "data-receipt",
			id: `${message.id}-receipt`,
			data: receipt,
		});
	}
	return parts;
}

/**
 * Maps the turn messages to the card messages. A user message keeps its
 * text and file parts and drops when it has neither (an approval answer
 * sends an empty message; the approval card shows the decision). An
 * assistant message keeps its parts in stream order (see assistantPartsOf).
 * `isRunning` is true while a turn streams: only the last message is live.
 */
export function toBuilderMessages(
	messages: readonly TurnMessage[],
	{ isRunning }: { isRunning: boolean },
): BuilderMessage[] {
	return messages.flatMap<BuilderMessage>((message, index) => {
		if (message.role === "user") {
			const parts = message.parts.filter(
				(part): part is Extract<TurnMessagePart, { type: "text" | "file" }> =>
					part.type === "text" || part.type === "file",
			);
			if (
				messageTextOf(message).length === 0 &&
				!parts.some((part) => part.type === "file")
			) {
				return [];
			}
			return [{ id: message.id, role: "user", parts }];
		}
		if (message.role !== "assistant") return [];
		const parts = assistantPartsOf(messages, index, isRunning);
		// A canceled turn leaves a reply that holds only the created frame.
		// The bubble drops, as the stored history drops such rows.
		if (parts.length === 0) return [];
		return [{ id: message.id, role: "assistant", parts }];
	});
}
