import { Injectable, ServiceUnavailableException } from "@nestjs/common";
import { idempotencyKeys, tasks } from "@trigger.dev/sdk";

import type { signupGrantDeliveryTask } from "../../../../trigger/sweep-signup-grants.task";

const SIGNUP_GRANT_DELIVERY_TASK_ID = "signup-grant-outbox-delivery";

@Injectable()
export class TriggerSignupGrantDispatcherService {
	async triggerDelivery(userId: string): Promise<void> {
		if (!process.env.TRIGGER_SECRET_KEY?.trim()) {
			throw new ServiceUnavailableException(
				"Signup grant delivery task is unavailable",
			);
		}

		const idempotencyKey = await idempotencyKeys.create(
			`signup-grant:${userId}`,
			{ scope: "global" },
		);

		await tasks.trigger<typeof signupGrantDeliveryTask>(
			SIGNUP_GRANT_DELIVERY_TASK_ID,
			{ userId },
			{ idempotencyKey, tags: [`user:${userId}`] },
		);
	}
}
