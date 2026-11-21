import { describe, expect, it, vi } from "vitest";

import type { BuilderTurnRow } from "../modules/app-builder/infrastructure/persistence/builder-turns.repository";
import { FakeLlmSpendCounters } from "../modules/app-builder/infrastructure/redis/fake-llm-spend-counters";
import { FakeTurnLock } from "../modules/app-builder/infrastructure/redis/fake-turn-lock";
import {
	runReconcileBuilderTurns,
	type TriggerRunState,
} from "./reconcile-builder-turns.runtime";

const NOW = new Date("2026-11-20T12:00:00.000Z");

const minutesAgo = (minutes: number) =>
	new Date(NOW.getTime() - minutes * 60_000);

function turnRow(overrides: Partial<BuilderTurnRow>): BuilderTurnRow {
	return {
		cacheReadTokens: null,
		cacheWriteTokens: null,
		chatId: "chat-1",
		completedAt: null,
		createdAt: minutesAgo(40),
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
		runner: "trigger",
		sentryEventId: null,
		sessionId: "session-1",
		spec: { attachments: [], composer: null, message: "hi" },
		startedAt: minutesAgo(30),
		status: "running",
		triggerRunId: "run_1",
		turnNumber: 1,
		userId: "user-1",
		...overrides,
	};
}

function runState(overrides: Partial<TriggerRunState>): TriggerRunState {
	return {
		createdAt: minutesAgo(30),
		isCompleted: false,
		isQueued: false,
		status: "EXECUTING",
		...overrides,
	};
}

const crashed = runState({ isCompleted: true, status: "CRASHED" });

describe("runReconcileBuilderTurns", () => {
	it.each([
		{
			name: "fails a running row whose run crashed",
			row: turnRow({}),
			run: crashed,
			lockHolder: null,
			stranded: [],
			ended: { code: "run_lost", from: "running", to: "failed" },
			promoted: [],
		},
		{
			name: "skips a running row whose run is still live",
			row: turnRow({}),
			run: runState({}),
			lockHolder: null,
			stranded: [],
			ended: null,
			promoted: [],
		},
		{
			name: "cancels a cancelling row whose run is final",
			row: turnRow({ status: "cancelling" }),
			run: crashed,
			lockHolder: null,
			stranded: [],
			ended: { code: null, from: "cancelling", to: "canceled" },
			promoted: [],
		},
		{
			name: "keeps a cancelling row while its canceled run settles",
			row: turnRow({ status: "cancelling" }),
			run: runState({
				finishedAt: new Date(NOW.getTime() - 10_000),
				isCompleted: true,
				status: "CANCELED",
			}),
			lockHolder: null,
			stranded: [],
			ended: null,
			promoted: [],
		},
		{
			name: "fails a queued row whose run expired on the ttl",
			row: turnRow({ startedAt: null, status: "queued" }),
			run: runState({ isCompleted: true, status: "EXPIRED" }),
			lockHolder: null,
			stranded: [],
			ended: { code: "queue_busy", from: "queued", to: "failed" },
			promoted: [],
		},
		{
			name: "keeps a queued row whose run waits 25 min",
			row: turnRow({ startedAt: null, status: "queued" }),
			run: runState({
				createdAt: minutesAgo(25),
				isQueued: true,
				status: "QUEUED",
			}),
			lockHolder: null,
			stranded: [],
			ended: null,
			promoted: [],
		},
		{
			name: "fails a queued row whose run waits 27 min",
			row: turnRow({ startedAt: null, status: "queued" }),
			run: runState({
				createdAt: minutesAgo(27),
				isQueued: true,
				status: "QUEUED",
			}),
			lockHolder: null,
			stranded: [],
			ended: { code: "queue_busy", from: "queued", to: "failed" },
			promoted: [],
		},
		{
			name: "keeps a queued row with no run id while its handoff holds the lock",
			row: turnRow({ startedAt: null, status: "queued", triggerRunId: null }),
			run: null,
			lockHolder: "turn-1",
			stranded: [],
			ended: null,
			promoted: [],
		},
		{
			name: "fails a queued row with no run id and no lock",
			row: turnRow({ startedAt: null, status: "queued", triggerRunId: null }),
			run: null,
			lockHolder: null,
			stranded: [],
			ended: { code: "run_lost", from: "queued", to: "failed" },
			promoted: [],
		},
	])("$name", async ({ row, run, lockHolder, stranded, ended, promoted }) => {
		const lock = new FakeTurnLock();
		if (lockHolder !== null) {
			await lock.acquire("project-1", lockHolder, 60_000);
		}
		const retrieveRun = vi.fn(async (_runId: string) => {
			if (run === null) {
				throw new Error("the spec row has no run");
			}
			return run;
		});
		const promoteNext = vi.fn(
			async (_projectId: string, _endedTurnId?: string) => {},
		);
		const transition = vi.fn(async () => true);

		await runReconcileBuilderTurns({
			counters: new FakeLlmSpendCounters(),
			insertAssistantMessage: async () => {},
			lock,
			logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() },
			metering: {
				findByIdempotencyKeyAnyPayer: vi.fn(async () => null),
				refund: vi.fn(),
			},
			now: () => NOW,
			promoteNext,
			retrieveRun,
			turns: {
				findProjectsWithStrandedWaiting: vi.fn(async () => stranded),
				findTriggerOwnedActive: vi.fn(async () => (row === null ? [] : [row])),
				transition,
			},
		});

		if (ended === null) {
			expect(transition).not.toHaveBeenCalled();
		} else {
			expect(transition).toHaveBeenCalledWith(
				"turn-1",
				[ended.from],
				ended.to,
				ended.code === null
					? expect.objectContaining({ completedAt: expect.any(Date) })
					: expect.objectContaining({
							failureCode: ended.code,
							error: expect.stringContaining("Send your message again."),
						}),
			);
		}
		const promotedProjects = promoteNext.mock.calls
			.filter(([, endedTurnId]) => endedTurnId === undefined)
			.map(([projectId]) => projectId);
		expect(promotedProjects).toEqual(promoted);
	});
});
