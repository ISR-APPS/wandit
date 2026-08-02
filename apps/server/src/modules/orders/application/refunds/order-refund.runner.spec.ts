import { describe, expect, it, vi } from "vitest";

import {
	ORDER_REFUND_FAILURE_REASON_MAX_LENGTH,
	ORDER_REFUND_RETRY_DELAY_SECONDS,
	parseOrderRefundPayload,
	REFUND_FAILURES_BEFORE_ESCALATION,
} from "./order-refund.contracts";
import { OrderRefundRunner } from "./order-refund.runner";

const orderId = "11111111-1111-4111-8111-111111111111";
const failureReason = "Domain registration failed";

function payload() {
	return { failureReason, orderId };
}

function setup() {
	const refundStep = {
		execute: vi.fn(async () => true),
	};
	const durableWait = {
		for: vi.fn(async () => undefined),
	};
	const logger = {
		error: vi.fn(),
	};
	const runner = new OrderRefundRunner(refundStep, durableWait, logger);

	return { durableWait, logger, refundStep, runner };
}

describe("parseOrderRefundPayload", () => {
	it("accepts the exact strict refund payload", () => {
		expect(parseOrderRefundPayload(payload())).toEqual(payload());
		expect(
			parseOrderRefundPayload({
				failureReason: "x".repeat(ORDER_REFUND_FAILURE_REASON_MAX_LENGTH),
				orderId,
			}),
		).toEqual({
			failureReason: "x".repeat(ORDER_REFUND_FAILURE_REASON_MAX_LENGTH),
			orderId,
		});
	});

	it.each([
		["a non-object", "refund"],
		["an array", []],
		["an extra property", { ...payload(), extra: true }],
		["a missing property", { orderId }],
		["an invalid order id", { failureReason, orderId: "not-a-uuid" }],
		["an empty reason", { failureReason: "", orderId }],
		[
			"an overlong reason",
			{
				failureReason: "x".repeat(ORDER_REFUND_FAILURE_REASON_MAX_LENGTH + 1),
				orderId,
			},
		],
	] as const)("rejects %s", (_label, input) => {
		expect(() => parseOrderRefundPayload(input)).toThrow(TypeError);
	});
});

describe("OrderRefundRunner", () => {
	it("returns after a successful refund step", async () => {
		const fixture = setup();

		await expect(fixture.runner.run(payload())).resolves.toEqual({
			processed: true,
		});
		expect(fixture.refundStep.execute).toHaveBeenCalledWith(
			orderId,
			failureReason,
		);
		expect(fixture.durableWait.for).not.toHaveBeenCalled();
		expect(fixture.logger.error).not.toHaveBeenCalled();
	});

	it("returns a stale false result without retrying", async () => {
		const fixture = setup();
		fixture.refundStep.execute.mockResolvedValueOnce(false);

		await expect(fixture.runner.run(payload())).resolves.toEqual({
			processed: false,
		});
		expect(fixture.refundStep.execute).toHaveBeenCalledTimes(1);
		expect(fixture.durableWait.for).not.toHaveBeenCalled();
	});

	it("logs a thrown step failure, durably waits 60 seconds, and retries", async () => {
		const fixture = setup();
		fixture.refundStep.execute.mockRejectedValueOnce(
			new Error("Stripe unavailable"),
		);

		await expect(fixture.runner.run(payload())).resolves.toEqual({
			processed: true,
		});
		expect(fixture.refundStep.execute).toHaveBeenCalledTimes(2);
		expect(fixture.durableWait.for).toHaveBeenCalledExactlyOnceWith({
			seconds: ORDER_REFUND_RETRY_DELAY_SECONDS,
		});
		expect(fixture.logger.error).toHaveBeenCalledExactlyOnceWith(
			`Refund for payment order ${orderId} failed and is retrying`,
			{
				attemptsMade: 1,
				failureReason,
				lastError: "Stripe unavailable",
				orderId,
			},
		);
	});

	it("uses the same fixed durable wait after every thrown failure", async () => {
		const fixture = setup();
		fixture.refundStep.execute
			.mockRejectedValueOnce(new Error("failure 1"))
			.mockRejectedValueOnce(new Error("failure 2"))
			.mockRejectedValueOnce(new Error("failure 3"));

		await expect(fixture.runner.run(payload())).resolves.toEqual({
			processed: true,
		});
		expect(fixture.durableWait.for).toHaveBeenCalledTimes(3);
		expect(fixture.durableWait.for.mock.calls).toEqual([
			[{ seconds: 60 }],
			[{ seconds: 60 }],
			[{ seconds: 60 }],
		]);
	});

	it("escalates every failure from failure 30 onward while continuing to retry", async () => {
		const fixture = setup();
		let attempts = 0;
		fixture.refundStep.execute.mockImplementation(async () => {
			attempts += 1;

			if (attempts <= REFUND_FAILURES_BEFORE_ESCALATION + 1) {
				throw new Error(`failure ${attempts}`);
			}

			return true;
		});

		await expect(fixture.runner.run(payload())).resolves.toEqual({
			processed: true,
		});

		const escalationCalls = fixture.logger.error.mock.calls.filter(
			([message]) => String(message).startsWith("MANUAL REVIEW REQUIRED:"),
		);
		expect(escalationCalls).toEqual([
			[
				`MANUAL REVIEW REQUIRED: refund for payment order ${orderId} has failed 30 times and is still retrying`,
				{
					attemptsMade: 30,
					failureReason,
					lastError: "failure 30",
					orderId,
				},
			],
			[
				`MANUAL REVIEW REQUIRED: refund for payment order ${orderId} has failed 31 times and is still retrying`,
				{
					attemptsMade: 31,
					failureReason,
					lastError: "failure 31",
					orderId,
				},
			],
		]);
		expect(fixture.durableWait.for).toHaveBeenCalledTimes(31);
		expect(fixture.refundStep.execute).toHaveBeenCalledTimes(32);
	});

	it("records a non-Error throw instead of silently losing its cause", async () => {
		const fixture = setup();
		fixture.refundStep.execute.mockRejectedValueOnce("Stripe unavailable");

		await fixture.runner.run(payload());

		expect(fixture.logger.error).toHaveBeenNthCalledWith(
			1,
			`Refund for payment order ${orderId} failed and is retrying`,
			expect.objectContaining({ lastError: "Stripe unavailable" }),
		);
	});

	it("propagates a durable-wait failure for task-level crash recovery", async () => {
		const fixture = setup();
		fixture.refundStep.execute.mockRejectedValueOnce(
			new Error("Stripe unavailable"),
		);
		fixture.durableWait.for.mockRejectedValueOnce(
			new Error("checkpoint unavailable"),
		);

		await expect(fixture.runner.run(payload())).rejects.toThrow(
			"checkpoint unavailable",
		);
		expect(fixture.logger.error).toHaveBeenCalledWith(
			expect.any(String),
			expect.objectContaining({ lastError: "Stripe unavailable" }),
		);
	});
});
