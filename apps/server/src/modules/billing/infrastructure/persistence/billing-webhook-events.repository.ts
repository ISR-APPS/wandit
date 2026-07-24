import { Inject, Injectable } from "@nestjs/common";
import { and, eq, sql } from "@wandit/db";
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
				eventCreatedAt: new Date(event.created * 1000),
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

	async tryClaim(eventId: string): Promise<Date | null> {
		const [row] = await this.db
			.update(billingWebhookEvents)
			.set({
				attemptCount: sql<number>`${billingWebhookEvents.attemptCount} + 1`,
				/*
				 * pg timestamps can retain microseconds that JavaScript Date cannot.
				 * Millisecond precision makes the returned lease token round-trip
				 * exactly through the ownership predicate on terminal writes.
				 */
				claimedAt: sql`date_trunc('milliseconds', now())`,
				status: "processing",
			})
			.where(
				and(
					eq(billingWebhookEvents.id, eventId),
					sql`(${billingWebhookEvents.status} IN ('received', 'failed') OR (${billingWebhookEvents.status} = 'processing' AND ${billingWebhookEvents.claimedAt} < now() - interval '5 minutes'))`,
				),
			)
			.returning({ claimedAt: billingWebhookEvents.claimedAt });

		return row?.claimedAt ?? null;
	}

	async findById(id: string): Promise<BillingWebhookEventRow | null> {
		const [row] = await this.db
			.select()
			.from(billingWebhookEvents)
			.where(eq(billingWebhookEvents.id, id))
			.limit(1);

		return row ?? null;
	}

	markProcessed(id: string, claimedAt: Date) {
		return this.markTerminal(id, claimedAt, "processed", null);
	}

	markSkipped(id: string, claimedAt: Date, reason: string | null = null) {
		return this.markTerminal(id, claimedAt, "skipped", reason);
	}

	markFailed(id: string, claimedAt: Date, error: string) {
		return this.markTerminal(id, claimedAt, "failed", error);
	}

	private async markTerminal(
		id: string,
		claimedAt: Date,
		status: "failed" | "processed" | "skipped",
		error: string | null,
	): Promise<boolean> {
		const [row] = await this.db
			.update(billingWebhookEvents)
			.set({
				error,
				processedAt: new Date(),
				status,
			})
			.where(
				and(
					eq(billingWebhookEvents.id, id),
					eq(billingWebhookEvents.status, "processing"),
					eq(billingWebhookEvents.claimedAt, claimedAt),
				),
			)
			.returning({ id: billingWebhookEvents.id });

		return row !== undefined;
	}
}
