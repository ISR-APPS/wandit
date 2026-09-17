import type {
	HarnessAgentAdapter,
	HarnessAgentContinueTurnState,
	HarnessAgentResumeSessionState,
	HarnessAgentSettings,
} from "@ai-sdk/harness/agent";
import type { ClaudeCodeHarnessSettings } from "@ai-sdk/harness-claude-code";
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
		model: "anthropic/claude-sonnet-5",
		sandbox: fakeSandbox(),
	};
}

type Captured = {
	agentSettings?: HarnessAgentSettings;
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
) {
	const captured: Captured = {};
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
		createSession: async (options) => {
			captured.createOptions = options;
			return session;
		},
		stream: async () =>
			streamResult ?? {
				toUIMessageStream: () => (async function* () {})(),
				totalUsage: Promise.resolve(usage()),
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
		logger,
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
			ANTHROPIC_CUSTOM_HEADERS: "X-Wandit-Run: run-1",
			CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: "1",
		});
		expect(captured.agentSettings?.sandboxConfig?.workDir).toBe(
			HARNESS_WORK_DIR,
		);
		expect(captured.agentSettings?.permissionMode).toBe("allow-all");
		expect(captured.agentSettings?.model).toBe("anthropic/claude-sonnet-5");
		expect(captured.agentSettings?.instructions).toBe(
			"Build the app in these languages only: ar, fr.",
		);
	});

	it("passes only the telemetry flag to env when no custom header exists", async () => {
		const { captured, harness } = setup();
		const input = sessionInput();
		delete input.env.ANTHROPIC_CUSTOM_HEADERS;

		await harness.createSession(input);

		expect(captured.claudeSettings?.env).toEqual({
			CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: "1",
		});
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

		await harness.resumeSession(sessionInput(), {
			harness: "claude_code",
			payload: JSON.stringify(RESUME_STATE),
			pending: [],
		});

		expect(captured.createOptions?.resumeFrom).toEqual(RESUME_STATE);
		expect(captured.createOptions?.sessionId).toBe("chat-1");
	});

	it("resumes a suspended turn through continueFrom, not resumeFrom", async () => {
		const { captured, harness } = setup();

		await harness.resumeSession(sessionInput(), {
			harness: "claude_code",
			payload: JSON.stringify(CONTINUE_STATE),
			pending: [
				{
					kind: "question",
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
					toolCallId: "call-1",
				},
			],
		});

		expect(captured.createOptions?.continueFrom).toEqual(CONTINUE_STATE);
		expect(captured.createOptions?.resumeFrom).toBeUndefined();
	});

	it("throws HarnessResumeMismatchError for another harness payload", async () => {
		const { harness } = setup();

		await expect(
			harness.resumeSession(sessionInput(), {
				harness: "opencode",
				payload: "{}",
				pending: [],
			}),
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
						options: [
							{ id: "option-1", label: "Blue" },
							{ id: "option-2", label: "Green" },
						],
						question: "Which color?",
					},
				],
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
				questions: [{ id: "question-2", options: [], question: "Any notes?" }],
				toolCallId: "call-2",
			},
		]);
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
						options: [
							{ id: "option-1", label: "Blue" },
							{ id: "option-2", label: "Green" },
						],
						question: "Which color?",
					},
				],
				toolCallId: "call-1",
			},
		]);
	});
});
