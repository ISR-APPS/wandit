import { Inject, Injectable } from "@nestjs/common";

import {
	CREDIT_EVENT_THRESHOLDS,
	type EnqueueLifecycleEvent,
	EVENT_HOLD_MS,
	lifecycleEventIdempotencyKey,
} from "../../domain/lifecycle-event";
import {
	type LifecycleEventRow,
	LifecycleEventsRepository,
	type LifecycleEventsTransaction,
} from "../../infrastructure/persistence/lifecycle-events.repository";

@Injectable()
export class LifecycleEventsService {
	constructor(
		@Inject(LifecycleEventsRepository)
		private readonly repository: LifecycleEventsRepository,
	) {}

	enqueue(
		input: EnqueueLifecycleEvent,
		transaction?: LifecycleEventsTransaction,
	): Promise<LifecycleEventRow | null> {
		return this.repository.enqueue(input, transaction);
	}

	async enqueueCreditThresholds(
		userId: string,
		netConsumedCentiCredits: number,
		transaction?: LifecycleEventsTransaction,
	): Promise<void> {
		if (netConsumedCentiCredits >= CREDIT_EVENT_THRESHOLDS.credits_25_used) {
			await this.enqueue(
				{
					event: "credits_25_used",
					idempotencyKey: lifecycleEventIdempotencyKey(
						"credits_25_used",
						userId,
					),
					userId,
				},
				transaction,
			);
		}

		if (netConsumedCentiCredits >= CREDIT_EVENT_THRESHOLDS.credits_40_used) {
			await this.enqueue(
				{
					dispatchAfter: new Date(Date.now() + EVENT_HOLD_MS.credits_40_used),
					event: "credits_40_used",
					idempotencyKey: lifecycleEventIdempotencyKey(
						"credits_40_used",
						userId,
					),
					userId,
				},
				transaction,
			);
		}
	}
}
