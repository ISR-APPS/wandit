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

import { BillingWebhookEventsRepository } from "../../../billing/infrastructure/persistence/billing-webhook-events.repository";
import { TriggerBillingWebhookDispatcherService } from "../../../billing/infrastructure/trigger/trigger-billing-webhook-dispatcher.service";

@Injectable()
export class AdminWebhookReplayService {
	private readonly logger = new Logger(AdminWebhookReplayService.name);

	constructor(
		@Inject(BillingWebhookEventsRepository)
		private readonly repository: BillingWebhookEventsRepository,
		@Optional()
		@Inject(TriggerBillingWebhookDispatcherService)
		private readonly dispatcher?: TriggerBillingWebhookDispatcherService,
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

		if (!this.dispatcher) {
			throw new ServiceUnavailableException(
				"Billing webhook replay task is unavailable",
			);
		}

		try {
			await this.dispatcher.triggerRetry(eventId, event.attemptCount);
			this.logger.log(
				`admin_webhook_replay_triggered admin=${actingAdminId} event=${eventId} attempt=${event.attemptCount}`,
			);
		} catch (error) {
			this.logger.error(
				`admin_webhook_replay_trigger_failed admin=${actingAdminId} event=${eventId}`,
				error instanceof Error ? error.stack : String(error),
			);
			throw error;
		}

		return { accepted: true, eventId };
	}
}
