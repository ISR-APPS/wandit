import { Inject, Injectable } from "@nestjs/common";
import { and, desc, eq, inArray, sql } from "@wandit/db";
import { cancellationReasons } from "@wandit/db/schema/cancellation-reasons";

import {
	DATABASE,
	type Database,
} from "../../../../infrastructure/database/database.constants";

export type CancellationReasonRow = typeof cancellationReasons.$inferSelect;
export type InsertCancellationReason = typeof cancellationReasons.$inferInsert;
type CancellationReasonStatus = CancellationReasonRow["status"];
type CancellationReasonTransaction = Parameters<
	Parameters<Database["transaction"]>[0]
>[0];

@Injectable()
export class CancellationReasonsRepository {
	constructor(@Inject(DATABASE) private readonly db: Database) {}

	async createPending(
		input: Omit<InsertCancellationReason, "status">,
	): Promise<CancellationReasonRow> {
		const [row] = await this.db
			.insert(cancellationReasons)
			.values({ ...input, status: "pending" })
			.returning();

		if (!row) {
			throw new Error("Cancellation reason insert returned no row");
		}

		return row;
	}

	async markPendingOutcome(
		id: string,
		status: "provider_failed" | "scheduled",
	): Promise<boolean> {
		const [row] = await this.db
			.update(cancellationReasons)
			.set({ status, updatedAt: new Date() })
			.where(
				and(
					eq(cancellationReasons.id, id),
					eq(cancellationReasons.status, "pending"),
				),
			)
			.returning({ id: cancellationReasons.id });

		return row !== undefined;
	}

	markNewestScheduledResumed(stripeSubscriptionId: string): Promise<boolean> {
		return this.transitionNewest(
			stripeSubscriptionId,
			["scheduled"],
			"resumed",
			null,
		);
	}

	linkNewestOpenToEnded(
		stripeSubscriptionId: string,
		endedStateEventId: string,
	): Promise<boolean> {
		return this.transitionNewest(
			stripeSubscriptionId,
			["scheduled", "pending"],
			"ended",
			endedStateEventId,
		);
	}

	private transitionNewest(
		stripeSubscriptionId: string,
		fromStatuses: [CancellationReasonStatus, ...CancellationReasonStatus[]],
		toStatus: CancellationReasonStatus,
		endedStateEventId: string | null,
	): Promise<boolean> {
		return this.db.transaction(async (tx) => {
			await this.lockSubscription(tx, stripeSubscriptionId);
			const [candidate] = await tx
				.select({ id: cancellationReasons.id })
				.from(cancellationReasons)
				.where(
					and(
						eq(cancellationReasons.stripeSubscriptionId, stripeSubscriptionId),
						inArray(cancellationReasons.status, fromStatuses),
					),
				)
				.orderBy(
					desc(cancellationReasons.createdAt),
					desc(cancellationReasons.id),
				)
				.limit(1)
				.for("update");

			if (!candidate) {
				return false;
			}

			const [updated] = await tx
				.update(cancellationReasons)
				.set({ endedStateEventId, status: toStatus, updatedAt: new Date() })
				.where(
					and(
						eq(cancellationReasons.id, candidate.id),
						inArray(cancellationReasons.status, fromStatuses),
					),
				)
				.returning({ id: cancellationReasons.id });

			return updated !== undefined;
		});
	}

	private async lockSubscription(
		tx: CancellationReasonTransaction,
		stripeSubscriptionId: string,
	): Promise<void> {
		await tx.execute(
			sql`select pg_advisory_xact_lock(hashtext('cancellation-reason:' || ${stripeSubscriptionId}::text))`,
		);
	}
}
