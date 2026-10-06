/**
 * `BuilderHarness` on the AI SDK `HarnessAgent` with the Claude Code
 * adapter (D17). The `builder-turn` task calls `createSession`,
 * `resumeSession`, `stream`, `detach`, `suspendTurn`, and `bootstrapKey`;
 * the `template-snapshot` task calls `bootstrapKey` and `prepareSandbox`.
 * `builder-harness.factory.ts` builds it. One instance keeps every live
 * session of the run in a Map. `stream`, `hasUnfinishedTurn`, `detach`,
 * and `suspendTurn` find the matching `HarnessAgentSession` there. On the
 * harness host (`keepAlive`), a finished session attaches again after the
 * turn, and the next turn of the chat reuses it.
 */

import { createHash } from "node:crypto";
import {
	harnessV1QuestionsToolInputSchema,
	harnessV1QuestionsToolOutputSchema,
} from "@ai-sdk/harness";
import {
	getHarnessErrorMessage,
	HarnessAgent,
	type HarnessAgentAdapter,
	type HarnessAgentContinueTurnState,
	type HarnessAgentResumeSessionState,
	type HarnessAgentSession,
	type HarnessAgentSettings,
	prepareSandboxForHarness,
} from "@ai-sdk/harness/agent";
import {
	type ClaudeCodeHarnessSettings,
	createClaudeCode,
} from "@ai-sdk/harness-claude-code";
import {
	type AskUserHostToolInput,
	askUserHostToolInputSchema,
	askUserHostToolOutputSchema,
	type BuilderTurnMode,
	type HarnessPendingInteraction,
	harnessResumeStateSchema,
	type PresentPlanHostToolInput,
	presentPlanHostToolInputSchema,
	presentPlanHostToolOutputSchema,
	resolveAskUserKind,
} from "@wandit/contracts";
import type {
	LanguageModelUsage,
	ToolApprovalResponse,
	ToolResultPart,
	UIMessageChunk,
} from "ai";

import { HarnessResumeMismatchError } from "../../domain/errors/harness-resume-mismatch.error";
import type {
	BuilderHarness,
	HarnessQuestionResult,
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
	type SandboxHandle,
} from "../../domain/ports/sandbox-provider";
import type { QuestionInteraction } from "../../domain/question-answers";
import { ASK_USER_TOOL_NAME } from "../host-tools/ask-user.host-tool";
import { PRESENT_PLAN_TOOL_NAME } from "../host-tools/present-plan.host-tool";
import { readForkRunTurn, withForkedBridge } from "./claude-code-bridge-fork";

/**
 * The built-in tool the adapter pauses on for a user question. The name
 * is the tool's registered name inside `HarnessAgent`, not our choice.
 */
const ASK_USER_QUESTIONS_TOOL_NAME = "askUserQuestions";

// The card limits of one `ask_user` call. The tool description tells the
// model; Claude Code does not enforce MCP schema lengths, so `pendingOf`
// cuts every value here instead of failing the paused turn.
const ASK_USER_MAX_QUESTIONS = 4;
const ASK_USER_MAX_OPTIONS = 6;
const ASK_USER_MAX_QUESTION_CHARS = 300;
const ASK_USER_MAX_LABEL_CHARS = 120;
const ASK_USER_MAX_NOTE_CHARS = 200;
const ASK_USER_MAX_ID_CHARS = 64;
const ASK_USER_MAX_FILES = 6;

// The card limits of one `present_plan` call, as its tool description names
// them. `pendingOf` cuts every value here, for the same reason as `ask_user`.
const PRESENT_PLAN_MAX_TITLE_CHARS = 120;
const PRESENT_PLAN_MAX_SUMMARY_CHARS = 800;
const PRESENT_PLAN_MAX_SECTIONS = 10;
const PRESENT_PLAN_MAX_SECTION_TITLE_CHARS = 80;
const PRESENT_PLAN_MAX_ITEMS = 12;
const PRESENT_PLAN_MAX_ITEM_CHARS = 300;
const PRESENT_PLAN_MAX_ASSUMPTIONS = 10;

/**
 * The built-in tools a Plan Mode session cannot use: each one writes a file,
 * runs a command, or starts another agent. This is a hard block, not only
 * prompt text. Native Claude Code plan mode is not usable: a bypass session
 * still runs Write and Bash in it (docs/v2/DECISIONS.md, D27). The names are
 * `builtinTools` keys of the adapter; `EnterPlanMode`, `PowerShell`, and
 * `Workflow` reach the CLI unchanged, the bridge maps the others.
 */
const PLAN_MODE_BLOCKED_TOOLS = [
	"write",
	"edit",
	"bash",
	"NotebookEdit",
	"Agent",
	"Monitor",
	"EnterPlanMode",
	"ExitPlanMode",
	"EnterWorktree",
	"PowerShell",
	"Workflow",
] as const;

/**
 * 30 s for a bridge start or an attach, against the adapter default of 120 s.
 * A dead bridge after an idle stop retried its socket for the whole window.
 */
const BRIDGE_STARTUP_TIMEOUT_MS = 30_000;

/**
 * 30 min. The bridge fork keeps one Claude Code process while its start env
 * stays the same. The env names this epoch, so each epoch starts a new
 * process, and no kept-alive connection holds a proxy token (65 min) too long.
 */
// LIMIT: a turn longer than 35 min on a process from an earlier turn can
// reach the token end. Upgrade: a proxy renewal for a bound chat.
const TOKEN_EPOCH_MS = 30 * 60_000;

/** 20 min, the window of the `sandbox-idle-sweep` task: a kept session goes after it. */
const KEPT_SESSION_IDLE_MS = 20 * 60_000;

/**
 * The HTTP status in a Claude Code error text. Claude Code writes
 * "API Error: 529 Overloaded", "API Error: Repeated 529 Overloaded errors",
 * and "API Error: Request rejected (429) · ...". The vendor bridge writes
 * "HTTP 401: ...", and the bridge fork writes "... (HTTP 529)".
 */
const API_ERROR_STATUS_PATTERN =
	/(?:API Error: (?:Repeated |Request rejected \()?|\bHTTP )([45]\d{2})\b/u;

/** The `HarnessAgentSession` fields the adapter uses; specs fake this. */
export type ClaudeCodeSessionHandle = Pick<
	HarnessAgentSession,
	"detach" | "hasUnfinishedTurn" | "sessionId" | "suspendTurn"
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
		continueFrom?: HarnessAgentContinueTurnState;
		resumeFrom?: HarnessAgentResumeSessionState;
		sandboxSession: HarnessSandboxSession;
		sessionId: string;
	}): Promise<ClaudeCodeSessionHandle>;
	stream(options: {
		abortSignal: AbortSignal;
		prompt: string;
		session: ClaudeCodeSessionHandle;
	}): Promise<ClaudeCodeStreamResult>;
	/** Drains a suspended turn after `createSession({ continueFrom })`. */
	continueStream(options: {
		abortSignal: AbortSignal;
		session: ClaudeCodeSessionHandle;
		toolApprovalContinuations?: ToolApprovalResponse[];
		toolResultContinuations?: ToolResultPart[];
	}): Promise<ClaudeCodeStreamResult>;
}

/**
 * Test seams: `agentFactory` defaults to the real `HarnessAgent`
 * constructor, `claudeFactory` to `createClaudeCode`, `prepareFactory` to
 * `prepareSandboxForHarness`. Specs assert the settings each one received.
 */
export type ClaudeCodeHarnessDeps = {
	agentFactory?: (settings: HarnessAgentSettings) => ClaudeCodeAgentRunner;
	claudeFactory?: (settings: ClaudeCodeHarnessSettings) => HarnessAgentAdapter;
	prepareFactory?: typeof prepareSandboxForHarness;
	/** Warn sink for a skipped pending tool result; defaults to console. */
	logger?: Pick<Console, "warn">;
	/**
	 * Harness host only: a finished session attaches to its bridge again after
	 * the turn, so the next turn of the chat skips the attach. A Trigger.dev
	 * run ends after one turn, so the task leaves it off.
	 */
	keepAlive?: boolean;
	/** Clock of the token epoch and the idle window; defaults to `Date.now`. */
	now?: () => number;
};

/** The options of `resumeSession`, see `BuilderHarness`. */
type ResumeOptions = { dropPausedTurn: boolean; bridgeDead: boolean };

type LiveSession = {
	agent: ClaudeCodeAgentRunner;
	session: ClaudeCodeSessionHandle;
	/** The chat of the session; it also names the session in the SDK. */
	chatId: string;
	/** The sandbox session the agent started on; a re-attach uses it again. */
	sandboxSession: HarnessSandboxSession;
	/** `providerSandboxId` of that sandbox; a new sandbox has a new bridge. */
	sandboxId: string;
	/** `TOKEN_EPOCH_MS` bucket of the env the session started with. */
	epoch: number;
	/**
	 * JSON of the host tool approval rules. The SDK fixes them when the
	 * session starts, so a kept session serves only the same rules.
	 */
	toolApproval: string;
	/**
	 * The turn mode the session started with. The SDK fixes the built-in tool
	 * filtering when the session starts, so a kept session serves only it.
	 */
	mode: BuilderTurnMode;
	/**
	 * `networkPolicyHash` of the sandbox handle the session started on. The
	 * session added its run-token rule on top of that policy.
	 */
	policyHash: string | null;
	/**
	 * Set when the turn reuses a kept session: the stored state to resume from
	 * when the kept bridge is gone at the turn start.
	 */
	fallback?: {
		input: HarnessSessionInput;
		resumeState: HarnessResumeState;
		options: ResumeOptions;
	};
};

/** A session kept attached between two turns of a chat (keep-alive only). */
type KeptSession = {
	/** The re-attach after the turn; null when it failed. */
	live: Promise<LiveSession | null>;
	/** The `payload` the turn end stored; the row must still hold it. */
	payload: string;
	sandboxId: string;
	/** When the turn ended, for the idle window. */
	idleSince: number;
};

/**
 * Kills a bridge process an earlier session left in the sandbox. A detached
 * session keeps its bridge alive for a resume; when the resume is not
 * possible, the old bridge still holds the bridge port and a new one cannot
 * listen. Only sh, tr, grep, and kill are used: the image has no pkill.
 * The pattern `[b]ridge` matches the bridge but not this script's own text.
 * A plain `bridge.mjs` pattern matched the script's own shell. The glob sorts
 * pids as text ("1865" before "733"), so the script killed itself first and
 * the bridge kept the port: a Plan to Build switch then failed on each retry.
 */
const KILL_STALE_BRIDGE_SCRIPT =
	"for p in /proc/[0-9]*; do if tr '\\0' ' ' < \"$p/cmdline\" 2>/dev/null | grep -q '[b]ridge\\.mjs --workdir'; then kill \"$(basename \"$p\")\" 2>/dev/null; fi; done; true";

export class ClaudeCodeHarness implements BuilderHarness {
	readonly kind = "claude_code";

	private readonly agentFactory: NonNullable<
		ClaudeCodeHarnessDeps["agentFactory"]
	>;
	private readonly claudeFactory: NonNullable<
		ClaudeCodeHarnessDeps["claudeFactory"]
	>;
	private readonly prepareFactory: NonNullable<
		ClaudeCodeHarnessDeps["prepareFactory"]
	>;
	private readonly logger: NonNullable<ClaudeCodeHarnessDeps["logger"]>;
	private readonly keepAlive: boolean;
	private readonly now: () => number;

	/** sessionId → the agent and its live session, for `stream`/`detach`. */
	private readonly sessions = new Map<string, LiveSession>();
	/** chatId → the session kept attached since the last turn (keep-alive). */
	private readonly kept = new Map<string, KeptSession>();

	constructor(deps: ClaudeCodeHarnessDeps = {}) {
		this.agentFactory =
			deps.agentFactory ??
			((settings) => {
				const agent = new HarnessAgent(settings);
				return {
					continueStream: (options) =>
						agent.continueStream({
							...options,
							// SAFETY: `createSession` below returns the SDK's
							// `HarnessAgentSession`; `ClaudeCodeSessionHandle` narrows
							// it for the spec seam. The runtime value is always the
							// full session.
							session: options.session as HarnessAgentSession,
						}),
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
		// The real adapter installs the Wandit bridge fork: one Claude Code
		// process serves many turns of a chat (`claude-code-bridge-fork.ts`).
		this.claudeFactory =
			deps.claudeFactory ??
			((settings) =>
				withForkedBridge(createClaudeCode(settings), readForkRunTurn()));
		this.prepareFactory = deps.prepareFactory ?? prepareSandboxForHarness;
		this.logger = deps.logger ?? console;
		this.keepAlive = deps.keepAlive ?? false;
		this.now = deps.now ?? Date.now;
	}

	async bootstrapKey(): Promise<string> {
		// The recipe holds the bridge files and the install commands, which
		// pin the Claude Code version. It does not read the settings.
		const recipe = await this.claudeFactory({
			port: HARNESS_BRIDGE_PORT,
		}).getBootstrap?.();
		return createHash("sha256")
			.update(JSON.stringify(recipe ?? null))
			.digest("hex");
	}

	async prepareSandbox(sandbox: SandboxHandle): Promise<void> {
		// The same adapter and work dir as `buildAgent`: a later session finds
		// the install marker and skips the install.
		await this.prepareFactory({
			harnesses: [this.claudeFactory({ port: HARNESS_BRIDGE_PORT })],
			sandboxConfig: { workDir: HARNESS_WORK_DIR },
			session: await sandbox.harnessSession(),
		});
	}

	async createSession(input: HarnessSessionInput): Promise<HarnessSession> {
		// The new bridge replaces the kept one, so the kept session goes first.
		await this.dropKept(input.chatId);
		const epoch = this.tokenEpoch();
		const agent = this.buildAgent(input, epoch);
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
		this.sessions.set(
			session.sessionId,
			this.liveSession(input, { agent, epoch, sandboxSession, session }),
		);
		return { sessionId: session.sessionId };
	}

	async resumeSession(
		input: HarnessSessionInput,
		resumeState: HarnessResumeState,
		options: ResumeOptions,
	): Promise<HarnessSession> {
		if (resumeState.harness !== this.kind) {
			throw new HarnessResumeMismatchError(resumeState.harness, this.kind);
		}
		const kept = await this.takeKept(input, resumeState, options);
		if (kept !== null) {
			// The kept session serves this turn with this turn's tools, model,
			// and instructions: the SDK reads them from the agent on each prompt.
			this.sessions.set(kept.session.sessionId, {
				...kept,
				agent: this.buildAgent(input, kept.epoch),
				fallback: { input, options, resumeState },
			});
			return { sessionId: kept.session.sessionId };
		}
		return this.resumeStored(input, resumeState, options);
	}

	/**
	 * Drops the kept sessions idle for longer than `KEPT_SESSION_IDLE_MS`.
	 * The harness host calls it on a timer. The bridges stay; the stored
	 * state still attaches to them.
	 */
	async dropIdleKept(): Promise<void> {
		for (const [chatId, kept] of this.kept) {
			if (this.now() - kept.idleSince >= KEPT_SESSION_IDLE_MS) {
				await this.dropKept(chatId);
			}
		}
	}

	/** The stored-state resume of `resumeSession`: one attach or bridge start. */
	private async resumeStored(
		input: HarnessSessionInput,
		resumeState: HarnessResumeState,
		options: ResumeOptions,
	): Promise<HarnessSession> {
		// `resumeState.payload` is a JSON string; jsonb hands it back as
		// unknown, so `JSON.parse` output is the boundary value.
		const parsed = harnessResumeStateSchema.parse(
			JSON.parse(resumeState.payload),
		);

		const epoch = this.tokenEpoch();
		const agent = this.buildAgent(input, epoch);
		const sandboxSession = await input.sandbox.harnessSession();
		// A mode switch drops a paused turn whose bridge still waits on the
		// paused call and holds the bridge port. After an idle stop no bridge
		// runs, and the kill does nothing.
		if (options.bridgeDead) {
			await input.sandbox.exec("sh", ["-c", KILL_STALE_BRIDGE_SCRIPT]);
		}
		let session: ClaudeCodeSessionHandle;
		if (parsed.type === "continue-turn") {
			// SAFETY: zod checked type, harnessId, and specificationVersion
			// above; the rest is the adapter's own suspendTurn() output.
			const continueFrom = parsed as HarnessAgentContinueTurnState;
			session = options.dropPausedTurn
				? await agent.createSession({
						// The paused turn goes for two reasons. A stopped sandbox killed
						// the bridge, so a rerun cannot deliver the old host-tool result
						// by id. A mode switch needs a new tool list, but a continue keeps
						// the tool list of the paused prompt. The thread resumes between
						// turns: same Claude conversation, no paused turn. Both state
						// types share the adapter `data` schema; the pending lists stay
						// out, and the caller's next prompt carries the answers.
						resumeFrom: {
							data: options.bridgeDead
								? withoutBridgeCoords(continueFrom.data)
								: continueFrom.data,
							harnessId: continueFrom.harnessId,
							specificationVersion: continueFrom.specificationVersion,
							type: "resume-session",
						},
						sandboxSession,
						sessionId: input.chatId,
					})
				: await agent.createSession({
						continueFrom,
						sandboxSession,
						sessionId: input.chatId,
					});
		} else {
			// SAFETY: zod checked type, harnessId, and specificationVersion
			// above; the rest is the adapter's own detach() output.
			const stored = parsed as HarnessAgentResumeSessionState;
			// A detach in the middle of a turn nests that turn in `continueFrom`.
			// A dropped paused turn must go from here too: the SDK refuses a
			// new prompt on a session with an unfinished turn.
			const { continueFrom: _pausedTurn, ...betweenTurns } = stored;
			const resumeFrom = options.dropPausedTurn ? betweenTurns : stored;
			session = await agent.createSession({
				resumeFrom: options.bridgeDead
					? { ...resumeFrom, data: withoutBridgeCoords(resumeFrom.data) }
					: resumeFrom,
				sandboxSession,
				sessionId: input.chatId,
			});
		}
		this.sessions.set(
			session.sessionId,
			this.liveSession(input, { agent, epoch, sandboxSession, session }),
		);
		return { sessionId: session.sessionId };
	}

	async *stream(
		session: HarnessSession,
		input: HarnessTurnInput,
	): AsyncIterable<HarnessStreamEvent> {
		const entry = this.requireSession(session.sessionId);
		let result: ClaudeCodeStreamResult;
		try {
			result = await this.startStream(entry, input);
		} catch (error) {
			// A kept bridge can die while it waits: it crashed, or another path
			// replaced it. The turn then resumes from the stored state once.
			if (entry.fallback === undefined) {
				throw error;
			}
			this.logger.warn(
				`builder-turn.kept-session-lost: ${error instanceof Error ? error.message : String(error)}`,
			);
			this.sessions.delete(session.sessionId);
			const { input: sessionInput, options, resumeState } = entry.fallback;
			const resumed = await this.resumeStored(
				sessionInput,
				resumeState,
				options,
			);
			result = await this.startStream(
				this.requireSession(resumed.sessionId),
				input,
			);
		}
		yield* this.streamEvents(result);
	}

	/** Sends the prompt or the continuation of one turn to the session. */
	private startStream(
		entry: LiveSession,
		input: HarnessTurnInput,
	): Promise<ClaudeCodeStreamResult> {
		return input.kind === "continue"
			? entry.agent.continueStream({
					abortSignal: input.signal,
					session: entry.session,
					toolApprovalContinuations: input.approvals.map(
						(approval): ToolApprovalResponse => ({
							approvalId: approval.approvalId,
							approved: approval.approved,
							type: "tool-approval-response",
						}),
					),
					toolResultContinuations: input.toolResults.map(toolResultPartOf),
				})
			: entry.agent.stream({
					abortSignal: input.signal,
					prompt: input.prompt,
					session: entry.session,
				});
	}

	async hasUnfinishedTurn(session: HarnessSession): Promise<boolean> {
		return this.requireSession(session.sessionId).session.hasUnfinishedTurn();
	}

	async detach(session: HarnessSession): Promise<HarnessResumeState> {
		const entry = this.requireSession(session.sessionId);
		this.sessions.delete(session.sessionId);
		const state = await entry.session.detach();
		const payload = JSON.stringify(state);
		// Only a finished turn is kept: a paused one continues through the
		// stored state, which carries its pending cards.
		if (this.keepAlive && state.continueFrom === undefined) {
			await this.keep(entry, state, payload);
		}
		// A detach in the middle of a turn keeps that turn in `continueFrom`.
		// Its cards must reach the row. The SDK refuses a new prompt on a
		// session with an unfinished turn. The next turn answers the cards.
		return {
			harness: this.kind,
			payload,
			pending: this.pendingOf(state.continueFrom),
		};
	}

	/**
	 * Attaches the detached session again in the background and keeps it for
	 * the next turn of the chat. The bridge serves one socket at a time, and a
	 * sandbox has one bridge, so a kept session of another chat on it goes.
	 */
	private async keep(
		entry: LiveSession,
		state: HarnessAgentResumeSessionState,
		payload: string,
	): Promise<void> {
		const { chatId } = entry;
		for (const [otherChatId, other] of this.kept) {
			if (otherChatId === chatId || other.sandboxId === entry.sandboxId) {
				await this.dropKept(otherChatId);
			}
		}
		const live = entry.agent
			.createSession({
				resumeFrom: state,
				sandboxSession: entry.sandboxSession,
				sessionId: chatId,
			})
			.then(
				(session): LiveSession => ({ ...entry, fallback: undefined, session }),
			)
			.catch((error: unknown) => {
				// The next turn resumes from the stored state instead.
				this.logger.warn(
					`builder-turn.keep-session-failed chatId=${chatId}: ${error instanceof Error ? error.message : String(error)}`,
				);
				return null;
			});
		this.kept.set(chatId, {
			idleSince: this.now(),
			live,
			payload,
			sandboxId: entry.sandboxId,
		});
	}

	/**
	 * The kept session of the chat when this turn may reuse it, else null.
	 * Reuse needs all of these:
	 * - the stored state that the last host turn wrote (no other path ran a turn since),
	 * - the same live sandbox,
	 * - the same tool approval rules,
	 * - the same turn mode,
	 * - the same token epoch,
	 * - no raw policy push at this turn start,
	 * - the same network policy hash as at the session start.
	 * A kept session that does not fit goes.
	 */
	private async takeKept(
		input: HarnessSessionInput,
		resumeState: HarnessResumeState,
		options: ResumeOptions,
	): Promise<LiveSession | null> {
		const kept = this.kept.get(input.chatId);
		if (kept === undefined) {
			return null;
		}
		this.kept.delete(input.chatId);
		const live = await kept.live;
		if (live === null) {
			return null;
		}
		const fits =
			!options.bridgeDead &&
			// A raw policy push deletes the run-token rule of the kept session, and
			// the proxy then answers 401. A stored-state resume adds it again. The
			// push can come from this turn start, or from a restore, a wake, or a
			// publish between the turns: then the policy hash differs.
			!input.sandbox.networkPolicyReplaced &&
			live.policyHash === input.sandbox.networkPolicyHash &&
			kept.payload === resumeState.payload &&
			live.sandboxId === input.sandbox.providerSandboxId &&
			live.epoch === this.tokenEpoch() &&
			live.toolApproval === JSON.stringify(input.hostTools.toolApproval) &&
			live.mode === input.mode &&
			!live.session.hasUnfinishedTurn();
		if (!fits) {
			await this.closeKept(input.chatId, live);
			return null;
		}
		return live;
	}

	/** Closes the kept session of the chat, if one exists. */
	private async dropKept(chatId: string): Promise<void> {
		const kept = this.kept.get(chatId);
		if (kept === undefined) {
			return;
		}
		this.kept.delete(chatId);
		const live = await kept.live;
		if (live !== null) {
			await this.closeKept(chatId, live);
		}
	}

	/**
	 * Closes the socket of a kept session. The bridge and its Claude Code
	 * process stay, so the stored state still attaches to them.
	 */
	private async closeKept(chatId: string, live: LiveSession): Promise<void> {
		try {
			await live.session.detach();
		} catch (error) {
			// A dead socket has nothing to close; the next resume handles it.
			this.logger.warn(
				`builder-turn.kept-session-close-failed chatId=${chatId}: ${error instanceof Error ? error.message : String(error)}`,
			);
		}
	}

	/** The live session record of a session that just started or resumed. */
	private liveSession(
		input: HarnessSessionInput,
		started: Pick<
			LiveSession,
			"agent" | "epoch" | "sandboxSession" | "session"
		>,
	): LiveSession {
		return {
			...started,
			chatId: input.chatId,
			mode: input.mode,
			policyHash: input.sandbox.networkPolicyHash,
			sandboxId: input.sandbox.providerSandboxId,
			toolApproval: JSON.stringify(input.hostTools.toolApproval),
		};
	}

	/** The `TOKEN_EPOCH_MS` bucket of now. */
	private tokenEpoch(): number {
		return Math.floor(this.now() / TOKEN_EPOCH_MS);
	}

	async suspendTurn(session: HarnessSession): Promise<HarnessResumeState> {
		const entry = this.requireSession(session.sessionId);
		const state = await entry.session.suspendTurn();
		this.sessions.delete(session.sessionId);
		return {
			harness: this.kind,
			payload: JSON.stringify(state),
			pending: this.pendingOf(state),
		};
	}

	/**
	 * The cards of an unfinished turn: one question card per pending
	 * `ask_user` or `askUserQuestions` call, one plan card per pending
	 * `present_plan` call, one approval card per pending host tool. Shared by
	 * `detach` and `suspendTurn`; an undefined state has no cards.
	 */
	private pendingOf(
		state: HarnessAgentContinueTurnState | undefined,
	): HarnessPendingInteraction[] {
		const pending: HarnessPendingInteraction[] = [];
		if (state === undefined) {
			return pending;
		}

		for (const result of state.pendingToolResults ?? []) {
			if (result.toolName === ASK_USER_TOOL_NAME) {
				// `input` is the JSON text of the tool call arguments. The model
				// wrote it, so the schema decides which questions are valid.
				const parsed = askUserHostToolInputSchema.safeParse(
					parseJsonText(result.input),
				);
				const questions = parsed.success
					? this.askUserQuestionsOf(parsed.data)
					: [];
				if (questions.length === 0) {
					this.logger.warn(
						`builder-turn.pending-cards: an ask_user call has no valid question, toolCallId=${result.toolCallId}`,
					);
				}
				pending.push({
					kind: "question",
					// The paused call still needs a tool result, or the next turn
					// drops the session. A free-text card with no text lets the
					// user type the answer; the reply above it gives the context.
					questions:
						questions.length > 0
							? questions
							: [
									{
										id: "question-0",
										kind: "free-text",
										options: [],
										question: "",
									},
								],
					tool: "ask_user",
					toolCallId: result.toolCallId,
				});
				continue;
			}
			if (result.toolName === PRESENT_PLAN_TOOL_NAME) {
				// The model wrote the JSON text, so the schema decides the plan.
				const parsed = presentPlanHostToolInputSchema.safeParse(
					parseJsonText(result.input),
				);
				if (!parsed.success) {
					this.logger.warn(
						`builder-turn.pending-cards: a present_plan call has no valid plan, toolCallId=${result.toolCallId}`,
					);
				}
				pending.push({
					kind: "plan",
					// The paused call still needs a tool result, or the next turn
					// drops the session. An empty card still takes the user's reply.
					plan: parsed.success
						? presentPlanOf(parsed.data)
						: { assumptions: [], sections: [], summary: "", title: "" },
					toolCallId: result.toolCallId,
				});
				continue;
			}
			// Only the question and plan tools pause for a user answer; a
			// client-side result of another tool is not a card the user sees.
			if (result.toolName !== ASK_USER_QUESTIONS_TOOL_NAME) {
				this.logger.warn(
					`builder-turn.pending-cards: skipped pending result for ${result.toolName}`,
				);
				continue;
			}
			// `input` is the JSON text of the tool call arguments; the parse
			// keeps a malformed argument out of the question cards.
			const toolInput = harnessV1QuestionsToolInputSchema.parse(
				JSON.parse(result.input),
			);
			pending.push({
				kind: "question",
				questions: toolInput.questions.map((question) => ({
					id: question.id,
					kind: question.allowMultiple ? "multi-select" : "single-choice",
					options: (question.options ?? []).map((option) => ({
						id: option.id,
						label: option.label,
					})),
					question: question.question,
				})),
				tool: "askUserQuestions",
				toolCallId: result.toolCallId,
			});
		}

		for (const approval of state.pendingToolApprovals ?? []) {
			pending.push({
				approvalId: approval.approvalId,
				input: approval.input,
				kind: "approval",
				toolCallId: approval.toolCallId,
				toolName: approval.toolName,
			});
		}
		return pending;
	}

	/**
	 * The questions of one `ask_user` call, cut to the card limits. A
	 * question without text drops. The ids are `question-N`, the ids the
	 * answers of the next turn name.
	 */
	private askUserQuestionsOf(
		input: AskUserHostToolInput,
	): QuestionInteraction["questions"] {
		return input.questions
			.slice(0, ASK_USER_MAX_QUESTIONS)
			.flatMap((question, index): QuestionInteraction["questions"] => {
				const text = cutText(question.question, ASK_USER_MAX_QUESTION_CHARS);
				if (text === undefined) {
					return [];
				}
				const seenIds = new Set<string>();
				const options = question.options
					.slice(0, ASK_USER_MAX_OPTIONS)
					.map((option, optionIndex) => {
						let id = option.id.trim().slice(0, ASK_USER_MAX_ID_CHARS);
						// The answer names the picked options by id, so an empty or
						// repeated id gets a position id that no other option holds.
						for (let n = 0; id === "" || seenIds.has(id); n++) {
							id =
								n === 0
									? `option-${optionIndex}`
									: `option-${optionIndex}-${n}`;
						}
						seenIds.add(id);
						const description = cutText(
							option.description,
							ASK_USER_MAX_NOTE_CHARS,
						);
						const worldId = cutText(option.worldId, ASK_USER_MAX_ID_CHARS);
						return {
							id,
							label: option.label.trim().slice(0, ASK_USER_MAX_LABEL_CHARS),
							...(description === undefined ? {} : { description }),
							...(worldId === undefined ? {} : { worldId }),
							...(option.recommended === true ? { recommended: true } : {}),
						};
					});
				const helper = cutText(question.helper, ASK_USER_MAX_NOTE_CHARS);
				const kind = resolveAskUserKind(question);
				return [
					{
						id: `question-${index}`,
						// A choice without options has nothing to pick; the user types.
						kind:
							options.length === 0 &&
							(kind === "single-choice" || kind === "multi-select")
								? "free-text"
								: kind,
						options,
						question: text,
						...(helper === undefined ? {} : { helper }),
						...(question.maxFiles === undefined
							? {}
							: {
									maxFiles: Math.min(
										ASK_USER_MAX_FILES,
										Math.max(1, question.maxFiles),
									),
								}),
					},
				];
			});
	}

	/**
	 * The chunk loop and the usage tail of `stream`, shared between a
	 * prompt turn and a continued turn. The browser part keeps the SDK's
	 * safe text; the error event carries the real message for the row.
	 */
	private async *streamEvents(
		result: ClaudeCodeStreamResult,
	): AsyncIterable<HarnessStreamEvent> {
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
				const message = lastErrorMessage ?? chunk.errorText;
				const status = API_ERROR_STATUS_PATTERN.exec(message)?.[1];
				yield {
					code: "harness_error",
					message,
					retryable: false,
					statusCode: status === undefined ? undefined : Number(status),
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

	/** `epoch` is the `TOKEN_EPOCH_MS` bucket the start env names. */
	private buildAgent(
		input: HarnessSessionInput,
		epoch: number,
	): ClaudeCodeAgentRunner {
		const baseUrl = input.env.ANTHROPIC_BASE_URL;
		const authToken = input.env.ANTHROPIC_AUTH_TOKEN;
		if (baseUrl === undefined || authToken === undefined) {
			throw new Error(
				"Harness env lacks ANTHROPIC_BASE_URL or ANTHROPIC_AUTH_TOKEN",
			);
		}
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
				// Other variables go through `env`. The traffic flag is always
				// on: deny-by-default egress would turn the telemetry and update
				// calls into noise. The env must not change between the turns of
				// an epoch, or the bridge fork starts a new Claude Code process.
				env: {
					// Empty: no `X-Wandit-Run` header. One process serves many turns,
					// so the proxy names the run of the turn the chat binds now.
					ANTHROPIC_CUSTOM_HEADERS: "",
					// 3.5 min, below TURN_STALL_MS (4 min) in builder-turn.runtime.ts.
					// A running Bash call sends no part, so a longer call stalls the turn.
					// LIMIT: one Bash call runs at most 3.5 min.
					// Upgrade: reset the stall timer on CLI tool_progress heartbeats, then raise this cap.
					BASH_MAX_TIMEOUT_MS: "210000",
					// The bridge fork keeps one Claude Code process between turns.
					// A background task or a cron prompt can end after the turn.
					// Then it starts a turn that no host reads. The next turn ends
					// on its result. Without background tasks, a Bash call stops at
					// its timeout.
					CLAUDE_CODE_DISABLE_BACKGROUND_TASKS: "1",
					CLAUDE_CODE_DISABLE_CRON: "1",
					CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: "1",
					// Claude Code 2.1.281 adds a `<total_tokens>` system message after
					// each user prompt. Through the LLM proxy and the gateway, each new
					// one changed the prompt prefix ahead of the chat history, so every
					// warm turn wrote the whole history to the cache again (Phase 1, item 4).
					CLAUDE_CODE_TOTAL_TOKENS_REMINDER: "off",
					WANDIT_TOKEN_EPOCH: String(epoch),
				},
				port: HARNESS_BRIDGE_PORT,
				startupTimeoutMs: BRIDGE_STARTUP_TIMEOUT_MS,
			}),
			instructions: input.instructions,
			model: input.model,
			// The model asks through the `ask_user` host tool only. It carries
			// the kinds and the world cards; the built-in question tool has none.
			// A build session has no subagents. The bridge drops subagent output,
			// so the stall watchdog sees a long subagent as a dead harness.
			inactiveTools:
				input.mode === "plan"
					? [ASK_USER_QUESTIONS_TOOL_NAME, ...PLAN_MODE_BLOCKED_TOOLS]
					: [ASK_USER_QUESTIONS_TOOL_NAME, "Agent", "Workflow"],
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

/**
 * Adapter state `data` without its `bridge` attach coordinates. The field
 * is internal to `@ai-sdk/harness-claude-code` (1.0.137 resume schema).
 * Without it the adapter spawns a new bridge and resumes the Claude
 * conversation by its id. With it, the adapter retries a dead socket first.
 */
function withoutBridgeCoords(
	data: HarnessAgentResumeSessionState["data"],
): HarnessAgentResumeSessionState["data"] {
	// `data` is the library's JSON union; only an object can hold `bridge`.
	if (data === null || typeof data !== "object" || !("bridge" in data)) {
		return data;
	}
	const { bridge: _deadBridge, ...rest } = data;
	return rest;
}

/**
 * The tool result that answers one paused call. The parse keeps a malformed
 * answer out of the resumed turn; a bad value throws here.
 */
function toolResultPartOf(result: HarnessQuestionResult): ToolResultPart {
	switch (result.tool) {
		case "ask_user":
			return {
				output: {
					type: "json",
					value: askUserHostToolOutputSchema.parse(result.output),
				},
				toolCallId: result.toolCallId,
				toolName: ASK_USER_TOOL_NAME,
				type: "tool-result",
			};
		case "present_plan":
			return {
				output: {
					type: "json",
					value: presentPlanHostToolOutputSchema.parse(result.output),
				},
				toolCallId: result.toolCallId,
				toolName: PRESENT_PLAN_TOOL_NAME,
				type: "tool-result",
			};
		case "askUserQuestions":
			return {
				output: {
					type: "json",
					value: harnessV1QuestionsToolOutputSchema.parse({
						action: result.partial ? "partially-answered" : "answered",
						answers: result.answers,
					}),
				},
				toolCallId: result.toolCallId,
				toolName: ASK_USER_QUESTIONS_TOOL_NAME,
				type: "tool-result",
			};
	}
}

/**
 * The plan of one `present_plan` call, cut to the card limits. A section
 * without a title or without items drops. An assumption has the item limit.
 */
function presentPlanOf(
	input: PresentPlanHostToolInput,
): PresentPlanHostToolInput {
	return {
		assumptions: cutItems(input.assumptions, PRESENT_PLAN_MAX_ASSUMPTIONS),
		sections: input.sections
			.flatMap((section) => {
				const title = cutText(
					section.title,
					PRESENT_PLAN_MAX_SECTION_TITLE_CHARS,
				);
				const items = cutItems(section.items, PRESENT_PLAN_MAX_ITEMS);
				return title === undefined || items.length === 0
					? []
					: [{ items, title }];
			})
			.slice(0, PRESENT_PLAN_MAX_SECTIONS),
		summary: cutText(input.summary, PRESENT_PLAN_MAX_SUMMARY_CHARS) ?? "",
		title: cutText(input.title, PRESENT_PLAN_MAX_TITLE_CHARS) ?? "",
	};
}

/** At most `max` texts, each cut to the item limit; an empty text drops. */
function cutItems(items: readonly string[], max: number): string[] {
	return items
		.flatMap((item) => {
			const cut = cutText(item, PRESENT_PLAN_MAX_ITEM_CHARS);
			return cut === undefined ? [] : [cut];
		})
		.slice(0, max);
}

/**
 * `text` trimmed and cut to `maxChars`, or undefined when it is absent or
 * empty. The `ask_user` and `present_plan` card fields go through it.
 */
function cutText(
	text: string | undefined,
	maxChars: number,
): string | undefined {
	const cut = text?.trim().slice(0, maxChars);
	return cut === undefined || cut === "" ? undefined : cut;
}

/**
 * The value of a JSON text, or undefined when the text is not JSON. The
 * schema parse after it then refuses the call; the paused turn does not fail.
 */
function parseJsonText(text: string): unknown {
	try {
		return JSON.parse(text);
	} catch {
		// A text that is not JSON is the same as a wrong shape: no card.
		return undefined;
	}
}
