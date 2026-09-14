/**
 * Port: the coding-agent harness that runs a turn inside the sandbox.
 * The builder-turn task calls it; WANDIT-166 implements it on the AI SDK
 * `HarnessAgent` with the Claude Code adapter first (D17).
 * Only `ai` types are imported here — the adapter package stays inside the
 * implementation.
 */
import type { UIMessageChunk } from "ai";

import type { HostToolSet } from "./host-tools";
import type { SandboxHandle } from "./sandbox-provider";

/** Nest token for the `BuilderHarness` implementation. */
export const BUILDER_HARNESS = Symbol.for("app-builder.builder-harness");

/** Which harness runs the turn. Matches the `builder_harness` db enum. */
export type HarnessKind = "claude_code" | "opencode";

/**
 * Opaque resume state of `session.detach()`, stored as JSON text in
 * `builder_sessions.resumeState`. The API never reads `payload`.
 */
export type HarnessResumeState = {
	harness: HarnessKind;
	payload: string;
};

/** What a harness session needs to start or resume. */
export type HarnessSessionInput = {
	chatId: string;
	/** Model id, for example the `V2_DEFAULT_MODEL` value. */
	model: string;
	/** Per-run env for the agent process; per-run tokens only. */
	env: Record<string, string>;
	/** Extra text appended to the harness system prompt, for example the language rule. */
	instructions?: string;
	sandbox: SandboxHandle;
	hostTools: HostToolSet;
};

/** A live harness session; the task keeps only the id it must log. */
export type HarnessSession = { readonly sessionId: string };

/** One turn of prompting inside a session. */
export type HarnessTurnInput = {
	prompt: string;
	signal: AbortSignal;
};

/** What the harness streams back while a turn runs. */
export type HarnessStreamEvent =
	| { type: "part"; chunk: UIMessageChunk }
	| {
			type: "usage";
			inputTokens: number;
			outputTokens: number;
			cacheReadTokens: number;
			cacheWriteTokens: number;
	  }
	| { type: "error"; code: string; message: string; retryable: boolean };

/**
 * One coding-agent harness. `createSession` starts cold; `resumeSession`
 * wakes a stored session; `stream` runs one turn; `detach` freezes the
 * state the next turn resumes from.
 */
export interface BuilderHarness {
	readonly kind: HarnessKind;
	createSession(input: HarnessSessionInput): Promise<HarnessSession>;
	resumeSession(
		input: HarnessSessionInput,
		resumeState: HarnessResumeState,
	): Promise<HarnessSession>;
	stream(
		session: HarnessSession,
		input: HarnessTurnInput,
	): AsyncIterable<HarnessStreamEvent>;
	detach(session: HarnessSession): Promise<HarnessResumeState>;
}
