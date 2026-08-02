import {
	SUBSCRIPTION_REFILL_SWEEP_JOB,
	type SubscriptionRefillJobName,
	type SubscriptionRefillSweepJobData,
} from "@wandit/jobs";
import type { Job, Queue } from "bullmq";
import { describe, expect, it, vi } from "vitest";

import type { SubscriptionRefillService } from "../../../server/src/modules/billing/application/services/subscription-refill.service";
import { SubscriptionRefillProcessor } from "./subscription-refill.processor";

function setup() {
	const refillService = {
		sweepDueSlots: vi.fn(async () => ({ granted: 2, scanned: 3 })),
	};
	const queue = {
		upsertJobScheduler: vi.fn(async () => undefined),
	};
	const processor = new SubscriptionRefillProcessor(
		refillService as unknown as SubscriptionRefillService,
		queue as unknown as Queue,
	);

	return { processor, queue, refillService };
}

function job(name = SUBSCRIPTION_REFILL_SWEEP_JOB) {
	return {
		data: {},
		name,
	} as unknown as Job<
		SubscriptionRefillSweepJobData,
		unknown,
		SubscriptionRefillJobName
	>;
}

describe("SubscriptionRefillProcessor", () => {
	it("upserts the due-slot sweep scheduler with bounded history", async () => {
		const { processor, queue } = setup();

		await processor.onModuleInit();
		await processor.onModuleInit();

		expect(queue.upsertJobScheduler).toHaveBeenCalledTimes(2);
		expect(queue.upsertJobScheduler).toHaveBeenCalledWith(
			"subscription-refill-sweep-scheduler",
			{ every: 60_000 },
			{
				data: {},
				name: SUBSCRIPTION_REFILL_SWEEP_JOB,
				opts: { removeOnComplete: 10, removeOnFail: 50 },
			},
		);
	});

	it("delegates the sweep job to SubscriptionRefillService", async () => {
		const { processor, refillService } = setup();

		await expect(processor.process(job())).resolves.toEqual({
			granted: 2,
			scanned: 3,
		});
		expect(refillService.sweepDueSlots).toHaveBeenCalledOnce();
	});

	it("rejects unknown job names", () => {
		const { processor, refillService } = setup();

		expect(() => processor.process(job("unexpected") as never)).toThrow(
			"Unknown subscription refill job unexpected",
		);
		expect(refillService.sweepDueSlots).not.toHaveBeenCalled();
	});
});
