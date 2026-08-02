import { InjectQueue } from "@nestjs/bullmq";
import { Injectable, Optional } from "@nestjs/common";
import {
	METERING_QUEUE,
	METERING_RECONCILE_DELAY_MS,
	METERING_RECONCILE_EVENT_JOB,
	METERING_RECONCILE_JOB_ATTEMPTS,
	type MeteringJobData,
	type MeteringJobName,
} from "@wandit/jobs";
import type { Queue } from "bullmq";

import type { MeteringReconciliationScheduler } from "../../domain/metering";

export type MeteringReconciliationQueue = Pick<
	Queue<MeteringJobData, unknown, MeteringJobName>,
	"add"
>;

export async function enqueueMeteringReconciliation(
	queue: MeteringReconciliationQueue,
	eventId: string,
): Promise<void> {
	await queue.add(
		METERING_RECONCILE_EVENT_JOB,
		{ eventId },
		{
			attempts: METERING_RECONCILE_JOB_ATTEMPTS,
			backoff: { delay: 2_000, type: "exponential" },
			delay: METERING_RECONCILE_DELAY_MS,
			jobId: `ai-usage-reconcile-${eventId}`,
			// A completed reconciliation must not permanently block a later
			// idempotent reschedule (for example after a worker crash/replay).
			removeOnComplete: true,
			removeOnFail: 5_000,
		},
	);
}

@Injectable()
export class BullMqMeteringReconciliationScheduler
	implements MeteringReconciliationScheduler
{
	constructor(
		@Optional()
		@InjectQueue(METERING_QUEUE)
		private readonly queue?: Queue<MeteringJobData, unknown, MeteringJobName>,
	) {}

	async schedule(eventId: string): Promise<void> {
		if (!this.queue) {
			return;
		}

		await enqueueMeteringReconciliation(this.queue, eventId);
	}
}
