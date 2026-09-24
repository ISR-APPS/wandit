/**
 * Orchestration behind the turn API: create, cancel, stream access checks,
 * and the end-of-turn promotion trigger.
 * Called by `turns.controller.ts`. It orders the side effects the issue
 * fixes: scope/engine checks first (404 before any credit moves), then the
 * model allow-list, the monthly cap, and the per-actor turn limit, then
 * the `agent_session` metering hold, then the session row, the project
 * lock, the turn row, the user message, and the task handoff. Every
 * failure after the hold refunds it.
 */
import { randomUUID } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import {
	BadRequestException,
	ConflictException,
	ForbiddenException,
	HttpException,
	HttpStatus,
	Inject,
	Injectable,
	Logger,
	NotFoundException,
	ServiceUnavailableException,
} from "@nestjs/common";
import {
	allowedLlmModels,
	appBuilderRoutes,
	type CancelTurnResponse,
	type CreateTurnRequest,
	type CreateTurnResponse,
} from "@wandit/contracts";
import { env } from "@wandit/env/server";
import type { V2Harness } from "@wandit/env/v2-harness";

import { resolveBillingPlan } from "../../../billing/application/services/resolve-billing-plan";
import { SubscriptionsRepository } from "../../../billing/infrastructure/persistence/subscriptions.repository";
import { ChatsRepository } from "../../../generation/infrastructure/persistence/chats.repository";
import { MeteringService } from "../../../metering/application/services/metering.service";
import { harnessModelMultiplier } from "../../../metering/domain/harness-price-table";
import {
	AGENT_SESSION_RESERVE_CEILING_CREDITS,
	AGENT_SESSION_RESERVE_FLOOR_CREDITS,
} from "../../../metering/domain/operation-registry";
import { assertWanditHostedAttachments } from "../../../projects/application/services/projects.service";
import {
	meteringSubjectFrom,
	type ProjectScope,
} from "../../../projects/domain/project-scope";
import { ProjectsRepository } from "../../../projects/infrastructure/persistence/projects.repository";
import { BuilderApprovalPendingError } from "../../domain/errors/builder-approval-pending.error";
import { BUILDER_TURN_ACTIVE_ERROR_CODE } from "../../domain/errors/builder-turn-active.error";
import type { HarnessKind } from "../../domain/ports/builder-harness";
import {
	TURN_EVENT_READER,
	type TurnEventReader,
} from "../../domain/ports/turn-events";
import { TURN_LOCK, type TurnLock } from "../../domain/ports/turn-lock";
import {
	TURN_TASK_STARTER,
	type TurnTaskStarter,
} from "../../domain/ports/turn-task-starter";
import {
	DEFAULT_PER_TURN_CAP_CREDITS,
	monthStartUtc,
} from "../../domain/turn-caps";
import {
	CANCELLABLE_TURN_STATUSES,
	isTerminalStatus,
	nextStatusForCancel,
	RESTORE_LOCK_HOLDER_PREFIX,
} from "../../domain/turn-queue";
import { V2_ENV, type V2EnvSource } from "../../infrastructure/env/v2-env";
import {
	type BuilderSessionRow,
	BuilderSessionsRepository,
} from "../../infrastructure/persistence/builder-sessions.repository";
import {
	type BuilderTurnRow,
	type BuilderTurnSpec,
	BuilderTurnsRepository,
	isUniqueViolation,
} from "../../infrastructure/persistence/builder-turns.repository";
import { ProjectCostCapsRepository } from "../../infrastructure/persistence/project-cost-caps.repository";
import {
	type LlmSpendCounterStore,
	LlmSpendCounters,
} from "../../infrastructure/redis/llm-spend-counters";
import { TURN_LOCK_TTL_MS } from "../../infrastructure/redis/redis-turn-lock";
import { LLM_PROXY_TOKEN_TTL_SECONDS } from "./llm-proxy-token.service";
import { TurnPromoter } from "./turn-promotion";

/**
 * 14 credits in centi-credits: about $0.45 of provider cost, the
 * WANDIT-151 typical message. The `agent_session` hold for a project with
 * no settled turn yet. The V2 create-project route reads it as the 402
 * `requiredCredits`.
 */
export const TURN_HOLD_DEFAULT_CREDITS = 1_400;

/**
 * Reserved `agent_session` events one user may hold at once, across
 * projects. Stops a runaway client before it can drain the pool.
 */
export const MAX_ACTIVE_TURNS_PER_ACTOR = 3;

/**
 * The create-time hold estimate `responseFor` reports. `modelId` is null
 * only when no deploy default is set and the body picks none; the
 * contract needs a model name, so the response omits `estimate` then.
 */
type TurnEstimate = {
	/** `fixed`: the default hold; `history`: the project's settled median. */
	basis: "fixed" | "history";
	/** The hold size in centi-credits (1 credit = 100 cc). */
	creditsCc: number;
	/** The model the turn runs on; null when none is configured. */
	modelId: string | null;
	/** Output-rate ratio of `modelId` over the deploy default; 1 for it. */
	multiplier: number;
};

// Cancel waits at most 30 s for the task's terminal write to land after
// runs.cancel; longer cleanup is the lock TTL's job.
const CANCEL_SETTLE_TIMEOUT_MS = 30_000;
// Row-poll cadence while cancel waits for a run that never wrote a run id.
const CANCEL_SETTLE_POLL_MS = 500;

/** Env harness name → `builder_harness` db enum. Shared with the V2 create route. */
export const HARNESS_BY_ENV: Record<V2Harness, HarnessKind> = {
	"claude-code": "claude_code",
	opencode: "opencode",
};

@Injectable()
export class TurnsService {
	private readonly logger = new Logger(TurnsService.name);
	private readonly promoter: TurnPromoter;

	constructor(
		@Inject(BuilderTurnsRepository)
		private readonly turns: BuilderTurnsRepository,
		@Inject(BuilderSessionsRepository)
		private readonly sessions: BuilderSessionsRepository,
		@Inject(ChatsRepository)
		private readonly chats: ChatsRepository,
		@Inject(ProjectsRepository)
		private readonly projects: ProjectsRepository,
		@Inject(MeteringService)
		private readonly metering: MeteringService,
		@Inject(TURN_LOCK)
		private readonly lock: TurnLock,
		@Inject(TURN_TASK_STARTER)
		private readonly starter: TurnTaskStarter,
		@Inject(TURN_EVENT_READER)
		private readonly turnEvents: TurnEventReader,
		@Inject(V2_ENV)
		private readonly v2Env: V2EnvSource,
		@Inject(LlmSpendCounters)
		private readonly counters: LlmSpendCounterStore,
		@Inject(ProjectCostCapsRepository)
		private readonly caps: Pick<ProjectCostCapsRepository, "findByProjectId">,
		@Inject(SubscriptionsRepository)
		private readonly subscriptions: Pick<
			SubscriptionsRepository,
			"findActiveByOwner"
		>,
	) {
		this.promoter = new TurnPromoter(this.turns, this.lock, this.starter);
	}

	/**
	 * `POST /v2/projects/:id/turns`. Reserves a credit hold, then either
	 * queues the turn behind an active one (`waiting` row, `queued: true`)
	 * or takes the project lock and starts `builder-turn` right away. A
	 * lock held by a restore answers 409 BUILDER_TURN_ACTIVE. A project
	 * whose last turn waits on an approval card answers 409
	 * BUILDER_APPROVAL_PENDING until the body carries `approval`.
	 */
	async create(
		scope: ProjectScope,
		projectId: string,
		body: CreateTurnRequest,
		/** Set by the create-project path: the first user message row already exists inside the create transaction. */
		options: { existingMessageId?: string } = {},
	): Promise<CreateTurnResponse> {
		const engine = await this.projects.findEngineByIdForScope(scope, projectId);
		// One 404 for "missing", "out of scope", and "not a V2 project".
		if (engine !== "v2_app") {
			throw new NotFoundException();
		}

		const chat = await this.chats.findAccessibleChatById(scope, body.chatId);
		if (!chat || chat.projectId !== projectId) {
			throw new NotFoundException();
		}

		assertWanditHostedAttachments(scope.userId, body.attachments);
		// Security check: an answer file reaches the sandbox copy, so it
		// passes the same owner check as an attachment.
		assertWanditHostedAttachments(
			scope.userId,
			body.answers?.flatMap((answer) => answer.files),
		);

		// A paused approval card must be answered before a new turn starts;
		// a paused question is answered by `answers` or by the message text.
		const waitingTurn = await this.turns.findWaitingForUser(projectId);
		if (
			waitingTurn?.status === "waiting_for_approval" &&
			body.approval === undefined
		) {
			throw new BuilderApprovalPendingError();
		}

		const turnId = randomUUID();
		// A pre-written first message (project create) keeps its id; every
		// other turn mints a fresh row id here.
		const messageId = options.existingMessageId ?? randomUUID();
		const defaultModel = this.v2Env.V2_DEFAULT_MODEL ?? null;
		const harness = HARNESS_BY_ENV[this.v2Env.V2_HARNESS];
		const subject = meteringSubjectFrom(scope);

		let model = defaultModel;
		if (body.model !== undefined) {
			// Without a deploy default the plan allow-list cannot be computed,
			// so every pick is denied.
			const allowed =
				defaultModel === null
					? []
					: allowedLlmModels(
							await resolveBillingPlan(this.subscriptions, subject),
							defaultModel,
						);
			if (!allowed.includes(body.model)) {
				throw new BadRequestException({
					code: "V2_MODEL_DENIED",
					message: "This plan may not run that model",
				});
			}
			model = body.model;
		}

		// The monthly cap refuses before the hold: the pool could pay, the
		// cap could not — buying credits is not the fix.
		const caps = await this.caps.findByProjectId(projectId);
		if (
			caps?.monthlyCapCredits != null &&
			(await this.metering.monthlySpendCredits(
				projectId,
				monthStartUtc(new Date()),
			)) >= caps.monthlyCapCredits
		) {
			throw new ForbiddenException({
				code: "PROJECT_CREDIT_CAP_REACHED",
				details: { cap: "monthly" },
				message: "This project reached its monthly credit cap",
			});
		}

		// A runaway client holding many open turns would drain the pool;
		// three reserved sessions per actor is the hard stop.
		if (
			(await this.metering.countReservedByActor(
				"agent_session",
				scope.userId,
			)) >= MAX_ACTIVE_TURNS_PER_ACTOR
		) {
			throw new HttpException(
				{
					code: "TOO_MANY_ACTIVE_TURNS",
					message: "Too many turns are running for this user",
				},
				HttpStatus.TOO_MANY_REQUESTS,
			);
		}

		const estimate = await this.estimateTurn(
			projectId,
			model,
			caps?.perTurnCapCredits ?? null,
		);

		// The hold runs before the lock on purpose: a 402 must leave the
		// project lock and the turn tables untouched. InsufficientCreditsError
		// passes through unchanged. GENERATION_BILLING_MODE=off keeps the
		// local dev bypass: no reserve, nothing to refund later.
		const billingOff = env.GENERATION_BILLING_MODE === "off";
		const hold = billingOff
			? null
			: await this.metering.reserveWithReplay("agent_session", subject, {
					attemptRef: turnId,
					chatId: body.chatId,
					credits: estimate.creditsCc,
					idempotencyKey: `builder-turn:${turnId}`,
					messageId,
					model,
					projectId,
				});
		if (billingOff) {
			this.logger.log("billing.off", { turnId });
		}

		let lockHeld = false;
		let rowCreated = false;
		try {
			const session = await this.ensureSession(
				scope,
				projectId,
				body.chatId,
				harness,
				model,
			);
			const spec: BuilderTurnSpec = {
				answers: body.answers ?? [],
				approval: body.approval,
				attachments: body.attachments ?? [],
				composer: body.composer ?? null,
				message: body.message,
			};

			// The row check is the fast path; the lock is authoritative. The
			// unique index is the last guard for a create/promote race.
			const active = await this.turns.findActiveForProject(projectId);
			// A parked `waiting` row means an earlier promote stranded the
			// queue. A new submit must park behind it, never jump the slot.
			const oldestWaiting =
				active === null ? await this.turns.findOldestWaiting(projectId) : null;
			const acquired =
				active === null &&
				oldestWaiting === null &&
				(await this.lock.acquire(projectId, turnId, TURN_LOCK_TTL_MS));
			lockHeld = acquired;

			if (!acquired && active === null && oldestWaiting === null) {
				// The busy lock holder is not a turn row. A `restore:` prefix
				// marks a running restore; parking would strand the row because
				// a restore never promotes a waiting turn. Answer a 409.
				const holder = await this.lock.holder(projectId);
				if (holder?.startsWith(RESTORE_LOCK_HOLDER_PREFIX)) {
					throw new ConflictException({
						code: BUILDER_TURN_ACTIVE_ERROR_CODE,
						message: "A restore is running for this project",
					});
				}
			}

			const status: "queued" | "waiting" = acquired ? "queued" : "waiting";

			const created = await this.turns.create({
				chatId: body.chatId,
				harness,
				id: turnId,
				messageId,
				model,
				organizationId: scope.kind === "org" ? scope.organizationId : null,
				projectId,
				requestKey: turnId,
				sessionId: session.id,
				spec,
				status,
				userId: scope.userId,
			});
			rowCreated = true;

			if (created.replayed) {
				// The requestKey matched an earlier row: adopt it. The fresh hold
				// is keyed on the NEW turn id, so it must go back. `refund` is
				// idempotent on an already-refunded event, so the catch path may
				// safely retry it when this call itself fails.
				if (lockHeld) {
					await this.lock.release(projectId, turnId);
				}
				if (hold !== null) {
					await this.metering.refund(
						hold.event.id,
						"builder_turn_create_replayed",
					);
				}
				return this.responseFor(created.turn, body.chatId, estimate);
			}

			if (options.existingMessageId === undefined) {
				await this.chats.insertTurnUserMessage({
					attachments: body.attachments,
					chatId: body.chatId,
					composer: body.composer,
					id: messageId,
					text: body.message,
					turnId: created.turn.id,
				});
			} else {
				// The create transaction already wrote the user message; only the
				// turn link is missing.
				await this.chats.attachTurnToMessage({
					chatId: body.chatId,
					messageId,
					turnId: created.turn.id,
				});
			}

			if (!acquired) {
				if (oldestWaiting !== null) {
					// The slot is free but a row is parked ahead. Promote it now;
					// no terminal event may come.
					await this.promoter
						.promoteNext(projectId)
						.catch((promoteError: unknown) => {
							this.logger.warn(
								`Turn promotion on a stranded queue failed for ${projectId}: ${
									promoteError instanceof Error
										? promoteError.message
										: String(promoteError)
								}`,
							);
						});
				}
				return this.responseFor(created.turn, body.chatId, estimate);
			}

			const { runId } = await this.starter.start({
				actorUserId: scope.userId,
				organizationId: scope.kind === "org" ? scope.organizationId : null,
				projectId,
				turnId: created.turn.id,
			});
			await this.turns.setTriggerRunId(created.turn.id, runId);

			return this.responseFor(
				{ ...created.turn, triggerRunId: runId },
				body.chatId,
				estimate,
			);
		} catch (error) {
			await this.compensateFailedCreate(
				projectId,
				turnId,
				hold?.event.id ?? null,
				{ lockHeld, rowCreated },
				error,
			);
			throw error;
		}
	}

	/**
	 * `POST /v2/projects/:id/turns/:turnId/cancel`. Idempotent: a terminal
	 * row answers its current status. A `waiting` or paused
	 * `waiting_for_*` row flips straight to `canceled`. A paused one also
	 * clears the chat resume state. An active row goes through
	 * `cancelling`, a best-effort remote cancel, and a bounded settle wait
	 * before the final CAS.
	 */
	async cancel(
		scope: ProjectScope,
		projectId: string,
		turnId: string,
	): Promise<CancelTurnResponse> {
		const turn = await this.requireScopedTurn(scope, projectId, turnId);
		const next = nextStatusForCancel(turn.status);

		// Idempotent: a terminal row answers current truth (like V1 stopAttempt).
		if (next === null) {
			return { status: turn.status, turnId: turn.id };
		}

		if (next === "canceled") {
			// A parked row has no run and no lock; nothing must die first.
			// A paused row is the same: the pause already ended the run.
			const moved = await this.turns.transition(
				turn.id,
				["waiting", "waiting_for_answer", "waiting_for_approval"],
				"canceled",
			);
			if (moved) {
				if (
					turn.chatId !== null &&
					(turn.status === "waiting_for_answer" ||
						turn.status === "waiting_for_approval")
				) {
					// LIMIT: a canceled question drops the agent memory of the
					// chat; the next turn starts a cold session. Upgrade:
					// submit a cancelled tool result on the next turn.
					await this.sessions.clearResumeState(turn.chatId);
				}
				await this.refundHold(scope, turn.id);
				return { status: "canceled", turnId: turn.id };
			}
			// Lost a race (a promotion landed between read and CAS): answer
			// the row's current truth instead of spinning.
			const current = await this.turns.findById(turn.id);
			return {
				status: current?.status ?? "waiting",
				turnId: turn.id,
			};
		}

		// `cancelling` rows skip the CAS: a retried cancel re-runs the settle.
		const movedToCancelling =
			turn.status === "cancelling" ||
			(await this.turns.transition(
				turn.id,
				[...CANCELLABLE_TURN_STATUSES],
				"cancelling",
			));

		if (!movedToCancelling) {
			const current = await this.turns.findById(turn.id);
			return {
				status: current?.status ?? turn.status,
				turnId: turn.id,
			};
		}

		if (turn.triggerRunId) {
			await this.starter.cancel(turn.triggerRunId);
			// The run is dead or dying; its proxy token must die with it, or a
			// leftover sandbox process keeps spending the run cap.
			await this.revokeRunToken(turn.triggerRunId);
		}

		await this.waitForCancelSettled(turn.id, turn.triggerRunId);

		// Release before the terminal flip per the issue order: the compare-
		// and-delete makes a stale holder's release a no-op.
		await this.lock.release(projectId, turn.id);

		const finalized = await this.turns.transition(
			turn.id,
			["cancelling"],
			"canceled",
		);
		if (finalized) {
			await this.refundHold(scope, turn.id);
		}

		await this.promoter
			.promoteNext(projectId, turn.id)
			.catch((error: unknown) => {
				this.logger.warn(
					`Turn promotion after cancel failed for ${projectId}: ${
						error instanceof Error ? error.message : String(error)
					}`,
				);
			});

		const current = await this.turns.findById(turn.id);
		return {
			status: current?.status ?? "canceled",
			turnId: turn.id,
		};
	}

	/**
	 * Stream-route access check: the project must be a scoped `v2_app` and
	 * the turn must belong to it. Returns the row for the relay.
	 */
	async assertStreamAccess(
		scope: ProjectScope,
		projectId: string,
		turnId: string,
	): Promise<BuilderTurnRow> {
		return this.requireScopedTurn(scope, projectId, turnId);
	}

	/** The project's currently active turn (for `turns/active/stream`). */
	async findActiveTurn(
		scope: ProjectScope,
		projectId: string,
	): Promise<BuilderTurnRow | null> {
		const engine = await this.projects.findEngineByIdForScope(scope, projectId);
		if (engine !== "v2_app") {
			throw new NotFoundException();
		}

		return this.turns.findActiveForProject(projectId);
	}

	/**
	 * Called by the relay when a `done` event arrives: revokes the run's
	 * proxy token, frees the project lock, and starts the next waiting
	 * turn. The row must already read terminal — a `done` that races the
	 * row write is covered by the task-end promote call, so this path just
	 * skips.
	 */
	async handleTurnEnded(projectId: string, turnId: string): Promise<void> {
		const row = await this.turns.findById(turnId);
		if (!row || row.projectId !== projectId || !isTerminalStatus(row.status)) {
			return;
		}

		// Same rule as cancel: a terminal turn's proxy token must not
		// outlive the run that owned it.
		if (row.triggerRunId) {
			await this.revokeRunToken(row.triggerRunId);
		}

		await this.promoter
			.promoteNext(projectId, turnId)
			.catch((error: unknown) => {
				this.logger.warn(
					`Turn promotion after done failed for ${projectId}: ${
						error instanceof Error ? error.message : String(error)
					}`,
				);
			});
	}

	/**
	 * Scope + project + turn-belongs-to-project in one read path. 404 hides
	 * every failure kind on purpose: missing, out of scope, wrong engine,
	 * and cross-project turn ids are indistinguishable to the client.
	 */
	private async requireScopedTurn(
		scope: ProjectScope,
		projectId: string,
		turnId: string,
	): Promise<BuilderTurnRow> {
		const engine = await this.projects.findEngineByIdForScope(scope, projectId);
		if (engine !== "v2_app") {
			throw new NotFoundException();
		}

		const turn = await this.turns.findById(turnId);
		if (!turn || turn.projectId !== projectId) {
			throw new NotFoundException();
		}

		return turn;
	}

	/**
	 * Finds or creates the chat's `builder_sessions` row. A raced
	 * double-create hits `builder_sessions_chatId_uq`; the loser adopts the
	 * winner's row.
	 */
	private async ensureSession(
		scope: ProjectScope,
		projectId: string,
		chatId: string,
		harness: HarnessKind,
		model: string | null,
	): Promise<BuilderSessionRow> {
		const existing = await this.sessions.findByChatId(chatId);
		if (existing) {
			return existing;
		}

		try {
			return await this.sessions.create({
				chatId,
				harness,
				model,
				organizationId: scope.kind === "org" ? scope.organizationId : null,
				projectId,
				templateVersion: null,
				userId: scope.userId,
			});
		} catch (error) {
			if (!isUniqueViolation(error)) {
				throw error;
			}
			const raced = await this.sessions.findByChatId(chatId);
			if (raced) {
				return raced;
			}
			throw error;
		}
	}

	/**
	 * Sizes the create hold: the median of the last settled `agent_session`
	 * events, or the fixed default when none exists. The result is clamped
	 * to the registry floor/ceiling and the per-turn cap. An outlier history
	 * cannot lock up more than the cap allows. `perTurnCapCredits` is the
	 * caps-row field `create` already read; null means the plan default. A
	 * model with no price row is a deploy error: it answers 503
	 * `V2_MODEL_UNPRICED`, the same answer the LLM proxy gives.
	 */
	private async estimateTurn(
		projectId: string,
		modelId: string | null,
		perTurnCapCredits: number | null,
	): Promise<TurnEstimate> {
		const median = await this.metering.medianSettledCredits(
			projectId,
			"agent_session",
			10,
		);
		const perTurnCap = perTurnCapCredits ?? DEFAULT_PER_TURN_CAP_CREDITS;
		// The floor wins over a sub-floor cap: the reserve needs its minimum
		// collateral, and the runtime cap check stops the turn at once.
		const upperBound = Math.max(
			Math.min(AGENT_SESSION_RESERVE_CEILING_CREDITS, perTurnCap),
			AGENT_SESSION_RESERVE_FLOOR_CREDITS,
		);
		const creditsCc = Math.min(
			Math.max(
				median ?? TURN_HOLD_DEFAULT_CREDITS,
				AGENT_SESSION_RESERVE_FLOOR_CREDITS,
			),
			upperBound,
		);
		let multiplier = 1;
		const defaultModel = this.v2Env.V2_DEFAULT_MODEL;
		if (modelId !== null && defaultModel !== undefined) {
			try {
				multiplier = harnessModelMultiplier(modelId, defaultModel);
			} catch (error) {
				// No price row is a deploy error, not a user error; the LLM
				// proxy answers 503 for the same case.
				throw new ServiceUnavailableException(
					{
						code: "V2_MODEL_UNPRICED",
						message: `Model ${modelId} has no price row`,
					},
					{ cause: error },
				);
			}
		}
		return {
			basis: median === null ? "fixed" : "history",
			creditsCc,
			modelId,
			multiplier,
		};
	}

	/**
	 * Undoes a failed `create` in reverse order: mark a written row failed
	 * (frees the active slot), release the lock, refund the hold, then let a
	 * waiting turn try for the freed slot. No step may mask the real error.
	 * `holdEventId` is null under GENERATION_BILLING_MODE=off: no reserve
	 * exists, so the refund step is skipped.
	 */
	private async compensateFailedCreate(
		projectId: string,
		turnId: string,
		holdEventId: string | null,
		flags: {
			lockHeld: boolean;
			rowCreated: boolean;
		},
		error: unknown,
	): Promise<void> {
		if (flags.rowCreated) {
			await this.turns
				.fail(turnId, {
					error: error instanceof Error ? error.message : "Turn create failed",
					failureCode: "create_failed",
					failureKind: "internal",
					failureProvider: null,
					failureProviderMessage: null,
					failureRequestId: null,
					failureSource: "api",
					sentryEventId: null,
				})
				.catch((failError: unknown) => {
					this.logger.warn(
						`Marking turn ${turnId} failed errored: ${
							failError instanceof Error ? failError.message : String(failError)
						}`,
					);
				});
		}

		const compensations: Array<Promise<unknown>> = [];
		if (flags.lockHeld) {
			compensations.push(this.lock.release(projectId, turnId));
		}
		if (holdEventId !== null) {
			// `refund` is idempotent on an already-refunded event, so a
			// replayed create's earlier refund does not make this second
			// call throw.
			compensations.push(
				this.metering.refund(holdEventId, "builder_turn_create_failed"),
			);
		}
		const results = await Promise.allSettled(compensations);
		for (const result of results) {
			if (result.status === "rejected") {
				this.logger.error(
					`Turn create compensation failed for ${turnId}`,
					result.reason instanceof Error
						? result.reason.stack
						: String(result.reason),
				);
			}
		}

		if (flags.rowCreated && flags.lockHeld) {
			// The slot is free again; a parked turn may start. A failed promote
			// leaves the row `waiting` — the next terminal event retries.
			await this.promoter
				.promoteNext(projectId, turnId)
				.catch((promoteError: unknown) => {
					this.logger.warn(
						`Turn promotion after create failure for ${projectId}: ${
							promoteError instanceof Error
								? promoteError.message
								: String(promoteError)
						}`,
					);
				});
		}
	}

	/**
	 * Bounded settle wait after a cancel. With a run id, reads the `ui`
	 * stream until a `done` event or the deadline; without one, polls the
	 * row every 500 ms until it reads terminal or the deadline passes.
	 */
	private async waitForCancelSettled(
		turnId: string,
		triggerRunId: string | null,
	): Promise<void> {
		if (triggerRunId) {
			const controller = new AbortController();
			const timeout = setTimeout(
				() => controller.abort(),
				CANCEL_SETTLE_TIMEOUT_MS,
			);
			try {
				for await (const event of this.turnEvents.read(
					triggerRunId,
					controller.signal,
				)) {
					// Any `done` means the run ended; the CAS after this wait
					// settles the true status.
					if (event.type === "done") {
						return;
					}
				}
				return;
			} catch (error) {
				// An aborted wait is the deadline path; a real read error must
				// never block the cancel.
				if (!controller.signal.aborted) {
					this.logger.warn(
						`Cancel settle stream read failed for run ${triggerRunId}: ${
							error instanceof Error ? error.message : String(error)
						}`,
					);
				}
				return;
			} finally {
				clearTimeout(timeout);
			}
		}

		const deadline = Date.now() + CANCEL_SETTLE_TIMEOUT_MS;
		while (Date.now() < deadline) {
			const row = await this.turns.findById(turnId);
			if (!row || isTerminalStatus(row.status)) {
				return;
			}
			await delay(CANCEL_SETTLE_POLL_MS);
		}
	}

	/**
	 * Kills the run's LLM proxy token: the turn ended, so the token must
	 * die even though its 65-minute expiry has not passed. Best-effort — a
	 * Redis failure must not mask the cancel or the promotion.
	 */
	private async revokeRunToken(runId: string): Promise<void> {
		try {
			await this.counters.revokeRun(runId, LLM_PROXY_TOKEN_TTL_SECONDS);
		} catch (error) {
			this.logger.warn(
				`LLM run token revoke failed for ${runId}: ${
					error instanceof Error ? error.message : String(error)
				}`,
			);
		}
	}

	/** Refunds the still-reserved create hold; a settled one stays paid. */
	private async refundHold(scope: ProjectScope, turnId: string): Promise<void> {
		const event = await this.metering.findByIdempotencyKey(
			`builder-turn:${turnId}`,
			meteringSubjectFrom(scope),
		);
		if (event?.status !== "reserved") {
			return;
		}

		try {
			await this.metering.refund(event.id, "builder_turn_canceled");
		} catch (error) {
			// The task may have settled the hold between the read and the
			// refund: the turn did real work, so the charge stands.
			this.logger.warn(
				`Turn hold refund failed for ${turnId}: ${
					error instanceof Error ? error.message : String(error)
				}`,
			);
		}
	}

	private responseFor(
		turn: BuilderTurnRow,
		chatId: string,
		estimate: TurnEstimate,
	): CreateTurnResponse {
		return {
			chatId,
			// The contract's estimate needs a model name; a null model means
			// no deploy default is set, so the field is omitted (it is
			// optional).
			...(estimate.modelId === null
				? {}
				: {
						estimate: {
							basis: estimate.basis,
							// The estimate surfaces whole credits; the hold is
							// centi-credits.
							credits: Math.ceil(estimate.creditsCc / 100),
							modelId: estimate.modelId,
							multiplier: estimate.multiplier,
						},
					}),
			runId: turn.triggerRunId,
			status: turn.status,
			// The reconnect route: the create response rides the create
			// route's own stream, so `streamUrl` exists for a reload resume.
			streamUrl: appBuilderRoutes.activeTurnStream(turn.projectId),
			turnId: turn.id,
			...(turn.status === "waiting" ? { queued: true } : {}),
		};
	}
}
