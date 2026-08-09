import { beforeEach, describe, expect, it, vi } from "vitest";

type CapturedTaskDefinition = {
	id: string;
	maxDuration: unknown;
	queue: unknown;
	retry: Record<string, unknown>;
	run(payload: unknown, context: unknown): Promise<unknown>;
	schema(payload: unknown): unknown;
};

type RuntimeOptions = {
	beforeAttempt(): void;
	wait: { for(input: { seconds: number }): Promise<void> };
};

const mocks = vi.hoisted(() => {
	const metadata = { set: vi.fn() };
	metadata.set.mockReturnValue(metadata);

	return {
		assertRefund: vi.fn(),
		close: vi.fn(),
		createDb: vi.fn(),
		createRuntime: vi.fn(),
		definition: null as unknown,
		events: [] as string[],
		logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
		metadata,
		noTimeout: Symbol("timeout.None"),
		orderQueue: { name: "order-refunds" },
		runnerRun: vi.fn(),
		runtimeOptions: null as unknown,
		schemaTask: vi.fn((definition: unknown) => {
			mocks.definition = definition;
			return { id: "order-refund" };
		}),
		waitFor: vi.fn(),
	};
});

vi.mock("@trigger.dev/sdk", () => ({
	logger: mocks.logger,
	metadata: mocks.metadata,
	schemaTask: mocks.schemaTask,
	timeout: { None: mocks.noTimeout },
	wait: { for: mocks.waitFor },
}));

vi.mock("@wandit/db", () => ({ createDb: mocks.createDb }));

vi.mock("./domain-operations.config", () => ({
	assertOrderRefundConfiguration: mocks.assertRefund,
}));

vi.mock("./domain-task-queues", () => ({
	orderRefundsQueue: mocks.orderQueue,
}));

vi.mock("./order-refund.runtime", () => ({
	createOrderRefundRuntime: mocks.createRuntime,
}));

import { orderRefundTask } from "./order-refund.task";

const payload = {
	failureReason: "Registrar provisioning failed",
	orderId: "22222222-2222-4222-8222-222222222222",
};

describe("orderRefundTask", () => {
	beforeEach(() => {
		mocks.events.length = 0;
		mocks.runtimeOptions = null;
		mocks.close.mockReset().mockResolvedValue(undefined);
		mocks.assertRefund.mockReset().mockImplementation(() => {
			mocks.events.push("refund-config");
		});
		mocks.createDb.mockReset().mockImplementation(() => {
			mocks.events.push("db");
			return { $client: { end: mocks.close } };
		});
		mocks.runnerRun.mockReset().mockResolvedValue({ processed: true });
		mocks.createRuntime.mockReset().mockImplementation((_db, options) => {
			mocks.events.push("runtime");
			mocks.runtimeOptions = options;

			return {
				runner: { run: mocks.runnerRun },
			};
		});
		mocks.waitFor.mockReset().mockResolvedValue(undefined);
	});

	it("declares the strict no-timeout task and fixed crash retry policy", () => {
		const task = definition();

		expect(orderRefundTask).toEqual({ id: "order-refund" });
		expect(task.id).toBe("order-refund");
		expect(task.maxDuration).toBe(mocks.noTimeout);
		expect(task.queue).toBe(mocks.orderQueue);
		expect(task.retry).toEqual({
			factor: 1,
			maxAttempts: 5,
			maxTimeoutInMs: 60_000,
			minTimeoutInMs: 60_000,
			randomize: false,
		});
		expect(task.schema(payload)).toEqual(payload);
		expect(() => task.schema({ ...payload, attempt: 1 })).toThrow(
			/contain only/,
		);
	});

	it("passes the production recheck callback and delegates wait.for", async () => {
		await expect(definition().run(payload, taskContext())).resolves.toEqual({
			processed: true,
		});
		expect(mocks.events).toEqual(["db", "runtime"]);
		expect(mocks.runnerRun).toHaveBeenCalledWith(payload);

		const runtimeOptions = mocks.runtimeOptions as RuntimeOptions;

		expect(runtimeOptions.beforeAttempt).toBe(mocks.assertRefund);
		await runtimeOptions.wait.for({ seconds: 60 });
		expect(mocks.waitFor).toHaveBeenCalledWith({ seconds: 60 });
		expect(mocks.createDb).toHaveBeenCalledWith({
			idleTimeoutMillis: 10_000,
			max: 1,
		});
		expect(mocks.close).toHaveBeenCalledOnce();
	});

	it("closes the one task-local pool when the runner throws", async () => {
		mocks.runnerRun.mockRejectedValueOnce(new Error("runner crashed"));

		await expect(definition().run(payload, taskContext())).rejects.toThrow(
			"runner crashed",
		);
		expect(mocks.close).toHaveBeenCalledOnce();
	});
});

function definition(): CapturedTaskDefinition {
	return mocks.definition as CapturedTaskDefinition;
}

function taskContext() {
	return {
		ctx: {
			attempt: { number: 1 },
			run: { id: "run_order_refund" },
		},
	};
}
