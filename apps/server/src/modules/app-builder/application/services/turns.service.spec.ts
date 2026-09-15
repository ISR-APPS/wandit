import { randomUUID } from "node:crypto";
import {
	BadRequestException,
	ConflictException,
	NotFoundException,
} from "@nestjs/common";
import { env } from "@wandit/env/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { ChatsRepository } from "../../../generation/infrastructure/persistence/chats.repository";
import type { MeteringService } from "../../../metering/application/services/metering.service";
import type { AiUsageEvent } from "../../../metering/domain/metering";
import type { ProjectScope } from "../../../projects/domain/project-scope";
import type { ProjectsRepository } from "../../../projects/infrastructure/persistence/projects.repository";
import { BuilderTurnActiveError } from "../../domain/errors/builder-turn-active.error";
import type { BuilderSessionsRepository } from "../../infrastructure/persistence/builder-sessions.repository";
import type {
	BuilderTurnRow,
	BuilderTurnsRepository,
} from "../../infrastructure/persistence/builder-turns.repository";
import { FakeLlmSpendCounters } from "../../infrastructure/redis/fake-llm-spend-counters";
import { FakeTurnLock } from "../../infrastructure/redis/fake-turn-lock";
import { FakeTurnEventStream } from "../../infrastructure/trigger/fake-turn-events";
import { TurnsService } from "./turns.service";

const SCOPE: ProjectScope = { kind: "personal", userId: "user-1" };
const INITIAL_R2_PUBLIC_BASE_URL = env.R2_PUBLIC_BASE_URL;

afterEach(() => {
	// The env object can be process.env; restore so the storage URL does
	// not leak into other spec files on the same worker.
	if (INITIAL_R2_PUBLIC_BASE_URL === undefined) {
		Reflect.deleteProperty(env, "R2_PUBLIC_BASE_URL");
	} else {
		// SAFETY: restores the value the process had before the suite ran.
		(env as { R2_PUBLIC_BASE_URL?: string }).R2_PUBLIC_BASE_URL =
			INITIAL_R2_PUBLIC_BASE_URL;
	}
});

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
		operation: "chat",
		organizationId: null,
		outputTokens: null,
		parentEventId: null,
		pricingSnapshot: null,
		projectId: null,
		provider: null,
		rawUsage: null,
		reconcileAttempts: 0,
		reconciledAt: null,
		reconciledCostUsdMicros: null,
		reservedCredits: 1_000,
		settledAt: null,
		status: "reserved",
		userId: "user-1",
		...overrides,
	};
}

function setup() {
	const turns = {
		create: vi.fn(async (input: { id: string; status: string }) => ({
			replayed: false,
			turn: turnRow({
				id: input.id,
				requestKey: input.id,
				// SAFETY: spec writes only the two legal insert statuses.
				status: input.status as BuilderTurnRow["status"],
			}),
		})),
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
		promoteOldestWaiting: vi.fn<BuilderTurnsRepository["promoteOldestWaiting"]>(
			async () => null,
		),
		setTriggerRunId: vi.fn(async () => undefined),
		transition: vi.fn<BuilderTurnsRepository["transition"]>(async () => true),
	};
	const sessions = {
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
		findByIdempotencyKey: vi.fn<MeteringService["findByIdempotencyKey"]>(
			async () => null,
		),
		refund: vi.fn(async () => undefined),
		reserveWithReplay: vi.fn(async () => ({
			event: { id: "event-1", status: "reserved" },
			replay: "none" as const,
			replayed: false as const,
		})),
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
		{ V2_DEFAULT_MODEL: "model-1", V2_HARNESS: "claude-code" },
		counters,
	);

	return {
		chats,
		counters,
		lock,
		metering,
		projects,
		service,
		sessions,
		starter,
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

	it("reserves the hold, locks, queues, and starts the task", async () => {
		const { chats, lock, metering, service, starter, turns } = setup();

		const result = await service.create(SCOPE, "project-1", BODY);

		expect(metering.reserveWithReplay).toHaveBeenCalledWith(
			"chat",
			{ actorUserId: "user-1" },
			expect.objectContaining({
				credits: 1_000,
				idempotencyKey: expect.stringMatching(/^builder-turn:/),
			}),
		);
		expect(turns.create).toHaveBeenCalledWith(
			expect.objectContaining({ status: "queued" }),
		);
		expect(chats.insertTurnUserMessage).toHaveBeenCalled();
		expect(starter.start).toHaveBeenCalledTimes(1);
		expect(turns.setTriggerRunId).toHaveBeenCalledWith(
			expect.any(String),
			"run-1",
		);
		expect(await lock.holder("project-1")).toBe(result.turnId);
		expect(result).toMatchObject({
			estimate: { basis: "fixed", credits: 10 },
			runId: "run-1",
			status: "queued",
			streamUrl: "/api/v2/projects/project-1/turns/active/stream",
		});
		expect(result).not.toHaveProperty("queued");
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
			["waiting"],
			"canceled",
		);
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
			["waiting"],
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
			["queued", "running", "waiting_for_answer", "waiting_for_approval"],
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
			["queued", "running", "waiting_for_answer", "waiting_for_approval"],
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
