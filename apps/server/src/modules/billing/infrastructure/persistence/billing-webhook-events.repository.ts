import { Inject, Injectable } from "@nestjs/common";
import { and, asc, eq, isNull, lt, or, sql } from "@wandit/db";
import { billingWebhookEvents } from "@wandit/db/schema/billing";
import type Stripe from "stripe";

import {
	DATABASE,
	type Database,
} from "../../../../infrastructure/database/database.constants";

export type BillingWebhookEventRow = typeof billingWebhookEvents.$inferSelect;
export type BillingWebhookClaimOptions = {
	maxAttempts?: number;
};

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

	async tryClaim(
		eventId: string,
		options: BillingWebhookClaimOptions = {},
	): Promise<Date | null> {
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
					options.maxAttempts === undefined
						? undefined
						: lt(billingWebhookEvents.attemptCount, options.maxAttempts),
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

	listRetryableBelowAttemptLimit(input: {
		limit: number;
		maxAttempts: number;
	}): Promise<BillingWebhookEventRow[]> {
		return this.db
			.select()
			.from(billingWebhookEvents)
			.where(
				and(
					lt(billingWebhookEvents.attemptCount, input.maxAttempts),
					sql`(${billingWebhookEvents.status} IN ('received', 'failed') OR (${billingWebhookEvents.status} = 'processing' AND ${billingWebhookEvents.claimedAt} < now() - interval '5 minutes'))`,
				),
			)
			.orderBy(
				asc(
					sql`coalesce(${billingWebhookEvents.processedAt}, ${billingWebhookEvents.claimedAt}, ${billingWebhookEvents.createdAt})`,
				),
				asc(billingWebhookEvents.id),
			)
			.limit(input.limit);
	}

	listDeadLetterCandidates(input: {
		limit: number;
		maxAttempts: number;
	}): Promise<BillingWebhookEventRow[]> {
		return this.db
			.select()
			.from(billingWebhookEvents)
			.where(
				and(
					sql`${billingWebhookEvents.attemptCount} >= ${input.maxAttempts}`,
					isNull(billingWebhookEvents.deadLetteredAt),
					or(
						eq(billingWebhookEvents.status, "failed"),
						and(
							eq(billingWebhookEvents.status, "processing"),
							sql`${billingWebhookEvents.claimedAt} < now() - interval '5 minutes'`,
						),
					),
				),
			)
			.orderBy(
				asc(billingWebhookEvents.processedAt),
				asc(billingWebhookEvents.id),
			)
			.limit(input.limit);
	}

	async markDeadLettered(
		eventId: string,
		maxAttempts: number,
	): Promise<BillingWebhookEventRow | null> {
		const [row] = await this.db
			.update(billingWebhookEvents)
			.set({ deadLetteredAt: new Date() })
			.where(
				and(
					eq(billingWebhookEvents.id, eventId),
					sql`${billingWebhookEvents.attemptCount} >= ${maxAttempts}`,
					isNull(billingWebhookEvents.deadLetteredAt),
					or(
						eq(billingWebhookEvents.status, "failed"),
						and(
							eq(billingWebhookEvents.status, "processing"),
							sql`${billingWebhookEvents.claimedAt} < now() - interval '5 minutes'`,
						),
					),
				),
			)
			.returning();

		return row ?? null;
	}

	async recordRetryFailure(input: {
		error: string;
		eventId: string;
		expectedAttemptCount: number;
	}): Promise<BillingWebhookEventRow | null> {
		const [row] = await this.db
			.update(billingWebhookEvents)
			.set({
				attemptCount: sql<number>`${billingWebhookEvents.attemptCount} + 1`,
				error: input.error,
				processedAt: new Date(),
				status: "failed",
			})
			.where(
				and(
					eq(billingWebhookEvents.id, input.eventId),
					eq(billingWebhookEvents.attemptCount, input.expectedAttemptCount),
					sql`(${billingWebhookEvents.status} IN ('received', 'failed') OR (${billingWebhookEvents.status} = 'processing' AND ${billingWebhookEvents.claimedAt} < now() - interval '5 minutes'))`,
				),
			)
			.returning();

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
