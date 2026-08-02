import { InjectQueue } from "@nestjs/bullmq";
import {
	ConflictException,
	Inject,
	Injectable,
	Logger,
	NotFoundException,
	Optional,
	ServiceUnavailableException,
} from "@nestjs/common";
import type { AdminWebhookReplayResponse } from "@wandit/contracts";
import {
	BILLING_WEBHOOK_RETRY_EVENT_JOB,
	BILLING_WEBHOOKS_QUEUE,
	type BillingWebhookRetryEventJobData,
} from "@wandit/jobs";
import type { Queue } from "bullmq";

import { BillingWebhookEventsRepository } from "../../../billing/infrastructure/persistence/billing-webhook-events.repository";

@Injectable()
export class AdminWebhookReplayService {
	private readonly logger = new Logger(AdminWebhookReplayService.name);

	constructor(
		@Inject(BillingWebhookEventsRepository)
		private readonly repository: BillingWebhookEventsRepository,
		@Optional()
		@InjectQueue(BILLING_WEBHOOKS_QUEUE)
		private readonly queue?: Queue<BillingWebhookRetryEventJobData>,
	) {}

	async enqueue(
		actingAdminId: string,
		eventId: string,
	): Promise<AdminWebhookReplayResponse> {
		const event = await this.repository.findById(eventId);

		if (!event) {
			throw new NotFoundException();
		}

		const leaseExpired =
			event.status === "processing" &&
			event.claimedAt !== null &&
			event.claimedAt.getTime() + 5 * 60_000 <= Date.now();
		const replayable =
			event.status === "failed" || event.status === "received" || leaseExpired;

		if (!replayable) {
			throw new ConflictException(
				`Billing webhook event ${eventId} is not in a claimable replay state`,
			);
		}

		if (!this.queue) {
			throw new ServiceUnavailableException(
				"Billing webhook replay queue is unavailable",
			);
		}

		try {
			await this.queue.add(
				BILLING_WEBHOOK_RETRY_EVENT_JOB,
				{ eventId },
				{
					attempts: 1,
					jobId: `billing-webhook-replay-${encodeURIComponent(eventId)}-${event.attemptCount}`,
					removeOnComplete: true,
					removeOnFail: true,
				},
			);
			this.logger.log(
				`admin_webhook_replay_queued admin=${actingAdminId} event=${eventId} attempt=${event.attemptCount}`,
			);
		} catch (error) {
			this.logger.error(
				`admin_webhook_replay_enqueue_failed admin=${actingAdminId} event=${eventId}`,
				error instanceof Error ? error.stack : String(error),
			);
			throw error;
		}

		return { accepted: true, eventId };
	}
}
