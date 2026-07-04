import { Inject, Injectable } from "@nestjs/common";
import { eq } from "@wandit/db";
import { billingWebhookEvents } from "@wandit/db/schema/billing";
import type Stripe from "stripe";

import {
	DATABASE,
	type Database,
} from "../../../../infrastructure/database/database.constants";

export type BillingWebhookEventRow = typeof billingWebhookEvents.$inferSelect;

@Injectable()
export class BillingWebhookEventsRepository {
	constructor(@Inject(DATABASE) private readonly db: Database) {}

	async tryInsertReceived(event: Stripe.Event): Promise<boolean> {
		const [row] = await this.db
			.insert(billingWebhookEvents)
			.values({
				id: event.id,
				payload: event,
				provider: "stripe",
				status: "received",
				type: event.type,
			})
			.onConflictDoNothing({
				target: billingWebhookEvents.id,
			})
			.returning({ id: billingWebhookEvents.id });

		return !!row;
	}

	async findById(id: string): Promise<BillingWebhookEventRow | null> {
		const [row] = await this.db
			.select()
			.from(billingWebhookEvents)
			.where(eq(billingWebhookEvents.id, id))
			.limit(1);

		return row ?? null;
	}

	markProcessed(id: string) {
		return this.markTerminal(id, "processed", null);
	}

	markSkipped(id: string) {
		return this.markTerminal(id, "skipped", null);
	}

	markFailed(id: string, error: string) {
		return this.markTerminal(id, "failed", error);
	}

	private async markTerminal(
		id: string,
		status: "failed" | "processed" | "skipped",
		error: string | null,
	) {
		await this.db
			.update(billingWebhookEvents)
			.set({
				error,
				processedAt: new Date(),
				status,
			})
			.where(eq(billingWebhookEvents.id, id));
	}
}
