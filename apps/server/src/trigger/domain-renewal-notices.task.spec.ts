import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
	const close = vi.fn(async () => undefined);
	const db = { $client: { end: close } };
	const execute = vi.fn();

	return {
		assertConfiguration: vi.fn(),
		close,
		createDb: vi.fn(() => db),
		createRuntime: vi.fn(() => ({ renewalNotices: { execute } })),
		db,
		execute,
		info: vi.fn(),
		queue: vi.fn((definition: unknown) => definition),
		scheduleTask: vi.fn((definition: unknown) => definition),
	};
});

vi.mock("@trigger.dev/sdk", () => ({
	logger: { info: mocks.info },
	queue: mocks.queue,
	schedules: { task: mocks.scheduleTask },
}));
vi.mock("@wandit/db", () => ({ createDb: mocks.createDb }));
vi.mock("./domain-operations.config", () => ({
	assertDatabaseConfiguration: mocks.assertConfiguration,
}));
vi.mock("./domain-fulfillment.runtime", () => ({
	createDomainRenewalRuntime: mocks.createRuntime,
}));

import { domainRenewalNoticesTask } from "./domain-renewal-notices.task";

type CapturedScheduledTask = {
	cron: { pattern: string; timezone: string };
	id: string;
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
};

const definition = domainRenewalNoticesTask as unknown as CapturedScheduledTask;
const RESULT = { noticed: 3, processed: true } as const;

describe("domainRenewalNoticesTask", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.execute.mockResolvedValue(RESULT);
	});

	it("preserves the daily UTC schedule on the shared domain queue", () => {
		expect(definition).toMatchObject({
			cron: { pattern: "0 2 * * *", timezone: "UTC" },
			id: "domain-renewal-notices",
			queue: { concurrencyLimit: 1, name: "domain-operations" },
			retry: {
				factor: 2,
				maxAttempts: 3,
				maxTimeoutInMs: 60_000,
				minTimeoutInMs: 1_000,
				randomize: false,
			},
		});
	});

	it("fails on database configuration before opening a pool", async () => {
		const error = new Error("DATABASE_URL is required");
		mocks.assertConfiguration.mockImplementationOnce(() => {
			throw error;
		});

		await expect(
			definition.run({}, { ctx: { run: { id: "run_unconfigured" } } }),
		).rejects.toBe(error);
		expect(mocks.createDb).not.toHaveBeenCalled();
		expect(mocks.createRuntime).not.toHaveBeenCalled();
		expect(mocks.close).not.toHaveBeenCalled();
	});

	it("asserts DB configuration first, delegates once, and closes its pool", async () => {
		await expect(
			definition.run({}, { ctx: { run: { id: "run_renewals" } } }),
		).resolves.toEqual(RESULT);

		expect(mocks.assertConfiguration).toHaveBeenCalledOnce();
		expect(mocks.createDb).toHaveBeenCalledOnce();
		expect(mocks.createDb).toHaveBeenCalledWith({
			idleTimeoutMillis: 10_000,
			max: 1,
		});
		expect(mocks.assertConfiguration.mock.invocationCallOrder[0]).toBeLessThan(
			mocks.createDb.mock.invocationCallOrder[0] ?? 0,
		);
		expect(mocks.createRuntime).toHaveBeenCalledWith(mocks.db);
		expect(mocks.execute).toHaveBeenCalledOnce();
		expect(mocks.info).toHaveBeenCalledWith(
			"Domain renewal notice sweep completed",
			{ ...RESULT, triggerRunId: "run_renewals" },
		);
		expect(mocks.close).toHaveBeenCalledOnce();
	});

	it("closes the task-local pool when the sweep throws", async () => {
		const error = new Error("renewal scan failed");
		mocks.execute.mockRejectedValueOnce(error);

		await expect(
			definition.run({}, { ctx: { run: { id: "run_failed" } } }),
		).rejects.toBe(error);
		expect(mocks.close).toHaveBeenCalledOnce();
	});
});
