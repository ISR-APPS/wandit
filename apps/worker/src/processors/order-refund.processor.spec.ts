import type { OrderRefundJobData, OrderRefundJobName } from "@wandit/jobs";
import type { Job } from "bullmq";
import { describe, expect, it, vi } from "vitest";

import type { OrderRefundExecutorService } from "../../../server/src/modules/orders/application/services/order-refund-executor.service";
import { OrderRefundProcessor } from "./order-refund.processor";

const orderId = "11111111-1111-4111-8111-111111111111";

function refundJob() {
	return {
		data: {
			failureReason: "Domain registration failed",
			orderId,
		},
		name: "order-refund",
	} as Job<OrderRefundJobData, unknown, OrderRefundJobName>;
}

describe("OrderRefundProcessor", () => {
	it("delegates the durable refund job to the shared executor", async () => {
		const executor = {
			execute: vi.fn(async () => true),
		};
		const processor = new OrderRefundProcessor(
			executor as unknown as OrderRefundExecutorService,
		);

		await expect(processor.process(refundJob())).resolves.toEqual({
			processed: true,
		});
		expect(executor.execute).toHaveBeenCalledWith(
			orderId,
			"Domain registration failed",
		);
	});

	it("propagates executor failures so BullMQ applies the job retry policy", async () => {
		const executor = {
			execute: vi.fn(async () => {
				throw new Error("Stripe unavailable");
			}),
		};
		const processor = new OrderRefundProcessor(
			executor as unknown as OrderRefundExecutorService,
		);

		await expect(processor.process(refundJob())).rejects.toThrow(
			"Stripe unavailable",
		);
	});
});
