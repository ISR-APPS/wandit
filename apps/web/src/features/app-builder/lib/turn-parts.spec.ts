import type { TurnStreamPhase } from "@wandit/contracts";
import type { DynamicToolUIPart } from "ai";
import { describe, expect, it } from "vitest";

import type {
	BuilderDiffLine,
	BuilderMessage,
	BuilderMessagePart,
	BuilderStepKind,
	BuilderStepState,
	TurnMessage,
	TurnMessagePart,
} from "../api/dto";
import {
	type LiveActivity,
	liveActivityOf,
	livePhaseOf,
	receiptOf,
	stepOf,
	toBuilderMessages,
	withoutThoughts,
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
	it.each<{
		toolName: string;
		input: Record<string, string>;
		target: string;
		detail: BuilderDiffLine[];
	}>([
		{
			toolName: "edit",
			input: {
				file_path: "src/styles.css",
				old_string: "a {}",
				new_string: "a { color: red; }",
			},
			target: "styles.css",
			detail: [
				{ kind: "remove", text: "a {}" },
				{ kind: "add", text: "a { color: red; }" },
			],
		},
		{
			toolName: "write",
			input: { file_path: "src/app.tsx", content: "one\ntwo" },
			target: "app.tsx",
			detail: [
				{ kind: "add", text: "one" },
				{ kind: "add", text: "two" },
			],
		},
	])("shows a $toolName call as an edit row with the file name and the diff lines", ({
		toolName,
		input,
		target,
		detail,
	}) => {
		expect(stepOf(doneCall(toolName, input), false)).toEqual({
			kind: "edit",
			state: "done",
			target,
			description: null,
			detail,
		});
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

	// A host tool reports a failure or a pause as a normal output with a status.
	it.each<{
		toolName: string;
		input: Record<string, string>;
		output: Record<string, string>;
		kind: BuilderStepKind;
		state: BuilderStepState;
		/** The one detail line: the SQL or the image prompt of the input. */
		detailText: string;
	}>([
		{
			toolName: "apply_migration",
			input: { name: "notes", sql: "create table notes ();" },
			output: { status: "applied", file: "supabase/migrations/1_notes.sql" },
			kind: "database",
			state: "done",
			detailText: "create table notes ();",
		},
		{
			toolName: "generate_image",
			input: { prompt: "a cat", aspect: "1:1", path: "public/cat.png" },
			output: { status: "failed", message: "no credits" },
			kind: "image",
			state: "error",
			detailText: "a cat",
		},
		{
			toolName: "run_sql",
			input: { query: "delete from notes" },
			output: { status: "needs_approval", tool: "run_sql_write" },
			kind: "databaseCheck",
			state: "skipped",
			detailText: "delete from notes",
		},
	])("shows the $toolName status $output.status as a $state row with its input in the detail", ({
		toolName,
		input,
		output,
		kind,
		state,
		detailText,
	}) => {
		expect(stepOf(doneCall(toolName, input, output), false)).toMatchObject({
			kind,
			state,
			detail: [{ kind: "context", text: detailText }],
		});
	});

	// The tool map is a Map, so a prototype key like constructor finds no kind either.
	it.each([
		"CronCreate",
		"constructor",
	])("keeps the raw name of the unknown tool %s out of the label", (toolName) => {
		expect(stepOf(doneCall(toolName, {}), false)).toEqual({
			kind: "other",
			state: "done",
			target: null,
			description: null,
			detail: [{ kind: "context", text: toolName }],
		});
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
});

describe("livePhaseOf", () => {
	// An old status must never show after the turn ends.
	it.each([
		{ isRunning: true, expected: "sandbox_waking" },
		{ isRunning: false, expected: null },
	])("returns $expected for the last status when isRunning is $isRunning", ({
		isRunning,
		expected,
	}) => {
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
		expect(livePhaseOf(messages, isRunning)).toBe(expected);
	});

	// A warm turn sends its first status after about 5 s. A queued turn waits
	// behind another turn, so "Getting ready" would be wrong for it.
	it.each([
		{ queued: false, expected: "session_starting" },
		{ queued: true, expected: null },
	])("returns $expected before the first status when queued is $queued", ({
		queued,
		expected,
	}) => {
		const messages = [
			{
				id: "a2",
				role: "assistant",
				parts: [
					{
						type: "data-turn-created",
						id: "turn-created",
						data: {
							chatId: "chat-1",
							runId: null,
							status: queued ? "waiting" : "queued",
							streamUrl: "/api/v2/projects/p/turns/active/stream",
							turnId: "turn-1",
							...(queued ? { queued: true } : {}),
						},
					},
				],
			},
		] satisfies TurnMessage[];
		expect(livePhaseOf(messages, true)).toBe(expected);
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

	// A rejected answer gets no reply, so the card stays open for a new decision.
	// The answer itself is an empty user message, and it never shows.
	it.each([
		{ hasReply: true, ids: ["a1", "a2"], isOpen: false },
		{ hasReply: false, ids: ["a1"], isOpen: true },
	])("sets isOpen $isOpen on an approval card when a reply follows is $hasReply", ({
		hasReply,
		ids,
		isOpen,
	}) => {
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
		const out = toBuilderMessages(
			hasReply ? messages : messages.slice(0, 2),
			IDLE,
		);
		expect(out.map((message) => message.id)).toEqual(ids);
		expect(out[0].parts[0]).toMatchObject({ data: { isOpen } });
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

/** The user bubble of the running turn. */
const USER_BUBBLE: BuilderMessage = {
	id: "u1",
	role: "user",
	parts: [{ type: "text", text: "Build a shop" }],
};

/** A thought row of the reply; `isStreaming` is true while the agent thinks now. */
function thought(isStreaming: boolean): BuilderMessagePart {
	return {
		type: "data-thought",
		data: { text: "Plan the pages", seconds: null, isStreaming },
	};
}

/** A finished explore row that read one file of `src`. */
function exploreStep(fileName: string): BuilderMessagePart {
	return {
		type: "data-step",
		data: {
			kind: "explore",
			state: "done",
			target: fileName,
			description: null,
			detail: [{ kind: "context", text: `src/${fileName}` }],
		},
	};
}

/** The reply of the running turn with these parts. */
function reply(parts: BuilderMessagePart[]): BuilderMessage {
	return { id: "a1", role: "assistant", parts };
}

describe("withoutThoughts", () => {
	it("drops an assistant message left with no parts, and keeps the user message", () => {
		expect(withoutThoughts([USER_BUBBLE, reply([thought(true)])])).toEqual([
			USER_BUBBLE,
		]);
	});

	it("merges the two explore rows around a hidden thought into one row", () => {
		expect(
			withoutThoughts([
				reply([exploreStep("a.ts"), thought(false), exploreStep("b.ts")]),
			]),
		).toEqual([
			reply([
				{
					type: "data-step",
					data: {
						kind: "explore",
						state: "done",
						target: null,
						description: null,
						detail: [
							{ kind: "context", text: "src/a.ts" },
							{ kind: "context", text: "src/b.ts" },
						],
					},
				},
			]),
		]);
	});
});

describe("liveActivityOf", () => {
	const onIt: BuilderMessagePart = { type: "text", text: "On it." };
	const receipt: BuilderMessagePart = {
		type: "data-receipt",
		id: "a1-receipt",
		data: { credits: 1, modelId: null, inputTokens: 10, outputTokens: 5 },
	};

	it.each<{
		name: string;
		messages: BuilderMessage[];
		phase: TurnStreamPhase | null;
		isFirstTurn: boolean;
		showsThoughts: boolean;
		expected: LiveActivity;
	}>([
		{
			name: "the setup on a first turn before the first phase",
			messages: [USER_BUBBLE],
			phase: null,
			isFirstTurn: true,
			showsThoughts: false,
			expected: { hasVisibleReply: false, kind: "setup" },
		},
		{
			name: "the setup while the first turn creates the sandbox",
			messages: [USER_BUBBLE],
			phase: "sandbox_waking",
			isFirstTurn: true,
			showsThoughts: false,
			expected: { hasVisibleReply: false, kind: "setup" },
		},
		{
			name: "the wake while a later turn wakes the sandbox",
			messages: [USER_BUBBLE],
			phase: "sandbox_waking",
			isFirstTurn: false,
			showsThoughts: false,
			expected: { hasVisibleReply: false, kind: "wake" },
		},
		{
			name: "Thinking on a warm turn with no reply yet",
			messages: [USER_BUBBLE],
			phase: "session_starting",
			isFirstTurn: false,
			showsThoughts: false,
			expected: { hasVisibleReply: false, kind: "thinking" },
		},
		{
			// The sandbox is ready once the agent runs, so the setup lines stop.
			name: "Thinking on a first turn that runs with no reply yet",
			messages: [USER_BUBBLE],
			phase: "running",
			isFirstTurn: true,
			showsThoughts: false,
			expected: { hasVisibleReply: false, kind: "thinking" },
		},
		{
			name: "Thinking when the reply holds only a hidden thought that streams",
			messages: [USER_BUBBLE, reply([thought(true)])],
			phase: "running",
			isFirstTurn: false,
			showsThoughts: false,
			expected: { hasVisibleReply: false, kind: "thinking" },
		},
		{
			name: "Thinking for a hidden thought after the text, also behind a receipt",
			messages: [USER_BUBBLE, reply([onIt, thought(true), receipt])],
			phase: "running",
			isFirstTurn: false,
			showsThoughts: false,
			expected: { hasVisibleReply: true, kind: "thinking" },
		},
		{
			name: "the phase once the reply has text",
			messages: [USER_BUBBLE, reply([onIt])],
			phase: "running",
			isFirstTurn: true,
			showsThoughts: false,
			expected: { hasVisibleReply: true, kind: "phase" },
		},
		{
			name: "the phase when the last hidden thought is finished",
			messages: [USER_BUBBLE, reply([onIt, thought(false)])],
			phase: "running",
			isFirstTurn: false,
			showsThoughts: false,
			expected: { hasVisibleReply: true, kind: "phase" },
		},
		{
			name: "the phase when the feed shows the thought that streams",
			messages: [USER_BUBBLE, reply([thought(true)])],
			phase: "running",
			isFirstTurn: false,
			showsThoughts: true,
			expected: { hasVisibleReply: true, kind: "phase" },
		},
	])("shows $name", ({ messages, expected, ...input }) => {
		expect(liveActivityOf(messages, input)).toEqual(expected);
	});
});
