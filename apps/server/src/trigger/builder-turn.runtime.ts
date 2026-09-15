/**
 * `runBuilderTurn`: the `builder-turn` task body (WANDIT-166).
 * `builder-turn.task.ts` calls it with real dependencies; the spec
 * drives it with fakes. One run: claim → fence → sandbox → harness →
 * stream → commit → settle → promote.
 */
import { randomUUID } from "node:crypto";
import type {
	BillingPlanId,
	TurnAssistantMessageMetadata,
	TurnStreamPhase,
} from "@wandit/contracts";
import {
	builderTurnSpecSchema,
	harnessResumeEnvelopeSchema,
} from "@wandit/contracts";
import { readUIMessageStream, type UIMessage, type UIMessageChunk } from "ai";
import {
	captureAiError,
	classifyAiError,
	renderAiErrorSentence,
} from "../modules/ai-errors/domain";
import {
	LLM_PROXY_TOKEN_TTL_SECONDS,
	type LlmProxyTokenClaimsInput,
} from "../modules/app-builder/application/services/llm-proxy-token.service";
import {
	llmModelPrice,
	priceUsdMicros,
} from "../modules/app-builder/domain/llm-model-prices";
import type {
	BuilderHarness,
	HarnessResumeState,
	HarnessSession,
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
	assertCurrentTurn,
	StaleTurnError,
} from "../modules/app-builder/domain/turn-queue";
import type {
	CommitTurnDeps,
	CommitTurnInput,
	CommitTurnResult,
} from "../modules/app-builder/infrastructure/git/commit-turn";
import type { BuilderSessionsRepository } from "../modules/app-builder/infrastructure/persistence/builder-sessions.repository";
import type {
	BuilderTurnFailure,
	BuilderTurnsRepository,
} from "../modules/app-builder/infrastructure/persistence/builder-turns.repository";
import type { ProjectCostCapsRepository } from "../modules/app-builder/infrastructure/persistence/project-cost-caps.repository";
import type { SandboxSessionsRepository } from "../modules/app-builder/infrastructure/persistence/sandbox-sessions.repository";
import type { TurnProjectRepository } from "../modules/app-builder/infrastructure/persistence/turn-project.repository";
import type { LlmSpendCounterStore } from "../modules/app-builder/infrastructure/redis/llm-spend-counters";
import { TURN_LOCK_TTL_MS } from "../modules/app-builder/infrastructure/redis/redis-turn-lock";
import { buildSandboxEnv } from "../modules/app-builder/infrastructure/sandbox/sandbox-env";
import type { MeteringSubject } from "../modules/credits/domain/credit-owner";
import type { MeteringService } from "../modules/metering/application/services/metering.service";
import { usdMicrosToCentiCredits } from "../modules/metering/domain/model-pricing";

// 60 s: refreshes the lock, the vendor sandbox deadline, and activity.
const TURN_KEEPALIVE_MS = 60_000;
// 30 s of part silence triggers a heartbeat; the Trigger read dies at 60 s.
const STREAM_HEARTBEAT_MS = 30_000;
// 4 minutes without a part means a dead harness, not a slow one.
const TURN_STALL_MS = 4 * 60_000;
// ESTIMATE until WANDIT-174 sets plan caps.
const DEFAULT_TURN_CAP_USD = 5;
// The dev server command and port of the app template (D15).
const DEV_COMMAND = "pnpm run dev";
const DEV_PORT = 5173;
// 72 chars: the commit summary limit, same as the UI turn title.
const SUMMARY_MAX_CHARS = 72;

/** Why the turn stopped on its own. */
type AbortCode = "lock_lost" | "stale" | "stalled";

/** The narrow log the runtime writes to; the task passes `logger`. */
export type BuilderTurnLogger = Pick<Console, "error" | "info" | "warn">;

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
		| "recordUsage"
		| "transition"
	>;
	project: Pick<TurnProjectRepository, "findForTurn">;
	caps: Pick<ProjectCostCapsRepository, "findByProjectId">;
	sessions: Pick<BuilderSessionsRepository, "findByChatId" | "saveResumeState">;
	sandboxSessions: Pick<SandboxSessionsRepository, "touchActivity">;
	sandboxes: SandboxProvider;
	harness: BuilderHarness;
	writer: TurnEventWriter;
	lock: TurnLock;
	counters: Pick<LlmSpendCounterStore, "revokeRun">;
	metering: Pick<MeteringService, "findByIdempotencyKey" | "refund" | "settle">;
	hostTools: HostToolRegistry;
	/** `mintLlmProxyToken` bound to the env; the spec passes a fake. */
	mintToken: (claims: LlmProxyTokenClaimsInput) => string;
	/** Subscription plan lookup; the task binds `SubscriptionsRepository`. */
	resolvePlan: (subject: MeteringSubject) => Promise<BillingPlanId>;
	/** `commitTurn` itself, so the spec asserts its input. */
	commit: (
		sandbox: SandboxHandle,
		deps: CommitTurnDeps,
		input: CommitTurnInput,
	) => Promise<CommitTurnResult>;
	/** `gitStore`, `appCommits`, `putPatch` the task builds once. */
	commitDeps: CommitTurnDeps;
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
	const logger = deps.logger;
	const { projectId, runId, turnId } = input;
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
	let hostTools: HostToolSet | null = null;
	let lastPartAt = deps.now();
	let keepAliveTimer: ReturnType<typeof setInterval> | null = null;
	let pulseTimer: ReturnType<typeof setInterval> | null = null;
	const usage = {
		cacheReadTokens: 0,
		cacheWriteTokens: 0,
		inputTokens: 0,
		outputTokens: 0,
	};
	let credits = 0;
	let unpricedWarned = false;

	/** Best-effort detach + resume save; used by the failure paths. */
	const detachSession = async () => {
		if (session === null) {
			return;
		}
		try {
			const resumeState = await deps.harness.detach(session);
			await deps.sessions.saveResumeState(chatId, {
				model: deps.model,
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

	/** One terminal failure: row, error+done events, refund, cleanup. */
	const failTurn = async (
		error: unknown,
		failureCode: string | null,
	): Promise<void> => {
		const normalized =
			classifyAiError(error, {
				abortSignal: signal,
				model: deps.model ?? undefined,
				route: "none",
				surface: "chat",
			}) ??
			classifyAiError(new Error("Builder turn failed"), {
				model: deps.model ?? undefined,
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
			error: renderAiErrorSentence(normalized),
			failureCode,
			failureKind: normalized.kind,
			failureProvider: normalized.provider,
			failureProviderMessage: normalized.providerMessage,
			failureRequestId: normalized.requestId,
			failureSource: normalized.source,
			sentryEventId: normalized.sentryEventId,
		};
		const failed =
			abortCode === "stalled"
				? // `stalled` is its own terminal status; `fail` would write `failed`.
					await deps.turns.transition(
						turnId,
						["running", "cancelling"],
						"stalled",
						{ completedAt: new Date(), ...failure },
					)
				: await deps.turns.fail(turnId, failure);
		if (!failed) {
			// A false CAS means the row went terminal under us (a cancel won).
			logger.warn(`Fail write lost for turn ${turnId}: row moved on`);
		}
		await deps.writer.write(turnId, {
			data: {
				code: failureCode ?? normalized.kind,
				message: failure.error,
				retryable: normalized.retryable,
			},
			type: "error",
		});
		await deps.writer.write(turnId, {
			data: { status: abortCode === "stalled" ? "stalled" : "failed" },
			type: "done",
		});
		await cleanupStep(() => refundHold("builder_turn_failed"));
		await detachSession();
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

	const startTimers = () => {
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
		if (deps.model === null) {
			// Checked before the sandbox starts: no model, no spend.
			throw Object.assign(new Error("V2_DEFAULT_MODEL is not set"), {
				code: "model_missing",
			});
		}
		const model = deps.model;

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

		const caps = await deps.caps.findByProjectId(projectId);
		// Centi-credits → dollars: /100 to credits, ×usdPerCredit to dollars.
		const usdPerCredit = deps.usdMicrosPerCredit / 1_000_000;
		const capUsd =
			caps?.perTurnCapCredits != null
				? (caps.perTurnCapCredits / 100) * usdPerCredit
				: DEFAULT_TURN_CAP_USD;

		const proxyToken = deps.mintToken({
			capUsd,
			plan: await deps.resolvePlan(subject),
			projectId,
			runId,
			turnId,
			userId: input.actorUserId,
			workspaceId: input.organizationId,
		});

		// WANDIT-183 adds the app_backends lookup here; until then the
		// sandbox gets no VITE_SUPABASE_* names and the status says why.
		const sandboxEnv = buildSandboxEnv({
			previewHost: null,
			proxyBaseUrl: deps.proxyBaseUrl,
			proxyToken,
			runId,
			supabaseAnonKey: null,
			supabaseUrl: null,
		});

		await writeStatus("sandbox_waking");
		sandbox = await deps.sandboxes.getOrCreate(projectId, {
			devCommand: DEV_COMMAND,
			devPort: DEV_PORT,
			env: sandboxEnv,
			framework: project.framework,
			organizationId: project.organizationId,
			ownerUserId: project.userId,
			templateVersion: project.templateVersion,
		});
		await deps.sandboxSessions.touchActivity(projectId);

		await writeStatus("session_starting", "Backend not ready yet");
		hostTools = await deps.hostTools.build({
			actorUserId: input.actorUserId,
			chatId,
			organizationId: input.organizationId,
			projectId,
			sandbox,
			turnId,
		});
		// A stored session can be dead: the sandbox was rebuilt, or the proxy
		// host changed and the SDK rejects the old egress rules. A fresh
		// session loses the agent memory but keeps the project alive.
		const startSession = async (
			stored: HarnessResumeState | null,
		): Promise<HarnessSession> => {
			if (stored === null) {
				return deps.harness.createSession(sessionInput);
			}
			try {
				return await deps.harness.resumeSession(sessionInput, stored);
			} catch (error) {
				logger.warn(
					`Resume failed for turn ${turnId}; starting a fresh session: ${messageOf(error)}`,
				);
				await writeStatus("session_starting", "Starting a fresh session");
				return deps.harness.createSession(sessionInput);
			}
		};
		const sessionInput = {
			chatId,
			env: sandboxEnv,
			hostTools,
			// One sentence; the template knows every other rule.
			instructions: `Build the app in these languages only: ${project.languages.join(", ")}.`,
			model,
			sandbox,
		};
		session = await startSession(resumeState);
		const providerSessionId = session.sessionId;

		await writeStatus("running");
		startTimers();
		const prompt =
			spec.message.trim().length > 0
				? spec.message
				: `See the attached files.\n${spec.attachments
						.map((attachment) => attachment.url)
						.join("\n")}`;

		for await (const event of deps.harness.stream(session, {
			prompt,
			signal: ownAbort.signal,
		})) {
			if (event.type === "part") {
				lastPartAt = deps.now();
				await chunkWriter.write(event.chunk);
				await writeEvent({ data: event.chunk, type: "part" });
				continue;
			}
			if (event.type === "usage") {
				usage.cacheReadTokens += event.cacheReadTokens;
				usage.cacheWriteTokens += event.cacheWriteTokens;
				usage.inputTokens += event.inputTokens;
				usage.outputTokens += event.outputTokens;
				// LIMIT: checkpoint debits come in WANDIT-174; the usage
				// event reports the running total only.
				const micros = priceUsdMicros(model, usage);
				if (micros === null) {
					// The proxy refuses unpriced models; this branch is a second guard.
					credits = 0;
					if (!unpricedWarned) {
						unpricedWarned = true;
						logger.warn(`No price row for model ${model}; reporting 0 credits`);
					}
				} else {
					credits = usdMicrosToCentiCredits(micros, deps.usdMicrosPerCredit);
				}
				await writeEvent({
					data: { ...usage, credits },
					type: "usage",
				});
				continue;
			}
			// A harness error chunk ends the turn as failed. `failTurn` writes
			// the one `error` event from the `code` this error carries.
			throw Object.assign(new Error(event.message), { code: event.code });
		}

		await writeStatus("committing");
		await chunkWriter.close();
		chunkStreamClosed = true;
		const finalMessage = await assistantMessage;
		const assistantText = (finalMessage?.parts ?? [])
			.filter(
				(part): part is Extract<UIMessage["parts"][number], { type: "text" }> =>
					part.type === "text",
			)
			.map((part) => part.text)
			.join("\n");
		// A text-only turn still gets a commit: the turn number names it.
		const summary =
			assistantText.trim().slice(0, SUMMARY_MAX_CHARS) || `Turn ${turnNumber}`;

		let commit: CommitTurnResult | null = null;
		try {
			commit = await deps.commit(sandbox, deps.commitDeps, {
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
		await fenced(() =>
			deps.insertAssistantMessage({
				chatId,
				id: assistantMessageId,
				metadata: {
					harness: deps.harness.kind,
					model,
					outputCommitSha,
					usage: { ...usage, credits },
				},
				parts: finalMessage?.parts ?? [],
				turnId,
			}),
		);

		await fenced(() =>
			deps.turns.recordUsage(turnId, {
				cacheReadTokens: usage.cacheReadTokens,
				cacheWriteTokens: usage.cacheWriteTokens,
				credits,
				harness: deps.harness.kind,
				inputTokens: usage.inputTokens,
				model,
				outputTokens: usage.outputTokens,
			}),
		);
		// A false CAS means the row went terminal under us (a cancel won):
		// skip the later row writes, still do the cleanup tail.
		const completed = await fenced(() =>
			deps.turns.complete(turnId, {
				completedAt: new Date(),
				outputCommitSha,
				status: "succeeded",
			}),
		);
		if (!completed) {
			logger.warn(`Complete write lost for turn ${turnId}: row moved on`);
		} else {
			const hold = await findHold();
			if (hold === null) {
				logger.warn(`No metering hold found for turn ${turnId}; skip settle`);
			} else if (hold.status !== "reserved") {
				logger.info(
					`Metering hold for turn ${turnId} is ${hold.status}; skip settle`,
				);
			} else {
				await deps.metering.settle(hold.id, {
					modelId: model,
					pricing: "token",
					provider: llmModelPrice(model)?.provider ?? null,
					rawUsage: { ...usage },
					usage: {
						inputTokenDetails: {
							cacheReadTokens: usage.cacheReadTokens,
							cacheWriteTokens: usage.cacheWriteTokens,
							noCacheTokens: Math.max(
								0,
								usage.inputTokens -
									usage.cacheReadTokens -
									usage.cacheWriteTokens,
							),
						},
						inputTokens: usage.inputTokens,
						outputTokens: usage.outputTokens,
					},
				});
			}

			const resumeOut = await deps.harness.detach(session);
			await fenced(() =>
				deps.sessions.saveResumeState(chatId, {
					model,
					providerSessionId,
					resumeState: resumeOut,
				}),
			);
			await deps.writer.write(turnId, {
				data: {
					receipt: { credits },
					status: "succeeded",
					...(outputCommitSha === null ? {} : { outputCommitSha }),
				},
				type: "done",
			});
		}
		await finishTurn();
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
		// Remove BEFORE the task ends its pool: a late onCancel must not
		// write against a closed database.
		builderTurnCancelFinalizers.delete(runId);
	}
}

function messageOf(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}
