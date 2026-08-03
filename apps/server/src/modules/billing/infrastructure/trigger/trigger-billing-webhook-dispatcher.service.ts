import { Injectable, ServiceUnavailableException } from "@nestjs/common";
import { idempotencyKeys, tasks } from "@trigger.dev/sdk";

import type { billingWebhookRetryEventTask } from "../../../../trigger/retry-billing-webhooks.task";

const BILLING_WEBHOOK_RETRY_TASK_ID = "billing-webhook-retry-event";

@Injectable()
export class TriggerBillingWebhookDispatcherService {
	async triggerRetry(eventId: string, attemptCount: number): Promise<void> {
		if (!process.env.TRIGGER_SECRET_KEY?.trim()) {
			throw new ServiceUnavailableException(
				"Billing webhook replay task is unavailable",
			);
		}

		const idempotencyKey = await idempotencyKeys.create(
			`billing-webhook:${eventId}:attempt:${attemptCount}`,
			{ scope: "global" },
		);

		await tasks.trigger<typeof billingWebhookRetryEventTask>(
			BILLING_WEBHOOK_RETRY_TASK_ID,
			{ eventId },
			{ idempotencyKey, tags: [`billing-webhook:${eventId}`] },
		);
	}
}
