import { randomUUID } from "node:crypto";
import {
	BadRequestException,
	ConflictException,
	ForbiddenException,
	HttpException,
	HttpStatus,
	NotFoundException,
	ServiceUnavailableException,
} from "@nestjs/common";
import type { BillingPlanId } from "@wandit/contracts";
import { env } from "@wandit/env/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import type {
	SubscriptionRow,
	SubscriptionsRepository,
} from "../../../billing/infrastructure/persistence/subscriptions.repository";
import type { ChatsRepository } from "../../../generation/infrastructure/persistence/chats.repository";
import type { MeteringService } from "../../../metering/application/services/metering.service";
import type { AiUsageEvent } from "../../../metering/domain/metering";
import type { ProjectScope } from "../../../projects/domain/project-scope";
import type { ProjectsRepository } from "../../../projects/infrastructure/persistence/projects.repository";
import { BuilderTurnActiveError } from "../../domain/errors/builder-turn-active.error";
import type { V2EnvSource } from "../../infrastructure/env/v2-env";
import type { BuilderSessionsRepository } from "../../infrastructure/persistence/builder-sessions.repository";
import type {
	BuilderTurnRow,
	BuilderTurnsRepository,
} from "../../infrastructure/persistence/builder-turns.repository";
import type { ProjectCostCapsRepository } from "../../infrastructure/persistence/project-cost-caps.repository";
import { FakeLlmSpendCounters } from "../../infrastructure/redis/fake-llm-spend-counters";
import { FakeTurnLock } from "../../infrastructure/redis/fake-turn-lock";
import { FakeTurnEventStream } from "../../infrastructure/trigger/fake-turn-events";
import { TurnsService } from "./turns.service";

const SCOPE: ProjectScope = { kind: "personal", userId: "user-1" };
// A real price-table id: the estimate math prices the model, so a made-up
// id would throw inside `estimateTurn`.
const DEFAULT_MODEL = "anthropic/claude-sonnet-5";
const INITIAL_R2_PUBLIC_BASE_URL = env.R2_PUBLIC_BASE_URL;
const INITIAL_GENERATION_BILLING_MODE = env.GENERATION_BILLING_MODE;

afterEach(() => {
	// The env object can be process.env; restore so the storage URL and the
	// billing mode do not leak into other spec files on the same worker.
	if (INITIAL_R2_PUBLIC_BASE_URL === undefined) {
		Reflect.deleteProperty(env, "R2_PUBLIC_BASE_URL");
	} else {
		// SAFETY: restores the value the process had before the suite ran.
		(env as { R2_PUBLIC_BASE_URL?: string }).R2_PUBLIC_BASE_URL =
			INITIAL_R2_PUBLIC_BASE_URL;
	}
	// SAFETY: restores the value the process had before the suite ran.
	(
		env as typeof env & { GENERATION_BILLING_MODE: "enforce" | "off" }
	).GENERATION_BILLING_MODE = INITIAL_GENERATION_BILLING_MODE;
});

function subscriptionRow(plan: BillingPlanId): SubscriptionRow {
	const now = new Date("2026-09-16T00:00:00.000Z");
	return {
		cancelAtPeriodEnd: false,
		createdAt: now,
		currentPeriodEnd: now,
		currentPeriodStart: now,
		id: "sub_1",
		interval: "year",
		organizationId: null,
		pendingAppliedBy: null,
		pendingInterval: null,
		pendingPlan: null,
		pendingTierCredits: null,
		plan,
		priceLookupKey: "business_1000_year",
		provider: "stripe",
		providerSubscriptionId: "sub_stripe_1",
		status: "active",
		tierCredits: 1_000,
		updatedAt: now,
		userId: "user-1",
	};
}

function turnRow(overrides: Partial<BuilderTurnRow> = {}): BuilderTurnRow {
	return {
		cacheReadTokens: null,
		cacheWriteTokens: null,
		chatId: "chat-1",
		completedAt: null,
		createdAt: new Date(0),
		credits: null,
		error: null,
		failureCode: null,
		failureKind: null,
		failureProvider: null,
		failureProviderMessage: null,
		failureRequestId: null,
		failureSource: null,
		harness: "claude_code",
		id: "turn-1",
		inputCommitSha: null,
		inputTokens: null,
		messageId: "message-1",
		model: null,
		organizationId: null,
		outputCommitSha: null,
		outputTokens: null,
		projectId: "project-1",
		requestKey: "turn-1",
		sentryEventId: null,
		sessionId: "session-1",
		spec: { attachments: [], composer: null, message: "hi" },
		startedAt: null,
		status: "queued",
		triggerRunId: null,
		turnNumber: 1,
		userId: "user-1",
		...overrides,
	};
}

function usageEvent(overrides: Partial<AiUsageEvent> = {}): AiUsageEvent {
	return {
		attemptRef: null,
		cacheReadTokens: null,
		cacheWriteTokens: null,
		chatId: null,
		createdAt: new Date(0),
		estimatedCostUsdMicros: null,
		executionLeaseExpiresAt: null,
		executionLeaseToken: null,
		finalCredits: null,
		id: "event-1",
		idempotencyKey: "builder-turn:turn-1",
		inputTokens: null,
		messageId: null,
		model: null,
		nextReconcileAttemptAt: null,
		operation: "agent_session",
		organizationId: null,
		outputTokens: null,
		parentEventId: null,
		pricingSnapshot: null,
		projectId: "project-1",
		provider: null,
		rawUsage: null,
		reconcileAttempts: 0,
		reconciledAt: null,
		reconciledCostUsdMicros: null,
		reservedCredits: 1_400,
		settledAt: null,
		status: "reserved",
		userId: "user-1",
		...overrides,
	};
}

function setup(
	v2Env: V2EnvSource = {
		V2_DEFAULT_MODEL: DEFAULT_MODEL,
		V2_HARNESS: "claude-code",
	},
) {
	const turns = {
		create: vi.fn(
			async (input: Parameters<BuilderTurnsRepository["create"]>[0]) => ({
				replayed: false,
				turn: turnRow({
					id: input.id,
					requestKey: input.id,
					status: input.status,
				}),
			}),
		),
		fail: vi.fn(async () => true),
		findActiveForChat: vi.fn<BuilderTurnsRepository["findActiveForChat"]>(
			async () => [],
		),
		findActiveForProject: vi.fn<BuilderTurnsRepository["findActiveForProject"]>(
			async () => null,
		),
		findById: vi.fn<BuilderTurnsRepository["findById"]>(async () => null),
		findOldestWaiting: vi.fn<BuilderTurnsRepository["findOldestWaiting"]>(
			async () => null,
		),
		findWaitingForUser: vi.fn<BuilderTurnsRepository["findWaitingForUser"]>(
			async () => null,
		),
		promoteOldestWaiting: vi.fn<BuilderTurnsRepository["promoteOldestWaiting"]>(
			async () => null,
		),
		setTriggerRunId: vi.fn(async () => undefined),
		transition: vi.fn<BuilderTurnsRepository["transition"]>(async () => true),
	};
	const sessions = {
		clearResumeState: vi.fn(async () => null),
		create: vi.fn(async () => ({ id: "session-1" })),
		findByChatId: vi.fn(
			async (): Promise<{ id: string } | null> => ({ id: "session-1" }),
		),
	};
	const chats = {
		attachTurnToMessage: vi.fn(async () => undefined),
		findAccessibleChatById: vi.fn(async () => ({
			id: "chat-1",
			projectId: "project-1",
			userId: "user-1",
		})),
		insertTurnUserMessage: vi.fn(
			async (
				_input: Parameters<ChatsRepository["insertTurnUserMessage"]>[0],
			) => ({ id: "message-1" }),
		),
	};
	const projects = {
		findEngineByIdForScope: vi.fn<ProjectsRepository["findEngineByIdForScope"]>(
			async () => "v2_app",
		),
	};
	const metering = {
		countReservedByActor: vi.fn<MeteringService["countReservedByActor"]>(
			async () => 0,
		),
		findByIdempotencyKey: vi.fn<MeteringService["findByIdempotencyKey"]>(
			async () => null,
		),
		medianSettledCredits: vi.fn<MeteringService["medianSettledCredits"]>(
			async () => null,
		),
		monthlySpendCredits: vi.fn<MeteringService["monthlySpendCredits"]>(
			async () => 0,
		),
		refund: vi.fn(async () => undefined),
		reserveWithReplay: vi.fn(async () => ({
			event: { id: "event-1", status: "reserved" },
			replay: "none" as const,
			replayed: false as const,
		})),
	};
	const caps = {
		findByProjectId: vi.fn<ProjectCostCapsRepository["findByProjectId"]>(
			async () => null,
		),
	};
	const subscriptions = {
		findActiveByOwner: vi.fn<SubscriptionsRepository["findActiveByOwner"]>(
			async () => null,
		),
	};
	const lock = new FakeTurnLock();
	const starter = {
		cancel: vi.fn(async () => undefined),
		start: vi.fn(async () => ({ runId: "run-1" })),
	};
	const turnEvents = new FakeTurnEventStream();
	const counters = new FakeLlmSpendCounters();

	const service = new TurnsService(
		turns as unknown as BuilderTurnsRepository,
		sessions as unknown as BuilderSessionsRepository,
		chats as unknown as ChatsRepository,
		projects as unknown as ProjectsRepository,
		metering as unknown as MeteringService,
		lock,
		starter,
		turnEvents,
		v2Env,
		counters,
		caps,
		subscriptions,
	);

	return {
		caps,
		chats,
		counters,
		lock,
		metering,
		projects,
		service,
		sessions,
		starter,
		subscriptions,
		turnEvents,
		turns,
	};
}

const BODY = { chatId: randomUUID(), message: "build me a page" };

describe("TurnsService.create", () => {
	it("rejects a project that is not a v2_app before any credit moves", async () => {
		const { metering, projects, service, turns } = setup();
		projects.findEngineByIdForScope.mockResolvedValue("v1_page");

		await expect(service.create(SCOPE, "project-1", BODY)).rejects.toThrow(
			NotFoundException,
		);
		expect(metering.reserveWithReplay).not.toHaveBeenCalled();
		expect(turns.create).not.toHaveBeenCalled();
	});

	it("rejects a chat that belongs to another project", async () => {
		const { chats, service } = setup();
		chats.findAccessibleChatById.mockResolvedValue({
			id: "chat-9",
			projectId: "other-project",
			userId: "user-1",
		});

		await expect(service.create(SCOPE, "project-1", BODY)).rejects.toThrow(
			NotFoundException,
		);
	});

	it("rejects attachments the user did not upload through Wandit", async () => {
		(env as { R2_PUBLIC_BASE_URL?: string }).R2_PUBLIC_BASE_URL =
			"https://assets.example.com/public";
		const { metering, service } = setup();

		await expect(
			service.create(SCOPE, "project-1", {
				...BODY,
				attachments: [
					{
						mediaType: "image/webp",
						url: "https://assets.example.com/public/uploads/other-user/u/a.webp",
					},
				],
			}),
		).rejects.toThrow(BadRequestException);
		expect(metering.reserveWithReplay).not.toHaveBeenCalled();
	});

	it("rejects answer files the user did not upload through Wandit", async () => {
		// SAFETY: env is a mutable object at runtime; the afterEach hook at the
		// top of the file restores this value.
		(env as { R2_PUBLIC_BASE_URL?: string }).R2_PUBLIC_BASE_URL =
			"https://assets.example.com/public";
		const { metering, service, turns } = setup();

		await expect(
			service.create(SCOPE, "project-1", {
				...BODY,
				answers: [
					{
						action: "answered",
						files: [
							{
								mediaType: "image/png",
								url: "https://assets.example.com/public/uploads/other-user/u/logo.png",
							},
						],
						optionIds: [],
						questionId: "question-0",
						text: "",
						toolCallId: "call-7",
					},
				],
			}),
		).rejects.toThrow(BadRequestException);
		expect(metering.reserveWithReplay).not.toHaveBeenCalled();
		expect(turns.create).not.toHaveBeenCalled();
	});

	it("reserves the agent_session hold, locks, queues, and starts the task", async () => {
		const { chats, lock, metering, service, starter, turns } = setup();

		const result = await service.create(SCOPE, "project-1", BODY);

		// No settled turns yet: the fixed 14-credit default hold applies.
		expect(metering.reserveWithReplay).toHaveBeenCalledWith(
			"agent_session",
			{ actorUserId: "user-1" },
			expect.objectContaining({
				credits: 1_400,
				idempotencyKey: expect.stringMatching(/^builder-turn:/),
				model: DEFAULT_MODEL,
				projectId: "project-1",
			}),
		);
		expect(turns.create).toHaveBeenCalledWith(
			expect.objectContaining({ model: DEFAULT_MODEL, status: "queued" }),
		);
		expect(chats.insertTurnUserMessage).toHaveBeenCalled();
		expect(starter.start).toHaveBeenCalledTimes(1);
		expect(turns.setTriggerRunId).toHaveBeenCalledWith(
			expect.any(String),
			"run-1",
		);
		expect(await lock.holder("project-1")).toBe(result.turnId);
		expect(result).toMatchObject({
			estimate: {
				basis: "fixed",
				credits: 14,
				modelId: DEFAULT_MODEL,
				multiplier: 1,
			},
			runId: "run-1",
			status: "queued",
			streamUrl: "/api/v2/projects/project-1/turns/active/stream",
		});
		expect(result).not.toHaveProperty("queued");
	});

	it("sizes the hold from the settled-turn median when history exists", async () => {
		const { metering, service } = setup();
		metering.medianSettledCredits.mockResolvedValue(2_300);

		const result = await service.create(SCOPE, "project-1", BODY);

		expect(metering.medianSettledCredits).toHaveBeenCalledWith(
			"project-1",
			"agent_session",
			10,
		);
		expect(metering.reserveWithReplay).toHaveBeenCalledWith(
			"agent_session",
			{ actorUserId: "user-1" },
			expect.objectContaining({ credits: 2_300 }),
		);
		expect(result.estimate).toEqual({
			basis: "history",
			credits: 23,
			modelId: DEFAULT_MODEL,
			multiplier: 1,
		});
	});

	it("clamps a tiny median up to the agent_session reserve floor", async () => {
		const { metering, service } = setup();
		metering.medianSettledCredits.mockResolvedValue(100);

		const result = await service.create(SCOPE, "project-1", BODY);

		expect(metering.reserveWithReplay).toHaveBeenCalledWith(
			"agent_session",
			{ actorUserId: "user-1" },
			expect.objectContaining({ credits: 500 }),
		);
		expect(result.estimate).toEqual({
			basis: "history",
			credits: 5,
			modelId: DEFAULT_MODEL,
			multiplier: 1,
		});
	});

	it("clamps the hold to the project per-turn cap", async () => {
		const { caps, metering, service } = setup();
		caps.findByProjectId.mockResolvedValue({
			monthlyCapCredits: null,
			perTurnCapCredits: 5_000,
		});
		metering.medianSettledCredits.mockResolvedValue(9_000);

		const result = await service.create(SCOPE, "project-1", BODY);

		expect(metering.reserveWithReplay).toHaveBeenCalledWith(
			"agent_session",
			{ actorUserId: "user-1" },
			expect.objectContaining({ credits: 5_000 }),
		);
		expect(result.estimate).toEqual({
			basis: "history",
			credits: 50,
			modelId: DEFAULT_MODEL,
			multiplier: 1,
		});
	});

	it("denies a picked model outside the plan allow-list before the hold", async () => {
		const { metering, service, turns } = setup();
		// The default starter plan may only run the default and haiku.

		const failure = await service
			.create(SCOPE, "project-1", {
				...BODY,
				model: "anthropic/claude-opus-5",
			})
			.catch((error: unknown) => error);

		expect(failure).toBeInstanceOf(BadRequestException);
		// SAFETY: toBeInstanceOf above proves the error type; getResponse
		// carries the { code, message } body passed to the constructor.
		expect((failure as BadRequestException).getResponse()).toMatchObject({
			code: "V2_MODEL_DENIED",
		});
		expect(metering.reserveWithReplay).not.toHaveBeenCalled();
		expect(turns.create).not.toHaveBeenCalled();
	});

	it("runs a plan-allowed model pick and stores it on the row", async () => {
		const { metering, service, subscriptions, turns } = setup();
		subscriptions.findActiveByOwner.mockResolvedValue(
			subscriptionRow("business"),
		);

		const result = await service.create(SCOPE, "project-1", {
			...BODY,
			model: "anthropic/claude-opus-5",
		});

		expect(metering.reserveWithReplay).toHaveBeenCalledWith(
			"agent_session",
			{ actorUserId: "user-1" },
			expect.objectContaining({ model: "anthropic/claude-opus-5" }),
		);
		expect(turns.create).toHaveBeenCalledWith(
			expect.objectContaining({ model: "anthropic/claude-opus-5" }),
		);
		// Opus 5 outputs $25/MTok over Sonnet 5's $10/MTok: multiplier 2.5.
		expect(result.estimate).toEqual({
			basis: "fixed",
			credits: 14,
			modelId: "anthropic/claude-opus-5",
			multiplier: 2.5,
		});
	});

	it("answers 503 V2_MODEL_UNPRICED when the deploy default has no price row", async () => {
		const { metering, service, turns } = setup({
			V2_DEFAULT_MODEL: "x/unpriced",
			V2_HARNESS: "claude-code",
		});

		const failure = await service
			.create(SCOPE, "project-1", BODY)
			.catch((error: unknown) => error);

		expect(failure).toBeInstanceOf(ServiceUnavailableException);
		// SAFETY: toBeInstanceOf above proves the error type; getStatus and
		// getResponse read what the constructor stored.
		const exception = failure as ServiceUnavailableException;
		expect(exception.getStatus()).toBe(HttpStatus.SERVICE_UNAVAILABLE);
		expect(exception.getResponse()).toMatchObject({
			code: "V2_MODEL_UNPRICED",
		});
		expect(metering.reserveWithReplay).not.toHaveBeenCalled();
		expect(turns.create).not.toHaveBeenCalled();
	});

	it("answers 403 PROJECT_CREDIT_CAP_REACHED when the monthly cap is spent", async () => {
		const { caps, metering, service, turns } = setup();
		caps.findByProjectId.mockResolvedValue({
			monthlyCapCredits: 4_000,
			perTurnCapCredits: null,
		});
		metering.monthlySpendCredits.mockResolvedValue(4_500);

		const failure = await service
			.create(SCOPE, "project-1", BODY)
			.catch((error: unknown) => error);

		expect(failure).toBeInstanceOf(ForbiddenException);
		// SAFETY: toBeInstanceOf above proves the error type; getResponse
		// carries the { code, details, message } body passed to the constructor.
		expect((failure as ForbiddenException).getResponse()).toMatchObject({
			code: "PROJECT_CREDIT_CAP_REACHED",
			details: { cap: "monthly" },
		});
		expect(metering.monthlySpendCredits).toHaveBeenCalledWith(
			"project-1",
			expect.any(Date),
		);
		expect(metering.reserveWithReplay).not.toHaveBeenCalled();
		expect(turns.create).not.toHaveBeenCalled();
	});

	it("answers 429 TOO_MANY_ACTIVE_TURNS when the actor holds three sessions", async () => {
		const { metering, service, turns } = setup();
		metering.countReservedByActor.mockResolvedValue(3);

		const failure = await service
			.create(SCOPE, "project-1", BODY)
			.catch((error: unknown) => error);

		expect(failure).toBeInstanceOf(HttpException);
		// SAFETY: toBeInstanceOf above proves the error type; getStatus and
		// getResponse read what the constructor stored.
		const exception = failure as HttpException;
		expect(exception.getStatus()).toBe(HttpStatus.TOO_MANY_REQUESTS);
		expect(exception.getResponse()).toMatchObject({
			code: "TOO_MANY_ACTIVE_TURNS",
		});
		expect(metering.reserveWithReplay).not.toHaveBeenCalled();
		expect(turns.create).not.toHaveBeenCalled();
	});

	it("skips the hold under GENERATION_BILLING_MODE=off and still answers the estimate", async () => {
		// SAFETY: the env schema already types this field as "enforce" | "off".
		(
			env as typeof env & { GENERATION_BILLING_MODE: "enforce" | "off" }
		).GENERATION_BILLING_MODE = "off";
		const { metering, service } = setup();

		const result = await service.create(SCOPE, "project-1", BODY);

		expect(metering.reserveWithReplay).not.toHaveBeenCalled();
		expect(result.estimate).toEqual({
			basis: "fixed",
			credits: 14,
			modelId: DEFAULT_MODEL,
			multiplier: 1,
		});
	});

	it("does not refund when a billing-off create fails after the row", async () => {
		// SAFETY: the env schema already types this field as "enforce" | "off".
		(
			env as typeof env & { GENERATION_BILLING_MODE: "enforce" | "off" }
		).GENERATION_BILLING_MODE = "off";
		const { metering, service, starter, turns } = setup();
		starter.start.mockRejectedValue(new Error("trigger down"));

		await expect(service.create(SCOPE, "project-1", BODY)).rejects.toThrow(
			"trigger down",
		);

		expect(turns.fail).toHaveBeenCalledWith(
			expect.any(String),
			expect.objectContaining({ failureCode: "create_failed" }),
		);
		expect(metering.refund).not.toHaveBeenCalled();
	});

	it("parks the turn as waiting behind an active one", async () => {
		const { service, starter, turns } = setup();
		turns.findActiveForProject.mockResolvedValue(turnRow());

		const result = await service.create(SCOPE, "project-1", BODY);

		expect(turns.create).toHaveBeenCalledWith(
			expect.objectContaining({ status: "waiting" }),
		);
		expect(starter.start).not.toHaveBeenCalled();
		expect(result).toMatchObject({ queued: true, runId: null });
	});

	it("parks behind a stranded waiting row and kicks the promote", async () => {
		const { lock, service, starter, turns } = setup();
		// The slot is free but an earlier promote left a row parked: the new
		// submit must queue behind it, and the promote unwedges that row.
		turns.findOldestWaiting.mockResolvedValue(turnRow({ status: "waiting" }));
		turns.promoteOldestWaiting.mockResolvedValue(
			turnRow({ id: "turn-0", status: "queued" }),
		);

		const result = await service.create(SCOPE, "project-1", BODY);

		expect(turns.create).toHaveBeenCalledWith(
			expect.objectContaining({ status: "waiting" }),
		);
		expect(turns.promoteOldestWaiting).toHaveBeenCalledWith("project-1");
		// The stranded row took the lock and started; the new row waits.
		expect(starter.start).toHaveBeenCalledWith(
			expect.objectContaining({ turnId: "turn-0" }),
		);
		expect(await lock.holder("project-1")).toBe("turn-0");
		expect(result).toMatchObject({ queued: true, runId: null });
	});

	it("parks the turn as waiting when the project lock is busy", async () => {
		const { lock, service, starter, turns } = setup();
		await lock.acquire("project-1", "other-turn", 60_000);

		const result = await service.create(SCOPE, "project-1", BODY);

		expect(turns.create).toHaveBeenCalledWith(
			expect.objectContaining({ status: "waiting" }),
		);
		expect(starter.start).not.toHaveBeenCalled();
		expect(result).toMatchObject({ queued: true });
		// The busy lock is untouched: the other turn still holds it.
		expect(await lock.holder("project-1")).toBe("other-turn");
	});

	it("answers 409 BUILDER_TURN_ACTIVE when a restore holds the lock", async () => {
		const { lock, metering, service, turns } = setup();
		await lock.acquire("project-1", "restore:abc-123", 60_000);

		const failure = await service
			.create(SCOPE, "project-1", BODY)
			.catch((error: unknown) => error);

		expect(failure).toBeInstanceOf(ConflictException);
		// SAFETY: toBeInstanceOf above proves the error type; getResponse
		// carries the { code, message } body passed to the constructor.
		expect((failure as ConflictException).getResponse()).toMatchObject({
			code: "BUILDER_TURN_ACTIVE",
		});
		expect(turns.create).not.toHaveBeenCalled();
		expect(metering.refund).toHaveBeenCalledWith(
			"event-1",
			"builder_turn_create_failed",
		);
		// No row parked, no task started; the restore keeps its lock.
		expect(await lock.holder("project-1")).toBe("restore:abc-123");
		expect(turns.promoteOldestWaiting).not.toHaveBeenCalled();
	});

	it("adopts the replayed row and refunds the fresh hold", async () => {
		const { metering, service, turns } = setup();
		const existing = turnRow({ id: "turn-old", status: "running" });
		turns.create.mockResolvedValue({ replayed: true, turn: existing });

		const result = await service.create(SCOPE, "project-1", BODY);

		expect(result.turnId).toBe("turn-old");
		expect(metering.refund).toHaveBeenCalledWith(
			"event-1",
			"builder_turn_create_replayed",
		);
	});

	it("marks the row failed, frees the lock, and refunds when start fails", async () => {
		const { lock, metering, service, starter, turns } = setup();
		starter.start.mockRejectedValue(new Error("trigger down"));

		await expect(service.create(SCOPE, "project-1", BODY)).rejects.toThrow(
			"trigger down",
		);

		expect(turns.fail).toHaveBeenCalledWith(
			expect.any(String),
			expect.objectContaining({ failureCode: "create_failed" }),
		);
		expect(await lock.holder("project-1")).toBeNull();
		expect(metering.refund).toHaveBeenCalledWith(
			"event-1",
			"builder_turn_create_failed",
		);
	});

	it("lets a BuilderTurnActiveError from the unique index pass through", async () => {
		const { metering, service, turns } = setup();
		turns.create.mockRejectedValue(new BuilderTurnActiveError());

		await expect(service.create(SCOPE, "project-1", BODY)).rejects.toThrow(
			BuilderTurnActiveError,
		);
		// No row landed: only the refund runs, nothing is marked failed.
		expect(turns.fail).not.toHaveBeenCalled();
		expect(metering.refund).toHaveBeenCalledWith(
			"event-1",
			"builder_turn_create_failed",
		);
	});

	it("adopts the raced session row when sessions.create hits 23505", async () => {
		const { service, sessions, turns } = setup();
		// First read finds nothing; a concurrent create wins the chat unique
		// index; the re-read then sees the winner's row.
		sessions.findByChatId
			.mockResolvedValueOnce(null)
			.mockResolvedValueOnce({ id: "session-raced" });
		sessions.create.mockRejectedValue(
			Object.assign(new Error("dup"), { code: "23505" }),
		);

		const result = await service.create(SCOPE, "project-1", BODY);

		expect(sessions.findByChatId).toHaveBeenCalledTimes(2);
		expect(turns.create).toHaveBeenCalledWith(
			expect.objectContaining({ sessionId: "session-raced" }),
		);
		expect(result.status).toBe("queued");
	});

	it("answers 409 BUILDER_APPROVAL_PENDING while an approval card waits", async () => {
		const { metering, service, turns } = setup();
		turns.findWaitingForUser.mockResolvedValue(
			turnRow({ status: "waiting_for_approval" }),
		);

		const failure = await service
			.create(SCOPE, "project-1", BODY)
			.catch((error: unknown) => error);

		expect(failure).toBeInstanceOf(ConflictException);
		// SAFETY: toBeInstanceOf above proves the error type; getResponse
		// carries the { code, message } body passed to the constructor.
		expect((failure as ConflictException).getResponse()).toMatchObject({
			code: "BUILDER_APPROVAL_PENDING",
		});
		expect(metering.reserveWithReplay).not.toHaveBeenCalled();
		expect(turns.create).not.toHaveBeenCalled();
	});

	it("stores the approval answer in the turn spec", async () => {
		const { service, turns } = setup();
		turns.findWaitingForUser.mockResolvedValue(
			turnRow({ status: "waiting_for_approval" }),
		);

		await service.create(SCOPE, "project-1", {
			...BODY,
			approval: { approvalId: "appr-1", approved: true },
		});

		expect(turns.create).toHaveBeenCalledWith(
			expect.objectContaining({
				spec: expect.objectContaining({
					approval: { approvalId: "appr-1", approved: true },
				}),
			}),
		);
	});

	it("lets a plain message through while a question card waits", async () => {
		const { service, turns } = setup();
		turns.findWaitingForUser.mockResolvedValue(
			turnRow({ status: "waiting_for_answer" }),
		);

		await service.create(SCOPE, "project-1", BODY);

		expect(turns.create).toHaveBeenCalledTimes(1);
		expect(turns.create.mock.calls[0]?.[0]?.spec.approval).toBeUndefined();
		expect(turns.create.mock.calls[0]?.[0]?.spec.answers).toEqual([]);
	});

	it("stores the question answers in the turn spec", async () => {
		const { service, turns } = setup();
		turns.findWaitingForUser.mockResolvedValue(
			turnRow({ status: "waiting_for_answer" }),
		);
		const answers = [
			{
				action: "answered" as const,
				files: [],
				optionIds: ["zellige"],
				questionId: "question-0",
				text: "",
				toolCallId: "call-7",
			},
		];

		await service.create(SCOPE, "project-1", { ...BODY, answers });

		expect(turns.create).toHaveBeenCalledWith(
			expect.objectContaining({
				spec: expect.objectContaining({ answers }),
			}),
		);
	});

	it("adopts the existing first message instead of inserting a new one", async () => {
		const { chats, service, turns } = setup();
		const existingMessageId = randomUUID();

		const result = await service.create(SCOPE, "project-1", BODY, {
			existingMessageId,
		});

		expect(chats.insertTurnUserMessage).not.toHaveBeenCalled();
		expect(chats.attachTurnToMessage).toHaveBeenCalledWith({
			chatId: BODY.chatId,
			messageId: existingMessageId,
			turnId: result.turnId,
		});
		// The turn row and the hold carry the adopted message id.
		expect(turns.create).toHaveBeenCalledWith(
			expect.objectContaining({ messageId: existingMessageId }),
		);
	});

	it("keeps the plain message insert when no existingMessageId is given", async () => {
		const { chats, service, turns } = setup();

		await service.create(SCOPE, "project-1", BODY);

		expect(chats.attachTurnToMessage).not.toHaveBeenCalled();
		expect(chats.insertTurnUserMessage).toHaveBeenCalledWith(
			expect.objectContaining({ turnId: expect.any(String) }),
		);
		// The message id is minted once and shared by the hold and the row.
		const messageId = chats.insertTurnUserMessage.mock.calls[0]?.[0].id;
		expect(turns.create).toHaveBeenCalledWith(
			expect.objectContaining({ messageId }),
		);
	});
});

describe("TurnsService.cancel", () => {
	it("returns a terminal row unchanged without side effects", async () => {
		const { metering, service, starter, turns } = setup();
		turns.findById.mockResolvedValue(turnRow({ status: "succeeded" }));

		const result = await service.cancel(SCOPE, "project-1", "turn-1");

		expect(result).toEqual({ status: "succeeded", turnId: "turn-1" });
		expect(starter.cancel).not.toHaveBeenCalled();
		expect(metering.refund).not.toHaveBeenCalled();
	});

	it("cancels a parked waiting row directly and refunds the hold", async () => {
		const { metering, service, starter, turns } = setup();
		turns.findById.mockResolvedValue(turnRow({ status: "waiting" }));
		metering.findByIdempotencyKey.mockResolvedValue(usageEvent());

		const result = await service.cancel(SCOPE, "project-1", "turn-1");

		expect(turns.transition).toHaveBeenCalledWith(
			"turn-1",
			["waiting", "waiting_for_answer", "waiting_for_approval"],
			"canceled",
		);
		expect(starter.cancel).not.toHaveBeenCalled();
		expect(metering.refund).toHaveBeenCalledWith(
			"event-1",
			"builder_turn_canceled",
		);
		expect(result.status).toBe("canceled");
	});

	it("cancels a paused turn directly and clears the session resume state", async () => {
		const { metering, service, sessions, starter, turns } = setup();
		turns.findById.mockResolvedValue(turnRow({ status: "waiting_for_answer" }));
		metering.findByIdempotencyKey.mockResolvedValue(usageEvent());

		const result = await service.cancel(SCOPE, "project-1", "turn-1");

		expect(turns.transition).toHaveBeenCalledWith(
			"turn-1",
			["waiting", "waiting_for_answer", "waiting_for_approval"],
			"canceled",
		);
		expect(sessions.clearResumeState).toHaveBeenCalledWith("chat-1");
		expect(starter.cancel).not.toHaveBeenCalled();
		expect(metering.refund).toHaveBeenCalledWith(
			"event-1",
			"builder_turn_canceled",
		);
		expect(result.status).toBe("canceled");
	});

	it("answers the current status when a promotion wins the waiting CAS", async () => {
		const { metering, service, turns } = setup();
		// Read as `waiting`, but the CAS loses: the promote flipped the row
		// to `queued` first, so the answer is the row's new truth.
		turns.findById
			.mockResolvedValueOnce(turnRow({ status: "waiting" }))
			.mockResolvedValueOnce(turnRow({ status: "queued" }));
		turns.transition.mockResolvedValue(false);

		const result = await service.cancel(SCOPE, "project-1", "turn-1");

		expect(turns.transition).toHaveBeenCalledWith(
			"turn-1",
			["waiting", "waiting_for_answer", "waiting_for_approval"],
			"canceled",
		);
		expect(result).toEqual({ status: "queued", turnId: "turn-1" });
		expect(metering.refund).not.toHaveBeenCalled();
	});

	it("answers the current status when the cancellable CAS is lost", async () => {
		const { service, starter, turns } = setup();
		// The row finished between the read and the CAS; cancel answers the
		// settled status instead of cancelling a corpse.
		turns.findById
			.mockResolvedValueOnce(
				turnRow({ status: "running", triggerRunId: "run-1" }),
			)
			.mockResolvedValueOnce(turnRow({ status: "succeeded" }));
		turns.transition.mockResolvedValue(false);

		const result = await service.cancel(SCOPE, "project-1", "turn-1");

		expect(turns.transition).toHaveBeenCalledWith(
			"turn-1",
			["queued", "running"],
			"cancelling",
		);
		expect(starter.cancel).not.toHaveBeenCalled();
		expect(result).toEqual({ status: "succeeded", turnId: "turn-1" });
	});

	it("settles a queued turn with no run id by polling the row", async () => {
		const { lock, service, starter, turns } = setup();
		// The turn never got a run id, so the settle wait cannot watch a
		// stream: it polls the row, which the first poll already reads
		// terminal.
		turns.findById
			.mockResolvedValueOnce(turnRow({ status: "queued", triggerRunId: null }))
			.mockResolvedValue(turnRow({ status: "canceled" }));
		await lock.acquire("project-1", "turn-1", 60_000);

		const result = await service.cancel(SCOPE, "project-1", "turn-1");

		expect(starter.cancel).not.toHaveBeenCalled();
		expect(await lock.holder("project-1")).toBeNull();
		expect(turns.transition).toHaveBeenCalledWith(
			"turn-1",
			["cancelling"],
			"canceled",
		);
		expect(result.status).toBe("canceled");
	});

	it("cancels a running turn, frees the lock, and promotes the next", async () => {
		const { lock, metering, service, starter, turnEvents, turns } = setup();
		const row = turnRow({ status: "running", triggerRunId: "run-1" });
		turns.findById.mockImplementation(async () => row);
		// The fake CAS applies the status change so the final re-read sees it.
		turns.transition.mockImplementation(async (_id, _from, to) => {
			row.status = to;
			return true;
		});
		metering.findByIdempotencyKey.mockResolvedValue(usageEvent());
		await lock.acquire("project-1", "turn-1", 60_000);
		// A closed stream makes the settle wait return at once.
		turnEvents.close("run-1");

		const result = await service.cancel(SCOPE, "project-1", "turn-1");

		expect(turns.transition).toHaveBeenCalledWith(
			"turn-1",
			["queued", "running"],
			"cancelling",
		);
		expect(starter.cancel).toHaveBeenCalledWith("run-1");
		expect(await lock.holder("project-1")).toBeNull();
		expect(metering.refund).toHaveBeenCalledWith(
			"event-1",
			"builder_turn_canceled",
		);
		expect(turns.promoteOldestWaiting).toHaveBeenCalledWith("project-1");
		expect(result.status).toBe("canceled");
	});

	it("revokes the run's proxy token when the cancelled turn had a run", async () => {
		const { counters, service, starter, turnEvents, turns } = setup();
		turns.findById.mockResolvedValue(
			turnRow({ status: "running", triggerRunId: "run-1" }),
		);
		turnEvents.close("run-1");

		await service.cancel(SCOPE, "project-1", "turn-1");

		expect(starter.cancel).toHaveBeenCalledWith("run-1");
		expect(counters.revoked.has("run-1")).toBe(true);
	});

	it("404s on a turn of another project", async () => {
		const { service, turns } = setup();
		turns.findById.mockResolvedValue(turnRow({ projectId: "other" }));

		await expect(service.cancel(SCOPE, "project-1", "turn-1")).rejects.toThrow(
			NotFoundException,
		);
	});
});

describe("TurnsService.findActiveTurn / assertStreamAccess", () => {
	it("returns the active turn for a scoped v2 project", async () => {
		const { service, turns } = setup();
		turns.findActiveForProject.mockResolvedValue(turnRow());

		const result = await service.findActiveTurn(SCOPE, "project-1");

		expect(result?.id).toBe("turn-1");
	});

	it("hides a foreign turn behind 404 on stream access", async () => {
		const { service, turns } = setup();
		turns.findById.mockResolvedValue(turnRow({ projectId: "other" }));

		await expect(
			service.assertStreamAccess(SCOPE, "project-1", "turn-1"),
		).rejects.toThrow(NotFoundException);
	});
});

describe("TurnsService.handleTurnEnded", () => {
	it("releases the lock and promotes when the row is terminal", async () => {
		const { lock, service, turns } = setup();
		turns.findById.mockResolvedValue(turnRow({ status: "succeeded" }));
		await lock.acquire("project-1", "turn-1", 60_000);

		await service.handleTurnEnded("project-1", "turn-1");

		expect(await lock.holder("project-1")).toBeNull();
		expect(turns.promoteOldestWaiting).toHaveBeenCalledWith("project-1");
	});

	it("revokes the run's proxy token when the ended turn had a run", async () => {
		const { counters, service, turns } = setup();
		turns.findById.mockResolvedValue(
			turnRow({ status: "succeeded", triggerRunId: "run-7" }),
		);

		await service.handleTurnEnded("project-1", "turn-1");

		expect(counters.revoked.has("run-7")).toBe(true);
	});

	it("does nothing while the row is still non-terminal", async () => {
		const { lock, service, turns } = setup();
		turns.findById.mockResolvedValue(turnRow({ status: "running" }));
		await lock.acquire("project-1", "turn-1", 60_000);

		await service.handleTurnEnded("project-1", "turn-1");

		expect(await lock.holder("project-1")).toBe("turn-1");
		expect(turns.promoteOldestWaiting).not.toHaveBeenCalled();
	});
});
