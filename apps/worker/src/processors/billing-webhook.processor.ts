import { InjectQueue, Processor, WorkerHost } from "@nestjs/bullmq";
import { Inject, Logger, type OnModuleInit } from "@nestjs/common";
import {
	BILLING_WEBHOOK_RETRY_EVENT_JOB,
	BILLING_WEBHOOK_RETRY_SWEEP_JOB,
	BILLING_WEBHOOKS_QUEUE,
	type BillingWebhookJobName,
	type BillingWebhookRetryEventJobData,
	type BillingWebhookRetrySweepJobData,
} from "@wandit/jobs";
import type { Job, Queue } from "bullmq";

import { BillingWebhookRetryService } from "../../../server/src/modules/billing/application/services/billing-webhook-retry.service";

type BillingWebhookJobData =
	| BillingWebhookRetryEventJobData
	| BillingWebhookRetrySweepJobData;

const BILLING_WEBHOOK_RETRY_SCHEDULER = "billing-webhook-retry-sweep-scheduler";

@Processor(BILLING_WEBHOOKS_QUEUE)
export class BillingWebhookProcessor
	extends WorkerHost
	implements OnModuleInit
{
	private readonly logger = new Logger(BillingWebhookProcessor.name);

	constructor(
		@Inject(BillingWebhookRetryService)
		private readonly retryService: BillingWebhookRetryService,
		@InjectQueue(BILLING_WEBHOOKS_QUEUE)
		private readonly queue: Queue<BillingWebhookJobData, unknown, string>,
	) {
		super();
	}

	async onModuleInit(): Promise<void> {
		await this.queue.upsertJobScheduler(
			BILLING_WEBHOOK_RETRY_SCHEDULER,
			{ every: 60_000 },
			{
				data: {},
				name: BILLING_WEBHOOK_RETRY_SWEEP_JOB,
				opts: { removeOnComplete: 10, removeOnFail: 50 },
			},
		);
		this.logger.log("Billing webhook retry scheduler registered");
	}

	process(job: Job<BillingWebhookJobData, unknown, BillingWebhookJobName>) {
		switch (job.name) {
			case BILLING_WEBHOOK_RETRY_SWEEP_JOB:
				return this.retryService.sweep();
			case BILLING_WEBHOOK_RETRY_EVENT_JOB: {
				const { eventId } = job.data as BillingWebhookRetryEventJobData;

				if (typeof eventId !== "string" || eventId.length === 0) {
					throw new Error("Billing webhook retry job requires an eventId");
				}

				return this.retryService.retryEvent(eventId);
			}
			default:
				throw new Error(
					`Unknown billing webhook job ${job.name satisfies never}`,
				);
		}
	}
}
