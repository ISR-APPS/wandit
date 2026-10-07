import { describe, expect, it, vi } from "vitest";

import type { TurnStreamEventInput } from "../modules/app-builder/domain/ports/turn-events";
import type { BuilderTurnRow } from "../modules/app-builder/infrastructure/persistence/builder-turns.repository";
import { FakeLlmSpendCounters } from "../modules/app-builder/infrastructure/redis/fake-llm-spend-counters";
import { FakeTurnLock } from "../modules/app-builder/infrastructure/redis/fake-turn-lock";
import type { AiUsageEvent } from "../modules/metering/domain/metering";
import type { BuilderTurnDeps } from "../trigger/builder-turn.runtime";
import { recoverHostTurns } from "./recover-host-turns";

/** One reply row that the recovery stores. */
type StoredReply = Parameters<BuilderTurnDeps["insertAssistantMessage"]>[0];

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
		runner: "host",
		sentryEventId: null,
		sessionId: "session-1",
		spec: { attachments: [], composer: null, message: "hi" },
		startedAt: new Date(0),
		status: "running",
		triggerRunId: null,
		turnNumber: 1,
		userId: "user-1",
		...overrides,
	};
}

function holdEvent(overrides: Partial<AiUsageEvent> = {}): AiUsageEvent {
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

async function setup(rows: BuilderTurnRow[]) {
	const lock = new FakeTurnLock();
	for (const row of rows) {
		await lock.acquire(row.projectId, row.id, 60_000);
	}
	const counters = new FakeLlmSpendCounters();
	const events: { turnId: string; events: TurnStreamEventInput[] }[] = [];
	/** The stored reply rows, with the count of event batches at each insert. */
	const replies: { eventsBefore: number; reply: StoredReply }[] = [];
	const deps = {
		appendEvents: vi.fn(
			async (turnId: string, list: TurnStreamEventInput[]) => {
				events.push({ events: list, turnId });
			},
		),
		counters,
		insertAssistantMessage: async (reply: StoredReply) => {
			replies.push({ eventsBefore: events.length, reply });
		},
		isRunningOnAnyHost: vi.fn(async (_turnId: string) => false),
		lock,
		logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() },
		metering: {
			findByIdempotencyKey: vi.fn(async () => holdEvent()),
			refund: vi.fn(async () => holdEvent({ status: "refunded" })),
		},
		promoteNext: vi.fn(async (_projectId: string, _endedTurnId: string) => {}),
		turns: {
			fail: vi.fn(async () => true),
			findHostOwnedActive: vi.fn(async () => rows),
			transition: vi.fn(async () => true),
		},
	};
	return { counters, deps, events, lock, replies };
}

describe("recoverHostTurns", () => {
	it("fails a running host turn with no live run and frees everything it held", async () => {
		const { counters, deps, events, lock, replies } = await setup([turnRow()]);

		await recoverHostTurns(deps, new Set(), new Set());

		expect(deps.turns.fail).toHaveBeenCalledWith(
			"turn-1",
			expect.objectContaining({ failureCode: "host_lost" }),
		);
		expect(events[0]?.events.map((event) => event.type)).toEqual([
			"error",
			"done",
		]);
		// A reload shows the same error card and Retry as the live stream.
		const error = events[0]?.events[0];
		expect(replies).toEqual([
			{
				eventsBefore: 0,
				reply: expect.objectContaining({
					chatId: "chat-1",
					metadata: null,
					parts: [
						{ data: error?.data, id: "turn-error", type: "data-turn-error" },
					],
					turnId: "turn-1",
				}),
			},
		]);
		expect(deps.metering.refund).toHaveBeenCalledWith(
			"event-1",
			"builder_turn_failed",
		);
		expect(counters.revoked.has("host-turn-1")).toBe(true);
		expect(await lock.holder("project-1")).toBeNull();
		expect(deps.promoteNext).toHaveBeenCalledWith("project-1", "turn-1");
	});

	it("leaves a turn that runs in this process alone", async () => {
		const { deps } = await setup([turnRow()]);

		await recoverHostTurns(deps, new Set(["turn-1"]), new Set());

		expect(deps.turns.fail).not.toHaveBeenCalled();
	});

	it("leaves a turn with a run mark of another instance alone and ends one without", async () => {
		const { deps, lock } = await setup([
			turnRow({ id: "turn-old-instance" }),
			turnRow({ id: "turn-dead", projectId: "project-2" }),
		]);
		deps.isRunningOnAnyHost.mockImplementation(
			async (turnId) => turnId === "turn-old-instance",
		);

		await recoverHostTurns(deps, new Set(), new Set());

		expect(deps.turns.fail).toHaveBeenCalledTimes(1);
		expect(deps.turns.fail).toHaveBeenCalledWith(
			"turn-dead",
			expect.objectContaining({ failureCode: "host_lost" }),
		);
		expect(await lock.holder("project-1")).toBe("turn-old-instance");
		expect(await lock.holder("project-2")).toBeNull();
	});

	it("ends a queued turn only on its second sweep", async () => {
		const { deps } = await setup([turnRow({ status: "queued" })]);

		const seen = await recoverHostTurns(deps, new Set(), new Set());
		expect(deps.turns.fail).not.toHaveBeenCalled();

		await recoverHostTurns(deps, new Set(), seen);
		expect(deps.turns.fail).toHaveBeenCalledTimes(1);
	});

	it("ends a cancelling turn as canceled", async () => {
		const { deps, events, replies } = await setup([
			turnRow({ status: "cancelling" }),
		]);

		await recoverHostTurns(deps, new Set(), new Set());

		expect(deps.turns.transition).toHaveBeenCalledWith(
			"turn-1",
			["cancelling"],
			"canceled",
			expect.objectContaining({ completedAt: expect.any(Date) }),
		);
		expect(events[0]?.events).toEqual([
			{ data: { status: "canceled" }, type: "done" },
		]);
		// A reload shows the Stopped line.
		expect(replies.map(({ reply }) => reply.parts)).toEqual([
			[
				{
					data: { status: "canceled" },
					id: "turn-done",
					type: "data-turn-done",
				},
			],
		]);
		expect(deps.metering.refund).toHaveBeenCalledWith(
			"event-1",
			"builder_turn_canceled",
		);
	});

	it("does no cleanup when another writer ended the row first", async () => {
		const { deps, lock } = await setup([turnRow()]);
		deps.turns.fail.mockResolvedValue(false);

		await recoverHostTurns(deps, new Set(), new Set());

		expect(deps.appendEvents).not.toHaveBeenCalled();
		expect(await lock.holder("project-1")).toBe("turn-1");
	});

	it("runs the next steps when one step fails", async () => {
		const { deps, lock } = await setup([turnRow()]);
		deps.appendEvents.mockRejectedValue(new Error("redis down"));

		await recoverHostTurns(deps, new Set(), new Set());

		expect(await lock.holder("project-1")).toBeNull();
		expect(deps.promoteNext).toHaveBeenCalled();
	});
});
