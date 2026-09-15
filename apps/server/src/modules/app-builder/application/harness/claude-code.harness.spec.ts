import type {
	HarnessAgentAdapter,
	HarnessAgentResumeSessionState,
	HarnessAgentSettings,
} from "@ai-sdk/harness/agent";
import type { ClaudeCodeHarnessSettings } from "@ai-sdk/harness-claude-code";
import type { LanguageModelUsage, UIMessageChunk } from "ai";
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
		resumeFrom?: HarnessAgentResumeSessionState;
		sandboxSession: HarnessSandboxSession;
		sessionId: string;
	};
};

function setup(streamResult?: ClaudeCodeStreamResult) {
	const captured: Captured = {};
	const session: ClaudeCodeSessionHandle = {
		detach: vi.fn(async () => RESUME_STATE),
		sessionId: "sess-1",
	};
	const agent: ClaudeCodeAgentRunner = {
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
		});

		expect(captured.createOptions?.resumeFrom).toEqual(RESUME_STATE);
		expect(captured.createOptions?.sessionId).toBe("chat-1");
	});

	it("throws HarnessResumeMismatchError for another harness payload", async () => {
		const { harness } = setup();

		await expect(
			harness.resumeSession(sessionInput(), {
				harness: "opencode",
				payload: "{}",
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
});

describe("ClaudeCodeHarness.detach", () => {
	it("returns the serialized resume state envelope", async () => {
		const { harness, session: innerSession } = setup();
		const session = await harness.createSession(sessionInput());

		const state = await harness.detach(session);

		expect(state.harness).toBe("claude_code");
		expect(JSON.parse(state.payload)).toEqual(RESUME_STATE);
		expect(innerSession.detach).toHaveBeenCalledOnce();
	});
});
