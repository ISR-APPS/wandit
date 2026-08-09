import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
	const close = vi.fn(async () => undefined);
	const db = { $client: { end: close } };
	const execute = vi.fn();

	return {
		assertConfiguration: vi.fn(),
		close,
		createDb: vi.fn(() => db),
		createRuntime: vi.fn(() => ({ registrarSync: { execute } })),
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
	assertDomainRegistrarSyncConfiguration: mocks.assertConfiguration,
}));
vi.mock("./domain-fulfillment.runtime", () => ({
	createDomainRegistrarSyncRuntime: mocks.createRuntime,
}));

import { domainRegistrarSyncTask } from "./domain-registrar-sync.task";

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

const definition = domainRegistrarSyncTask as unknown as CapturedScheduledTask;
const RESULT = { failed: 1, processed: true, synced: 4 } as const;

describe("domainRegistrarSyncTask", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.execute.mockResolvedValue(RESULT);
	});

	it("preserves the weekly UTC schedule on the shared domain queue", () => {
		expect(definition).toMatchObject({
			cron: { pattern: "0 3 * * 0", timezone: "UTC" },
			id: "domain-registrar-sync",
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

	it("fails on Name.com/DB configuration before opening a pool", async () => {
		const error = new Error("NAMECOM_API_TOKEN is required");
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

	it("asserts Name.com/DB configuration first, delegates once, and closes its pool", async () => {
		await expect(
			definition.run({}, { ctx: { run: { id: "run_registrar_sync" } } }),
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
		expect(mocks.info).toHaveBeenCalledWith("Domain registrar sync completed", {
			...RESULT,
			triggerRunId: "run_registrar_sync",
		});
		expect(mocks.close).toHaveBeenCalledOnce();
	});

	it("closes the task-local pool when the sweep throws", async () => {
		const error = new Error("registrar scan failed");
		mocks.execute.mockRejectedValueOnce(error);

		await expect(
			definition.run({}, { ctx: { run: { id: "run_failed" } } }),
		).rejects.toBe(error);
		expect(mocks.close).toHaveBeenCalledOnce();
	});
});
