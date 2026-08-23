import { beforeEach, describe, expect, it, vi } from "vitest";

type CapturedTaskDefinition = {
	id: string;
	queue: unknown;
	retry: Record<string, unknown>;
	run(payload: unknown, context: unknown): Promise<unknown>;
	schema(payload: unknown): unknown;
};

const mocks = vi.hoisted(() => {
	const metadata = { set: vi.fn() };
	metadata.set.mockReturnValue(metadata);

	return {
		assertConfiguration: vi.fn(),
		close: vi.fn(),
		configurationExecute: vi.fn(),
		createDb: vi.fn(),
		createRuntime: vi.fn(),
		definition: null as unknown,
		domainQueue: { name: "domain-operations" },
		events: [] as string[],
		logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
		metadata,
		schemaTask: vi.fn((definition: unknown) => {
			mocks.definition = definition;
			return { id: "domain-configure" };
		}),
		waitUntil: vi.fn(),
	};
});

vi.mock("@trigger.dev/sdk", () => ({
	logger: mocks.logger,
	metadata: mocks.metadata,
	schemaTask: mocks.schemaTask,
	wait: { until: mocks.waitUntil },
}));

vi.mock("@wandit/db", () => ({ createDb: mocks.createDb }));

vi.mock("./domain-operations.config", () => ({
	assertDomainConfigurationConfiguration: mocks.assertConfiguration,
}));

vi.mock("./domain-fulfillment.runtime", () => ({
	createDomainConfigurationRuntime: mocks.createRuntime,
}));

vi.mock("./domain-task-queues", () => ({
	domainOperationsQueue: mocks.domainQueue,
}));

import { domainConfigurationTask } from "./domain-configuration.task";

const domainId = "11111111-1111-4111-8111-111111111111";
const payload = { domainId, nonce: "manual:nonce-1" };

describe("domainConfigurationTask", () => {
	beforeEach(() => {
		mocks.events.length = 0;
		mocks.close.mockReset().mockResolvedValue(undefined);
		mocks.configurationExecute.mockReset().mockResolvedValue({
			processed: false,
			reason: "external_still_pending",
		});
		mocks.assertConfiguration.mockReset().mockImplementation(() => {
			mocks.events.push("config");
			return {
				apexZoneEnabled: true,
				cloudflareApiToken: "cf-token",
				cloudflareKvNamespaceId: "kv-namespace",
				cloudflareZoneId: "zone-id",
				databaseUrl: "postgresql://task.test/database",
				fallbackOrigin: "customers.task.test",
			};
		});
		mocks.createDb.mockReset().mockImplementation(() => {
			mocks.events.push("db");
			return { $client: { end: mocks.close } };
		});
		mocks.createRuntime.mockReset().mockImplementation(() => {
			mocks.events.push("runtime");
			return {
				configuration: { execute: mocks.configurationExecute },
			};
		});
		mocks.waitUntil.mockReset().mockResolvedValue(undefined);
	});

	it("declares the strict task, shared queue, and exact retry policy", () => {
		const task = definition();

		expect(domainConfigurationTask).toEqual({ id: "domain-configure" });
		expect(task.id).toBe("domain-configure");
		expect(task.queue).toBe(mocks.domainQueue);
		expect(task.retry).toEqual({
			factor: 2,
			maxAttempts: 3,
			maxTimeoutInMs: 120_000,
			minTimeoutInMs: 60_000,
			randomize: false,
		});
		expect(task.schema(payload)).toEqual(payload);
		expect(() => task.schema({ ...payload, attempt: 0 })).toThrow(
			/contain only/,
		);
	});

	it("asserts configuration first, delegates durable waits, and closes the pool", async () => {
		const result = await definition().run(payload, taskContext(1));

		expect(result).toEqual({
			processed: false,
			reason: "external_still_pending",
		});
		expect(mocks.events).toEqual(["config", "db", "runtime"]);
		expect(mocks.configurationExecute).toHaveBeenCalledWith(payload);

		const runtimeOptions = mocks.createRuntime.mock.calls[0]?.[1] as {
			apexZoneEnabled: boolean;
			fallbackOrigin: string;
			wait: { until(input: { date: Date }): Promise<void> };
		};
		const date = new Date("2026-08-01T00:00:00.000Z");

		// The external apex zone pass runs with the asserted configuration's
		// kill switch and fallback origin.
		expect(runtimeOptions).toMatchObject({
			apexZoneEnabled: true,
			fallbackOrigin: "customers.task.test",
		});
		await runtimeOptions.wait.until({ date });
		expect(mocks.waitUntil).toHaveBeenCalledWith({ date });
		expect(mocks.createDb).toHaveBeenCalledWith({
			idleTimeoutMillis: 10_000,
			max: 1,
		});
		expect(mocks.close).toHaveBeenCalledOnce();
	});

	it("closes the task-local pool when the runner throws", async () => {
		mocks.configurationExecute.mockRejectedValueOnce(
			new Error("database lost"),
		);

		await expect(definition().run(payload, taskContext(1))).rejects.toThrow(
			"database lost",
		);
		expect(mocks.close).toHaveBeenCalledOnce();
	});
});

function definition(): CapturedTaskDefinition {
	return mocks.definition as CapturedTaskDefinition;
}

function taskContext(attempt: number) {
	return {
		ctx: {
			attempt: { number: attempt },
			run: { id: "run_domain_configuration" },
		},
	};
}
