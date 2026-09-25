/**
 * `runBuilderTurn`: the `builder-turn` task body (WANDIT-166).
 * `builder-turn.task.ts` calls it with real dependencies; the spec
 * drives it with fakes. One run: claim → fence → backend wake → sandbox →
 * harness → stream → commit → settle → promote.
 */
import { randomUUID } from "node:crypto";
import { posix } from "node:path";
import type {
	AskUserHostToolOutput,
	BillingPlanId,
	BuilderTurnStatus,
	HarnessPendingInteraction,
	SupabaseProjectStatus,
	TurnApprovalData,
	TurnAssistantMessageMetadata,
	TurnQuestionData,
	TurnStreamPhase,
	TurnThoughtData,
} from "@wandit/contracts";
import {
	builderTurnSpecSchema,
	harnessResumeEnvelopeSchema,
	supabaseProjectUrl,
} from "@wandit/contracts";
import { readUIMessageStream, type UIMessage, type UIMessageChunk } from "ai";
import { worldCardOf } from "../modules/ai-chat/agent/worlds";
import {
	captureAiError,
	classifyAiError,
	renderAiErrorSentence,
} from "../modules/ai-errors/domain";
import {
	LLM_PROXY_TOKEN_TTL_SECONDS,
	type LlmProxyTokenClaimsInput,
} from "../modules/app-builder/application/services/llm-proxy-token.service";
import { isProjectComingUp } from "../modules/app-builder/domain/backend-lifecycle";
import { llmModelPrice } from "../modules/app-builder/domain/llm-model-prices";
import type {
	BuilderHarness,
	HarnessQuestionResult,
	HarnessResumeState,
	HarnessSession,
	HarnessTurnInput,
} from "../modules/app-builder/domain/ports/builder-harness";
import type {
	HostToolRegistry,
	HostToolSet,
} from "../modules/app-builder/domain/ports/host-tools";
import type {
	SandboxHandle,
	SandboxProvider,
} from "../modules/app-builder/domain/ports/sandbox-provider";
import type {
	TurnEventWriter,
	TurnStreamEventInput,
} from "../modules/app-builder/domain/ports/turn-events";
import type { TurnLock } from "../modules/app-builder/domain/ports/turn-lock";
import {
	askUserOutputOf,
	builtinQuestionResultOf,
	fallbackPromptOf,
	uploadCopyPath,
} from "../modules/app-builder/domain/question-answers";
import {
	DEFAULT_PER_TURN_CAP_CREDITS,
	monthStartUtc,
} from "../modules/app-builder/domain/turn-caps";
import {
	assertCurrentTurn,
	StaleTurnError,
} from "../modules/app-builder/domain/turn-queue";
import type {
	CommitTurnDeps,
	CommitTurnInput,
	CommitTurnResult,
} from "../modules/app-builder/infrastructure/git/commit-turn";
import type {
	AppBackendRow,
	AppBackendsRepository,
} from "../modules/app-builder/infrastructure/persistence/app-backends.repository";
import type { BuilderSessionsRepository } from "../modules/app-builder/infrastructure/persistence/builder-sessions.repository";
import type {
	BuilderTurnFailure,
	BuilderTurnsRepository,
} from "../modules/app-builder/infrastructure/persistence/builder-turns.repository";
import type {
	LlmProxyRequestsRepository,
	LlmProxyTurnSum,
} from "../modules/app-builder/infrastructure/persistence/llm-proxy-requests.repository";
import type { ProjectCostCapsRepository } from "../modules/app-builder/infrastructure/persistence/project-cost-caps.repository";
import type { SandboxSessionsRepository } from "../modules/app-builder/infrastructure/persistence/sandbox-sessions.repository";
import type { TurnProjectRepository } from "../modules/app-builder/infrastructure/persistence/turn-project.repository";
import type { LlmSpendCounterStore } from "../modules/app-builder/infrastructure/redis/llm-spend-counters";
import { TURN_LOCK_TTL_MS } from "../modules/app-builder/infrastructure/redis/redis-turn-lock";
import { buildSandboxEnv } from "../modules/app-builder/infrastructure/sandbox/sandbox-env";
import type { SupabaseManagementClient } from "../modules/app-builder/infrastructure/supabase/supabase-management.client";
import type { MeteringSubject } from "../modules/credits/domain/credit-owner";
import {
	AGENT_SESSION_LEASE_TTL_MS,
	type MeteringService,
} from "../modules/metering/application/services/metering.service";
import { HARNESS_PRICE_TABLE_VERSION } from "../modules/metering/domain/harness-price-table";
import { usdMicrosToCentiCredits } from "../modules/metering/domain/model-pricing";

// 60 s: refreshes the lock, the vendor sandbox deadline, and activity.
const TURN_KEEPALIVE_MS = 60_000;
// 30 s of part silence triggers a heartbeat; the Trigger read dies at 60 s.
const STREAM_HEARTBEAT_MS = 30_000;
// 4 minutes without a part means a dead harness, not a slow one.
const TURN_STALL_MS = 4 * 60_000;
// About $0.25 = 7.8 credits per checkpoint; about 30 debits for an $8
// turn. The proxy token cap is the hard stop; the checkpoint only keeps
// the ledger close to the truth while the turn runs.
const CHECKPOINT_STEP_USD_MICROS = 250_000;
// The dev server command and port of the app template (D15).
const DEV_COMMAND = "pnpm run dev";
const DEV_PORT = 5173;
// 72 chars: the commit summary limit, same as the UI turn title.
const SUMMARY_MAX_CHARS = 72;
// 15 MB, the image upload limit. A bigger answer file is a video or an
// audio file, and a copy in public/ grows every commit of the app repo.
const ANSWER_FILE_MAX_BYTES = 15 * 1024 * 1024;
// 5 s between two status reads of a waking backend, like the provision poll.
const BACKEND_WAKE_POLL_MS = 5_000;
// LIMIT: the wake waits at most 180 s, then the turn runs without the
// database. Upgrade: hold the turn until the backend answers.
// The restore call and the last status read can each add about 60 s:
// the interactive client makes two tries of 30 s.
const BACKEND_WAKE_TIMEOUT_MS = 180_000;

/** Why the turn stopped on its own. */
type AbortCode =
	| "disabled"
	| "hold_lost"
	| "lock_lost"
	| "no_credits"
	| "project_cap"
	| "stale"
	| "stalled";

/** Terminal row status each stop code lands on; the other codes fail. */
const STOP_STATUS: Record<
	"disabled" | "no_credits" | "project_cap",
	BuilderTurnStatus
> = {
	disabled: "stopped_disabled",
	no_credits: "stopped_no_credits",
	project_cap: "stopped_project_cap",
};

/** The `Turn stopped: <reason>` text of each stop code. */
const STOP_REASON: Record<keyof typeof STOP_STATUS, string> = {
	disabled: "V2 builder disabled",
	no_credits: "no credits left",
	project_cap: "project credit cap reached",
};

/** `code` when it is a stop code, else null. */
const stopCodeOf = (code: AbortCode | null): keyof typeof STOP_STATUS | null =>
	code === "disabled" || code === "no_credits" || code === "project_cap"
		? code
		: null;

/**
 * The error a pre-start stop throws. The stream loop cannot carry it (the
 * sandbox is not running yet), so it travels the catch into `failTurn`.
 */
const stoppedTurnError = (code: keyof typeof STOP_STATUS) =>
	Object.assign(new Error(`Turn stopped: ${STOP_REASON[code]}`), {
		code: STOP_STATUS[code],
	});

/** The narrow log the runtime writes to; the task passes `logger`. */
export type BuilderTurnLogger = Pick<Console, "error" | "info" | "warn">;

/**
 * Fields of the `builder-turn.timing` log line: one per run that passes
 * the claim and the chat check, failures included. Every duration is in
 * ms from the worker clock; null means the step did not run. WANDIT-253
 * reads ten warm turns from it.
 */
export type BuilderTurnTiming = {
	turnId: string;
	runId: string;
	/** Row create → run start. Long for a `waiting` turn the promoter requeued. */
	queueMs: number;
	/** Run start → sandbox call: the row reads, the money checks, the token mint, and a backend wake. */
	prestartMs: number | null;
	/** `sandboxes.getOrCreate` plus the activity stamp. */
	sandboxMs: number | null;
	/** `woke` when the sandbox booted or resumed, `warm` when it already ran. */
	sandbox: "woke" | "warm" | null;
	hostToolsMs: number | null;
	/** The session resume or create, the fresh-session fallback included. */
	sessionMs: number | null;
	/** `resumed` when the stored session came back, `created` for a fresh one. */
	session: "resumed" | "created" | null;
	/** Stream start → first harness part. */
	firstPartMs: number | null;
	/** Run start → the first proxy request leaves the sandbox, from the rows. */
	firstModelCallMs: number | null;
	streamMs: number | null;
	/** Stream end → commit done: the pause check, the commit, the files event. */
	commitMs: number | null;
	/** Commit done → cleanup done: message row, usage, CAS, settle, done event. */
	settleMs: number | null;
	/** Run start → this line. */
	totalMs: number;
};

/** Parsed task payload plus the Trigger.dev run id. */
export type BuilderTurnInput = {
	turnId: string;
	projectId: string;
	/** The signed-in user who sent the turn. */
	actorUserId: string;
	/** Org workspace of the project, or null for a personal project. */
	organizationId: string | null;
	actorIsLimitExempt?: boolean;
	/** `ctx.run.id`; binds the row claim and the proxy token claims. */
	runId: string;
};

/** Every dependency of `runBuilderTurn`, one field each for spec fakes. */
export type BuilderTurnDeps = {
	/** Turn row CAS writes; a false answer means the row moved on. */
	turns: Pick<
		BuilderTurnsRepository,
		| "claimRunning"
		| "complete"
		| "currentTurnNumber"
		| "fail"
		| "findById"
		| "findWaitingForUser"
		| "recordUsage"
		| "transition"
	>;
	project: Pick<TurnProjectRepository, "findForTurn">;
	caps: Pick<ProjectCostCapsRepository, "findByProjectId">;
	/**
	 * The `app_backends` row: its URL and anon key enter the sandbox env when
	 * `active`. The wake moves a paused row back; the turn end stamps activity.
	 */
	backends: Pick<
		AppBackendsRepository,
		| "findByProjectId"
		| "markRestoreFailed"
		| "markRestored"
		| "markRestoring"
		| "touchActive"
	>;
	/**
	 * The interactive Management API client the task also gives the backend
	 * tools. The wake calls restore and reads the status. Null without
	 * `SUPABASE_PLATFORM_TOKEN` or `SUPABASE_PLATFORM_ORG_ID`.
	 */
	backendClient: Pick<
		SupabaseManagementClient,
		"getProject" | "restoreProject"
	> | null;
	sessions: Pick<BuilderSessionsRepository, "findByChatId" | "saveResumeState">;
	sandboxSessions: Pick<SandboxSessionsRepository, "touchActivity">;
	sandboxes: SandboxProvider;
	harness: BuilderHarness;
	writer: TurnEventWriter;
	lock: TurnLock;
	/** Redis run-spend counter and token revocation; the pulse tick reads it. */
	counters: Pick<LlmSpendCounterStore, "readRunSpend" | "revokeRun">;
	metering: Pick<
		MeteringService,
		| "acquireExecutionLease"
		| "checkpoint"
		| "findByIdempotencyKey"
		| "heartbeatExecutionLease"
		| "monthlySpendCredits"
		| "refund"
		| "settle"
	>;
	/**
	 * `llm_proxy_requests` reads: the sums are the turn's real spend and
	 * token counts; the first request time only feeds the timing line.
	 */
	proxyRows: Pick<
		LlmProxyRequestsRepository,
		"firstRequestStartedAtMs" | "sumByTurn"
	>;
	hostTools: HostToolRegistry;
	/** `mintLlmProxyToken` bound to the env; the spec passes a fake. */
	mintToken: (claims: LlmProxyTokenClaimsInput) => string;
	/** Subscription plan lookup; the task binds `SubscriptionsRepository`. */
	resolvePlan: (subject: MeteringSubject) => Promise<BillingPlanId>;
	/**
	 * The payer's settled balance in cc; the task binds
	 * `CreditsService.getSettledBalance(subjectPayer(subject)).settledBalance`.
	 * Reserve holds are added back, checkpoint debits are not (D5).
	 */
	readBalance: (subject: MeteringSubject) => Promise<number>;
	/**
	 * `product_settings.v2BuilderEnabled`; the task binds
	 * `ProductSettingsService.get`, which caches 30 s.
	 */
	readV2Enabled: () => Promise<boolean>;
	/** `GENERATION_BILLING_MODE === "off"`: no checkpoint, no settle, one `billing.off` log. */
	billingDisabled: boolean;
	/** `commitTurn` itself, so the spec asserts its input. */
	commit: (
		sandbox: SandboxHandle,
		deps: CommitTurnDeps,
		input: CommitTurnInput,
	) => Promise<CommitTurnResult>;
	/** `gitStore`, `appCommits`, `putPatch` the task builds once. */
	commitDeps: CommitTurnDeps;
	/**
	 * The bytes of one Wandit upload URL, or null when the URL names no
	 * upload object. The task binds `publicAssetKeyFromUrl` + `getObjectBytes`.
	 */
	readUpload: (url: string) => Promise<Uint8Array | null>;
	/** `ChatsRepository.insertTurnAssistantMessage` bound to the repo. */
	insertAssistantMessage: (input: {
		chatId: string;
		id: string;
		metadata: TurnAssistantMessageMetadata;
		parts: UIMessage["parts"];
		turnId: string;
	}) => Promise<void>;
	/** `TurnPromoter.promoteNext` bound to the task's promoter. */
	promoteNext: (projectId: string, endedTurnId: string) => Promise<void>;
	/** `<API origin>/api/v2/llm`; becomes `ANTHROPIC_BASE_URL` in the VM. */
	proxyBaseUrl: string;
	/** Micros per whole credit (32,000 = $0.032) from `AI_USD_PER_CREDIT`. */
	usdMicrosPerCredit: number;
	/** `env.V2_DEFAULT_MODEL`; null fails the turn `model_missing`. */
	model: string | null;
	/** ms clock; the task passes `Date.now`, fake timers replace it. */
	now: () => number;
	/** Log sink; the task passes the Trigger `logger`. */
	logger: BuilderTurnLogger;
};

/**
 * Cancel finalizers keyed by run id; the task's `onCancel` calls them
 * after the run's own grace window. Memoized inside the run, so the
 * aborted-catch and the hook can never settle the same turn twice.
 */
const builderTurnCancelFinalizers = new Map<string, () => Promise<void>>();

/** The cancel finalizer one run registered, or undefined. */
export function builderTurnCancelFinalizer(
	runId: string,
): (() => Promise<void>) | undefined {
	return builderTurnCancelFinalizers.get(runId);
}

/**
 * One builder turn inside its Trigger.dev run. `signal` is the run's
 * abort signal: a dashboard cancel or a `turns.service` cancel aborts it.
 * Handled failures never throw: the terminal row write, the events, and
 * the cleanup always run.
 */
export async function runBuilderTurn(
	deps: BuilderTurnDeps,
	input: BuilderTurnInput,
	signal: AbortSignal,
): Promise<void> {
	const runStartedAt = deps.now();
	const logger = deps.logger;
	const { projectId, runId, turnId } = input;
	// The hold's lease column is a uuid; the Trigger run id (`run_…`) is not
	// one, and Postgres rejects it. One token per run: the heartbeat matches
	// only this run's lease.
	const leaseToken = randomUUID();
	const subject: MeteringSubject = {
		actorUserId: input.actorUserId,
		...(input.actorIsLimitExempt === undefined
			? {}
			: { actorIsLimitExempt: input.actorIsLimitExempt }),
		organizationId: input.organizationId,
	};

	// Another run holds the turn, or the row left `queued` already.
	const claimed = await deps.turns.claimRunning(turnId, runId);
	if (!claimed) {
		logger.info(`Builder turn ${turnId} not claimed by run ${runId}`);
		return;
	}

	const turn = await deps.turns.findById(turnId);
	if (turn === null) {
		logger.warn(`Builder turn ${turnId} claimed but the row vanished`);
		return;
	}
	const chatId = turn.chatId;

	/** The `builder-turn:<turnId>` hold row, or null on lookup failure. */
	const findHold = async () => {
		try {
			return await deps.metering.findByIdempotencyKey(
				`builder-turn:${turnId}`,
				subject,
			);
		} catch (error) {
			logger.warn(
				`Metering hold lookup failed for turn ${turnId}: ${messageOf(error)}`,
			);
			return null;
		}
	};

	/**
	 * Refunds the still-reserved hold with `reason`; a settled or missing
	 * hold is logged and kept.
	 */
	const refundHold = async (
		reason: "builder_turn_failed" | "builder_turn_canceled",
	) => {
		const event = await findHold();
		if (event === null) {
			logger.warn(`No metering hold found for turn ${turnId}; skip refund`);
			return;
		}
		if (event.status !== "reserved") {
			logger.info(
				`Metering hold for turn ${turnId} is ${event.status}; skip refund`,
			);
			return;
		}
		await deps.metering.refund(event.id, reason);
	};

	/**
	 * Row spend in cc. The 1 cc floor of `usdMicrosToCentiCredits` prices
	 * work that ran; a turn that never reached the proxy pays nothing.
	 */
	const creditsFromRows = (rows: LlmProxyTurnSum): number =>
		rows.usdMicros === 0
			? 0
			: usdMicrosToCentiCredits(rows.usdMicros, deps.usdMicrosPerCredit);

	/**
	 * Settles the hold at the `llm_proxy_requests` sum (D3 direct pricing:
	 * the proxy rows are the spend truth, not the harness usage report).
	 * A zero-spend turn with no checkpoints refunds the hold instead of
	 * paying the 1 cc floor. Answers the row sums and the settled credits
	 * for the receipt and `recordUsage`; null when the hold is missing or
	 * already terminal. With billing off it skips the settle and still
	 * answers the sums.
	 */
	const settleHoldFromRows = async (
		modelId: string,
		rows: LlmProxyTurnSum,
	): Promise<{ credits: number; rows: LlmProxyTurnSum } | null> => {
		const credits = creditsFromRows(rows);
		if (deps.billingDisabled) {
			if (!billingOffLogged) {
				billingOffLogged = true;
				logger.info("billing.off", { turnId });
			}
			return { credits, rows };
		}
		const hold = await findHold();
		if (hold === null) {
			logger.warn(`No metering hold found for turn ${turnId}; skip settle`);
			return null;
		}
		if (hold.status !== "reserved") {
			logger.info(
				`Metering hold for turn ${turnId} is ${hold.status}; skip settle`,
			);
			return null;
		}
		if (rows.usdMicros === 0 && checkpointCount === 0) {
			// Nothing ran and nothing was debited: the hold goes back in
			// full, not a 1 cc settle on an empty turn.
			await refundHold("builder_turn_failed");
			return { credits, rows };
		}
		await deps.metering.settle(hold.id, {
			costUsdMicros: rows.usdMicros,
			finalCredits: credits,
			model: modelId,
			pricing: "direct",
			pricingSnapshot: {
				checkpoints: checkpointCount,
				modelId,
				source: "llm_proxy_rows",
				table: HARNESS_PRICE_TABLE_VERSION,
				usdMicrosPerCredit: deps.usdMicrosPerCredit,
			},
			provider: llmModelPrice(modelId)?.provider ?? null,
			rawUsage: rows.byModel,
			usage: {
				cacheReadTokens: rows.cacheReadTokens,
				cacheWriteTokens: rows.cacheWriteTokens,
				inputTokens: rows.inputTokens,
				outputTokens: rows.outputTokens,
			},
		});
		return { credits, rows };
	};

	/**
	 * One cleanup step that logs and continues. The row is already
	 * terminal when this runs, so a failed step must not throw the run
	 * into the failure path a second time.
	 */
	const cleanupStep = async (fn: () => Promise<void>) => {
		try {
			await fn();
		} catch (error) {
			logger.warn(`Cleanup failed for turn ${turnId}: ${messageOf(error)}`);
		}
	};

	if (chatId === null) {
		// `chat_id` survives a deleted chat; an orphaned turn cannot run.
		await deps.turns.fail(turnId, {
			error: "The turn has no chat",
			failureCode: "chat_missing",
			failureKind: null,
			failureProvider: null,
			failureProviderMessage: null,
			failureRequestId: null,
			failureSource: null,
			sentryEventId: null,
		});
		// The API reserved the hold at create; nothing ran, so it goes back.
		await cleanupStep(() => refundHold("builder_turn_failed"));
		// The API relay needs a terminal event, or the browser waits forever.
		await deps.writer.write(turnId, {
			data: {
				code: "chat_missing",
				message: "The turn has no chat",
				retryable: false,
			},
			type: "error",
		});
		await deps.writer.write(turnId, {
			data: { status: "failed" },
			type: "done",
		});
		// The API holds the lock under this turn id: the claim still frees
		// the slot and lets the next waiting turn go.
		await deps.lock.release(projectId, turnId);
		await deps.promoteNext(projectId, turnId);
		return;
	}
	// The project's row that waits on a question or approval card, or null.
	// This turn carries the answer, so the row now counts as succeeded. Its
	// usage, commit, and completedAt are already set from the pause.
	const waitingTurn = await deps.turns.findWaitingForUser(projectId);
	if (waitingTurn !== null) {
		const moved = await deps.turns.transition(
			waitingTurn.id,
			["waiting_for_answer", "waiting_for_approval"],
			"succeeded",
		);
		if (!moved) {
			logger.warn(`Waiting turn ${waitingTurn.id} write lost: row moved on`);
		}
	}

	const turnNumber = turn.turnNumber;
	// The commit trailer and the assistant row share one id (step 3).
	const assistantMessageId = randomUUID();

	// turnNumber only grows per project; a stale write carries less.
	const fenced = async <T>(fn: () => Promise<T>): Promise<T> => {
		assertCurrentTurn(
			await deps.turns.currentTurnNumber(projectId),
			turnNumber,
		);
		return fn();
	};

	const ownAbort = new AbortController();
	let abortCode: AbortCode | null = null;
	const abortTurn = (code: AbortCode) => {
		if (abortCode === null) {
			abortCode = code;
			ownAbort.abort();
		}
	};
	// The task signal aborts on a user cancel or a dashboard cancel.
	const onTaskAbort = () => ownAbort.abort();
	signal.addEventListener("abort", onTaskAbort, { once: true });

	let sandbox: SandboxHandle | null = null;
	let session: HarnessSession | null = null;
	/** Set by `suspendTurn` after a paused stream; the failure path saves it. */
	let suspendState: HarnessResumeState | null = null;
	let hostTools: HostToolSet | null = null;
	let lastPartAt = deps.now();
	let keepAliveTimer: ReturnType<typeof setInterval> | null = null;
	let pulseTimer: ReturnType<typeof setInterval> | null = null;
	// Harness-reported token totals; a log line only, never money (D3: the
	// `llm_proxy_requests` rows are the spend truth).
	const usage = {
		cacheReadTokens: 0,
		cacheWriteTokens: 0,
		inputTokens: 0,
		outputTokens: 0,
	};
	/** The model the turn runs on: the row's pick or the env default. */
	let resolvedModel: string | null = deps.model;
	/** The `builder-turn:<turnId>` hold id; loaded once before the session. */
	let holdId: string | null = null;
	/** Checkpoints landed on the hold; the next debit is `checkpointCount + 1`. */
	let checkpointCount = 0;
	/** Run spend in USD micros at the last landed checkpoint. */
	let lastCheckpointUsdMicros = 0;
	/** Per-turn spend cap in cc; the caps row or the plan default. */
	let perTurnCapCredits = DEFAULT_PER_TURN_CAP_CREDITS;
	/** Monthly project spend cap in cc, or null for no monthly check. */
	let monthlyCapCredits: number | null = null;
	/** The project's month spend in cc, read once before the sandbox starts. */
	let monthlySpendAtStart = 0;
	/** Set when `billing.off` was logged; keeps it to once per turn. */
	let billingOffLogged = false;
	/** `deps.now()` stamps of the run steps for the timing line; absent until the step ran. */
	const stamps: Partial<
		Record<
			| "sandboxStart"
			| "sandboxEnd"
			| "hostToolsEnd"
			| "sessionEnd"
			| "streamStart"
			| "firstPart"
			| "streamEnd"
			| "commitEnd"
			| "settleEnd",
			number
		>
	> = {};
	/** Set by the sandbox `onWake` callback: the sandbox really booted. */
	let sandboxWoke = false;
	/** How the harness session started; null until it did. */
	let sessionStart: BuilderTurnTiming["session"] = null;

	/** Best-effort resume save for the failure paths: the suspend state, else a detach. */
	const detachSession = async () => {
		if (session === null) {
			return;
		}
		try {
			// A suspended session is already gone from the harness map; its
			// pending cards must reach the row, so the saved state is the suspend one.
			const resumeState = suspendState ?? (await deps.harness.detach(session));
			await deps.sessions.saveResumeState(chatId, {
				model: resolvedModel,
				providerSessionId: session.sessionId,
				resumeState,
			});
		} catch (error) {
			logger.warn(`Detach failed for turn ${turnId}: ${messageOf(error)}`);
		}
	};

	/** The cleanup tail every terminal path shares. */
	const finishTurn = async () => {
		// The run token must die with the turn.
		await cleanupStep(async () => {
			await deps.counters.revokeRun(runId, LLM_PROXY_TOKEN_TTL_SECONDS);
		});
		await cleanupStep(async () => {
			await deps.lock.release(projectId, turnId);
		});
		await cleanupStep(async () => {
			await deps.promoteNext(projectId, turnId);
		});
		await cleanupStep(async () => {
			await deps.sandboxSessions.touchActivity(projectId);
		});
		// A turn is backend use, a failed turn too: the pause sweep reads the
		// stamp. The stamp is a hint, so a failure only logs.
		try {
			await deps.backends.touchActive(projectId);
		} catch (error) {
			logger.warn("backend.touch-failed", {
				message: messageOf(error),
				projectId,
			});
		}
	};

	// Memoized so the aborted-catch and the task onCancel share it.
	let finalizePromise: Promise<void> | null = null;
	const finalizeCanceled = (): Promise<void> => {
		finalizePromise ??= (async () => {
			// The wip commit keeps the agent's file work. No Trigger wait may
			// sit between an attach and a detach on a cancel.
			if (sandbox !== null) {
				try {
					await deps.commit(sandbox, deps.commitDeps, {
						chatId,
						messageId: assistantMessageId,
						organizationId: input.organizationId,
						projectId,
						source: "wip",
						summary: "Interrupted",
						turnId,
						userId: input.actorUserId,
					});
				} catch (error) {
					logger.warn(
						`Wip commit failed for turn ${turnId}: ${messageOf(error)}`,
					);
				}
			}
			await detachSession();
			await deps.writer.write(turnId, {
				data: { status: "canceled" },
				type: "done",
			});
			const moved = await deps.turns.transition(
				turnId,
				["cancelling", "running"],
				"canceled",
			);
			if (!moved) {
				logger.warn(`Cancel write lost for turn ${turnId}: row moved on`);
			} else {
				// The CAS winner refunds. The API cancel (turns.service.ts) refunds
				// only when its own `cancelling -> canceled` CAS wins.
				await cleanupStep(() => refundHold("builder_turn_canceled"));
			}
			await finishTurn();
		})();
		return finalizePromise;
	};
	builderTurnCancelFinalizers.set(runId, finalizeCanceled);

	/** Writes one stream event under the turn-number fence. */
	const writeEvent = (event: TurnStreamEventInput) =>
		fenced(() => deps.writer.write(turnId, event));
	const writeStatus = (phase: TurnStreamPhase, message?: string) =>
		writeEvent({
			data: message === undefined ? { phase } : { message, phase },
			type: "status",
		});

	/** One terminal failure: row, the wip commit of a stop, error+done events, refund or settle, cleanup. */
	const failTurn = async (
		error: unknown,
		failureCode: string | null,
	): Promise<void> => {
		const stopCode = stopCodeOf(abortCode);
		const normalized =
			classifyAiError(error, {
				abortSignal: signal,
				model: resolvedModel ?? undefined,
				route: "none",
				surface: "chat",
			}) ??
			classifyAiError(new Error("Builder turn failed"), {
				model: resolvedModel ?? undefined,
				route: "none",
				surface: "chat",
			});
		if (normalized === null) {
			throw new Error("Builder turn classification returned no result");
		}
		// Sentry is optional in dev; the worker log must still say why.
		logger.error("builder-turn.failed", {
			failureCode,
			kind: normalized.kind,
			message: messageOf(error),
			stack: error instanceof Error ? error.stack : undefined,
			turnId,
		});
		normalized.sentryEventId = captureAiError(error, normalized, {
			chatId,
			harness: deps.harness.kind,
			projectId,
			route: "none",
			sandboxId: sandbox?.providerSandboxId,
			surface: "chat",
			turnId,
			userId: input.actorUserId,
		});
		// The page path writes the same columns via
		// `pageFailurePersistenceValues`. Its key type is page-specific, so
		// the mapping stays inline here.
		const failure: BuilderTurnFailure = {
			error:
				stopCode === null
					? renderAiErrorSentence(normalized)
					: `Turn stopped: ${STOP_REASON[stopCode]}`,
			failureCode: stopCode === null ? failureCode : STOP_STATUS[stopCode],
			failureKind: normalized.kind,
			failureProvider: normalized.provider,
			failureProviderMessage: normalized.providerMessage,
			failureRequestId: normalized.requestId,
			failureSource: normalized.source,
			sentryEventId: normalized.sentryEventId,
		};
		// `stalled` and the stop codes are their own terminal status;
		// `fail` would write `failed`.
		const terminalStatus =
			abortCode === "stalled"
				? "stalled"
				: stopCode === null
					? null
					: STOP_STATUS[stopCode];
		const failed =
			terminalStatus === null
				? await deps.turns.fail(turnId, failure)
				: await deps.turns.transition(
						turnId,
						["running", "cancelling"],
						terminalStatus,
						{ completedAt: new Date(), ...failure },
					);
		if (!failed) {
			// A false CAS means the row went terminal under us (a cancel won).
			logger.warn(`Fail write lost for turn ${turnId}: row moved on`);
		}
		// D3: a stopped turn keeps its file work. The commit lands before the
		// `done` event: the web refetches the project at the stream end and
		// must see the change (`hasCodeChanges`).
		if (stopCode !== null && sandbox !== null) {
			try {
				await deps.commit(sandbox, deps.commitDeps, {
					chatId,
					messageId: assistantMessageId,
					organizationId: input.organizationId,
					projectId,
					source: "wip",
					summary: "Stopped",
					turnId,
					userId: input.actorUserId,
				});
			} catch (commitError) {
				logger.warn(
					`Wip commit failed for turn ${turnId}: ${messageOf(commitError)}`,
				);
			}
		}
		await deps.writer.write(turnId, {
			data: {
				code:
					stopCode === null
						? (failureCode ?? normalized.kind)
						: STOP_STATUS[stopCode],
				message: failure.error,
				retryable: stopCode === null ? normalized.retryable : false,
			},
			type: "error",
		});
		await deps.writer.write(turnId, {
			data: { status: terminalStatus ?? "failed" },
			type: "done",
		});
		if (stopCode === null) {
			await cleanupStep(() => refundHold("builder_turn_failed"));
			await detachSession();
		} else {
			// D3: a stopped turn settles the real spend; the hold is not
			// refunded. The wip commit ran above, before the `done` event.
			await detachSession();
			await cleanupStep(async () => {
				const rows = await deps.proxyRows.sumByTurn(turnId);
				// A stop code lands only after the `model === null` check, so
				// `resolvedModel` is set; `recordUsage` still writes when it is not.
				if (resolvedModel !== null) {
					await settleHoldFromRows(resolvedModel, rows);
				}
				await deps.turns.recordUsage(turnId, {
					cacheReadTokens: rows.cacheReadTokens,
					cacheWriteTokens: rows.cacheWriteTokens,
					credits: creditsFromRows(rows),
					harness: deps.harness.kind,
					inputTokens: rows.inputTokens,
					model: resolvedModel,
					outputTokens: rows.outputTokens,
				});
			});
		}
		await finishTurn();
	};

	/** Timer bodies must never reject unhandled; a stale write ends the turn. */
	const guardTick = (tick: () => Promise<void>) => {
		void tick().catch((error: unknown) => {
			if (error instanceof StaleTurnError) {
				abortTurn("stale");
				return;
			}
			logger.warn(`Turn ${turnId} timer failed: ${messageOf(error)}`);
		});
	};

	const startTimers = (model: string) => {
		lastPartAt = deps.now();
		keepAliveTimer = setInterval(() => {
			guardTick(async () => {
				// A false answer means another turn id holds the lock now.
				const refreshed = await deps.lock.refresh(
					projectId,
					turnId,
					TURN_LOCK_TTL_MS,
				);
				if (!refreshed) {
					abortTurn("lock_lost");
					return;
				}
				// The vendor timeout is absolute (30 min), not idle.
				await sandbox?.keepAlive();
				// The idle sweep must not stop a live turn.
				await deps.sandboxSessions.touchActivity(projectId);
			});
		}, TURN_KEEPALIVE_MS);
		pulseTimer = setInterval(() => {
			guardTick(async () => {
				const silenceMs = deps.now() - lastPartAt;
				if (silenceMs >= TURN_STALL_MS) {
					abortTurn("stalled");
					return;
				}
				if (silenceMs >= STREAM_HEARTBEAT_MS) {
					// A long tool call is quiet; the heartbeat keeps the read open.
					await writeStatus("running", "Working");
				}
				if (!deps.billingDisabled) {
					// The heartbeat keeps the sweep off the hold. "lost" means
					// no lease under this run: the start acquire failed, or the
					// hold left `reserved`. A fresh acquire tells which; a null
					// answer means the hold is gone, and the turn must not run
					// without one.
					if (holdId !== null) {
						const lease = await deps.metering.heartbeatExecutionLease(
							holdId,
							leaseToken,
							AGENT_SESSION_LEASE_TTL_MS,
						);
						if (lease === "lost") {
							const leased = await deps.metering.acquireExecutionLease(
								holdId,
								leaseToken,
								AGENT_SESSION_LEASE_TTL_MS,
							);
							if (leased === null) {
								abortTurn("hold_lost");
								return;
							}
						}
					}
					// Redis holds a string counter; the store parses it. A
					// corrupt key parses to NaN, which reads as zero spend.
					const rawSpend = await deps.counters.readRunSpend(runId);
					if (!Number.isFinite(rawSpend)) {
						logger.warn("builder-turn.spend-counter-invalid", {
							runId,
							turnId,
						});
					}
					const spent = Number.isFinite(rawSpend)
						? Math.max(0, Math.trunc(rawSpend))
						: 0;
					// The fresh spend in cc; both cap rules read the same number.
					const spentNowCredits = usdMicrosToCentiCredits(
						spent,
						deps.usdMicrosPerCredit,
					);
					// Only the debit needs the hold; a null `holdId` must not
					// disable the stop rules below.
					if (
						holdId !== null &&
						spent - lastCheckpointUsdMicros >= CHECKPOINT_STEP_USD_MICROS
					) {
						const nextN = checkpointCount + 1;
						try {
							const { debitedCredits } = await deps.metering.checkpoint(
								holdId,
								{
									costUsdMicrosSoFar: spent,
									modelId: model,
									n: nextN,
								},
							);
							// Only after the debit lands: a failed checkpoint retries n.
							checkpointCount = nextN;
							lastCheckpointUsdMicros = spent;
							logger.info("builder-turn.checkpoint", {
								credits: debitedCredits,
								n: checkpointCount,
								turnId,
							});
							const rows = await deps.proxyRows.sumByTurn(turnId);
							await writeEvent({
								data: {
									cacheReadTokens: rows.cacheReadTokens,
									cacheWriteTokens: rows.cacheWriteTokens,
									credits: spentNowCredits,
									inputTokens: rows.inputTokens,
									outputTokens: rows.outputTokens,
								},
								type: "usage",
							});
						} catch (error) {
							// A stale write still ends the turn. Any other
							// failure only logs: the debit may already be landed
							// (then `n` moved), the stop rules run, and the next
							// tick retries or continues.
							if (error instanceof StaleTurnError) {
								throw error;
							}
							logger.warn("builder-turn.checkpoint-failed", {
								message: messageOf(error),
								n: nextN,
								turnId,
							});
						}
					}
					const balance = await deps.readBalance(subject);
					// Checkpoint debits are not added back, so the balance
					// falls as they land; at zero the payer is out (D5).
					if (balance <= 0) {
						abortTurn("no_credits");
						return;
					}
					if (spentNowCredits >= perTurnCapCredits) {
						abortTurn("project_cap");
						return;
					}
					if (
						monthlyCapCredits !== null &&
						monthlySpendAtStart + spentNowCredits >= monthlyCapCredits
					) {
						abortTurn("project_cap");
						return;
					}
				}
				// The admin kill switch applies every tick, billing or not.
				if (!(await deps.readV2Enabled())) {
					abortTurn("disabled");
				}
			});
		}, STREAM_HEARTBEAT_MS);
	};

	// The stream read end; `readUIMessageStream` rebuilds the assistant
	// parts from the harness chunks the loop feeds it.
	const chunkStream = new TransformStream<UIMessageChunk, UIMessageChunk>();
	const chunkWriter = chunkStream.writable.getWriter();
	let chunkStreamClosed = false;
	const assistantMessage: Promise<UIMessage | null> = (async () => {
		try {
			let last: UIMessage | null = null;
			for await (const message of readUIMessageStream<UIMessage>({
				stream: chunkStream.readable,
			})) {
				last = message;
			}
			return last;
		} catch {
			// A dead stream still ends the turn; the row gets empty parts.
			return null;
		}
	})();

	try {
		const spec = builderTurnSpecSchema.parse(turn.spec);

		const project = await deps.project.findForTurn(projectId);
		if (project === null) {
			throw Object.assign(new Error("Project row missing"), {
				code: "project_missing",
			});
		}
		if (project.engine !== "v2_app") {
			throw Object.assign(new Error("Project is not a V2 app"), {
				code: "project_not_v2",
			});
		}
		if (project.framework === null || project.templateVersion === null) {
			throw Object.assign(new Error("Project template fields missing"), {
				code: "project_template_missing",
			});
		}
		const model = turn.model ?? deps.model;
		if (model === null) {
			// Checked before the sandbox starts: no model, no spend. When
			// `turn.model` is set, a null `V2_DEFAULT_MODEL` is allowed.
			throw Object.assign(new Error("V2_DEFAULT_MODEL is not set"), {
				code: "model_missing",
			});
		}
		resolvedModel = model;

		const sessionRow = await deps.sessions.findByChatId(chatId);
		// jsonb returns unknown; the envelope schema is the boundary.
		const storedResume = sessionRow?.resumeState ?? null;
		const parsedResume =
			storedResume === null
				? null
				: harnessResumeEnvelopeSchema.safeParse(storedResume);
		if (parsedResume !== null && !parsedResume.success) {
			logger.warn(
				`Stored resume state for chat ${chatId} failed the schema; starting cold`,
			);
		}
		const resumeState: HarnessResumeState | null =
			parsedResume?.success === true ? parsedResume.data : null;

		// The user's words, or the attachment URLs when the message is empty.
		// Answer files count as attachments here too.
		const sentFiles = [
			...spec.attachments,
			...spec.answers.flatMap((answer) => answer.files),
		];
		const prompt =
			spec.message.trim().length > 0
				? spec.message
				: sentFiles.length > 0
					? `See the attached files.\n${sentFiles
							.map((attachment) => attachment.url)
							.join("\n")}`
					: // An approval or answers alone have no text: the cards carry them.
						"Continue.";
		// The pending cards of a suspended turn make a `continue` input.
		// `spec.answers`, the message text, and `spec.approval` carry the
		// answers.
		let continuation: Extract<HarnessTurnInput, { kind: "continue" }> | null =
			null;
		// The prompt a fresh session gets when the suspended one cannot
		// resume: the answers still reach the agent. Set after the answer
		// files are in the sandbox, so it can name their paths.
		let continuationFallbackPrompt: string | null = null;
		if (resumeState !== null && resumeState.pending.length > 0) {
			const text = prompt.trim();
			const toolResults: HarnessQuestionResult[] = [];
			const approvals: { approvalId: string; approved: boolean }[] = [];
			for (const interaction of resumeState.pending) {
				if (
					interaction.kind === "question" &&
					interaction.tool === "ask_user"
				) {
					toolResults.push({
						output: askUserOutputOf(interaction, spec.answers, {
							attachments: spec.attachments,
							message: spec.message,
						}),
						tool: "ask_user",
						toolCallId: interaction.toolCallId,
					});
				} else if (interaction.kind === "question") {
					// A chat paused on the built-in tool before `ask_user` existed:
					// the tray answers each card, a plain message the first one.
					const result = builtinQuestionResultOf(
						interaction,
						spec.answers,
						text,
					);
					if (result !== null) {
						toolResults.push(result);
					}
				} else {
					// An approval the body does not name counts as denied.
					const approved =
						spec.approval?.approvalId === interaction.approvalId
							? spec.approval.approved
							: false;
					approvals.push({
						approvalId: interaction.approvalId,
						approved,
					});
				}
			}
			continuation = {
				approvals,
				kind: "continue",
				signal: ownAbort.signal,
				toolResults,
			};
		}

		const caps = await deps.caps.findByProjectId(projectId);
		perTurnCapCredits = caps?.perTurnCapCredits ?? DEFAULT_PER_TURN_CAP_CREDITS;
		monthlyCapCredits = caps?.monthlyCapCredits ?? null;
		// Centi-credits → dollars: /100 to credits, ×usdPerCredit to dollars.
		const usdPerCredit = deps.usdMicrosPerCredit / 1_000_000;
		const capUsd = (perTurnCapCredits / 100) * usdPerCredit;
		const plan = await deps.resolvePlan(subject);
		// The hold is loaded once: the pulse tick checkpoints against it.
		const hold = await findHold();
		holdId = hold?.id ?? null;
		// The stranded-hold sweep refunds a hold that waited too long in the
		// queue. A turn without a hold would run for free, so it fails here.
		if (hold?.status === "refunded" && !deps.billingDisabled) {
			// The catch at the end reads `code` into the row's failure code.
			throw Object.assign(
				new Error(
					`The credit hold of turn ${turnId} was refunded while it waited`,
				),
				{ code: "hold_refunded" },
			);
		}
		// The lease marks the hold as live, so the sweep skips it during the
		// run. The pulse renews it; a miss only logs, the sweep window is long.
		if (hold !== null && !deps.billingDisabled) {
			try {
				const leased = await deps.metering.acquireExecutionLease(
					hold.id,
					leaseToken,
					AGENT_SESSION_LEASE_TTL_MS,
				);
				if (leased === null) {
					logger.warn("builder-turn.lease-missed", { holdId: hold.id, turnId });
				}
			} catch (error) {
				logger.warn("builder-turn.lease-failed", {
					holdId: hold.id,
					message: messageOf(error),
					turnId,
				});
			}
		}
		// LIMIT: the month sum is read once per turn; another turn's spend
		// in the same month is not re-read. Upgrade: re-read on each tick.
		if (monthlyCapCredits !== null && !deps.billingDisabled) {
			// The sum holds this turn's own reserve; the real spend replaces
			// it on every tick, so the reserve must not count twice. A
			// terminal hold already counts at its final credits in the sum.
			monthlySpendAtStart =
				(await deps.metering.monthlySpendCredits(
					projectId,
					monthStartUtc(new Date(deps.now())),
				)) - (hold?.status === "reserved" ? hold.reservedCredits : 0);
		}
		// A stop before the sandbox starts cannot ride the stream loop:
		// the throw reaches `failTurn` through the catch.
		if (!(await deps.readV2Enabled())) {
			abortTurn("disabled");
			throw stoppedTurnError("disabled");
		}
		if (!deps.billingDisabled) {
			if ((await deps.readBalance(subject)) <= 0) {
				abortTurn("no_credits");
				throw stoppedTurnError("no_credits");
			}
			if (
				monthlyCapCredits !== null &&
				monthlySpendAtStart >= monthlyCapCredits
			) {
				abortTurn("project_cap");
				throw stoppedTurnError("project_cap");
			}
		}

		const proxyToken = deps.mintToken({
			capUsd,
			plan,
			projectId,
			runId,
			turnId,
			userId: input.actorUserId,
			workspaceId: input.organizationId,
		});

		let backend = await deps.backends.findByProjectId(projectId);
		// A paused backend wakes before the env is built, so the app has its
		// database in this turn. A Cloud tab restore leaves `restoring`; the
		// wake waits for that one too.
		if (
			backend !== null &&
			backend.ref !== null &&
			(backend.status === "paused" || backend.status === "restoring")
		) {
			if (deps.backendClient === null) {
				// Without the platform env no wake can start; the note says so.
				logger.warn("backend.wake-unconfigured", { projectId });
			} else {
				await writeStatus("sandbox_waking", "Waking up the database");
				backend = await wakeBackend(
					{ ...deps, client: deps.backendClient },
					backend,
					backend.ref,
					ownAbort.signal,
				);
			}
			// A cancel during the wake must not boot a sandbox: the catch
			// sees the aborted task signal and runs `finalizeCanceled`.
			if (signal.aborted) {
				throw new Error("Turn canceled during the backend wake");
			}
		}
		// D18: only an `active` row reaches the VM. A `creating` or `error`
		// row, or no row, keeps the VITE_* names out of the env.
		const supabase =
			backend?.status === "active" &&
			backend.ref !== null &&
			backend.anonKey !== null
				? { anonKey: backend.anonKey, url: supabaseProjectUrl(backend.ref) }
				: null;
		// LIMIT: a sandbox that already runs keeps its env until its next
		// resume. Upgrade: write the sandbox `.env` and restart the dev
		// server (issue step 8).
		const sandboxEnv = buildSandboxEnv({
			previewHost: null,
			proxyBaseUrl: deps.proxyBaseUrl,
			proxyToken,
			runId,
			supabaseAnonKey: supabase?.anonKey ?? null,
			supabaseUrl: supabase?.url ?? null,
		});

		stamps.sandboxStart = deps.now();
		sandbox = await deps.sandboxes.getOrCreate(projectId, {
			devCommand: DEV_COMMAND,
			devPort: DEV_PORT,
			env: sandboxEnv,
			framework: project.framework,
			// Layer 3 egress hosts the `request_network_host` tool approved.
			networkAllowedHosts: project.networkAllowedHosts,
			// The card says "Waking the sandbox" only when the sandbox really
			// boots; a running sandbox answers with no status.
			onWake: async () => {
				sandboxWoke = true;
				await writeStatus("sandbox_waking");
			},
			organizationId: project.organizationId,
			ownerUserId: project.userId,
			templateVersion: project.templateVersion,
		});
		await deps.sandboxSessions.touchActivity(projectId);
		stamps.sandboxEnd = deps.now();
		// The answer files enter the sandbox before the agent reads the
		// answers, so the tool result and the fallback text name their paths.
		if (continuation !== null && resumeState !== null) {
			const toolResults: HarnessQuestionResult[] = [];
			for (const result of continuation.toolResults) {
				toolResults.push(
					result.tool === "ask_user"
						? {
								...result,
								output: await copyAnswerFiles(
									{ logger, readUpload: deps.readUpload, sandbox, turnId },
									result.output,
								),
							}
						: result,
				);
			}
			continuation = { ...continuation, toolResults };
			const fallback = fallbackPromptOf({
				approvals: continuation.approvals,
				messageText: prompt.trim(),
				pending: resumeState.pending,
				results: toolResults,
			});
			// No answer line: a fresh session gets the plain prompt instead.
			continuationFallbackPrompt = fallback === "" ? null : fallback;
		}
		// After a sandbox stop, the rerun bridge matches a host-tool result
		// only by the old call id, so an ask_user answer goes as text on the
		// same thread. An approval keeps the continue path: a text would make
		// the agent call the tool again and ask for a new approval.
		const answersAsText =
			sandboxWoke &&
			continuationFallbackPrompt !== null &&
			continuation?.toolResults.some((result) => result.tool === "ask_user") ===
				true;

		// The note applies only when no active backend row exists.
		const backendNote = supabase === null ? "Backend not ready yet" : undefined;
		// The card says "Starting the session" only for a cold session. A
		// stored session resumes with no status; `startSession` writes one
		// when the resume fails and a fresh session starts instead.
		if (resumeState === null) {
			await writeStatus("session_starting", backendNote);
		}
		hostTools = await deps.hostTools.build({
			actorUserId: input.actorUserId,
			chatId,
			holdEventId: holdId,
			organizationId: input.organizationId,
			projectId,
			sandbox,
			subject,
			turnId,
		});
		stamps.hostToolsEnd = deps.now();
		// A stored session can be dead: the sandbox was rebuilt, or the proxy
		// host changed and the SDK rejects the old egress rules. A fresh
		// session loses the agent memory but keeps the project alive.
		const startSession = async (
			stored: HarnessResumeState | null,
		): Promise<{ resumed: boolean; session: HarnessSession }> => {
			if (stored !== null) {
				try {
					const resumed = await deps.harness.resumeSession(
						sessionInput,
						stored,
						{ dropPausedTurn: answersAsText },
					);
					// A resumed session can hold an unfinished turn with no card to
					// answer. Causes: a detach mid-generation, or a row from before
					// the cards existed. The SDK refuses a new prompt on it, so the
					// turn starts fresh. The agent memory is lost; the files stay.
					if (
						continuation !== null ||
						!(await deps.harness.hasUnfinishedTurn(resumed))
					) {
						return { resumed: true, session: resumed };
					}
					logger.warn(
						`builder-turn.stale-unfinished-turn turnId=${turnId}: resumed session holds an unfinished turn without cards`,
					);
				} catch (error) {
					logger.warn(`Resume failed for turn ${turnId}: ${messageOf(error)}`);
				}
				await writeStatus("session_starting", "Starting a fresh session");
			}
			return {
				resumed: false,
				session: await deps.harness.createSession(sessionInput),
			};
		};
		const sessionInput = {
			chatId,
			env: sandboxEnv,
			hostTools,
			// Three sentences; the template knows every other rule.
			instructions:
				`Build the app in these languages only: ${project.languages.join(", ")}. ` +
				"Ask the user with the ask_user tool only when you cannot decide yourself: put every question of one step in ONE call. " +
				"Write the Bash and Agent description in the user's language: the chat shows it to the user.",
			model,
			sandbox,
		};
		const started = await startSession(resumeState);
		session = started.session;
		sessionStart = started.resumed ? "resumed" : "created";
		stamps.sessionEnd = deps.now();
		const providerSessionId = session.sessionId;

		// A warm turn wrote no session status, so its first status carries
		// the backend note instead.
		await writeStatus(
			"running",
			resumeState === null ? undefined : backendNote,
		);
		startTimers(model);
		stamps.streamStart = deps.now();
		// A continued suspended turn gets the user's answers as tool
		// results; a lost session or a lost bridge still hears them as text.
		let turnInput: HarnessTurnInput;
		if (continuation !== null && started.resumed && !answersAsText) {
			turnInput = continuation;
		} else if (continuation !== null && continuationFallbackPrompt !== null) {
			logger.warn(
				`builder-turn.continuation-fallback turnId=${turnId}: ${
					started.resumed
						? "bridge lost in a sandbox stop"
						: "suspended session lost"
				}`,
			);
			turnInput = {
				kind: "prompt",
				prompt: continuationFallbackPrompt,
				signal: ownAbort.signal,
			};
		} else {
			turnInput = { kind: "prompt", prompt, signal: ownAbort.signal };
		}

		// reasoning chunk id → the ms clock at its `reasoning-start`.
		const reasoningStartedAt = new Map<string, number>();
		for await (const event of deps.harness.stream(session, turnInput)) {
			if (event.type === "part") {
				lastPartAt = deps.now();
				stamps.firstPart ??= lastPartAt;
				await chunkWriter.write(event.chunk);
				await writeEvent({ data: event.chunk, type: "part" });
				if (event.chunk.type === "reasoning-start") {
					reasoningStartedAt.set(event.chunk.id, lastPartAt);
				}
				const startedAt =
					event.chunk.type === "reasoning-end"
						? reasoningStartedAt.get(event.chunk.id)
						: undefined;
				// The UI shows "Thought for Ns" on the block. No chunk carries a
				// time, so the task stamps the duration as its own part. The
				// chunk writer keeps it in the stored message too.
				if (event.chunk.type === "reasoning-end" && startedAt !== undefined) {
					const thought: UIMessageChunk = {
						data: {
							reasoningId: event.chunk.id,
							// ms → whole seconds; a block under 0.5 s still shows 1 s.
							seconds: Math.max(1, Math.round((lastPartAt - startedAt) / 1000)),
						} satisfies TurnThoughtData,
						id: `thought-${event.chunk.id}`,
						type: "data-thought",
					};
					await chunkWriter.write(thought);
					await writeEvent({ data: thought, type: "part" });
				}
				continue;
			}
			if (event.type === "usage") {
				// The checkpoint tick writes the stream usage events from the
				// proxy rows; the harness counts stay in `usage` for the log.
				usage.cacheReadTokens += event.cacheReadTokens;
				usage.cacheWriteTokens += event.cacheWriteTokens;
				usage.inputTokens += event.inputTokens;
				usage.outputTokens += event.outputTokens;
				continue;
			}
			// A harness error chunk ends the turn as failed. `failTurn` writes
			// the one `error` event from the `code` this error carries.
			throw Object.assign(new Error(event.message), { code: event.code });
		}
		stamps.streamEnd = deps.now();

		// The harness counts stay informational; money comes from the proxy rows.
		logger.info("builder-turn.harness-usage", {
			cacheReadTokens: usage.cacheReadTokens,
			cacheWriteTokens: usage.cacheWriteTokens,
			inputTokens: usage.inputTokens,
			outputTokens: usage.outputTokens,
			turnId,
		});

		// The stream ended clean. A paused turn suspends instead of
		// detaching: `suspendState.pending` names the cards the user must
		// answer before the turn can continue.
		suspendState = (await deps.harness.hasUnfinishedTurn(session))
			? await deps.harness.suspendTurn(session)
			: null;

		// Commit, message, usage, and settle tail of a finished run. The success
		// path and the pause path share it. The caller passes the live handles.
		const settleTurn = async (
			liveSession: HarnessSession,
			liveSandbox: SandboxHandle,
			outcome: {
				pending: HarnessPendingInteraction[];
				status: "succeeded" | "waiting_for_answer" | "waiting_for_approval";
			},
		): Promise<void> => {
			await writeStatus("committing");
			await chunkWriter.close();
			chunkStreamClosed = true;
			const finalMessage = await assistantMessage;
			const assistantText = (finalMessage?.parts ?? [])
				.filter(
					(
						part,
					): part is Extract<UIMessage["parts"][number], { type: "text" }> =>
						part.type === "text",
				)
				.map((part) => part.text)
				.join("\n");
			// A text-only turn still gets a commit: the turn number names it.
			const summary =
				assistantText.trim().slice(0, SUMMARY_MAX_CHARS) ||
				`Turn ${turnNumber}`;

			let commit: CommitTurnResult | null = null;
			try {
				commit = await deps.commit(liveSandbox, deps.commitDeps, {
					chatId,
					messageId: assistantMessageId,
					organizationId: input.organizationId,
					projectId,
					source: "agent",
					summary,
					turnId,
					userId: input.actorUserId,
				});
			} catch (error) {
				// A failed commit must not lose the turn's text and usage.
				logger.warn(`Commit failed for turn ${turnId}: ${messageOf(error)}`);
			}
			stamps.commitEnd = deps.now();
			const outputCommitSha = commit?.sha ?? null;

			// The files event is a stream-only part; the message row keeps the
			// harness chunks only.
			await writeEvent({
				data: {
					data: { files: commit?.numstat ?? [] },
					id: `files-${turnId}`,
					type: "data-builder-files",
				},
				type: "part",
			});

			// One stream part and one message part per card the user must
			// answer; the cards are what the next turn answers.
			const cardParts: UIMessage["parts"] = [];
			for (const interaction of outcome.pending) {
				if (interaction.kind === "question") {
					for (const question of interaction.questions) {
						const part: UIMessage["parts"][number] = {
							data: {
								answer: null,
								kind: question.kind,
								options: question.options.map((option) => {
									// A design world option shows the world's preview card.
									const card =
										option.worldId === undefined
											? undefined
											: worldCardOf(option.worldId);
									return {
										id: option.id,
										label: option.label,
										...(option.description === undefined
											? {}
											: { description: option.description }),
										...(card === undefined ? {} : { card }),
									};
								}),
								question: question.question,
								questionId: question.id,
								toolCallId: interaction.toolCallId,
								...(question.helper === undefined
									? {}
									: { helper: question.helper }),
								...(question.maxFiles === undefined
									? {}
									: { maxFiles: question.maxFiles }),
							} satisfies TurnQuestionData,
							id: `${interaction.toolCallId}:${question.id}`,
							type: "data-question",
						};
						await writeEvent({ data: part, type: "part" });
						cardParts.push(part);
					}
				} else {
					const part: UIMessage["parts"][number] = {
						data: {
							approvalId: interaction.approvalId,
							decision: null,
							input: interaction.input,
							toolCallId: interaction.toolCallId,
							toolName: interaction.toolName,
						} satisfies TurnApprovalData,
						id: interaction.approvalId,
						type: "data-approval",
					};
					await writeEvent({ data: part, type: "part" });
					cardParts.push(part);
				}
			}

			// The proxy rows are the spend truth; the message metadata and
			// `recordUsage` read them before the CAS and the settle.
			const rows = await deps.proxyRows.sumByTurn(turnId);
			const rowCredits = creditsFromRows(rows);

			await fenced(() =>
				deps.insertAssistantMessage({
					chatId,
					id: assistantMessageId,
					metadata: {
						harness: deps.harness.kind,
						model,
						outputCommitSha,
						usage: {
							cacheReadTokens: rows.cacheReadTokens,
							cacheWriteTokens: rows.cacheWriteTokens,
							credits: rowCredits,
							inputTokens: rows.inputTokens,
							outputTokens: rows.outputTokens,
						},
					},
					parts: [...(finalMessage?.parts ?? []), ...cardParts],
					turnId,
				}),
			);

			await fenced(() =>
				deps.turns.recordUsage(turnId, {
					cacheReadTokens: rows.cacheReadTokens,
					cacheWriteTokens: rows.cacheWriteTokens,
					credits: rowCredits,
					harness: deps.harness.kind,
					inputTokens: rows.inputTokens,
					model,
					outputTokens: rows.outputTokens,
				}),
			);
			// A false CAS means the row went terminal under us (a cancel won):
			// skip the later row writes, still do the cleanup tail.
			const completed = await fenced(() =>
				deps.turns.complete(turnId, {
					completedAt: new Date(),
					outputCommitSha,
					status: outcome.status,
				}),
			);
			if (!completed) {
				logger.warn(`Complete write lost for turn ${turnId}: row moved on`);
			} else {
				await settleHoldFromRows(model, rows);

				// A suspended session is already parked; a live one detaches.
				const resumeOut =
					suspendState === null
						? await deps.harness.detach(liveSession)
						: suspendState;
				await fenced(() =>
					deps.sessions.saveResumeState(chatId, {
						model,
						providerSessionId,
						resumeState: resumeOut,
					}),
				);
				const balanceCredits = await deps.readBalance(subject);
				await deps.writer.write(turnId, {
					data: {
						receipt: {
							balanceCredits,
							cacheReadTokens: rows.cacheReadTokens,
							cacheWriteTokens: rows.cacheWriteTokens,
							credits: rowCredits,
							inputTokens: rows.inputTokens,
							modelId: model,
							outputTokens: rows.outputTokens,
						},
						status: outcome.status,
						...(outputCommitSha === null ? {} : { outputCommitSha }),
					},
					type: "done",
				});
			}
			await finishTurn();
			stamps.settleEnd = deps.now();
		};

		await settleTurn(
			session,
			sandbox,
			suspendState === null
				? { pending: [], status: "succeeded" }
				: {
						pending: suspendState.pending,
						// An approval card outranks a question card: the API blocks
						// a new turn on it with a 409.
						status: suspendState.pending.some(
							(interaction) => interaction.kind === "approval",
						)
							? "waiting_for_approval"
							: "waiting_for_answer",
					},
		);
	} catch (error) {
		if (signal.aborted) {
			await finalizeCanceled();
		} else {
			const code =
				abortCode ??
				(typeof error === "object" &&
				error !== null &&
				"code" in error &&
				typeof error.code === "string"
					? error.code
					: null);
			await failTurn(error, code);
		}
	} finally {
		if (keepAliveTimer !== null) {
			clearInterval(keepAliveTimer);
		}
		if (pulseTimer !== null) {
			clearInterval(pulseTimer);
		}
		signal.removeEventListener("abort", onTaskAbort);
		if (hostTools !== null) {
			try {
				await hostTools.close();
			} catch (error) {
				logger.warn(
					`Host tools close failed for turn ${turnId}: ${messageOf(error)}`,
				);
			}
		}
		// A failed turn leaves the chunk stream open; close it so the
		// reader promise ends with the run.
		if (!chunkStreamClosed) {
			try {
				await chunkWriter.close();
			} catch (error) {
				logger.warn(
					`Chunk stream close failed for turn ${turnId}: ${messageOf(error)}`,
				);
			}
		}
		// One timing line per run, failures included (WANDIT-253). It runs
		// before the finalizer is removed, so the pool is still open.
		let firstModelCallMs: number | null = null;
		try {
			const firstRequestAtMs =
				await deps.proxyRows.firstRequestStartedAtMs(turnId);
			// LIMIT: the row time is the database clock, the run start the
			// worker clock; the difference carries their skew. Upgrade: let
			// `claimRunning` write `started_at` with the database `now()` and
			// diff the two columns in SQL.
			firstModelCallMs =
				firstRequestAtMs === null ? null : firstRequestAtMs - runStartedAt;
		} catch (error) {
			logger.warn(
				`First proxy request lookup failed for turn ${turnId}: ${messageOf(error)}`,
			);
		}
		const timing: BuilderTurnTiming = {
			commitMs: msBetween(stamps.streamEnd, stamps.commitEnd),
			firstModelCallMs,
			firstPartMs: msBetween(stamps.streamStart, stamps.firstPart),
			hostToolsMs: msBetween(stamps.sandboxEnd, stamps.hostToolsEnd),
			prestartMs: msBetween(runStartedAt, stamps.sandboxStart),
			queueMs: runStartedAt - turn.createdAt.getTime(),
			runId,
			sandbox:
				stamps.sandboxEnd === undefined ? null : sandboxWoke ? "woke" : "warm",
			sandboxMs: msBetween(stamps.sandboxStart, stamps.sandboxEnd),
			session: sessionStart,
			sessionMs: msBetween(stamps.hostToolsEnd, stamps.sessionEnd),
			settleMs: msBetween(stamps.commitEnd, stamps.settleEnd),
			streamMs: msBetween(stamps.streamStart, stamps.streamEnd),
			totalMs: deps.now() - runStartedAt,
			turnId,
		};
		logger.info("builder-turn.timing", timing);
		// Remove BEFORE the task ends its pool: a late onCancel must not
		// write against a closed database.
		builderTurnCancelFinalizers.delete(runId);
	}
}

/** What the answer file copy needs from the run. */
type AnswerCopyContext = {
	logger: BuilderTurnLogger;
	readUpload: BuilderTurnDeps["readUpload"];
	/** The live project sandbox; the copy goes under its `workspaceDir`. */
	sandbox: SandboxHandle;
	turnId: string;
};

/**
 * Copies the answer files of one `ask_user` result into the sandbox, one
 * by one, and sets each `path`. A file that cannot be read, is too big, or
 * fails the write keeps `path: null`; the agent still gets its URL.
 */
async function copyAnswerFiles(
	context: AnswerCopyContext,
	output: AskUserHostToolOutput,
): Promise<AskUserHostToolOutput> {
	const answers: AskUserHostToolOutput["answers"] = [];
	for (const answer of output.answers) {
		const files: AskUserHostToolOutput["answers"][number]["files"] = [];
		for (const file of answer.files) {
			files.push({ ...file, path: await copyAnswerFile(context, file.url) });
		}
		answers.push({ ...answer, files });
	}
	return { answers };
}

/** One answer file into `public/uploads/`; the project-relative path, or null. */
async function copyAnswerFile(
	context: AnswerCopyContext,
	url: string,
): Promise<string | null> {
	const { logger, turnId } = context;
	const path = uploadCopyPath(url);
	if (path === null) {
		logger.warn("builder-turn.answer-file-skipped", {
			reason: "not an upload url",
			turnId,
			url,
		});
		return null;
	}
	try {
		const bytes = await context.readUpload(url);
		if (bytes === null || bytes.byteLength > ANSWER_FILE_MAX_BYTES) {
			logger.warn("builder-turn.answer-file-skipped", {
				reason: bytes === null ? "no upload object" : "file too big",
				turnId,
				url,
			});
			return null;
		}
		await context.sandbox.writeFiles([
			{
				content: bytes,
				path: posix.join(context.sandbox.workspaceDir, path),
			},
		]);
		return path;
	} catch (error) {
		// The answer still reaches the agent with the URL; only the copy fails.
		logger.warn("builder-turn.answer-file-copy-failed", {
			message: messageOf(error),
			turnId,
			url,
		});
		return null;
	}
}

/**
 * Wakes a `paused` or `restoring` backend: the restore call for a paused
 * row, then one status read every 5 s until `ACTIVE_HEALTHY`. Answers the
 * row read after the wake, or the row as it was on a timeout, a cancel, or
 * a failure. It never throws: a slow database must not fail the turn.
 */
async function wakeBackend(
	deps: Pick<BuilderTurnDeps, "backends" | "logger" | "now"> & {
		/** `deps.backendClient`, checked not null by the caller. */
		client: NonNullable<BuilderTurnDeps["backendClient"]>;
	},
	row: AppBackendRow,
	/** The ref of `row`; the caller checked that it is not null. */
	ref: string,
	signal: AbortSignal,
): Promise<AppBackendRow> {
	// The scope of each Management API call, and the fields of each log line.
	const backendRef = { projectId: row.projectId, ref };
	const client = deps.client;
	const startedAt = deps.now();
	try {
		if (row.status === "paused") {
			try {
				await client.restoreProject(backendRef);
			} catch (error) {
				// Supabase can apply a restore and still fail the answer; the next
				// restore then fails too. A project that comes up needs only the wait.
				const { status } = await client.getProject(backendRef);
				if (!isProjectComingUp(status)) {
					throw error;
				}
			}
			// False means a Cloud tab restore moved the row first; the poll
			// below waits for that restore instead.
			await deps.backends.markRestoring(row.projectId);
		}
		// The loop also ends on `ACTIVE_HEALTHY` or a failed restore.
		while (
			!signal.aborted &&
			deps.now() - startedAt < BACKEND_WAKE_TIMEOUT_MS
		) {
			let status: SupabaseProjectStatus | null = null;
			try {
				status = (await client.getProject(backendRef)).status;
			} catch (error) {
				// One failed read (a 429, a timeout) does not end the wake.
				deps.logger.warn("backend.wake-poll-failed", {
					...backendRef,
					message: messageOf(error),
				});
			}
			if (status === "ACTIVE_HEALTHY") {
				await deps.backends.markRestored(row.projectId);
				deps.logger.info("backend.wake-done", {
					...backendRef,
					elapsedMs: deps.now() - startedAt,
				});
				// A re-read: the row can have moved on, for example to `deleting`.
				return (await deps.backends.findByProjectId(row.projectId)) ?? row;
			}
			if (status === "RESTORE_FAILED" || status === "REMOVED") {
				// Supabase does not bring this project back by itself; `error`
				// ends the `restoring` state that nothing else would end.
				await deps.backends.markRestoreFailed(row.projectId, status);
				deps.logger.warn("backend.wake-failed", { ...backendRef, status });
				return (await deps.backends.findByProjectId(row.projectId)) ?? row;
			}
			// A cancel ends the sleep at once, so the turn stops without a wait.
			await new Promise<void>((resolve) => {
				const done = () => {
					clearTimeout(timer);
					signal.removeEventListener("abort", done);
					resolve();
				};
				const timer = setTimeout(done, BACKEND_WAKE_POLL_MS);
				signal.addEventListener("abort", done, { once: true });
			});
		}
		if (signal.aborted) {
			deps.logger.info("backend.wake-canceled", backendRef);
			return row;
		}
		deps.logger.warn("backend.wake-timeout", {
			...backendRef,
			elapsedMs: deps.now() - startedAt,
		});
	} catch (error) {
		deps.logger.warn("backend.wake-failed", {
			...backendRef,
			message: messageOf(error),
		});
	}
	return row;
}

/** `to - from` in ms, or null while either stamp is missing. */
function msBetween(
	from: number | undefined,
	to: number | undefined,
): number | null {
	return from === undefined || to === undefined ? null : to - from;
}

function messageOf(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}
