import type { Queue } from "bullmq";
import { describe, expect, it, vi } from "vitest";

import { OrderRefundQueueService } from "./order-refund-queue.service";

describe("OrderRefundQueueService", () => {
	it("persists a deterministic refund job with independent retries", async () => {
		const queue = {
			add: vi.fn(async () => undefined),
		};
		const service = new OrderRefundQueueService(
			queue as unknown as Queue<
				{ failureReason: string; orderId: string },
				unknown,
				"order-refund"
			>,
		);

		await service.enqueue(
			"11111111-1111-4111-8111-111111111111",
			"Domain registration failed",
		);

		expect(queue.add).toHaveBeenCalledWith(
			"order-refund",
			{
				failureReason: "Domain registration failed",
				orderId: "11111111-1111-4111-8111-111111111111",
			},
			{
				attempts: Number.MAX_SAFE_INTEGER,
				backoff: {
					delay: 60_000,
					type: "fixed",
				},
				jobId: "order-refund-11111111-1111-4111-8111-111111111111",
			},
		);
	});

	it("fails before terminalization when the refund queue is unavailable", async () => {
		const service = new OrderRefundQueueService();

		await expect(
			service.enqueue(
				"11111111-1111-4111-8111-111111111111",
				"Domain registration failed",
			),
		).rejects.toMatchObject({
			status: 503,
		});
	});
});
