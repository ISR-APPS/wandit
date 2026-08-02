import { afterEach, describe, expect, it, vi } from "vitest";

import { OrderRefundStep } from "../modules/orders/application/refunds/order-refund.step";
import { createOrderRefundRuntime } from "./order-refund.runtime";

const payload = {
	failureReason: "Registrar provisioning failed",
	orderId: "22222222-2222-4222-8222-222222222222",
};

describe("createOrderRefundRuntime", () => {
	afterEach(() => {
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
	});

	it("rechecks configuration again after each durable retry", async () => {
		const events: string[] = [];
		vi.spyOn(OrderRefundStep.prototype, "execute")
			.mockImplementationOnce(async () => {
				events.push("step-1");
				throw new Error("Stripe unavailable");
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
	});
});

function databaseStub(): Parameters<typeof createOrderRefundRuntime>[0] {
	return {} as Parameters<typeof createOrderRefundRuntime>[0];
}
