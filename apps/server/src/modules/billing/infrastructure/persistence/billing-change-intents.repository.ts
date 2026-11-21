/**
 * Reads `billing_change_intents` rows of the pre-v8 plan change flow.
 * Only scripts/migrate-subscriptions-v6.ts calls it. Pricing v8 removed the change routes.
 * Delete it with that script in the next release.
 */
import { Inject, Injectable } from "@nestjs/common";
import { and, eq, ne, sql } from "@wandit/db";
import { billingChangeIntents } from "@wandit/db/schema/billing";
import {
	DATABASE,
	type Database,
} from "../../../../infrastructure/database/database.constants";
import {
	type CreditOwner,
	creditOwnerLockValue,
} from "../../../credits/domain/credit-owner";

export type BillingChangeIntentRow = typeof billingChangeIntents.$inferSelect;
export type BillingChangeIntentTransaction = Parameters<
	Parameters<Database["transaction"]>[0]
>[0];

type BillingChangeIntentClient = Pick<Database, "select">;

@Injectable()
export class BillingChangeIntentsRepository {
	constructor(@Inject(DATABASE) private readonly db: Database) {}

	/**
	 * Owner-scoped variant (creditOwnerLockValue; personal = raw user id).
	 * Change EXECUTION must serialize on the SUBSCRIPTION'S owner: an org can
	 * have several owners, and per-actor locks let two of them race conflicting
	 * Stripe changes (confirmed money-review finding).
	 */
	withOwnerLock<T>(
		owner: CreditOwner,
		fn: (tx: BillingChangeIntentTransaction) => Promise<T>,
	): Promise<T> {
		return this.db.transaction(async (tx) => {
			await tx.execute(
				sql`select pg_advisory_xact_lock(hashtext(${creditOwnerLockValue(owner)}))`,
			);

			return fn(tx);
		});
	}

	async findOtherProcessingForSubscription(
		subscriptionId: string,
		excludedIntentId: string,
		client: BillingChangeIntentClient = this.db,
	): Promise<BillingChangeIntentRow | null> {
		const [row] = await client
			.select()
			.from(billingChangeIntents)
			.where(
				and(
					eq(billingChangeIntents.subscriptionId, subscriptionId),
					eq(billingChangeIntents.status, "processing"),
					ne(billingChangeIntents.id, excludedIntentId),
				),
			)
			.limit(1);

		return row ?? null;
	}
}
