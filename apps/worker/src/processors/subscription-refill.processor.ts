import { InjectQueue, Processor, WorkerHost } from "@nestjs/bullmq";
import { Inject, Logger, type OnModuleInit } from "@nestjs/common";
import {
	SUBSCRIPTION_REFILL_SWEEP_JOB,
	SUBSCRIPTION_REFILLS_QUEUE,
	type SubscriptionRefillJobName,
	type SubscriptionRefillSweepJobData,
} from "@wandit/jobs";
import type { Job, Queue } from "bullmq";

import { SubscriptionRefillService } from "../../../server/src/modules/billing/application/services/subscription-refill.service";

const SUBSCRIPTION_REFILL_SCHEDULER = "subscription-refill-sweep-scheduler";

@Processor(SUBSCRIPTION_REFILLS_QUEUE)
export class SubscriptionRefillProcessor
	extends WorkerHost
	implements OnModuleInit
{
	private readonly logger = new Logger(SubscriptionRefillProcessor.name);

	constructor(
		@Inject(SubscriptionRefillService)
		private readonly refillService: SubscriptionRefillService,
		@InjectQueue(SUBSCRIPTION_REFILLS_QUEUE)
		private readonly queue: Queue<
			SubscriptionRefillSweepJobData,
			unknown,
			string
		>,
	) {
		super();
	}

	async onModuleInit(): Promise<void> {
		await this.queue.upsertJobScheduler(
			SUBSCRIPTION_REFILL_SCHEDULER,
			{ every: 60_000 },
			{
				data: {},
				name: SUBSCRIPTION_REFILL_SWEEP_JOB,
				opts: { removeOnComplete: 10, removeOnFail: 50 },
			},
		);
		this.logger.log("Subscription refill scheduler registered");
	}

	process(
		job: Job<
			SubscriptionRefillSweepJobData,
			unknown,
			SubscriptionRefillJobName
		>,
	) {
		if (job.name !== SUBSCRIPTION_REFILL_SWEEP_JOB) {
			throw new Error(
				`Unknown subscription refill job ${job.name satisfies never}`,
			);
		}

		return this.refillService.sweepDueSlots();
	}
}
