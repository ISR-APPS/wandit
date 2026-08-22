import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
	const close = vi.fn(async () => undefined);
	const db = { $client: { end: close } };
	const expireDue = vi.fn();

	return {
		assertDatabase: vi.fn(),
		close,
		createDb: vi.fn(() => db),
		createRuntime: vi.fn(() => ({
			manualSubscriptions: { expireDue },
		})),
		db,
		expireDue,
		info: vi.fn(),
		queue: vi.fn((definition: unknown) => definition),
		scheduledTask: vi.fn((definition: unknown) => definition),
	};
});

vi.mock("@trigger.dev/sdk", () => ({
	logger: { info: mocks.info },
	queue: mocks.queue,
	schedules: { task: mocks.scheduledTask },
}));
vi.mock("@wandit/db", () => ({ createDb: mocks.createDb }));
vi.mock("./billing-maintenance.config", () => ({
	assertBillingDatabaseConfiguration: mocks.assertDatabase,
}));
vi.mock("./billing-maintenance.runtime", () => ({
	createManualBillingRuntime: mocks.createRuntime,
}));

import { manualSubscriptionExpiryTask } from "./manual-subscription-expiry.task";

type CapturedTask = {
	cron: { pattern: string; timezone: string };
	id: string;
	maxDuration: number;
	queue: unknown;
	retry: { maxAttempts: number };
	run(
		payload: { timestamp: Date },
		context: { ctx: { run: { id: string } } },
	): Promise<unknown>;
	ttl: string;
};

const task = manualSubscriptionExpiryTask as unknown as CapturedTask;
const timestamp = new Date("2026-08-21T12:00:00.000Z");
const context = { ctx: { run: { id: "run_manual_expiry" } } };

describe("manual subscription expiry task", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.expireDue.mockResolvedValue({ ended: 3, failed: 1, skipped: 2 });
	});

	it("declares the exact UTC schedule and billing queue", () => {
		expect(task).toMatchObject({
			cron: { pattern: "*/10 * * * *", timezone: "UTC" },
			id: "manual-subscription-expiry",
			maxDuration: 240,
			queue: {
				concurrencyLimit: 1,
				name: "billing-financial-maintenance",
			},
			retry: { maxAttempts: 1 },
			ttl: "9m",
		});
	});

	it("expires a bounded batch and closes the task-local database", async () => {
		await expect(task.run({ timestamp }, context)).resolves.toEqual({
			ended: 3,
			failed: 1,
			skipped: 2,
		});

		expect(mocks.assertDatabase).toHaveBeenCalledOnce();
		expect(mocks.createDb).toHaveBeenCalledWith({ max: 1 });
		expect(mocks.createRuntime).toHaveBeenCalledWith(mocks.db);
		expect(mocks.expireDue).toHaveBeenCalledWith(timestamp, 500);
		expect(mocks.info).toHaveBeenCalledWith(
			"Manual subscription expiry sweep completed",
			{
				ended: 3,
				failed: 1,
				skipped: 2,
				triggerRunId: "run_manual_expiry",
			},
		);
		expect(mocks.close).toHaveBeenCalledOnce();
	});

	it("checks database configuration before opening a connection", async () => {
		const failure = new Error("DATABASE_URL is required");
		mocks.assertDatabase.mockImplementationOnce(() => {
			throw failure;
		});

		await expect(task.run({ timestamp }, context)).rejects.toBe(failure);
		expect(mocks.createDb).not.toHaveBeenCalled();
		expect(mocks.close).not.toHaveBeenCalled();
	});
});
