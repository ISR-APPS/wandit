import type { HarnessV1Bootstrap } from "@ai-sdk/harness";
import type {
	HarnessAgentAdapter,
	HarnessAgentContinueTurnState,
	HarnessAgentResumeSessionState,
	HarnessAgentSettings,
	prepareSandboxForHarness,
} from "@ai-sdk/harness/agent";
import {
	type ClaudeCodeHarnessSettings,
	createClaudeCode,
} from "@ai-sdk/harness-claude-code";
import type { HarnessPendingInteraction } from "@wandit/contracts";
import type {
	LanguageModelUsage,
	ToolApprovalResponse,
	ToolResultPart,
	UIMessageChunk,
} from "ai";
import { describe, expect, it, vi } from "vitest";

import { HarnessResumeMismatchError } from "../../domain/errors/harness-resume-mismatch.error";
import type { HarnessSessionInput } from "../../domain/ports/builder-harness";
import {
	HARNESS_BRIDGE_PORT,
	HARNESS_WORK_DIR,
	type HarnessSandboxSession,
	type SandboxHandle,
} from "../../domain/ports/sandbox-provider";
import {
	type ClaudeCodeAgentRunner,
	ClaudeCodeHarness,
	type ClaudeCodeSessionHandle,
	type ClaudeCodeStreamResult,
} from "./claude-code.harness";

// The sandbox session is opaque to the adapter: it goes straight into
// `agent.createSession`. The fake agent never reads it.
// SAFETY: only the fake agent touches this value, and it never reads it.
const clearTransformations = vi.fn(async () => {});
const FAKE_SANDBOX_SESSION: HarnessSandboxSession = {
	// SAFETY: the harness reads only `setRequestTransformations` off the
	// session and hands the object to the fake agent unchanged.
	...({} as HarnessSandboxSession),
	setRequestTransformations: clearTransformations,
};

const RESUME_STATE: HarnessAgentResumeSessionState = {
	data: { claudeSessionId: "claude-1", forkOnResume: false },
	harnessId: "claude-code",
	specificationVersion: "harness-v1",
	type: "resume-session",
};

/** `suspendTurn` output: one pending `askUserQuestions` call, two options. */
const CONTINUE_STATE: HarnessAgentContinueTurnState = {
	data: { claudeSessionId: "claude-1" },
	harnessId: "claude-code",
	pendingToolResults: [
		{
			input: JSON.stringify({
				allowPartialAnswers: false,
				questions: [
					{
						id: "question-1",
						options: [
							{ id: "option-1", label: "Blue" },
							{ id: "option-2", label: "Green" },
						],
						question: "Which color?",
					},
				],
			}),
			toolCallId: "call-1",
			toolName: "askUserQuestions",
		},
	],
	specificationVersion: "harness-v1",
	turnSettings: { skills: [], tools: [] },
	type: "continue-turn",
};

/** The question card `CONTINUE_STATE` waits on, as the envelope stores it. */
const PENDING_COLOR_QUESTION: HarnessPendingInteraction = {
	kind: "question",
	questions: [
		{
			id: "question-1",
			kind: "single-choice",
			options: [
				{ id: "option-1", label: "Blue" },
				{ id: "option-2", label: "Green" },
			],
			question: "Which color?",
		},
	],
	tool: "askUserQuestions",
	toolCallId: "call-1",
};

function usage(
	overrides: Partial<LanguageModelUsage> = {},
): LanguageModelUsage {
	return {
		inputTokenDetails: {
			cacheReadTokens: undefined,
			cacheWriteTokens: undefined,
			noCacheTokens: undefined,
		},
		inputTokens: 0,
		outputTokenDetails: {
			reasoningTokens: undefined,
			textTokens: undefined,
		},
		outputTokens: 0,
		totalTokens: 0,
		...overrides,
	};
}

const execCalls: { args: string[]; command: string }[] = [];

function fakeSandbox(): SandboxHandle {
	return {
		exec: async (command, args) => {
			execCalls.push({ args, command });
			return { exitCode: 0, stderr: "", stdout: "" };
		},
		harnessSession: async () => FAKE_SANDBOX_SESSION,
		keepAlive: async () => {},
		listFiles: async () => [],
		openPort: async () => {},
		previewUrl: async () => "",
		projectId: "project-1",
		providerSandboxId: "sbx-1",
		allowHost: async () => {},
		readFile: async () => null,
		setNetworkPolicy: async () => {},
		workspaceDir: "/vercel/workspace",
		writeFiles: async () => {},
	};
}

function sessionInput(): HarnessSessionInput {
	return {
		chatId: "chat-1",
		env: {
			ANTHROPIC_AUTH_TOKEN: "run-token",
			ANTHROPIC_BASE_URL: "https://api.test/api/v2/llm",
			ANTHROPIC_CUSTOM_HEADERS: "X-Wandit-Run: run-1",
		},
		hostTools: { close: async () => {}, toolApproval: {}, tools: {} },
		instructions: "Build the app in these languages only: ar, fr.",
		mode: "build",
		model: "anthropic/claude-sonnet-5",
		sandbox: fakeSandbox(),
	};
}

type Captured = {
	agentSettings?: HarnessAgentSettings;
	/** Calls of `agent.createSession`: starts, resumes, and keep re-attaches. */
	createCount: number;
	claudeSettings?: ClaudeCodeHarnessSettings;
	createOptions?: {
		continueFrom?: HarnessAgentContinueTurnState;
		resumeFrom?: HarnessAgentResumeSessionState;
		sandboxSession: HarnessSandboxSession;
		sessionId: string;
	};
	continueOptions?: {
		toolApprovalContinuations?: ToolApprovalResponse[];
		toolResultContinuations?: ToolResultPart[];
	};
};

function setup(
	streamResult?: ClaudeCodeStreamResult,
	logger?: Pick<Console, "warn">,
	options: {
		keepAlive?: boolean;
		now?: () => number;
		/** `agent.stream` throws this once, like a send on a dead bridge socket. */
		streamErrorOnce?: Error;
	} = {},
) {
	const captured: Captured = { createCount: 0 };
	let streamError = options.streamErrorOnce;
	const session: ClaudeCodeSessionHandle = {
		detach: vi.fn(async () => RESUME_STATE),
		hasUnfinishedTurn: vi.fn(() => false),
		sessionId: "sess-1",
		suspendTurn: vi.fn(async () => CONTINUE_STATE),
	};
	const agent: ClaudeCodeAgentRunner = {
		continueStream: async (options) => {
			captured.continueOptions = options;
			return (
				streamResult ?? {
					toUIMessageStream: () => (async function* () {})(),
					totalUsage: Promise.resolve(usage()),
				}
			);
		},
		createSession: async (createOptions) => {
			captured.createOptions = createOptions;
			captured.createCount += 1;
			return session;
		},
		stream: async () => {
			if (streamError !== undefined) {
				const error = streamError;
				streamError = undefined;
				throw error;
			}
			return (
				streamResult ?? {
					toUIMessageStream: () => (async function* () {})(),
					totalUsage: Promise.resolve(usage()),
				}
			);
		},
	};
	const harness = new ClaudeCodeHarness({
		agentFactory: (settings) => {
			captured.agentSettings = settings;
			return agent;
		},
		claudeFactory: (settings) => {
			captured.claudeSettings = settings;
			// SAFETY: the agent fake never calls into the adapter; only the
			// settings are under test.
			return {} as HarnessAgentAdapter;
		},
		keepAlive: options.keepAlive,
		logger,
		now: options.now,
	});
	return { captured, harness, session };
}

describe("ClaudeCodeHarness.createSession", () => {
	it("builds the agent with workDir, allow-all, and the scoped auth object", async () => {
		const { captured, harness } = setup();

		await harness.createSession(sessionInput());

		expect(captured.claudeSettings?.port).toBe(HARNESS_BRIDGE_PORT);
		expect(captured.claudeSettings?.auth).toEqual({
			ANTHROPIC_AUTH_TOKEN: "run-token",
			ANTHROPIC_BASE_URL: "https://api.test/api/v2/llm",
		});
		expect(Object.keys(captured.claudeSettings?.auth ?? {})).toHaveLength(2);
		expect(captured.claudeSettings?.env).toEqual({
			// One Claude Code process serves many turns: no per-run header.
			ANTHROPIC_CUSTOM_HEADERS: "",
			CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: "1",
			// The per-turn token note broke the prompt cache prefix.
			CLAUDE_CODE_TOTAL_TOKENS_REMINDER: "off",
			WANDIT_TOKEN_EPOCH: expect.any(String),
		});
		expect(captured.agentSettings?.sandboxConfig?.workDir).toBe(
			HARNESS_WORK_DIR,
		);
		expect(captured.agentSettings?.permissionMode).toBe("allow-all");
		// A dead bridge must not hold a turn for the adapter default of 120 s.
		expect(captured.claudeSettings?.startupTimeoutMs).toBe(30_000);
		// The model asks through ask_user only; the built-in tool is off.
		expect(captured.agentSettings?.inactiveTools).toEqual(["askUserQuestions"]);
		expect(captured.agentSettings?.model).toBe("anthropic/claude-sonnet-5");
		expect(captured.agentSettings?.instructions).toBe(
			"Build the app in these languages only: ar, fr.",
		);
	});

	it("blocks the built-in tools that write, run, or fork in a plan session", async () => {
		const { captured, harness } = setup();

		await harness.createSession({ ...sessionInput(), mode: "plan" });

		const inactive = captured.agentSettings?.inactiveTools ?? [];
		expect(inactive).toEqual(
			expect.arrayContaining(["askUserQuestions", "write", "edit", "bash"]),
		);
		// HarnessAgent throws NoSuchToolError on a name the adapter does not
		// know, so a wrong name would fail every plan turn.
		const builtinNames = Object.keys(createClaudeCode().builtinTools);
		for (const name of inactive) {
			expect(builtinNames).toContain(name);
		}
	});

	it("names the 30-minute token epoch in the env", async () => {
		const { captured, harness } = setup(undefined, undefined, {
			now: () => 3 * 30 * 60_000 + 5,
		});

		await harness.createSession(sessionInput());

		// A new epoch changes the start env, so the bridge fork starts a new
		// Claude Code process before a kept-alive connection holds an old token.
		expect(captured.claudeSettings?.env?.WANDIT_TOKEN_EPOCH).toBe("3");
	});

	it("passes the chat id as the session id", async () => {
		const { captured, harness } = setup();

		const session = await harness.createSession(sessionInput());

		expect(captured.createOptions?.sessionId).toBe("chat-1");
		expect(captured.createOptions?.sandboxSession).toBe(FAKE_SANDBOX_SESSION);
		expect(session.sessionId).toBe("sess-1");
	});

	it("clears the request transformations an earlier session left on the sandbox", async () => {
		const { harness } = setup();
		clearTransformations.mockClear();

		execCalls.length = 0;

		await harness.createSession(sessionInput());

		expect(clearTransformations).toHaveBeenCalledWith([]);
		// The stale bridge of the earlier session is killed before the new one
		// binds the bridge port.
		expect(execCalls).toHaveLength(1);
		expect(execCalls[0]?.command).toBe("sh");
		expect(execCalls[0]?.args[1]).toContain("bridge.mjs --workdir");
	});
});

describe("ClaudeCodeHarness.resumeSession", () => {
	it("parses the stored payload and passes resumeFrom", async () => {
		const { captured, harness } = setup();

		await harness.resumeSession(
			sessionInput(),
			{
				harness: "claude_code",
				payload: JSON.stringify(RESUME_STATE),
				pending: [],
			},
			{ bridgeDead: false, dropPausedTurn: false },
		);

		expect(captured.createOptions?.resumeFrom).toEqual(RESUME_STATE);
		expect(captured.createOptions?.sessionId).toBe("chat-1");
	});

	it("drops the bridge coordinates of a resume when the sandbox woke", async () => {
		const { captured, harness } = setup();
		const stored = {
			...RESUME_STATE,
			data: {
				bridge: { lastSeenEventId: 7, port: 8787, token: "bridge-token" },
				claudeSessionId: "claude-1",
				forkOnResume: false,
			},
		};

		await harness.resumeSession(
			sessionInput(),
			{ harness: "claude_code", payload: JSON.stringify(stored), pending: [] },
			{ bridgeDead: true, dropPausedTurn: false },
		);

		// The conversation id stays; only the dead attach target goes.
		expect(captured.createOptions?.resumeFrom).toEqual(RESUME_STATE);
	});

	it("resumes a suspended turn through continueFrom, not resumeFrom", async () => {
		const { captured, harness } = setup();
		execCalls.length = 0;

		await harness.resumeSession(
			sessionInput(),
			{
				harness: "claude_code",
				payload: JSON.stringify(CONTINUE_STATE),
				pending: [PENDING_COLOR_QUESTION],
			},
			{ bridgeDead: false, dropPausedTurn: false },
		);

		expect(captured.createOptions?.continueFrom).toEqual(CONTINUE_STATE);
		expect(captured.createOptions?.resumeFrom).toBeUndefined();
		// The live bridge waits on the paused call; a kill would lose it.
		expect(execCalls).toHaveLength(0);
	});

	it("resumes the thread between turns when the bridge of a suspended turn is lost", async () => {
		const { captured, harness } = setup();

		await harness.resumeSession(
			sessionInput(),
			{
				harness: "claude_code",
				payload: JSON.stringify(CONTINUE_STATE),
				pending: [PENDING_COLOR_QUESTION],
			},
			{ bridgeDead: false, dropPausedTurn: true },
		);

		// Same Claude conversation (`data`), no pending lists, no continueFrom.
		expect(captured.createOptions?.resumeFrom).toEqual({
			data: CONTINUE_STATE.data,
			harnessId: "claude-code",
			specificationVersion: "harness-v1",
			type: "resume-session",
		});
		expect(captured.createOptions?.continueFrom).toBeUndefined();
	});

	it("drops the dead bridge of a lost paused turn but keeps its conversation", async () => {
		const { captured, harness } = setup();
		execCalls.length = 0;
		const stored = {
			...CONTINUE_STATE,
			data: {
				bridge: { lastSeenEventId: 3, port: 8787, token: "bridge-token" },
				claudeSessionId: "claude-1",
			},
		};

		await harness.resumeSession(
			sessionInput(),
			{
				harness: "claude_code",
				payload: JSON.stringify(stored),
				pending: [PENDING_COLOR_QUESTION],
			},
			{ bridgeDead: true, dropPausedTurn: true },
		);

		expect(captured.createOptions?.resumeFrom?.data).toEqual({
			claudeSessionId: "claude-1",
		});
		// After a mode switch the old bridge still runs and holds the port.
		expect(execCalls).toHaveLength(1);
		expect(execCalls[0]?.args[1]).toContain("bridge.mjs --workdir");
	});

	it("drops the paused turn that a mid-turn detach nests in the resume state", async () => {
		const { captured, harness } = setup();

		await harness.resumeSession(
			sessionInput(),
			{
				harness: "claude_code",
				payload: JSON.stringify({
					...RESUME_STATE,
					continueFrom: CONTINUE_STATE,
				}),
				pending: [PENDING_COLOR_QUESTION],
			},
			{ bridgeDead: true, dropPausedTurn: true },
		);

		// The SDK refuses a new prompt while the nested turn is unfinished.
		expect(captured.createOptions?.resumeFrom).toEqual(RESUME_STATE);
		expect(captured.createOptions?.continueFrom).toBeUndefined();
	});

	it("throws HarnessResumeMismatchError for another harness payload", async () => {
		const { harness } = setup();

		await expect(
			harness.resumeSession(
				sessionInput(),
				{ harness: "opencode", payload: "{}", pending: [] },
				{ bridgeDead: false, dropPausedTurn: false },
			),
		).rejects.toBeInstanceOf(HarnessResumeMismatchError);
	});
});

describe("ClaudeCodeHarness.stream", () => {
	it("maps chunks to part events and reports usage at the end", async () => {
		const textChunk: UIMessageChunk = {
			delta: "hello",
			id: "t1",
			type: "text-delta",
		};
		const streamResult: ClaudeCodeStreamResult = {
			toUIMessageStream: () =>
				(async function* () {
					yield textChunk;
				})(),
			totalUsage: Promise.resolve(
				usage({
					inputTokenDetails: {
						cacheReadTokens: 7,
						cacheWriteTokens: 3,
						noCacheTokens: 90,
					},
					inputTokens: 100,
					outputTokenDetails: {
						reasoningTokens: 0,
						textTokens: 50,
					},
					outputTokens: 50,
					totalTokens: 150,
				}),
			),
		};
		const { harness } = setup(streamResult);
		const session = await harness.createSession(sessionInput());

		const events = [];
		for await (const event of harness.stream(session, {
			kind: "prompt",
			prompt: "hi",
			signal: new AbortController().signal,
		})) {
			events.push(event);
		}

		expect(events).toEqual([
			{ chunk: textChunk, type: "part" },
			{
				cacheReadTokens: 7,
				cacheWriteTokens: 3,
				inputTokens: 100,
				outputTokens: 50,
				type: "usage",
			},
		]);
	});

	it("emits a harness_error event with the real message after an error chunk", async () => {
		// The SDK stream calls onError with the real error and yields a chunk
		// with the safe text it returned; the event must carry the real one.
		const errorChunk: UIMessageChunk = {
			errorText: "An error occurred.",
			type: "error",
		};
		const { harness } = setup({
			toUIMessageStream: (options) =>
				(async function* () {
					options?.onError?.(new Error("model blew up"));
					yield errorChunk;
				})(),
			totalUsage: Promise.resolve(usage()),
		});
		const session = await harness.createSession(sessionInput());

		const events = [];
		for await (const event of harness.stream(session, {
			kind: "prompt",
			prompt: "hi",
			signal: new AbortController().signal,
		})) {
			events.push(event);
		}

		expect(events).toEqual([
			{ chunk: errorChunk, type: "part" },
			{
				code: "harness_error",
				message: "model blew up",
				retryable: false,
				type: "error",
			},
			{
				cacheReadTokens: 0,
				cacheWriteTokens: 0,
				inputTokens: 0,
				outputTokens: 0,
				type: "usage",
			},
		]);
	});

	it("maps a continue input to one tool result and one approval response", async () => {
		const { captured, harness } = setup();
		const session = await harness.createSession(sessionInput());

		const events = [];
		for await (const event of harness.stream(session, {
			approvals: [{ approvalId: "appr-1", approved: true }],
			kind: "continue",
			signal: new AbortController().signal,
			toolResults: [
				{
					answers: { "question-1": { optionIds: ["option-2"] } },
					partial: false,
					tool: "askUserQuestions",
					toolCallId: "call-1",
				},
			],
		})) {
			events.push(event);
		}

		expect(captured.continueOptions?.toolResultContinuations).toEqual([
			{
				output: {
					type: "json",
					value: {
						action: "answered",
						answers: { "question-1": { optionIds: ["option-2"] } },
					},
				},
				toolCallId: "call-1",
				toolName: "askUserQuestions",
				type: "tool-result",
			},
		]);
		expect(captured.continueOptions?.toolApprovalContinuations).toEqual([
			{ approvalId: "appr-1", approved: true, type: "tool-approval-response" },
		]);
		// The tail still reports usage, same as the prompt path.
		expect(events.at(-1)).toEqual({
			cacheReadTokens: 0,
			cacheWriteTokens: 0,
			inputTokens: 0,
			outputTokens: 0,
			type: "usage",
		});
	});

	it("marks a partial answer as partially-answered", async () => {
		const { captured, harness } = setup();
		const session = await harness.createSession(sessionInput());

		const events = [];
		for await (const event of harness.stream(session, {
			approvals: [],
			kind: "continue",
			signal: new AbortController().signal,
			toolResults: [
				{
					answers: { "question-1": { optionIds: ["option-2"] } },
					partial: true,
					tool: "askUserQuestions",
					toolCallId: "call-1",
				},
			],
		})) {
			events.push(event);
		}

		expect(
			captured.continueOptions?.toolResultContinuations?.[0]?.output,
		).toEqual({
			type: "json",
			value: {
				action: "partially-answered",
				answers: { "question-1": { optionIds: ["option-2"] } },
			},
		});
	});

	it("maps ask_user and present_plan answers to their JSON tool results", async () => {
		const { captured, harness } = setup();
		const session = await harness.createSession(sessionInput());
		const output = {
			answers: [
				{
					action: "answered" as const,
					files: [
						{
							filename: "logo.png",
							mediaType: "image/png",
							path: "public/uploads/0d1f2a3b-logo.png",
							url: "https://assets.test/uploads/u/0d1f2a3b-9c/logo.png",
						},
					],
					question: "Which style?",
					questionId: "question-0",
					selected: [{ id: "zellige", label: "Warm and crafted" }],
					text: "",
				},
			],
		};

		for await (const _event of harness.stream(session, {
			approvals: [],
			kind: "continue",
			signal: new AbortController().signal,
			toolResults: [
				{ output, tool: "ask_user", toolCallId: "call-7" },
				{
					output: { feedback: "Add a stock page" },
					tool: "present_plan",
					toolCallId: "call-plan",
				},
			],
		})) {
			// Drain the stream; only the continue options are under test.
		}

		expect(captured.continueOptions?.toolResultContinuations).toEqual([
			{
				output: { type: "json", value: output },
				toolCallId: "call-7",
				toolName: "ask_user",
				type: "tool-result",
			},
			{
				output: { type: "json", value: { feedback: "Add a stock page" } },
				toolCallId: "call-plan",
				toolName: "present_plan",
				type: "tool-result",
			},
		]);
	});
});

describe("ClaudeCodeHarness.suspendTurn", () => {
	it("maps a pending askUserQuestions result to a question interaction", async () => {
		const { harness, session: innerSession } = setup();
		const session = await harness.createSession(sessionInput());

		const state = await harness.suspendTurn(session);

		expect(state.harness).toBe("claude_code");
		expect(JSON.parse(state.payload)).toEqual(CONTINUE_STATE);
		expect(state.pending).toEqual([
			{
				kind: "question",
				questions: [
					{
						id: "question-1",
						kind: "single-choice",
						options: [
							{ id: "option-1", label: "Blue" },
							{ id: "option-2", label: "Green" },
						],
						question: "Which color?",
					},
				],
				tool: "askUserQuestions",
				toolCallId: "call-1",
			},
		]);
		expect(innerSession.suspendTurn).toHaveBeenCalledOnce();
	});

	it("maps a question without options to an empty option list", async () => {
		const { harness, session: innerSession } = setup();
		innerSession.suspendTurn = vi.fn(async () => ({
			...CONTINUE_STATE,
			pendingToolResults: [
				{
					input: JSON.stringify({
						allowPartialAnswers: false,
						questions: [{ id: "question-2", question: "Any notes?" }],
					}),
					toolCallId: "call-2",
					toolName: "askUserQuestions",
				},
			],
		}));
		const session = await harness.createSession(sessionInput());

		const state = await harness.suspendTurn(session);

		expect(state.pending).toEqual([
			{
				kind: "question",
				questions: [
					{
						id: "question-2",
						kind: "single-choice",
						options: [],
						question: "Any notes?",
					},
				],
				tool: "askUserQuestions",
				toolCallId: "call-2",
			},
		]);
	});

	it("maps a pending ask_user call and cuts it to the card limits", async () => {
		const { harness, session: innerSession } = setup();
		const longLabel = "L".repeat(150);
		innerSession.suspendTurn = vi.fn(async () => ({
			...CONTINUE_STATE,
			pendingToolResults: [
				{
					input: JSON.stringify({
						questions: [
							{
								helper: "  ",
								kind: "single-choice",
								options: [
									{ id: "zellige", label: longLabel, worldId: "zellige" },
									{ id: "zellige", label: "Twin id" },
									{ id: "", description: "No id", label: "Empty id" },
									{ id: "d", label: "D", recommended: true },
									{ id: "e", label: "E", recommended: false },
									{ id: "f", label: "F" },
									{ id: "g", label: "Seventh" },
								],
								question: "Which style?",
							},
							{ maxFiles: 9, question: "Your logo?", kind: "attachments" },
							{ question: "   " },
							{ kind: "multi-select", question: "Which pages?" },
						],
					}),
					toolCallId: "call-7",
					toolName: "ask_user",
				},
			],
		}));
		const session = await harness.createSession(sessionInput());

		const state = await harness.suspendTurn(session);

		expect(state.pending).toEqual([
			{
				kind: "question",
				questions: [
					{
						id: "question-0",
						kind: "single-choice",
						options: [
							{ id: "zellige", label: "L".repeat(120), worldId: "zellige" },
							{ id: "option-1", label: "Twin id" },
							{ description: "No id", id: "option-2", label: "Empty id" },
							// Only the advised option keeps the flag; the tray shows a badge.
							{ id: "d", label: "D", recommended: true },
							{ id: "e", label: "E" },
							{ id: "f", label: "F" },
						],
						question: "Which style?",
					},
					{
						id: "question-1",
						kind: "attachments",
						maxFiles: 6,
						options: [],
						question: "Your logo?",
					},
					// A choice without options becomes a typed answer.
					{
						id: "question-3",
						kind: "free-text",
						options: [],
						question: "Which pages?",
					},
				],
				tool: "ask_user",
				toolCallId: "call-7",
			},
		]);
	});

	it("gives an ask_user call without a valid question one empty free-text card", async () => {
		const warn = vi.fn();
		const { harness, session: innerSession } = setup(undefined, { warn });
		const inputs = [
			JSON.stringify({ questions: "not a list" }),
			"{not json",
			JSON.stringify({ questions: [] }),
			JSON.stringify({ questions: [{ question: "   " }] }),
		];
		innerSession.suspendTurn = vi.fn(async () => ({
			...CONTINUE_STATE,
			pendingToolResults: inputs.map((input, index) => ({
				input,
				toolCallId: `call-${index}`,
				toolName: "ask_user",
			})),
		}));
		const session = await harness.createSession(sessionInput());

		const state = await harness.suspendTurn(session);

		// The paused calls still need a tool result, so each gets a card.
		expect(state.pending).toEqual(
			inputs.map((_input, index) => ({
				kind: "question",
				questions: [
					{ id: "question-0", kind: "free-text", options: [], question: "" },
				],
				tool: "ask_user",
				toolCallId: `call-${index}`,
			})),
		);
		expect(warn).toHaveBeenCalledTimes(4);
	});

	it("maps a pending present_plan call to a plan card cut to the card limits", async () => {
		const { harness, session: innerSession } = setup();
		const fullSections = Array.from({ length: 11 }, (_unused, index) => ({
			items: Array.from({ length: 14 }, (_item, item) => `Item ${item}`),
			title: `Section ${index}`,
		}));
		innerSession.suspendTurn = vi.fn(async () => ({
			...CONTINUE_STATE,
			pendingToolResults: [
				{
					input: JSON.stringify({
						assumptions: [
							"  ",
							"A".repeat(400),
							...Array.from({ length: 12 }, (_unused, n) => `Choice ${n}`),
						],
						sections: [
							{
								items: ["Owner", "  ", "I".repeat(350)],
								title: "T".repeat(100),
							},
							{ items: [], title: "No items" },
							{ items: ["No title"], title: "  " },
							...fullSections,
						],
						summary: "S".repeat(900),
						title: ` ${"N".repeat(130)} `,
					}),
					toolCallId: "call-plan",
					toolName: "present_plan",
				},
			],
		}));
		const session = await harness.createSession(sessionInput());

		const state = await harness.suspendTurn(session);

		const card = state.pending[0];
		if (card?.kind !== "plan") {
			throw new Error("expected a plan card");
		}
		expect(card.toolCallId).toBe("call-plan");
		expect(card.plan.title).toBe("N".repeat(120));
		expect(card.plan.summary).toBe("S".repeat(800));
		expect(card.plan.sections[0]).toEqual({
			items: ["Owner", "I".repeat(300)],
			title: "T".repeat(80),
		});
		// Empty sections drop before the cut, so 10 sections with content stay.
		expect(card.plan.sections.map((section) => section.title)).toEqual([
			"T".repeat(80),
			...fullSections.slice(0, 9).map((section) => section.title),
		]);
		expect(card.plan.sections[1]?.items).toHaveLength(12);
		expect(card.plan.assumptions).toHaveLength(10);
		expect(card.plan.assumptions[0]).toBe("A".repeat(300));
	});

	it("gives a present_plan call with a bad input one empty plan card", async () => {
		const warn = vi.fn();
		const { harness, session: innerSession } = setup(undefined, { warn });
		const inputs = ["{not json", JSON.stringify({ sections: "not a list" })];
		innerSession.suspendTurn = vi.fn(async () => ({
			...CONTINUE_STATE,
			pendingToolResults: inputs.map((input, index) => ({
				input,
				toolCallId: `call-${index}`,
				toolName: "present_plan",
			})),
		}));
		const session = await harness.createSession(sessionInput());

		const state = await harness.suspendTurn(session);

		// The paused call still needs a tool result, so each gets a card.
		expect(state.pending).toEqual(
			inputs.map((_input, index) => ({
				kind: "plan",
				plan: { assumptions: [], sections: [], summary: "", title: "" },
				toolCallId: `call-${index}`,
			})),
		);
		expect(warn).toHaveBeenCalledTimes(2);
	});

	it("maps a pending host-tool call to an approval interaction", async () => {
		const { harness, session: innerSession } = setup();
		innerSession.suspendTurn = vi.fn(async () => ({
			...CONTINUE_STATE,
			pendingToolApprovals: [
				{
					approvalId: "appr-1",
					input: '{"command":"deploy"}',
					kind: "custom" as const,
					toolCallId: "call-9",
					toolName: "request_network_host",
				},
			],
			pendingToolResults: [],
		}));
		const session = await harness.createSession(sessionInput());

		const state = await harness.suspendTurn(session);

		expect(state.pending).toEqual([
			{
				approvalId: "appr-1",
				input: '{"command":"deploy"}',
				kind: "approval",
				toolCallId: "call-9",
				toolName: "request_network_host",
			},
		]);
	});

	it("warns and skips a pending result of another tool", async () => {
		const warn = vi.fn();
		const { harness, session: innerSession } = setup(undefined, { warn });
		innerSession.suspendTurn = vi.fn(async () => ({
			...CONTINUE_STATE,
			pendingToolResults: [
				{ input: "{}", toolCallId: "call-2", toolName: "other" },
			],
		}));
		const session = await harness.createSession(sessionInput());

		const state = await harness.suspendTurn(session);

		expect(state.pending).toEqual([]);
		expect(warn).toHaveBeenCalledOnce();
	});
});

describe("ClaudeCodeHarness.detach", () => {
	it("returns the serialized resume state envelope", async () => {
		const { harness, session: innerSession } = setup();
		const session = await harness.createSession(sessionInput());

		const state = await harness.detach(session);

		expect(state.harness).toBe("claude_code");
		expect(JSON.parse(state.payload)).toEqual(RESUME_STATE);
		expect(state.pending).toEqual([]);
		expect(innerSession.detach).toHaveBeenCalledOnce();
	});

	it("maps the unfinished turn of a mid-turn detach to pending cards", async () => {
		const { harness, session: innerSession } = setup();
		// The SDK nests the suspended turn inside the resume state when the
		// session detaches before the turn ends.
		const state: HarnessAgentResumeSessionState = {
			...RESUME_STATE,
			continueFrom: CONTINUE_STATE,
		};
		innerSession.detach = vi.fn(async () => state);
		const session = await harness.createSession(sessionInput());

		const resume = await harness.detach(session);

		expect(JSON.parse(resume.payload)).toEqual(state);
		expect(resume.pending).toEqual([
			{
				kind: "question",
				questions: [
					{
						id: "question-1",
						kind: "single-choice",
						options: [
							{ id: "option-1", label: "Blue" },
							{ id: "option-2", label: "Green" },
						],
						question: "Which color?",
					},
				],
				tool: "askUserQuestions",
				toolCallId: "call-1",
			},
		]);
	});
});

describe("ClaudeCodeHarness keep-alive (harness host)", () => {
	/** One finished turn on a kept-alive harness; answers the stored state. */
	async function finishOneTurn(
		options: Parameters<typeof setup>[2] = {},
	): Promise<
		ReturnType<typeof setup> & {
			stored: Awaited<ReturnType<ClaudeCodeHarness["detach"]>>;
		}
	> {
		const world = setup(
			undefined,
			{ warn: vi.fn() },
			{
				keepAlive: true,
				...options,
			},
		);
		const session = await world.harness.createSession(sessionInput());
		const stored = await world.harness.detach(session);
		return { ...world, stored };
	}

	const LIVE = { bridgeDead: false, dropPausedTurn: false };

	it("attaches a finished session again and gives it to the next turn of the chat", async () => {
		const { captured, harness, stored } = await finishOneTurn();
		// The start and the background re-attach.
		expect(captured.createCount).toBe(2);

		const session = await harness.resumeSession(sessionInput(), stored, LIVE);
		const events = [];
		for await (const event of harness.stream(session, {
			kind: "prompt",
			prompt: "make it blue",
			signal: new AbortController().signal,
		})) {
			events.push(event);
		}

		// No third attach: the kept session serves the turn.
		expect(captured.createCount).toBe(2);
		expect(events.at(-1)?.type).toBe("usage");
	});

	it("resumes from the stored state when another path wrote a newer one", async () => {
		const { captured, harness, session: inner, stored } = await finishOneTurn();
		// A Trigger turn ran in between and stored its own state.
		const newer = {
			...stored,
			payload: JSON.stringify({
				...RESUME_STATE,
				data: { claudeSessionId: "claude-2" },
			}),
		};

		await harness.resumeSession(sessionInput(), newer, LIVE);

		expect(captured.createCount).toBe(3);
		// The kept socket closes; its bridge stays for the stored state.
		expect(inner.detach).toHaveBeenCalledTimes(2);
	});

	it("resumes from the stored state when the sandbox woke", async () => {
		const { captured, harness, stored } = await finishOneTurn();

		await harness.resumeSession(sessionInput(), stored, {
			bridgeDead: true,
			dropPausedTurn: false,
		});

		expect(captured.createCount).toBe(3);
	});

	it("resumes from the stored state when the turn switches mode", async () => {
		const { captured, harness, stored } = await finishOneTurn();

		await harness.resumeSession(
			{ ...sessionInput(), mode: "plan" },
			stored,
			LIVE,
		);

		// The kept session keeps the built-in tools of a build session.
		expect(captured.createCount).toBe(3);
	});

	it("drops the kept session in a new token epoch", async () => {
		let now = 0;
		const { captured, harness, stored } = await finishOneTurn({
			now: () => now,
		});
		now = 30 * 60_000;

		await harness.resumeSession(sessionInput(), stored, LIVE);

		expect(captured.createCount).toBe(3);
	});

	it("resumes from the stored state once when the kept bridge is gone", async () => {
		const { captured, harness, stored } = await finishOneTurn({
			streamErrorOnce: new Error("SandboxChannel: cannot send start"),
		});
		const session = await harness.resumeSession(sessionInput(), stored, LIVE);

		for await (const _event of harness.stream(session, {
			kind: "prompt",
			prompt: "hey",
			signal: new AbortController().signal,
		})) {
			// Drain the turn.
		}

		expect(captured.createCount).toBe(3);
	});

	it("does not keep a session whose turn is still unfinished", async () => {
		const world = setup(undefined, undefined, { keepAlive: true });
		world.session.detach = vi.fn(async () => ({
			...RESUME_STATE,
			continueFrom: CONTINUE_STATE,
		}));
		const session = await world.harness.createSession(sessionInput());

		await world.harness.detach(session);

		expect(world.captured.createCount).toBe(1);
	});

	it("closes kept sessions after 20 idle minutes", async () => {
		let now = 0;
		const {
			captured,
			harness,
			session: inner,
			stored,
		} = await finishOneTurn({
			now: () => now,
		});
		now = 20 * 60_000;

		await harness.dropIdleKept();
		await harness.resumeSession(sessionInput(), stored, LIVE);

		expect(inner.detach).toHaveBeenCalledTimes(2);
		expect(captured.createCount).toBe(3);
	});
});

describe("ClaudeCodeHarness template snapshot support", () => {
	const RECIPE: HarnessV1Bootstrap = {
		bootstrapDir: ".harness-bootstrap/claude-code",
		commands: [{ command: "pnpm install --frozen-lockfile" }],
		files: [
			{
				content: '{"@anthropic-ai/claude-code":"2.1.245"}',
				path: "package.json",
			},
		],
		harnessId: "claude-code",
	};

	function harnessWith(recipe: HarnessV1Bootstrap) {
		const prepared: Parameters<typeof prepareSandboxForHarness>[0][] = [];
		const adapter: HarnessAgentAdapter = {
			// SAFETY: the harness reads only `getBootstrap` off this adapter, and
			// the prepare fake below only records it.
			...({} as HarnessAgentAdapter),
			getBootstrap: async () => recipe,
		};
		const harness = new ClaudeCodeHarness({
			claudeFactory: () => adapter,
			prepareFactory: async (options) => {
				prepared.push(options);
				return { recipeIdentities: {}, skippedHarnessIds: [] };
			},
		});
		return { adapter, harness, prepared };
	}

	it("bootstrapKey is stable for one recipe and changes with the pinned version", async () => {
		const key = await harnessWith(RECIPE).harness.bootstrapKey();
		const bumped = await harnessWith({
			...RECIPE,
			files: [
				{
					content: '{"@anthropic-ai/claude-code":"2.1.281"}',
					path: "package.json",
				},
			],
		}).harness.bootstrapKey();

		expect(await harnessWith(RECIPE).harness.bootstrapKey()).toBe(key);
		expect(key).toMatch(/^[0-9a-f]{64}$/);
		expect(bumped).not.toBe(key);
	});

	it("prepareSandbox installs the adapter in the work dir of the sandbox session", async () => {
		const { adapter, harness, prepared } = harnessWith(RECIPE);

		await harness.prepareSandbox(fakeSandbox());

		expect(prepared).toEqual([
			{
				harnesses: [adapter],
				sandboxConfig: { workDir: HARNESS_WORK_DIR },
				session: FAKE_SANDBOX_SESSION,
			},
		]);
	});
});
