import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
	const close = vi.fn(async () => undefined);
	const db = { $client: { end: close } };
	const sweep = vi.fn();

	return {
		close,
		createDb: vi.fn(() => db),
		createRuntime: vi.fn(() => ({ dispatcher: { sweep } })),
		db,
		info: vi.fn(),
		queue: vi.fn((definition: unknown) => definition),
		scheduledTask: vi.fn((definition: unknown) => definition),
		sweep,
	};
});

vi.mock("@trigger.dev/sdk", () => ({
	logger: { info: mocks.info },
	queue: mocks.queue,
	schedules: { task: mocks.scheduledTask },
}));
vi.mock("@wandit/db", () => ({ createDb: mocks.createDb }));
vi.mock("./lifecycle-events.runtime", () => ({
	createLifecycleEventsRuntime: mocks.createRuntime,
}));

import { lifecycleEventsQueue } from "./lifecycle-events.queue";
import { lifecycleEventsSweepTask } from "./sweep-lifecycle-events.task";

type CapturedTask = {
	cron: { pattern: string; timezone: string };
	id: string;
	maxDuration: number;
	queue: unknown;
	retry: {
		factor: number;
		maxAttempts: number;
		maxTimeoutInMs: number;
		minTimeoutInMs: number;
		randomize: boolean;
	};
	run(
		payload: unknown,
		context: { ctx: { run: { id: string } } },
	): Promise<unknown>;
	ttl: string;
};

const task = lifecycleEventsSweepTask as unknown as CapturedTask;
const context = { ctx: { run: { id: "run_lifecycle" } } };

describe("lifecycle events Trigger task", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.sweep.mockResolvedValue({ dispatched: 2, dropped: 1, failed: 0 });
	});

	it("declares the five-minute UTC schedule and serialized queue", () => {
		expect(task).toMatchObject({
			cron: { pattern: "*/5 * * * *", timezone: "UTC" },
			id: "lifecycle-events-sweep",
			maxDuration: 240,
			queue: lifecycleEventsQueue,
			retry: {
				factor: 2,
				maxAttempts: 3,
				maxTimeoutInMs: 30_000,
				minTimeoutInMs: 5_000,
				randomize: false,
			},
			ttl: "4m",
		});
		expect(lifecycleEventsQueue).toEqual({
			concurrencyLimit: 1,
			name: "lifecycle-events-sweep",
		});
	});

	it("sweeps the outbox, logs the result, and closes the database", async () => {
		await expect(task.run(undefined, context)).resolves.toEqual({
			dispatched: 2,
			dropped: 1,
			failed: 0,
		});

		expect(mocks.createDb).toHaveBeenCalledWith({
			idleTimeoutMillis: 10_000,
			max: 1,
		});
		expect(mocks.createRuntime).toHaveBeenCalledWith(mocks.db);
		expect(mocks.sweep).toHaveBeenCalledOnce();
		expect(mocks.info).toHaveBeenCalledWith(
			"Lifecycle events sweep completed",
			{
				dispatched: 2,
				dropped: 1,
				failed: 0,
				triggerRunId: "run_lifecycle",
			},
		);
		expect(mocks.close).toHaveBeenCalledOnce();
	});

	it("still closes the database when the sweep fails", async () => {
		mocks.sweep.mockRejectedValueOnce(new Error("database unavailable"));

		await expect(task.run(undefined, context)).rejects.toThrow(
			"database unavailable",
		);
		expect(mocks.close).toHaveBeenCalledOnce();
	});
});
