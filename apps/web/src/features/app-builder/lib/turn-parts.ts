/**
 * Maps the real turn stream messages (`TurnMessage`) to the card shapes the
 * chat components render (`BuilderMessage`). use-builder-thread.ts feeds
 * the `useChat` messages through `toBuilderMessages`. Pure functions, no
 * React, no copy: the caller passes the labels.
 */

import { type TurnStreamPhase, turnStreamPhases } from "@wandit/contracts";
import { getToolName, isToolUIPart } from "ai";
import { z } from "zod";

import type {
	BuilderDataParts,
	BuilderFileChange,
	BuilderMessage,
	BuilderProgressStep,
	BuilderToolCall,
	TurnMessage,
	TurnMessagePart,
} from "../api/dto";

/**
 * Phase and tool labels of the cards, filled by the page from the
 * dictionary so this file holds no user-facing copy.
 */
export type TurnPartLabels = {
	/** Label of each stream phase, keyed by the contracts phase id. */
	phases: Record<TurnStreamPhase, string>;
	/** Label of each tool-row kind: think, read, write, run. */
	tools: Record<BuilderToolCall["kind"], string>;
};

// The built-in tool names of @ai-sdk/harness, grouped by the row icon they
// get. The stream types each call `tool-<name>`, so `read` arrives as a
// `tool-read` part. A name that is not here gets the "think" kind and
// keeps its raw name as the label.
const TOOL_KIND_BY_NAME: Record<string, BuilderToolCall["kind"]> = {
	read: "read",
	glob: "read",
	grep: "read",
	webSearch: "read",
	edit: "write",
	write: "write",
	bash: "run",
};

// The harness tool the agent calls to ask the user. The API mirrors each
// call as a `data-question` card (contracts turns.ts), so it gets no row.
const QUESTION_TOOL_NAME = "askUserQuestions";

/**
 * The row kind of a harness tool name, or undefined when the table does
 * not know it. `Object.hasOwn` keeps inherited keys like "constructor"
 * from passing as known names.
 */
function toolKindOf(toolName: string): BuilderToolCall["kind"] | undefined {
	return Object.hasOwn(TOOL_KIND_BY_NAME, toolName)
		? TOOL_KIND_BY_NAME[toolName]
		: undefined;
}

/** Longest text a tool chip shows; longer targets and JSON inputs are cut. */
const TOOL_TARGET_MAX_CHARS = 80;

// The input fields of the harness tools that name what a call works on, in
// pick order: file_path (read, write, edit), command (bash), pattern (grep,
// glob), query (webSearch).
const toolInputTargetSchema = z.object({
	file_path: z.string().optional(),
	command: z.string().optional(),
	pattern: z.string().optional(),
	query: z.string().optional(),
});

/**
 * The chip target of one tool call: the first input field that names a
 * file, a command, a pattern, or a query. Without one, the JSON text of
 * the input. Both are cut to TOOL_TARGET_MAX_CHARS.
 */
function toolTargetOf(input: unknown): string {
	const parsed = toolInputTargetSchema.safeParse(input);
	const named = parsed.success
		? (parsed.data.file_path ??
			parsed.data.command ??
			parsed.data.pattern ??
			parsed.data.query)
		: undefined;
	// JSON.stringify returns undefined for an absent input (streaming state).
	return (named ?? JSON.stringify(input) ?? "").slice(0, TOOL_TARGET_MAX_CHARS);
}

/**
 * One tool-chip row per tool part (`tool-<name>` or `dynamic-tool`) and per
 * `reasoning` part, in part order. A reasoning part gets the `think` kind
 * and its first TOOL_TARGET_MAX_CHARS characters as the target.
 */
export function toolCallsOf(
	parts: readonly TurnMessagePart[],
	labels: TurnPartLabels,
): BuilderToolCall[] {
	return parts.flatMap<BuilderToolCall>((part) => {
		if (part.type === "reasoning") {
			return [
				{
					kind: "think",
					label: labels.tools.think,
					target: part.text.slice(0, TOOL_TARGET_MAX_CHARS),
				},
			];
		}
		if (!isToolUIPart(part)) return [];
		const toolName = getToolName(part);
		if (toolName === QUESTION_TOOL_NAME) return [];
		const kind = toolKindOf(toolName);
		return [
			{
				kind: kind ?? "think",
				// An unknown tool name is its own label; a known one takes the
				// dictionary label of its kind.
				label: kind === undefined ? toolName : labels.tools[kind],
				target: toolTargetOf(part.input),
			},
		];
	});
}

/**
 * The files the turn wrote: the unique `file_path` of the `write`-kind
 * calls, in first-seen order. Read and run calls carry no file change.
 */
export function fileChangesOf(
	parts: readonly TurnMessagePart[],
): BuilderFileChange[] {
	const seen = new Set<string>();
	const files: BuilderFileChange[] = [];
	for (const part of parts) {
		if (!isToolUIPart(part)) continue;
		if (toolKindOf(getToolName(part)) !== "write") continue;
		const parsed = toolInputTargetSchema.safeParse(part.input);
		const path = parsed.success ? parsed.data.file_path : undefined;
		if (path === undefined || path === "" || seen.has(path)) continue;
		seen.add(path);
		// LIMIT: added and removed stay 0; the stream's data-builder-files
		// part has no contract schema yet. Upgrade: a schema for that part in
		// contracts, read here.
		files.push({ path, added: 0, removed: 0 });
	}
	return files;
}

/**
 * The progress card data of one message, or null when it holds no
 * `data-turn-status` part. Phases before the last seen phase are done and
 * the last seen phase is active; a `data-turn-done` part with status
 * `succeeded` marks every step done at 100 percent.
 */
export function progressOf(
	parts: readonly TurnMessagePart[],
	labels: TurnPartLabels,
): BuilderDataParts["progress"] | null {
	const lastStatus = parts.findLast(
		(part): part is Extract<TurnMessagePart, { type: "data-turn-status" }> =>
			part.type === "data-turn-status",
	);
	if (lastStatus === undefined) return null;
	const lastIndex = turnStreamPhases.indexOf(lastStatus.data.phase);
	// The done part carries the row status: failed, canceled, or stalled
	// keeps the last phase active next to the error card.
	const finished = parts.some(
		(part) =>
			part.type === "data-turn-done" && part.data.status === "succeeded",
	);
	const steps: BuilderProgressStep[] = turnStreamPhases.map((phase, index) => ({
		id: phase,
		label: labels.phases[phase],
		state:
			finished || index < lastIndex
				? "done"
				: index === lastIndex
					? "active"
					: "pending",
	}));
	return {
		title: lastStatus.data.message ?? labels.phases[lastStatus.data.phase],
		// Last seen phase index over the last possible phase index, in percent.
		percent: finished
			? 100
			: Math.round((lastIndex / (turnStreamPhases.length - 1)) * 100),
		steps,
	};
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

/** The text parts of a message joined with a blank line, trimmed. */
function messageTextOf(message: TurnMessage): string {
	return message.parts
		.flatMap((part) => (part.type === "text" ? [part.text] : []))
		.join("\n\n")
		.trim();
}

/**
 * The text of the first user message after `messages[index]` that got an
 * assistant reply and is not empty, or null. The API never writes a
 * `data-question` answer back into the stored part; the next answered user
 * message holds it.
 */
export function answerFor(
	messages: readonly TurnMessage[],
	index: number,
): string | null {
	for (let i = index + 1; i < messages.length; i++) {
		// A send the API rejected keeps its user message but no reply follows
		// it. Only a message the turn answered counts as an answer.
		if (messages[i].role !== "user" || messages[i + 1]?.role !== "assistant") {
			continue;
		}
		const text = messageTextOf(messages[i]);
		if (text.length > 0) return text;
	}
	return null;
}

/**
 * True when an assistant message sits after `messages[index]`. The API
 * refuses every new turn while an approval card waits, so a later reply
 * proves the card got its answer. The answer row itself has no parts, and
 * hydration drops it, so the reply is the only durable proof.
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
 * Maps the turn messages to the card messages. A user message keeps its
 * text and file parts and is dropped when it has neither (an approval
 * answer sends an empty message; the approval card shows the decision).
 * An assistant message keeps its text parts first, then gets the
 * synthesized data parts: tools, progress, question cards, approval cards,
 * error, receipt. `data-turn-created`, `step-start`, `source-*`, and every
 * other part type are ignored.
 */
export function toBuilderMessages(
	messages: readonly TurnMessage[],
	labels: TurnPartLabels,
): BuilderMessage[] {
	return messages.flatMap<BuilderMessage>((message, index) => {
		if (message.role === "user") {
			const parts = message.parts.filter(
				(part): part is Extract<TurnMessagePart, { type: "text" | "file" }> =>
					part.type === "text" || part.type === "file",
			);
			// An approval answer sends an empty user message; the approval card
			// shows the decision, so the empty message drops. A file-only
			// message is a real turn (an attachment-only send) and stays.
			if (
				messageTextOf(message).length === 0 &&
				!parts.some((part) => part.type === "file")
			) {
				return [];
			}
			return [{ id: message.id, role: "user", parts }];
		}
		if (message.role !== "assistant") return [];
		const parts: BuilderMessage["parts"] = message.parts.filter(
			(part): part is Extract<TurnMessagePart, { type: "text" }> =>
				part.type === "text",
		);
		const calls = toolCallsOf(message.parts, labels);
		if (calls.length > 0) {
			parts.push({
				type: "data-tools",
				id: `${message.id}-tools`,
				data: { calls, files: fileChangesOf(message.parts) },
			});
		}
		const progress = progressOf(message.parts, labels);
		if (progress !== null) {
			parts.push({
				type: "data-progress",
				id: `${message.id}-progress`,
				data: progress,
			});
		}
		for (const part of message.parts) {
			if (part.type !== "data-question") continue;
			parts.push({
				type: "data-question",
				id: part.id,
				data: {
					question: part.data.question,
					options: part.data.options,
					answer: part.data.answer ?? answerFor(messages, index),
				},
			});
		}
		for (const part of message.parts) {
			if (part.type !== "data-approval") continue;
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
					isOpen:
						part.data.decision === null &&
						!hasAssistantMessageAfter(messages, index),
				},
			});
		}
		const error = errorOf(message.parts);
		if (error !== null) {
			parts.push({
				type: "data-error",
				id: `${message.id}-error`,
				data: error,
			});
		}
		const receipt = receiptOf(message.parts);
		if (receipt !== null) {
			parts.push({
				type: "data-receipt",
				id: `${message.id}-receipt`,
				data: receipt,
			});
		}
		// A canceled turn leaves a reply that holds only the created frame.
		// The bubble drops, as the stored history drops such rows.
		if (parts.length === 0) return [];
		return [{ id: message.id, role: "assistant", parts }];
	});
}
