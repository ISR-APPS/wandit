import type { DynamicToolUIPart } from "ai";
import { describe, expect, it } from "vitest";

import type {
	BuilderMessagePart,
	TurnMessage,
	TurnMessagePart,
} from "../api/dto";
import {
	errorOf,
	livePhaseOf,
	receiptOf,
	stepOf,
	toBuilderMessages,
} from "./turn-parts";

const IDLE = { isRunning: false };
const RUNNING = { isRunning: true };

/** A finished call of one tool, as the harness streams it. */
function doneCall(
	toolName: string,
	input: Record<string, string>,
	output: Record<string, string> = {},
): DynamicToolUIPart {
	return {
		type: "dynamic-tool",
		toolName,
		toolCallId: `call-${toolName}`,
		state: "output-available",
		input,
		output,
	};
}

/** The data-step parts of the first message, in order. */
function stepsOf(messages: TurnMessage[], options = IDLE) {
	return toBuilderMessages(messages, options)[0].parts.flatMap((part) =>
		part.type === "data-step" ? [part.data] : [],
	);
}

describe("stepOf", () => {
	it("shows an edit as an edit row with the file name and the diff lines", () => {
		expect(
			stepOf(
				doneCall("edit", {
					file_path: "src/styles.css",
					old_string: "a {}",
					new_string: "a { color: red; }",
				}),
				false,
			),
		).toEqual({
			kind: "edit",
			state: "done",
			target: "styles.css",
			description: null,
			detail: [
				{ kind: "remove", text: "a {}" },
				{ kind: "add", text: "a { color: red; }" },
			],
		});
	});

	it("shows a write as an edit row with the content as added lines", () => {
		const step = stepOf(
			doneCall("write", { file_path: "src/app.tsx", content: "one\ntwo" }),
			false,
		);
		expect(step?.kind).toBe("edit");
		expect(step?.target).toBe("app.tsx");
		expect(step?.detail).toEqual([
			{ kind: "add", text: "one" },
			{ kind: "add", text: "two" },
		]);
	});

	it("cuts a long detail to 40 lines and one ellipsis line", () => {
		const content = Array.from({ length: 50 }, (_, index) => `line ${index}`);
		const step = stepOf(
			doneCall("write", { file_path: "a.ts", content: content.join("\n") }),
			false,
		);
		expect(step?.detail).toHaveLength(41);
		expect(step?.detail.at(-1)).toEqual({ kind: "context", text: "…" });
	});

	it("uses the model's command sentence and hides the command in the detail", () => {
		const step = stepOf(
			doneCall("bash", {
				command: "pnpm run typecheck",
				description: "Vérification que l'application se charge",
			}),
			false,
		);
		expect(step).toMatchObject({
			kind: "run",
			target: null,
			description: "Vérification que l'application se charge",
			detail: [{ kind: "context", text: "pnpm run typecheck" }],
		});
	});

	it("names a fetched page by its host", () => {
		const step = stepOf(
			doneCall("WebFetch", { url: "https://docs.example.com/a", prompt: "x" }),
			false,
		);
		expect(step).toMatchObject({ kind: "web", target: "docs.example.com" });
	});

	it("gives a web search no target", () => {
		expect(
			stepOf(doneCall("webSearch", { query: "tanstack start" }), false),
		).toMatchObject({ kind: "web", target: null });
	});

	it("names the skill of a guide row", () => {
		expect(
			stepOf(doneCall("Skill", { skill: "zellige" }), false),
		).toMatchObject({ kind: "guide", target: "zellige" });
	});

	it("names the host of a network request", () => {
		expect(
			stepOf(
				doneCall(
					"request_network_host",
					{ host: "api.github.com", reason: "Load the repos" },
					{ status: "allowed", host: "api.github.com" },
				),
				false,
			),
		).toMatchObject({
			kind: "network",
			state: "done",
			target: "api.github.com",
		});
	});

	it("shows the SQL of a migration in the detail", () => {
		expect(
			stepOf(
				doneCall(
					"apply_migration",
					{ name: "notes", sql: "create table notes ();" },
					{ status: "applied", file: "supabase/migrations/1_notes.sql" },
				),
				false,
			),
		).toMatchObject({
			kind: "database",
			detail: [{ kind: "context", text: "create table notes ();" }],
		});
	});

	it("marks a host tool failure status as an error", () => {
		expect(
			stepOf(
				doneCall(
					"generate_image",
					{ prompt: "a cat", aspect: "1:1", path: "public/cat.png" },
					{ status: "failed", message: "no credits" },
				),
				false,
			),
		).toMatchObject({
			kind: "image",
			state: "error",
			detail: [{ kind: "context", text: "a cat" }],
		});
	});

	it("marks a host tool that waits for an approval as skipped", () => {
		expect(
			stepOf(
				doneCall(
					"run_sql",
					{ query: "delete from notes" },
					{ status: "needs_approval", tool: "run_sql_write" },
				),
				false,
			),
		).toMatchObject({
			kind: "databaseCheck",
			state: "skipped",
			detail: [{ kind: "context", text: "delete from notes" }],
		});
	});

	it("shows a sub-agent task with its description and its prompt", () => {
		expect(
			stepOf(
				doneCall("Agent", {
					description: "Check the forms",
					prompt: "Read src/forms",
				}),
				false,
			),
		).toEqual({
			kind: "task",
			state: "done",
			target: null,
			description: "Check the forms",
			detail: [{ kind: "context", text: "Read src/forms" }],
		});
	});

	it("never shows the raw name of an unknown tool as the label", () => {
		expect(
			stepOf(doneCall("CronCreate", { cron: "* * * * *" }), false),
		).toEqual({
			kind: "other",
			state: "done",
			target: null,
			description: null,
			detail: [{ kind: "context", text: "CronCreate" }],
		});
	});

	it("treats a prototype key like constructor as an unknown tool", () => {
		expect(stepOf(doneCall("constructor", {}), false)?.kind).toBe("other");
	});

	it("gives the bookkeeping and question tools no row", () => {
		for (const toolName of [
			"TodoWrite",
			"ToolSearch",
			"ask_user",
			"askUserQuestions",
		]) {
			expect(stepOf(doneCall(toolName, {}), false)).toBeNull();
		}
	});

	it("hides a call that waits for an approval; the approval card covers it", () => {
		expect(
			stepOf(
				{
					type: "dynamic-tool",
					toolName: "run_sql_write",
					toolCallId: "call-1",
					state: "approval-requested",
					input: { query: "delete from notes" },
					approval: { id: "ap-1" },
				},
				false,
			),
		).toBeNull();
	});

	it("runs while the turn is live and is skipped once the turn stopped", () => {
		const part: DynamicToolUIPart = {
			type: "dynamic-tool",
			toolName: "edit",
			toolCallId: "call-1",
			state: "input-available",
			input: { file_path: "src/a.ts" },
		};
		expect(stepOf(part, true)?.state).toBe("running");
		expect(stepOf(part, false)?.state).toBe("skipped");
	});

	it("adds the error text of a failed call to the detail", () => {
		const step = stepOf(
			{
				type: "dynamic-tool",
				toolName: "bash",
				toolCallId: "call-1",
				state: "output-error",
				input: { command: "pnpm lint" },
				errorText: "exit code 1",
			},
			false,
		);
		expect(step?.state).toBe("error");
		expect(step?.detail.at(-1)).toEqual({
			kind: "remove",
			text: "exit code 1",
		});
	});
});

describe("receiptOf", () => {
	it("rounds the usage centi-credits up to whole credits", () => {
		const parts = [
			{
				type: "data-turn-usage",
				id: "turn-usage",
				data: {
					inputTokens: 1200,
					outputTokens: 300,
					cacheReadTokens: 0,
					cacheWriteTokens: 0,
					credits: 150,
				},
			},
		] satisfies TurnMessagePart[];
		expect(receiptOf(parts)).toEqual({
			credits: 2,
			modelId: null,
			inputTokens: 1200,
			outputTokens: 300,
		});
	});

	it("lets the done receipt win over the usage part", () => {
		const parts = [
			{
				type: "data-turn-usage",
				id: "turn-usage",
				data: {
					inputTokens: 1200,
					outputTokens: 300,
					cacheReadTokens: 0,
					cacheWriteTokens: 0,
					credits: 150,
				},
			},
			{
				type: "data-turn-done",
				id: "turn-done",
				data: {
					status: "succeeded",
					receipt: {
						credits: 250,
						modelId: "anthropic/claude-sonnet-5",
						inputTokens: 1400,
						outputTokens: 500,
						cacheReadTokens: 0,
						cacheWriteTokens: 0,
						balanceCredits: 750,
					},
				},
			},
		] satisfies TurnMessagePart[];
		expect(receiptOf(parts)).toEqual({
			credits: 3,
			modelId: "anthropic/claude-sonnet-5",
			inputTokens: 1400,
			outputTokens: 500,
		});
	});

	it("returns null without a usage or a done part", () => {
		expect(receiptOf([])).toBeNull();
	});
});

describe("errorOf", () => {
	it("returns the payload of the error part", () => {
		const parts = [
			{
				type: "data-turn-error",
				id: "turn-error",
				data: {
					code: "SANDBOX_LOST",
					message: "The sandbox stopped.",
					retryable: true,
				},
			},
		] satisfies TurnMessagePart[];
		expect(errorOf(parts)).toEqual({
			code: "SANDBOX_LOST",
			message: "The sandbox stopped.",
			retryable: true,
		});
	});

	it("returns null without an error part", () => {
		expect(errorOf([])).toBeNull();
	});
});

describe("livePhaseOf", () => {
	const messages = [
		{
			id: "a1",
			role: "assistant",
			parts: [
				{
					type: "data-turn-status",
					id: "turn-status",
					data: { phase: "sandbox_waking" },
				},
			],
		},
	] satisfies TurnMessage[];

	it("returns the last status phase while a turn runs", () => {
		expect(livePhaseOf(messages, true)).toBe("sandbox_waking");
	});

	it("returns null when no turn runs, so an old status never shows", () => {
		expect(livePhaseOf(messages, false)).toBeNull();
	});
});

describe("toBuilderMessages", () => {
	it("keeps the text and file parts of a user message", () => {
		const messages = [
			{
				id: "u1",
				role: "user",
				parts: [
					{ type: "text", text: "Add this logo" },
					{
						type: "file",
						mediaType: "image/png",
						url: "data:image/png;base64,xx",
						filename: "logo.png",
					},
				],
			},
		] satisfies TurnMessage[];
		const out = toBuilderMessages(messages, IDLE);
		expect(out).toHaveLength(1);
		expect(out[0].parts.map((part) => part.type)).toEqual(["text", "file"]);
	});

	it("drops an empty user message, like the answer to an approval", () => {
		const messages = [
			{ id: "u1", role: "user", parts: [{ type: "text", text: "" }] },
		] satisfies TurnMessage[];
		expect(toBuilderMessages(messages, IDLE)).toEqual([]);
	});

	it("keeps the stream order: thought, steps, text", () => {
		const messages = [
			{
				id: "a1",
				role: "assistant",
				parts: [
					{ type: "step-start" },
					{
						type: "reasoning",
						id: "r-1",
						text: "Plan the page.",
						state: "done",
					},
					{ type: "data-thought", data: { reasoningId: "r-1", seconds: 5 } },
					doneCall("edit", { file_path: "src/a.ts" }),
					{ type: "text", text: "Your page is live." },
				],
			},
		] satisfies TurnMessage[];
		const out = toBuilderMessages(messages, IDLE);
		expect(out[0].parts.map((part) => part.type)).toEqual([
			"data-thought",
			"data-step",
			"text",
		]);
	});

	it("reads the thought seconds of the reasoning block by its id", () => {
		const messages = [
			{
				id: "a1",
				role: "assistant",
				parts: [
					{ type: "reasoning", id: "r-1", text: "One.", state: "done" },
					{ type: "reasoning", id: "r-2", text: "Two.", state: "done" },
					{ type: "data-thought", data: { reasoningId: "r-2", seconds: 22 } },
					{ type: "data-thought", data: { reasoningId: "r-1", seconds: 5 } },
				],
			},
		] satisfies TurnMessage[];
		const thoughts = toBuilderMessages(messages, IDLE)[0].parts.flatMap(
			(part) => (part.type === "data-thought" ? [part.data] : []),
		);
		expect(thoughts).toEqual([
			{ text: "One.", seconds: 5, isStreaming: false },
			{ text: "Two.", seconds: 22, isStreaming: false },
		]);
	});

	it("streams the thought of the live reply only", () => {
		const messages = [
			{
				id: "a1",
				role: "assistant",
				parts: [
					{ type: "reasoning", id: "r-1", text: "Hmm", state: "streaming" },
				],
			},
		] satisfies TurnMessage[];
		const live = toBuilderMessages(messages, RUNNING)[0].parts[0];
		const stopped = toBuilderMessages(messages, IDLE)[0].parts[0];
		expect(live).toMatchObject({ data: { isStreaming: true } });
		// A stopped turn leaves the block in "streaming"; it must not shimmer forever.
		expect(stopped).toMatchObject({
			data: { isStreaming: false, seconds: null },
		});
	});

	it("drops an empty reasoning block with no timing", () => {
		const messages = [
			{
				id: "a1",
				role: "assistant",
				parts: [
					{ type: "reasoning", id: "r-1", text: "", state: "done" },
					{ type: "text", text: "Done." },
				],
			},
		] satisfies TurnMessage[];
		expect(
			toBuilderMessages(messages, IDLE)[0].parts.map((part) => part.type),
		).toEqual(["text"]);
	});

	it("merges a run of reads and searches into one explore row", () => {
		const messages = [
			{
				id: "a1",
				role: "assistant",
				parts: [
					doneCall("read", { file_path: "src/a.ts" }),
					{ type: "step-start" },
					doneCall("TodoWrite", {}),
					doneCall("grep", { pattern: "useChat" }),
					doneCall("edit", { file_path: "src/a.ts" }),
					doneCall("read", { file_path: "src/b.ts" }),
				],
			},
		] satisfies TurnMessage[];
		const steps = stepsOf(messages);
		expect(steps.map((step) => [step.kind, step.target])).toEqual([
			["explore", null],
			["edit", "a.ts"],
			["explore", "b.ts"],
		]);
		expect(steps[0].detail.map((line) => line.text)).toEqual([
			"src/a.ts",
			"useChat",
		]);
	});

	it("runs a merged explore row while one of its reads runs", () => {
		const messages = [
			{
				id: "a1",
				role: "assistant",
				parts: [
					doneCall("read", { file_path: "src/a.ts" }),
					{
						type: "dynamic-tool",
						toolName: "glob",
						toolCallId: "call-2",
						state: "input-available",
						input: { pattern: "**/*.tsx" },
					},
				],
			},
		] satisfies TurnMessage[];
		expect(stepsOf(messages, RUNNING)[0].state).toBe("running");
	});

	it("opens the question of the last reply and closes it once a reply follows", () => {
		const question = {
			type: "data-question",
			id: "call-1:question-0",
			data: {
				toolCallId: "call-1",
				questionId: "question-0",
				question: "Which style?",
				kind: "single-choice",
				options: [{ id: "a", label: "Warm" }],
				answer: null,
			},
		} satisfies TurnMessagePart;
		const open = [
			{ id: "a1", role: "assistant", parts: [question] },
		] satisfies TurnMessage[];
		const answered = [
			...open,
			{ id: "u1", role: "user", parts: [{ type: "text", text: "Warm" }] },
			{ id: "a2", role: "assistant", parts: [{ type: "text", text: "Ok." }] },
		] satisfies TurnMessage[];
		const isQuestion = (
			part: BuilderMessagePart,
		): part is Extract<BuilderMessagePart, { type: "data-question" }> =>
			part.type === "data-question";
		expect(
			toBuilderMessages(open, IDLE)[0].parts.find(isQuestion)?.data,
		).toMatchObject({
			isOpen: true,
			isAnswered: false,
			kind: "single-choice",
			helper: null,
			maxFiles: null,
			options: [{ id: "a", label: "Warm" }],
		});
		expect(
			toBuilderMessages(answered, IDLE)[0].parts.find(isQuestion)?.data,
		).toMatchObject({ isOpen: false, isAnswered: true });
		// The paused turn still settles: the question is neither in the tray nor answered.
		expect(
			toBuilderMessages(open, RUNNING)[0].parts.find(isQuestion)?.data,
		).toMatchObject({ isOpen: false, isAnswered: false });
	});

	it("keeps a question open after a rejected answer, since no reply follows", () => {
		const messages = [
			{
				id: "a1",
				role: "assistant",
				parts: [
					{
						type: "data-question",
						id: "call-1:question-0",
						data: {
							toolCallId: "call-1",
							questionId: "question-0",
							question: "Which style?",
							kind: "free-text",
							options: [],
							answer: null,
						},
					},
				],
			},
			{ id: "u1", role: "user", parts: [{ type: "text", text: "Warm" }] },
		] satisfies TurnMessage[];
		const question = toBuilderMessages(messages, IDLE)[0].parts[0];
		expect(question).toMatchObject({
			data: { isOpen: true, isAnswered: false },
		});
		// While the answer turn runs, the tray must not show the question again.
		expect(toBuilderMessages(messages, RUNNING)[0].parts[0]).toMatchObject({
			data: { isOpen: false },
		});
	});

	it("closes an approval card when a reply follows it, as after a reload", () => {
		const messages = [
			{
				id: "a1",
				role: "assistant",
				parts: [
					{
						type: "data-approval",
						id: "ap-1",
						data: {
							approvalId: "ap-1",
							toolCallId: "call-9",
							toolName: "run_sql_write",
							input: "{}",
							decision: null,
						},
					},
				],
			},
			{ id: "u1", role: "user", parts: [{ type: "text", text: "" }] },
			{
				id: "a2",
				role: "assistant",
				parts: [{ type: "text", text: "Ran it." }],
			},
		] satisfies TurnMessage[];
		const out = toBuilderMessages(messages, IDLE);
		expect(out.map((message) => message.id)).toEqual(["a1", "a2"]);
		expect(out[0].parts[0]).toMatchObject({ data: { isOpen: false } });
	});

	it("keeps an approval card open when the answer got no reply", () => {
		const messages = [
			{
				id: "a1",
				role: "assistant",
				parts: [
					{
						type: "data-approval",
						id: "ap-1",
						data: {
							approvalId: "ap-1",
							toolCallId: "call-9",
							toolName: "run_sql_write",
							input: "{}",
							decision: null,
						},
					},
				],
			},
			{ id: "u1", role: "user", parts: [{ type: "text", text: "" }] },
		] satisfies TurnMessage[];
		expect(toBuilderMessages(messages, IDLE)[0].parts[0]).toMatchObject({
			data: { isOpen: true },
		});
	});

	it("ends with the error and the receipt and never renders the status", () => {
		const messages = [
			{
				id: "a1",
				role: "assistant",
				parts: [
					{
						type: "data-turn-status",
						id: "turn-status",
						data: { phase: "sandbox_waking" },
					},
					{ type: "text", text: "Working on it." },
					{
						type: "data-turn-error",
						id: "turn-error",
						data: { code: "X", message: "failed", retryable: false },
					},
					{
						type: "data-turn-usage",
						id: "turn-usage",
						data: {
							inputTokens: 10,
							outputTokens: 5,
							cacheReadTokens: 0,
							cacheWriteTokens: 0,
							credits: 42,
						},
					},
				],
			},
		] satisfies TurnMessage[];
		expect(
			toBuilderMessages(messages, IDLE)[0].parts.map((part) => part.type),
		).toEqual(["text", "data-error", "data-receipt"]);
	});

	it("drops a reply that holds only the created frame, as after a cancel", () => {
		const messages = [
			{ id: "u1", role: "user", parts: [{ type: "text", text: "hello" }] },
			{
				id: "a1",
				role: "assistant",
				parts: [
					{
						type: "data-turn-created",
						id: "turn-created",
						data: {
							turnId: "9b1d6b24-3f0c-4c6f-9f1d-2f0d2a5a1c01",
							chatId: "9b1d6b24-3f0c-4c6f-9f1d-2f0d2a5a1c02",
							runId: null,
							status: "running",
							streamUrl: "/api/v2/projects/p1/turns/active/stream",
						},
					},
				],
			},
		] satisfies TurnMessage[];
		expect(
			toBuilderMessages(messages, IDLE).map((message) => message.id),
		).toEqual(["u1"]);
	});
});
