import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
	const close = vi.fn(async () => undefined);
	const db = { $client: { end: close } };
	const sweep = vi.fn();

	return {
		assertDatabase: vi.fn(),
		close,
		createDb: vi.fn(() => db),
		createRuntime: vi.fn(() => ({ autoSync: { sweep } })),
		db,
		info: vi.fn(),
		queue: vi.fn((definition: unknown) => definition),
		scheduledTask: vi.fn((definition: unknown) => definition),
		sweep,
		warn: vi.fn(),
	};
});

vi.mock("@trigger.dev/sdk", () => ({
	logger: { info: mocks.info, warn: mocks.warn },
	queue: mocks.queue,
	schedules: { task: mocks.scheduledTask },
}));
vi.mock("@wandit/db", () => ({ createDb: mocks.createDb }));
vi.mock("./domain-operations.config", () => ({
	assertDatabaseConfiguration: mocks.assertDatabase,
}));
vi.mock("./lead-sheet-sync.runtime", () => ({
	createLeadSheetAutoSyncRuntime: mocks.createRuntime,
}));

import { leadSheetAutoSyncTask } from "./lead-sheet-auto-sync.task";

type CapturedTask = {
	cron: { pattern: string; timezone: string };
	id: string;
	maxDuration: number;
	queue: unknown;
	run(
		payload: unknown,
		context: { ctx: { run: { id: string } } },
	): Promise<unknown>;
	ttl: string;
};

const task = leadSheetAutoSyncTask as unknown as CapturedTask;
const context = { ctx: { run: { id: "run_lead_sheet_sync" } } };
const summary = {
	candidates: 3,
	deferred: 0,
	failed: 0,
	failures: [],
	skipped: 1,
	synced: 2,
	tokenFailed: 0,
	tokenFailedUsers: 0,
};

describe("lead sheet auto-sync task", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.sweep.mockResolvedValue(summary);
	});

	it("declares the exact 30-minute UTC schedule and serialized queue", () => {
		expect(task).toMatchObject({
			cron: { pattern: "*/30 * * * *", timezone: "UTC" },
			id: "lead-sheet-auto-sync",
			maxDuration: 1500,
			queue: { concurrencyLimit: 1, name: "lead-sheet-auto-sync" },
			ttl: "25m",
		});
	});

	it("runs a bounded sweep, logs counts, and closes its pool", async () => {
		await expect(task.run({}, context)).resolves.toEqual(summary);

		expect(mocks.assertDatabase).toHaveBeenCalledOnce();
		expect(mocks.createDb).toHaveBeenCalledWith({
			idleTimeoutMillis: 10_000,
			max: 1,
		});
		expect(mocks.createRuntime).toHaveBeenCalledWith(mocks.db);
		expect(mocks.sweep).toHaveBeenCalledWith({ budgetMs: 15 * 60_000 });
		expect(mocks.info).toHaveBeenCalledWith(
			"Lead sheet auto-sync sweep completed",
			{
				candidates: 3,
				deferred: 0,
				failed: 0,
				skipped: 1,
				synced: 2,
				tokenFailed: 0,
				tokenFailedUsers: 0,
				triggerRunId: "run_lead_sheet_sync",
			},
		);
		expect(mocks.close).toHaveBeenCalledOnce();
	});

	it("logs each project failure, marks the run failed, and closes the pool", async () => {
		mocks.sweep.mockResolvedValueOnce({
			...summary,
			failed: 1,
			failures: [{ message: "Google unavailable", projectId: "project-1" }],
		});

		await expect(task.run({}, context)).rejects.toThrow(
			"Lead sheet auto-sync left 1 project(s) unsynced and 0 token mint(s) failed across 0 user(s)",
		);
		expect(mocks.warn).toHaveBeenCalledWith(
			"Lead sheet auto-sync project failed",
			{
				message: "Google unavailable",
				projectId: "project-1",
				triggerRunId: "run_lead_sheet_sync",
			},
		);
		expect(mocks.close).toHaveBeenCalledOnce();
	});

	it("marks two users' token failures with nothing synced as a systemic run failure", async () => {
		mocks.sweep.mockResolvedValueOnce({
			...summary,
			skipped: 0,
			synced: 0,
			tokenFailed: 2,
			tokenFailedUsers: 2,
		});

		await expect(task.run({}, context)).rejects.toThrow(
			"Lead sheet auto-sync left 0 project(s) unsynced and 2 token mint(s) failed across 2 user(s)",
		);
		expect(mocks.info).toHaveBeenCalledWith(
			"Lead sheet auto-sync sweep completed",
			expect.objectContaining({ tokenFailed: 2, tokenFailedUsers: 2 }),
		);
		expect(mocks.close).toHaveBeenCalledOnce();
	});

	it("keeps the run successful when one user's revoked grant prevents all syncs", async () => {
		const revokedGrantSummary = {
			...summary,
			skipped: 0,
			synced: 0,
			tokenFailed: 2,
			tokenFailedUsers: 1,
		};
		mocks.sweep.mockResolvedValueOnce(revokedGrantSummary);

		await expect(task.run({}, context)).resolves.toEqual(revokedGrantSummary);
		expect(mocks.info).toHaveBeenCalledWith(
			"Lead sheet auto-sync sweep completed",
			expect.objectContaining({
				synced: 0,
				tokenFailed: 2,
				tokenFailedUsers: 1,
			}),
		);
		expect(mocks.close).toHaveBeenCalledOnce();
	});

	it("keeps the run successful when another project synced despite a token failure", async () => {
		const partiallySyncedSummary = {
			...summary,
			synced: 1,
			tokenFailed: 1,
			tokenFailedUsers: 1,
		};
		mocks.sweep.mockResolvedValueOnce(partiallySyncedSummary);

		await expect(task.run({}, context)).resolves.toEqual(
			partiallySyncedSummary,
		);
		expect(mocks.info).toHaveBeenCalledWith(
			"Lead sheet auto-sync sweep completed",
			expect.objectContaining({
				synced: 1,
				tokenFailed: 1,
				tokenFailedUsers: 1,
			}),
		);
		expect(mocks.close).toHaveBeenCalledOnce();
	});
});
