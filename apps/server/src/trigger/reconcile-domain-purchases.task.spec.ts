import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
	const close = vi.fn(async () => undefined);
	const db = { $client: { end: close } };
	const execute = vi.fn();

	return {
		assertConfiguration: vi.fn(),
		close,
		createDb: vi.fn(() => db),
		createRuntime: vi.fn(() => ({ reconciler: { execute } })),
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
	createDomainReconciliationRuntime: mocks.createRuntime,
}));

import { reconcileDomainPurchasesTask } from "./reconcile-domain-purchases.task";

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

const definition =
	reconcileDomainPurchasesTask as unknown as CapturedScheduledTask;
const RESULT = {
	ensured: 2,
	processed: true,
	scanned: 3,
	skipped: 1,
} as const;

describe("reconcileDomainPurchasesTask", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.execute.mockResolvedValue(RESULT);
	});

	it("declares the exact UTC schedule, retry policy, and shared domain queue", () => {
		expect(definition).toMatchObject({
			cron: { pattern: "*/15 * * * *", timezone: "UTC" },
			id: "reconcile-domain-purchases",
			queue: { concurrencyLimit: 1, name: "domain-operations" },
			retry: {
				factor: 2,
				maxAttempts: 5,
				maxTimeoutInMs: 60_000,
				minTimeoutInMs: 5_000,
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
			definition.run({}, { ctx: { run: { id: "run_domain_reconcile" } } }),
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
			"Domain purchase reconciliation completed",
			{ ...RESULT, triggerRunId: "run_domain_reconcile" },
		);
		expect(mocks.close).toHaveBeenCalledOnce();
	});

	it("closes the task-local pool when reconciliation throws", async () => {
		const error = new Error("scan failed");
		mocks.execute.mockRejectedValueOnce(error);

		await expect(
			definition.run({}, { ctx: { run: { id: "run_failed" } } }),
		).rejects.toBe(error);
		expect(mocks.close).toHaveBeenCalledOnce();
	});
});
