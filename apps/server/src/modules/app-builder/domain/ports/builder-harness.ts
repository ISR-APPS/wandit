/**
 * Port: the coding-agent harness that runs a turn inside the sandbox.
 * The builder-turn task calls it; WANDIT-166 implements it on the AI SDK
 * `HarnessAgent` with the Claude Code adapter first (D17).
 * Only `ai` types are imported here — the adapter package stays inside the
 * implementation.
 */

import type {
	AskUserHostToolOutput,
	HarnessPendingInteraction,
} from "@wandit/contracts";
import type { UIMessageChunk } from "ai";

import type { HostToolSet } from "./host-tools";
import type { SandboxHandle } from "./sandbox-provider";

/** Nest token for the `BuilderHarness` implementation. */
export const BUILDER_HARNESS = Symbol.for("app-builder.builder-harness");

/** Which harness runs the turn. Matches the `builder_harness` db enum. */
export type HarnessKind = "claude_code" | "opencode";

/**
 * Opaque resume state of `session.detach()` or `session.suspendTurn()`,
 * stored as JSON text in `builder_sessions.resumeState`. The API never
 * reads `payload`; `pending` holds the question/approval cards an
 * unfinished turn waits on (`[]` when the turn ended).
 */
export type HarnessResumeState = {
	harness: HarnessKind;
	payload: string;
	pending: HarnessPendingInteraction[];
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

/**
 * One answered question call, keyed on the tool that asked. For the
 * built-in `askUserQuestions`, `answers` is keyed by question id and
 * `partial` marks a call where the harness re-asks the unanswered
 * questions. For the `ask_user` host tool, `output` is the tool result.
 */
export type HarnessQuestionResult =
	| {
			tool: "askUserQuestions";
			toolCallId: string;
			answers: Record<string, { optionIds: string[]; freeform?: string }>;
			partial: boolean;
	  }
	| {
			tool: "ask_user";
			toolCallId: string;
			output: AskUserHostToolOutput;
	  };

/**
 * One turn inside a session. `prompt` starts a fresh turn from the user
 * message; `continue` answers the question/approval cards a suspended
 * turn waits on.
 */
export type HarnessTurnInput =
	| {
			kind: "prompt";
			prompt: string;
			signal: AbortSignal;
	  }
	| {
			kind: "continue";
			toolResults: HarnessQuestionResult[];
			approvals: { approvalId: string; approved: boolean }[];
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
 * state the next turn resumes from; `suspendTurn` freezes a paused turn
 * with its pending cards.
 */
export interface BuilderHarness {
	readonly kind: HarnessKind;
	createSession(input: HarnessSessionInput): Promise<HarnessSession>;
	resumeSession(
		input: HarnessSessionInput,
		resumeState: HarnessResumeState,
		options: {
			/**
			 * True resumes the thread between turns and drops a paused turn; the
			 * caller then sends the answers as a text prompt. The runtime sets it
			 * when the sandbox woke from a stop: the bridge and its open tool
			 * calls are gone.
			 */
			dropPausedTurn: boolean;
		},
	): Promise<HarnessSession>;
	stream(
		session: HarnessSession,
		input: HarnessTurnInput,
	): AsyncIterable<HarnessStreamEvent>;
	/** True while the session waits on a tool result or an approval. */
	hasUnfinishedTurn(session: HarnessSession): Promise<boolean>;
	/**
	 * Freezes the session for the next turn. A detach in the middle of a
	 * turn also fills `pending`; the next turn must answer the cards.
	 */
	detach(session: HarnessSession): Promise<HarnessResumeState>;
	/**
	 * Freezes a paused turn and fills `pending` on the resume state.
	 * The session handle is unusable after it, same as `detach`.
	 */
	suspendTurn(session: HarnessSession): Promise<HarnessResumeState>;
}
