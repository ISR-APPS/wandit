import { beforeEach, describe, expect, it, vi } from "vitest";

type CapturedTaskDefinition = {
	id: string;
	maxDuration: number;
	onFailure(input: { error: unknown; payload: unknown }): Promise<void>;
	queue: unknown;
	retry: Record<string, unknown>;
	run(payload: unknown, context: unknown): Promise<unknown>;
	schema(payload: unknown): unknown;
};

const mocks = vi.hoisted(() => {
	class MockAbortTaskRunError extends Error {}

	const metadata = { set: vi.fn() };
	metadata.set.mockReturnValue(metadata);

	return {
		AbortTaskRunError: MockAbortTaskRunError,
		assertDatabase: vi.fn(),
		assertPurchase: vi.fn(),
		close: vi.fn(),
		createDb: vi.fn(),
		createFailureRuntime: vi.fn(),
		createPurchaseRuntime: vi.fn(),
		definition: null as unknown,
		domainQueue: { name: "domain-operations" },
		events: [] as string[],
		failureFinalize: vi.fn(),
		logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
		metadata,
		purchaseExecute: vi.fn(),
		purchaseFinalize: vi.fn(),
		schemaTask: vi.fn((definition: unknown) => {
			mocks.definition = definition;
			return { id: "domain-purchase" };
		}),
		waitUntil: vi.fn(),
	};
});

vi.mock("@trigger.dev/sdk", () => ({
	AbortTaskRunError: mocks.AbortTaskRunError,
	logger: mocks.logger,
	metadata: mocks.metadata,
	schemaTask: mocks.schemaTask,
	wait: { until: mocks.waitUntil },
}));

vi.mock("@wandit/db", () => ({ createDb: mocks.createDb }));

vi.mock("./domain-operations.config", () => ({
	assertDatabaseConfiguration: mocks.assertDatabase,
	assertDomainPurchaseConfiguration: mocks.assertPurchase,
}));

vi.mock("./domain-fulfillment.runtime", () => ({
	createDomainFailureRuntime: mocks.createFailureRuntime,
	createDomainPurchaseRuntime: mocks.createPurchaseRuntime,
}));

vi.mock("./domain-task-queues", () => ({
	domainOperationsQueue: mocks.domainQueue,
}));

import { domainPurchaseTask } from "./domain-purchase.task";

const payload = {
	domainId: "11111111-1111-4111-8111-111111111111",
	orderId: "22222222-2222-4222-8222-222222222222",
};

describe("domainPurchaseTask", () => {
	beforeEach(() => {
		mocks.events.length = 0;
		mocks.close.mockReset().mockResolvedValue(undefined);
		mocks.assertDatabase.mockReset().mockImplementation(() => {
			mocks.events.push("database-config");
			return { databaseUrl: "postgres://test" };
		});
		mocks.assertPurchase.mockReset().mockImplementation(() => {
			mocks.events.push("purchase-config");
			return { fallbackOrigin: "customers.wandit.app" };
		});
		mocks.createDb.mockReset().mockImplementation(() => {
			mocks.events.push("db");
			return { $client: { end: mocks.close } };
		});
		mocks.purchaseExecute.mockReset().mockResolvedValue({
			processed: false,
			reason: "order_not_fulfillable",
			terminalized: false,
		});
		mocks.purchaseFinalize.mockReset().mockResolvedValue({ status: "failed" });
		mocks.failureFinalize.mockReset().mockResolvedValue({ status: "failed" });
		mocks.createPurchaseRuntime.mockReset().mockImplementation(() => {
			mocks.events.push("runtime");
			return {
				finalizePurchase: mocks.purchaseFinalize,
				purchase: { execute: mocks.purchaseExecute },
			};
		});
		mocks.createFailureRuntime.mockReset().mockReturnValue({
			finalizePurchase: mocks.failureFinalize,
		});
		mocks.waitUntil.mockReset().mockResolvedValue(undefined);
	});

	it("declares the strict task and exact five-attempt policy", () => {
		const task = definition();

		expect(domainPurchaseTask).toEqual({ id: "domain-purchase" });
		expect(task.id).toBe("domain-purchase");
		expect(task.maxDuration).toBe(1800);
		expect(task.queue).toBe(mocks.domainQueue);
		expect(task.retry).toEqual({
			factor: 2,
			maxAttempts: 5,
			maxTimeoutInMs: 480_000,
			minTimeoutInMs: 60_000,
			randomize: false,
		});
		expect(task).not.toHaveProperty("catchError");
		expect(task.schema(payload)).toEqual(payload);
		expect(() => task.schema({ ...payload, paymentSource: "credits" })).toThrow(
			/contain only/,
		);
	});

	it("asserts the full preflight first, delegates waits, and closes one pool", async () => {
		await expect(definition().run(payload, taskContext(1))).resolves.toEqual({
			processed: false,
			reason: "order_not_fulfillable",
			terminalized: false,
		});
		expect(mocks.events).toEqual(["purchase-config", "db", "runtime"]);
		expect(mocks.purchaseExecute).toHaveBeenCalledWith(payload);

		const runtimeOptions = mocks.createPurchaseRuntime.mock.calls[0]?.[1] as {
			fallbackOrigin: string;
			wait: { until(input: { date: Date }): Promise<void> };
		};
		const date = new Date("2026-08-01T00:00:00.000Z");

		expect(runtimeOptions.fallbackOrigin).toBe("customers.wandit.app");
		await runtimeOptions.wait.until({ date });
		expect(mocks.waitUntil).toHaveBeenCalledWith({ date });
		expect(mocks.createDb).toHaveBeenCalledOnce();
		expect(mocks.createDb).toHaveBeenCalledWith({
			idleTimeoutMillis: 10_000,
			max: 1,
		});
		expect(mocks.close).toHaveBeenCalledOnce();
	});

	it("aborts retries whenever the application reports terminalization", async () => {
		mocks.purchaseExecute.mockResolvedValueOnce({
			processed: false,
			reason: "not_configuring",
			terminalized: true,
		});

		let failure: unknown;

		try {
			await definition().run(payload, taskContext(1));
		} catch (error) {
			failure = error;
		}

		expect(failure).toBeInstanceOf(mocks.AbortTaskRunError);
		expect(mocks.purchaseFinalize).not.toHaveBeenCalled();
		expect(mocks.close).toHaveBeenCalledOnce();
	});

	it("finalizes an ordinary attempt-five failure before rethrowing", async () => {
		const transient = new Error("database CAS failed");
		mocks.purchaseExecute.mockRejectedValueOnce(transient);

		await expect(definition().run(payload, taskContext(5))).rejects.toBe(
			transient,
		);
		expect(mocks.purchaseFinalize).toHaveBeenCalledWith(payload, transient);
		expect(mocks.createDb).toHaveBeenCalledOnce();
		expect(mocks.createDb).toHaveBeenCalledWith({
			idleTimeoutMillis: 10_000,
			max: 1,
		});
		expect(mocks.close).toHaveBeenCalledOnce();
	});

	it("can terminalize a preflight failure using only DB readiness", async () => {
		const missingStripe = new Error("STRIPE_SECRET_KEY is required");
		mocks.assertPurchase.mockImplementationOnce(() => {
			throw missingStripe;
		});

		await expect(definition().run(payload, taskContext(5))).rejects.toBe(
			missingStripe,
		);
		expect(mocks.assertDatabase).toHaveBeenCalledOnce();
		expect(mocks.createFailureRuntime).toHaveBeenCalledOnce();
		expect(mocks.failureFinalize).toHaveBeenCalledWith(payload, missingStripe);
		expect(mocks.createDb).toHaveBeenCalledOnce();
		expect(mocks.createDb).toHaveBeenCalledWith({
			idleTimeoutMillis: 10_000,
			max: 1,
		});
		expect(mocks.close).toHaveBeenCalledOnce();
	});

	it("replays the idempotent finalizer in onFailure and closes its pool", async () => {
		const terminalError = new Error("attempts exhausted");

		await definition().onFailure({ error: terminalError, payload });

		expect(mocks.events.slice(0, 2)).toEqual(["database-config", "db"]);
		expect(mocks.failureFinalize).toHaveBeenCalledWith(payload, terminalError);
		expect(mocks.createDb).toHaveBeenCalledWith({
			idleTimeoutMillis: 10_000,
			max: 1,
		});
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
			run: { id: "run_domain_purchase" },
		},
	};
}
