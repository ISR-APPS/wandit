import { describe, expect, it, vi } from "vitest";

import type { BuilderTurnRow } from "../../infrastructure/persistence/builder-turns.repository";
import { FakeTurnLock } from "../../infrastructure/redis/fake-turn-lock";
import { TURN_LOCK_TTL_MS } from "../../infrastructure/redis/redis-turn-lock";
import type { TurnsRepositoryForPromotion } from "./turn-promotion";
import { TurnPromoter } from "./turn-promotion";

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
		status: "waiting",
		triggerRunId: null,
		turnNumber: 1,
		userId: "user-1",
		...overrides,
	};
}

function setup(
	options: {
		promoted?: BuilderTurnRow | null;
		startError?: Error;
		transitionResult?: boolean;
	} = {},
) {
	const promoted = options.promoted ?? null;
	const turns: TurnsRepositoryForPromotion = {
		promoteOldestWaiting: vi.fn(async () => promoted),
		setTriggerRunId: vi.fn(async () => undefined),
		transition: vi.fn(async () => options.transitionResult ?? true),
	};
	const lock = new FakeTurnLock();
	const starter = {
		cancel: vi.fn(async () => undefined),
		start: options.startError
			? vi.fn(async () => {
					throw options.startError;
				})
			: vi.fn(async () => ({ runId: "run-1" })),
	};

	return {
		lock,
		promoter: new TurnPromoter(turns, lock, starter),
		starter,
		turns,
	};
}

describe("TurnPromoter.promoteNext", () => {
	it("returns null when no waiting row exists", async () => {
		const { promoter, starter } = setup();

		await expect(promoter.promoteNext("project-1")).resolves.toBeNull();
		expect(starter.start).not.toHaveBeenCalled();
	});

	it("promotes, takes the lock under the new id, and starts the task", async () => {
		const promoted = turnRow({ id: "turn-2" });
		const { lock, promoter, starter, turns } = setup({ promoted });

		const result = await promoter.promoteNext("project-1");

		expect(result?.id).toBe("turn-2");
		expect(await lock.holder("project-1")).toBe("turn-2");
		expect(starter.start).toHaveBeenCalledWith({
			actorUserId: "user-1",
			organizationId: null,
			projectId: "project-1",
			turnId: "turn-2",
		});
		expect(turns.setTriggerRunId).toHaveBeenCalledWith("turn-2", "run-1");
	});

	it("reverts the row to waiting when the lock is taken", async () => {
		// A foreign holder keeps the lock; the promoted row must not stay
		// queued behind a lock it can never see released.
		const promoted = turnRow({ id: "turn-2" });
		const { lock, promoter, turns } = setup({ promoted });
		await lock.acquire("project-1", "other-turn", TURN_LOCK_TTL_MS);

		await expect(promoter.promoteNext("project-1")).resolves.toBeNull();
		expect(turns.transition).toHaveBeenCalledWith(
			"turn-2",
			["queued"],
			"waiting",
		);
		expect(await lock.holder("project-1")).toBe("other-turn");
	});

	it("releases the ended turn's lock first so the promote cannot wait on the TTL", async () => {
		// The task-end caller runs while the ended turn still holds the lock.
		const promoted = turnRow({ id: "turn-2" });
		const { lock, promoter, starter } = setup({ promoted });
		await lock.acquire("project-1", "turn-1", TURN_LOCK_TTL_MS);

		const result = await promoter.promoteNext("project-1", "turn-1");

		expect(result?.id).toBe("turn-2");
		expect(await lock.holder("project-1")).toBe("turn-2");
		expect(starter.start).toHaveBeenCalledWith(
			expect.objectContaining({ turnId: "turn-2" }),
		);
	});

	it("never frees a foreign holder when the ended turn id is passed", async () => {
		// The compare-delete only fires for the named turn; a different live
		// holder keeps the lock and the promoted row parks again.
		const promoted = turnRow({ id: "turn-2" });
		const { lock, promoter, turns } = setup({ promoted });
		await lock.acquire("project-1", "other-turn", TURN_LOCK_TTL_MS);

		await expect(
			promoter.promoteNext("project-1", "turn-1"),
		).resolves.toBeNull();
		expect(await lock.holder("project-1")).toBe("other-turn");
		expect(turns.transition).toHaveBeenCalledWith(
			"turn-2",
			["queued"],
			"waiting",
		);
	});

	it("reverts the row and frees the lock when the handoff fails", async () => {
		const promoted = turnRow({ id: "turn-2" });
		const { lock, promoter, turns } = setup({
			promoted,
			startError: new Error("trigger api down"),
		});

		await expect(promoter.promoteNext("project-1")).resolves.toBeNull();
		expect(turns.transition).toHaveBeenCalledWith(
			"turn-2",
			["queued"],
			"waiting",
		);
		expect(await lock.holder("project-1")).toBeNull();
	});
});
