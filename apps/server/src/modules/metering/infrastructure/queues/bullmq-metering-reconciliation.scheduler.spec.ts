import {
	METERING_RECONCILE_EVENT_JOB,
	type MeteringJobData,
	type MeteringJobName,
} from "@wandit/jobs";
import type { Queue } from "bullmq";
import { describe, expect, it, vi } from "vitest";

import { BullMqMeteringReconciliationScheduler } from "./bullmq-metering-reconciliation.scheduler";

describe("BullMqMeteringReconciliationScheduler", () => {
	it("enqueues one stable delayed job with not-found retries", async () => {
		const queue = { add: vi.fn(async () => undefined) };
		const scheduler = new BullMqMeteringReconciliationScheduler(
			queue as unknown as Queue<MeteringJobData, unknown, MeteringJobName>,
		);

		await scheduler.schedule("event_1");

		expect(queue.add).toHaveBeenCalledWith(
			METERING_RECONCILE_EVENT_JOB,
			{ eventId: "event_1" },
			{
				attempts: 8,
				backoff: { delay: 2_000, type: "exponential" },
				delay: 10_000,
				jobId: "ai-usage-reconcile-event_1",
				removeOnComplete: true,
				removeOnFail: 5_000,
			},
		);
	});

	it("is a no-op when queues are disabled", async () => {
		const scheduler = new BullMqMeteringReconciliationScheduler();

		await expect(scheduler.schedule("event_1")).resolves.toBeUndefined();
	});
});
