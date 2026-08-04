import { Injectable, ServiceUnavailableException } from "@nestjs/common";
import { idempotencyKeys, tasks } from "@trigger.dev/sdk";

import type { affiliateAttributionRetryTask } from "../../../../trigger/affiliate-attribution-retry.task";
import type { AffiliateAttributionRetryPayload } from "../../application/services/affiliate-attribution-retry";

const AFFILIATE_ATTRIBUTION_RETRY_TASK_ID = "affiliate-attribution-retry";

@Injectable()
export class TriggerAffiliateAttributionDispatcherService {
	async triggerRetry(payload: AffiliateAttributionRetryPayload): Promise<void> {
		if (!process.env.TRIGGER_SECRET_KEY?.trim()) {
			throw new ServiceUnavailableException(
				"Affiliate attribution retry task is unavailable",
			);
		}

		// Include the signed token without exposing it: create() hashes the complete
		// tuple before it leaves this process. A later, genuinely different signup
		// token for the same user/source must not collide with the earlier retry.
		const idempotencyKey = await idempotencyKeys.create(
			["affiliate-attribution", payload.userId, payload.source, payload.token],
			{ scope: "global" },
		);

		await tasks.trigger<typeof affiliateAttributionRetryTask>(
			AFFILIATE_ATTRIBUTION_RETRY_TASK_ID,
			payload,
			{
				idempotencyKey,
				tags: [`user:${payload.userId}`],
			},
		);
	}
}
