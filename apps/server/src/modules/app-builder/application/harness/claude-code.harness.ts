/**
 * `BuilderHarness` on the AI SDK `HarnessAgent` with the Claude Code
 * adapter (D17). The `builder-turn` task calls `createSession`,
 * `resumeSession`, `stream`, and `detach`; `builder-harness.factory.ts`
 * builds it. One instance keeps every live session of the run in a Map
 * so `stream` and `detach` find the matching `HarnessAgentSession`.
 */

import {
	getHarnessErrorMessage,
	HarnessAgent,
	type HarnessAgentAdapter,
	type HarnessAgentResumeSessionState,
	type HarnessAgentSession,
	type HarnessAgentSettings,
} from "@ai-sdk/harness/agent";
import {
	type ClaudeCodeHarnessSettings,
	createClaudeCode,
} from "@ai-sdk/harness-claude-code";
import { harnessResumeStateSchema } from "@wandit/contracts";
import type { LanguageModelUsage, UIMessageChunk } from "ai";

import { HarnessResumeMismatchError } from "../../domain/errors/harness-resume-mismatch.error";
import type {
	BuilderHarness,
	HarnessResumeState,
	HarnessSession,
	HarnessSessionInput,
	HarnessStreamEvent,
	HarnessTurnInput,
} from "../../domain/ports/builder-harness";
import {
	HARNESS_BRIDGE_PORT,
	HARNESS_WORK_DIR,
	type HarnessSandboxSession,
} from "../../domain/ports/sandbox-provider";

/** The `HarnessAgentSession` fields the adapter uses; specs fake this. */
export type ClaudeCodeSessionHandle = Pick<
	HarnessAgentSession,
	"detach" | "sessionId"
>;

/** The `StreamTextResult` fields the adapter reads; specs fake this. */
export type ClaudeCodeStreamResult = {
	toUIMessageStream(options?: {
		onError?: (error: unknown) => string;
	}): AsyncIterable<UIMessageChunk>;
	totalUsage: PromiseLike<LanguageModelUsage>;
};

/**
 * The slice of `HarnessAgent` the adapter calls. Declared with method
 * signatures so the narrower session handle still matches the real class.
 */
export interface ClaudeCodeAgentRunner {
	createSession(options: {
		resumeFrom?: HarnessAgentResumeSessionState;
		sandboxSession: HarnessSandboxSession;
		sessionId: string;
	}): Promise<ClaudeCodeSessionHandle>;
	stream(options: {
		abortSignal: AbortSignal;
		prompt: string;
		session: ClaudeCodeSessionHandle;
	}): Promise<ClaudeCodeStreamResult>;
}

/**
 * Test seams: `agentFactory` defaults to the real `HarnessAgent`
 * constructor, `claudeFactory` to `createClaudeCode`. Specs assert the
 * settings each factory received.
 */
export type ClaudeCodeHarnessDeps = {
	agentFactory?: (settings: HarnessAgentSettings) => ClaudeCodeAgentRunner;
	claudeFactory?: (settings: ClaudeCodeHarnessSettings) => HarnessAgentAdapter;
};

type LiveSession = {
	agent: ClaudeCodeAgentRunner;
	session: ClaudeCodeSessionHandle;
};

/**
 * Kills a bridge process an earlier session left in the sandbox. A detached
 * session keeps its bridge alive for a resume; when the resume is not
 * possible, the old bridge still holds the bridge port and a new one cannot
 * listen. Only sh, tr, grep, and kill are used: the image has no pkill.
 */
const KILL_STALE_BRIDGE_SCRIPT =
	"for p in /proc/[0-9]*; do if tr '\\0' ' ' < \"$p/cmdline\" 2>/dev/null | grep -q 'bridge.mjs --workdir'; then kill \"$(basename \"$p\")\" 2>/dev/null; fi; done; true";

export class ClaudeCodeHarness implements BuilderHarness {
	readonly kind = "claude_code";

	private readonly agentFactory: NonNullable<
		ClaudeCodeHarnessDeps["agentFactory"]
	>;
	private readonly claudeFactory: NonNullable<
		ClaudeCodeHarnessDeps["claudeFactory"]
	>;

	/** sessionId → the agent and its live session, for `stream`/`detach`. */
	private readonly sessions = new Map<string, LiveSession>();

	constructor(deps: ClaudeCodeHarnessDeps = {}) {
		this.agentFactory =
			deps.agentFactory ??
			((settings) => {
				const agent = new HarnessAgent(settings);
				return {
					createSession: (options) => agent.createSession(options),
					stream: (options) =>
						agent.stream({
							...options,
							// SAFETY: `createSession` above returns the SDK's
							// `HarnessAgentSession`; `ClaudeCodeSessionHandle` narrows
							// it for the spec seam. The runtime value is always the
							// full session.
							session: options.session as HarnessAgentSession,
						}),
				};
			});
		this.claudeFactory = deps.claudeFactory ?? createClaudeCode;
	}

	async createSession(input: HarnessSessionInput): Promise<HarnessSession> {
		const agent = this.buildAgent(input);
		const sandboxSession = await input.sandbox.harnessSession();
		// A fresh session owns the sandbox egress policy. An earlier session on
		// the same sandbox leaves its request transformations behind (the run
		// token header for the proxy host), and the SDK refuses to add new ones
		// next to transformations it cannot attribute. A resume keeps them.
		await sandboxSession.setRequestTransformations?.([]);
		await input.sandbox.exec("sh", ["-c", KILL_STALE_BRIDGE_SCRIPT]);
		// `sessionId` names the Claude Code work dir and the bridge dir; the
		// chat id keeps them stable across turns. A missing sessionId gets a
		// random id and a new empty work dir.
		const session = await agent.createSession({
			sandboxSession,
			sessionId: input.chatId,
		});
		this.sessions.set(session.sessionId, { agent, session });
		return { sessionId: session.sessionId };
	}

	async resumeSession(
		input: HarnessSessionInput,
		resumeState: HarnessResumeState,
	): Promise<HarnessSession> {
		if (resumeState.harness !== this.kind) {
			throw new HarnessResumeMismatchError(resumeState.harness, this.kind);
		}
		// `resumeState.payload` is a JSON string; jsonb hands it back as
		// unknown, so `JSON.parse` output is the boundary value.
		const parsed = harnessResumeStateSchema.parse(
			JSON.parse(resumeState.payload),
		);
		// SAFETY: zod checked type, harnessId, and specificationVersion above;
		// the rest is the adapter's own detach() output.
		const resumeFrom = parsed as HarnessAgentResumeSessionState;

		const agent = this.buildAgent(input);
		const sandboxSession = await input.sandbox.harnessSession();
		const session = await agent.createSession({
			resumeFrom,
			sandboxSession,
			sessionId: input.chatId,
		});
		this.sessions.set(session.sessionId, { agent, session });
		return { sessionId: session.sessionId };
	}

	async *stream(
		session: HarnessSession,
		input: HarnessTurnInput,
	): AsyncIterable<HarnessStreamEvent> {
		const entry = this.requireSession(session.sessionId);
		const result = await entry.agent.stream({
			abortSignal: input.signal,
			prompt: input.prompt,
			session: entry.session,
		});
		// The browser part keeps the SDK's safe text. The error event below
		// carries the real message, for the turn row and the worker log.
		let lastErrorMessage: string | null = null;
		for await (const chunk of result.toUIMessageStream({
			onError: (error) => {
				lastErrorMessage =
					error instanceof Error ? error.message : String(error);
				return getHarnessErrorMessage(error);
			},
		})) {
			yield { chunk, type: "part" };
			if (chunk.type === "error") {
				yield {
					code: "harness_error",
					message: lastErrorMessage ?? chunk.errorText,
					retryable: false,
					type: "error",
				};
				lastErrorMessage = null;
			}
		}
		const usage = await result.totalUsage;
		yield {
			cacheReadTokens: usage.inputTokenDetails.cacheReadTokens ?? 0,
			cacheWriteTokens: usage.inputTokenDetails.cacheWriteTokens ?? 0,
			inputTokens: usage.inputTokens ?? 0,
			outputTokens: usage.outputTokens ?? 0,
			type: "usage",
		};
	}

	async detach(session: HarnessSession): Promise<HarnessResumeState> {
		const entry = this.requireSession(session.sessionId);
		this.sessions.delete(session.sessionId);
		return {
			harness: this.kind,
			payload: JSON.stringify(await entry.session.detach()),
		};
	}

	private buildAgent(input: HarnessSessionInput): ClaudeCodeAgentRunner {
		const baseUrl = input.env.ANTHROPIC_BASE_URL;
		const authToken = input.env.ANTHROPIC_AUTH_TOKEN;
		if (baseUrl === undefined || authToken === undefined) {
			throw new Error(
				"Harness env lacks ANTHROPIC_BASE_URL or ANTHROPIC_AUTH_TOKEN",
			);
		}
		const customHeaders = input.env.ANTHROPIC_CUSTOM_HEADERS;
		return this.agentFactory({
			harness: this.claudeFactory({
				// The explicit auth object stops the adapter from reading
				// process.env or a keychain for Anthropic credentials: the
				// adapter copies only ANTHROPIC_API_KEY, ANTHROPIC_AUTH_TOKEN,
				// CLAUDE_CODE_OAUTH_TOKEN, and ANTHROPIC_BASE_URL from `auth`.
				auth: {
					ANTHROPIC_AUTH_TOKEN: authToken,
					ANTHROPIC_BASE_URL: baseUrl,
				},
				// Other variables go through `env`; absent means no `env` key.
				...(customHeaders === undefined
					? {}
					: { env: { ANTHROPIC_CUSTOM_HEADERS: customHeaders } }),
				port: HARNESS_BRIDGE_PORT,
			}),
			instructions: input.instructions,
			model: input.model,
			// The template deny rules and hooks still apply in this mode.
			permissionMode: "allow-all",
			// Claude Code runs in `<vendor cwd>/<workDir>`; the project and the
			// template .claude/settings.json (deny rules, hooks) live there, so
			// the rules load only with this value.
			sandboxConfig: { workDir: HARNESS_WORK_DIR },
			toolApproval: input.hostTools.toolApproval,
			tools: input.hostTools.tools,
		});
	}

	private requireSession(sessionId: string): LiveSession {
		const entry = this.sessions.get(sessionId);
		if (entry === undefined) {
			throw new Error(`Unknown harness session ${sessionId}`);
		}
		return entry;
	}
}
