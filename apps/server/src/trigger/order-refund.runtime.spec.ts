import { afterEach, describe, expect, it, vi } from "vitest";

const observability = vi.hoisted(() => ({ captureException: vi.fn() }));

vi.mock("@wandit/observability/node", () => ({
	Sentry: { captureException: observability.captureException },
}));

import { OrderRefundStep } from "../modules/orders/application/refunds/order-refund.step";
import { createOrderRefundRuntime } from "./order-refund.runtime";

const payload = {
	failureReason: "Registrar provisioning failed",
	orderId: "22222222-2222-4222-8222-222222222222",
};

describe("createOrderRefundRuntime", () => {
	afterEach(() => {
		vi.clearAllMocks();
		vi.restoreAllMocks();
	});

	it("runs the configuration recheck immediately before the real step", async () => {
		const events: string[] = [];
		const execute = vi
			.spyOn(OrderRefundStep.prototype, "execute")
			.mockImplementation(async () => {
				events.push("step");
				return true;
			});
		const runtime = createOrderRefundRuntime(databaseStub(), {
			beforeAttempt() {
				events.push("configuration");
			},
			logger: { error: vi.fn() },
			wait: { for: vi.fn() },
		});

		await expect(runtime.runner.run(payload)).resolves.toEqual({
			processed: true,
		});
		expect(events).toEqual(["configuration", "step"]);
		expect(execute).toHaveBeenCalledWith(
			payload.orderId,
			payload.failureReason,
		);
		expect(observability.captureException).not.toHaveBeenCalled();
	});

	it("rechecks configuration again after each durable retry", async () => {
		const events: string[] = [];
		const originalError = new Error("Stripe unavailable");
		vi.spyOn(OrderRefundStep.prototype, "execute")
			.mockImplementationOnce(async () => {
				events.push("step-1");
				throw originalError;
			})
			.mockImplementationOnce(async () => {
				events.push("step-2");
				return true;
			});
		const waitFor = vi.fn(async () => {
			events.push("wait");
		});
		const runtime = createOrderRefundRuntime(databaseStub(), {
			beforeAttempt() {
				events.push("configuration");
			},
			logger: { error: vi.fn() },
			wait: { for: waitFor },
		});

		await expect(runtime.runner.run(payload)).resolves.toEqual({
			processed: true,
		});
		expect(events).toEqual([
			"configuration",
			"step-1",
			"wait",
			"configuration",
			"step-2",
		]);
		expect(waitFor).toHaveBeenCalledWith({ seconds: 60 });
		expect(observability.captureException).toHaveBeenCalledExactlyOnceWith(
			originalError,
			{ tags: { attempt: 1, orderId: payload.orderId } },
		);
	});
});

function databaseStub(): Parameters<typeof createOrderRefundRuntime>[0] {
	return {} as Parameters<typeof createOrderRefundRuntime>[0];
}
