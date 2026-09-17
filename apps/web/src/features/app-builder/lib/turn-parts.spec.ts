import { describe, expect, it } from "vitest";

import type {
	BuilderMessagePart,
	TurnMessage,
	TurnMessagePart,
} from "../api/dto";
import {
	answerFor,
	errorOf,
	fileChangesOf,
	progressOf,
	receiptOf,
	type TurnPartLabels,
	toBuilderMessages,
	toolCallsOf,
} from "./turn-parts";

// The labels the page fills from the dictionary; any fixed strings work here.
const LABELS: TurnPartLabels = {
	phases: {
		sandbox_waking: "Waking the sandbox",
		session_starting: "Starting the session",
		running: "Working",
		checkpoint: "Saving a checkpoint",
		committing: "Saving the version",
	},
	tools: { think: "Thinking", read: "Read", write: "Write", run: "Run" },
};

describe("toolCallsOf", () => {
	it("maps a read call to a read row with the file path", () => {
		const parts = [
			{
				type: "dynamic-tool",
				toolName: "read",
				toolCallId: "call-1",
				state: "input-available",
				input: { file_path: "src/app.ts" },
			},
		] satisfies TurnMessagePart[];
		expect(toolCallsOf(parts, LABELS)).toEqual([
			{ kind: "read", label: "Read", target: "src/app.ts" },
		]);
	});

	it("maps an edit call to a write row", () => {
		const parts = [
			{
				type: "dynamic-tool",
				toolName: "edit",
				toolCallId: "call-2",
				state: "input-available",
				input: { file_path: "src/db.ts" },
			},
		] satisfies TurnMessagePart[];
		expect(toolCallsOf(parts, LABELS)).toEqual([
			{ kind: "write", label: "Write", target: "src/db.ts" },
		]);
	});

	it("maps a bash call to a run row with the command", () => {
		const parts = [
			{
				type: "dynamic-tool",
				toolName: "bash",
				toolCallId: "call-3",
				state: "input-available",
				input: { command: "pnpm db:push" },
			},
		] satisfies TurnMessagePart[];
		expect(toolCallsOf(parts, LABELS)).toEqual([
			{ kind: "run", label: "Run", target: "pnpm db:push" },
		]);
	});

	it("cuts a long command to 80 characters", () => {
		const command = "cat ".repeat(30);
		const parts = [
			{
				type: "tool-bash",
				toolCallId: "call-9",
				state: "input-available",
				input: { command },
			},
		] satisfies TurnMessagePart[];
		expect(toolCallsOf(parts, LABELS)[0]?.target).toBe(command.slice(0, 80));
	});

	it("maps an unknown tool name to a think row with the raw name", () => {
		const parts = [
			{
				type: "dynamic-tool",
				toolName: "Foo",
				toolCallId: "call-4",
				state: "input-available",
				input: { bar: 1 },
			},
		] satisfies TurnMessagePart[];
		expect(toolCallsOf(parts, LABELS)).toEqual([
			{ kind: "think", label: "Foo", target: '{"bar":1}' },
		]);
	});

	it("maps a reasoning part to a think row with its first 80 characters", () => {
		const text = "reasoning step ".repeat(10);
		const parts = [{ type: "reasoning", text }] satisfies TurnMessagePart[];
		expect(toolCallsOf(parts, LABELS)).toEqual([
			{ kind: "think", label: "Thinking", target: text.slice(0, 80) },
		]);
	});

	it("treats a prototype key like constructor as an unknown tool", () => {
		const parts = [
			{
				type: "dynamic-tool",
				toolName: "constructor",
				toolCallId: "call-5",
				state: "input-available",
				input: {},
			},
		] satisfies TurnMessagePart[];
		expect(toolCallsOf(parts, LABELS)).toEqual([
			{ kind: "think", label: "constructor", target: "{}" },
		]);
	});

	it("gives an empty target while the tool input still streams", () => {
		const parts = [
			{
				type: "dynamic-tool",
				toolName: "read",
				toolCallId: "call-6",
				state: "input-streaming",
			},
		] satisfies TurnMessagePart[];
		expect(toolCallsOf(parts, LABELS)).toEqual([
			{ kind: "read", label: "Read", target: "" },
		]);
	});

	it("maps a typed tool part, as the harness streams them, to its row", () => {
		const parts = [
			{
				type: "tool-bash",
				toolCallId: "call-7",
				state: "output-available",
				input: { command: "ls src" },
				output: { stdout: "app.ts", stderr: "" },
			},
		] satisfies TurnMessagePart[];
		expect(toolCallsOf(parts, LABELS)).toEqual([
			{ kind: "run", label: "Run", target: "ls src" },
		]);
	});

	it("gives the question tool no row, since the question card shows it", () => {
		const parts = [
			{
				type: "tool-askUserQuestions",
				toolCallId: "call-8",
				state: "input-available",
				input: { questions: [{ id: "q1", header: "Bakery name" }] },
			},
		] satisfies TurnMessagePart[];
		expect(toolCallsOf(parts, LABELS)).toEqual([]);
	});
});

describe("fileChangesOf", () => {
	it("lists the unique file_path of the write calls in first-seen order", () => {
		const parts = [
			{
				type: "dynamic-tool",
				toolName: "edit",
				toolCallId: "call-1",
				state: "input-available",
				input: { file_path: "src/db.ts" },
			},
			{
				type: "dynamic-tool",
				toolName: "read",
				toolCallId: "call-2",
				state: "input-available",
				input: { file_path: "src/app.ts" },
			},
			{
				type: "dynamic-tool",
				toolName: "write",
				toolCallId: "call-3",
				state: "input-available",
				input: { file_path: "src/new.ts" },
			},
			{
				type: "dynamic-tool",
				toolName: "write",
				toolCallId: "call-4",
				state: "input-available",
				input: { file_path: "src/db.ts" },
			},
			{
				type: "tool-edit",
				toolCallId: "call-5",
				state: "input-available",
				input: { file_path: "src/typed.ts" },
			},
		] satisfies TurnMessagePart[];
		expect(fileChangesOf(parts)).toEqual([
			{ path: "src/db.ts", added: 0, removed: 0 },
			{ path: "src/new.ts", added: 0, removed: 0 },
			{ path: "src/typed.ts", added: 0, removed: 0 },
		]);
	});
});

describe("progressOf", () => {
	it("returns null when the message has no status part", () => {
		const parts = [{ type: "text", text: "hi" }] satisfies TurnMessagePart[];
		expect(progressOf(parts, LABELS)).toBeNull();
	});

	it("marks the last seen phase active and the earlier phases done", () => {
		const parts = [
			{
				type: "data-turn-status",
				id: "turn-status",
				data: { phase: "sandbox_waking" },
			},
			{
				type: "data-turn-status",
				id: "turn-status",
				data: { phase: "running", message: "Editing the files" },
			},
		] satisfies TurnMessagePart[];
		expect(progressOf(parts, LABELS)).toEqual({
			title: "Editing the files",
			percent: 50,
			steps: [
				{
					id: "sandbox_waking",
					label: "Waking the sandbox",
					state: "done",
				},
				{
					id: "session_starting",
					label: "Starting the session",
					state: "done",
				},
				{ id: "running", label: "Working", state: "active" },
				{
					id: "checkpoint",
					label: "Saving a checkpoint",
					state: "pending",
				},
				{
					id: "committing",
					label: "Saving the version",
					state: "pending",
				},
			],
		});
	});

	it("uses the phase label as the title when the status has no message", () => {
		const parts = [
			{
				type: "data-turn-status",
				id: "turn-status",
				data: { phase: "sandbox_waking" },
			},
		] satisfies TurnMessagePart[];
		expect(progressOf(parts, LABELS)?.title).toBe("Waking the sandbox");
		expect(progressOf(parts, LABELS)?.percent).toBe(0);
	});

	it("marks every step done at 100 percent when the message is done", () => {
		const parts = [
			{
				type: "data-turn-status",
				id: "turn-status",
				data: { phase: "running" },
			},
			{
				type: "data-turn-done",
				id: "turn-done",
				data: { status: "succeeded" },
			},
		] satisfies TurnMessagePart[];
		const progress = progressOf(parts, LABELS);
		expect(progress?.percent).toBe(100);
		expect(progress?.steps.every((step) => step.state === "done")).toBe(true);
	});

	it("keeps the last phase active when the turn ended failed", () => {
		const parts = [
			{
				type: "data-turn-status",
				id: "turn-status",
				data: { phase: "running" },
			},
			{
				type: "data-turn-done",
				id: "turn-done",
				data: { status: "failed" },
			},
		] satisfies TurnMessagePart[];
		const progress = progressOf(parts, LABELS);
		expect(progress?.percent).toBe(50);
		expect(progress?.steps[2]?.state).toBe("active");
		expect(progress?.steps[3]?.state).toBe("pending");
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

describe("answerFor", () => {
	const question = {
		id: "a1",
		role: "assistant",
		parts: [
			{
				type: "data-question",
				id: "call-1:q1",
				data: {
					toolCallId: "call-1",
					questionId: "q1",
					question: "How do members pay?",
					options: ["Card", "Cash"],
					answer: null,
				},
			},
		],
	} satisfies TurnMessage;

	const reply = {
		id: "a2",
		role: "assistant",
		parts: [{ type: "text", text: "Done." }],
	} satisfies TurnMessage;

	it("returns the text of the next answered user message", () => {
		const messages = [
			question,
			{
				id: "u1",
				role: "user",
				parts: [{ type: "text", text: "Both" }],
			},
			reply,
		] satisfies TurnMessage[];
		expect(answerFor(messages, 0)).toBe("Both");
	});

	it("returns null when no user message follows", () => {
		expect(answerFor([question], 0)).toBeNull();
	});

	it("returns null when the user message got no reply", () => {
		const messages = [
			question,
			{
				id: "u1",
				role: "user",
				parts: [{ type: "text", text: "Both" }],
			},
		] satisfies TurnMessage[];
		expect(answerFor(messages, 0)).toBeNull();
	});

	it("takes the retried answer, not the one whose send failed", () => {
		const messages = [
			question,
			{
				id: "u1",
				role: "user",
				parts: [{ type: "text", text: "Card" }],
			},
			{
				id: "u2",
				role: "user",
				parts: [{ type: "text", text: "Both" }],
			},
			reply,
		] satisfies TurnMessage[];
		expect(answerFor(messages, 0)).toBe("Both");
	});

	it("skips an empty approval-answer message to find the text", () => {
		const messages = [
			question,
			{ id: "u1", role: "user", parts: [{ type: "text", text: "" }] },
			{
				id: "u2",
				role: "user",
				parts: [{ type: "text", text: "Both" }],
			},
			reply,
		] satisfies TurnMessage[];
		expect(answerFor(messages, 0)).toBe("Both");
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
		const out = toBuilderMessages(messages, LABELS);
		expect(out).toHaveLength(1);
		expect(out[0].parts.map((part) => part.type)).toEqual(["text", "file"]);
	});

	it("keeps a file-only user message with its file part", () => {
		const messages = [
			{
				id: "u1",
				role: "user",
				parts: [
					{
						type: "file",
						mediaType: "image/png",
						url: "https://files.example/logo.png",
						filename: "logo.png",
					},
				],
			},
		] satisfies TurnMessage[];
		const out = toBuilderMessages(messages, LABELS);
		expect(out).toHaveLength(1);
		expect(out[0].parts.map((part) => part.type)).toEqual(["file"]);
	});

	it("closes an approval card when only a reply follows it, as after a reload", () => {
		// The stored answer row has no parts, so hydration drops it. The reply
		// after the card is the proof the answer landed.
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
							toolName: "bash",
							input: "{}",
							decision: null,
						},
					},
				],
			},
			{
				id: "a2",
				role: "assistant",
				parts: [{ type: "text", text: "Ran it." }],
			},
		] satisfies TurnMessage[];
		const out = toBuilderMessages(messages, LABELS);
		const approval = out[0].parts.find(
			(part): part is Extract<BuilderMessagePart, { type: "data-approval" }> =>
				part.type === "data-approval",
		);
		expect(approval?.data.isOpen).toBe(false);
	});

	it("drops the empty approval-answer message and closes the card it answered", () => {
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
							toolName: "bash",
							input: '{"command":"rm -rf dist"}',
							decision: null,
						},
					},
				],
			},
			{ id: "u1", role: "user", parts: [{ type: "text", text: "" }] },
			{
				id: "a2",
				role: "assistant",
				parts: [{ type: "text", text: "Done." }],
			},
		] satisfies TurnMessage[];
		const out = toBuilderMessages(messages, LABELS);
		expect(out).toHaveLength(2);
		const approval = out[0].parts.find(
			(part): part is Extract<BuilderMessagePart, { type: "data-approval" }> =>
				part.type === "data-approval",
		);
		expect(approval?.data.isOpen).toBe(false);
		expect(approval?.data.toolName).toBe("bash");
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
							toolName: "bash",
							input: "{}",
							decision: null,
						},
					},
				],
			},
			// A rejected send keeps its user message but no reply follows it.
			{ id: "u1", role: "user", parts: [{ type: "text", text: "" }] },
		] satisfies TurnMessage[];
		const out = toBuilderMessages(messages, LABELS);
		expect(out).toHaveLength(1);
		const approval = out[0].parts.find(
			(part): part is Extract<BuilderMessagePart, { type: "data-approval" }> =>
				part.type === "data-approval",
		);
		expect(approval?.data.isOpen).toBe(true);
	});

	it("keeps an approval card open when no user message follows", () => {
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
							toolName: "bash",
							input: "{}",
							decision: null,
						},
					},
				],
			},
		] satisfies TurnMessage[];
		const out = toBuilderMessages(messages, LABELS);
		const approval = out[0].parts.find(
			(part): part is Extract<BuilderMessagePart, { type: "data-approval" }> =>
				part.type === "data-approval",
		);
		expect(approval?.data.isOpen).toBe(true);
		expect(approval?.data.decision).toBeNull();
	});

	it("fills a question card answer from the next user message", () => {
		const messages = [
			{
				id: "a1",
				role: "assistant",
				parts: [
					{
						type: "data-question",
						id: "call-1:q1",
						data: {
							toolCallId: "call-1",
							questionId: "q1",
							question: "How do members pay?",
							options: ["Card", "Cash"],
							answer: null,
						},
					},
				],
			},
			{
				id: "u1",
				role: "user",
				parts: [{ type: "text", text: "Both" }],
			},
			{
				id: "a2",
				role: "assistant",
				parts: [{ type: "text", text: "Done." }],
			},
		] satisfies TurnMessage[];
		const out = toBuilderMessages(messages, LABELS);
		const questionPart = out[0].parts.find(
			(part): part is Extract<BuilderMessagePart, { type: "data-question" }> =>
				part.type === "data-question",
		);
		expect(questionPart?.data.answer).toBe("Both");
	});

	it("keeps a stored question answer and leaves an open one null", () => {
		const answered = {
			id: "a1",
			role: "assistant",
			parts: [
				{
					type: "data-question",
					id: "call-1:q1",
					data: {
						toolCallId: "call-1",
						questionId: "q1",
						question: "How do members pay?",
						options: ["Card", "Cash"],
						answer: "Card",
					},
				},
			],
		} satisfies TurnMessage;
		const open = {
			id: "a2",
			role: "assistant",
			parts: [
				{
					type: "data-question",
					id: "call-2:q2",
					data: {
						toolCallId: "call-2",
						questionId: "q2",
						question: "Which plan?",
						options: ["A"],
						answer: null,
					},
				},
			],
		} satisfies TurnMessage;
		const out = toBuilderMessages([answered, open], LABELS);
		const isQuestion = (
			part: BuilderMessagePart,
		): part is Extract<BuilderMessagePart, { type: "data-question" }> =>
			part.type === "data-question";
		expect(out[0].parts.find(isQuestion)?.data.answer).toBe("Card");
		expect(out[1].parts.find(isQuestion)?.data.answer).toBeNull();
	});

	it("ignores data-turn-created and step-start parts", () => {
		const messages = [
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
					{ type: "step-start" },
					{ type: "text", text: "Done." },
				],
			},
		] satisfies TurnMessage[];
		const out = toBuilderMessages(messages, LABELS);
		expect(out[0].parts.map((part) => part.type)).toEqual(["text"]);
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
			toBuilderMessages(messages, LABELS).map((message) => message.id),
		).toEqual(["u1"]);
	});

	it("orders the assistant parts: text first, then the synthesized cards", () => {
		const messages = [
			{
				id: "a1",
				role: "assistant",
				parts: [
					{
						type: "dynamic-tool",
						toolName: "bash",
						toolCallId: "call-1",
						state: "input-available",
						input: { command: "ls" },
					},
					{ type: "text", text: "Working on it." },
					{
						type: "data-turn-status",
						id: "turn-status",
						data: { phase: "running" },
					},
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
		const out = toBuilderMessages(messages, LABELS);
		expect(out[0].parts.map((part) => part.type)).toEqual([
			"text",
			"data-tools",
			"data-progress",
			"data-error",
			"data-receipt",
		]);
		const tools = out[0].parts.find(
			(part): part is Extract<BuilderMessagePart, { type: "data-tools" }> =>
				part.type === "data-tools",
		);
		expect(tools?.id).toBe("a1-tools");
	});
});
