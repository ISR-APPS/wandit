import { Inject, Injectable } from "@nestjs/common";
import { and, eq, sql } from "@wandit/db";
import { billingPaymentAdjustments } from "@wandit/db/schema/billing";

import {
	DATABASE,
	type Database,
} from "../../../../infrastructure/database/database.constants";

export type BillingPaymentAdjustmentRow =
	typeof billingPaymentAdjustments.$inferSelect;
export type InsertBillingPaymentAdjustment =
	typeof billingPaymentAdjustments.$inferInsert;
export type BillingPaymentAdjustmentsTransaction = Parameters<
	Parameters<Database["transaction"]>[0]
>[0];

type BillingPaymentAdjustmentsClient = Pick<Database, "insert" | "select">;

@Injectable()
export class BillingPaymentAdjustmentsRepository {
	constructor(@Inject(DATABASE) private readonly db: Database) {}

	withStripeObjectLock<T>(
		stripeObjectId: string,
		fn: (tx: BillingPaymentAdjustmentsTransaction) => Promise<T>,
	): Promise<T> {
		return this.db.transaction(async (tx) => {
			await tx.execute(
				sql`select pg_advisory_xact_lock(hashtext('billing-payment-adjustment:' || ${stripeObjectId}::text))`,
			);

			return fn(tx);
		});
	}

	async tryInsert(
		input: InsertBillingPaymentAdjustment,
		client: BillingPaymentAdjustmentsClient = this.db,
	): Promise<boolean> {
		const [inserted] = await client
			.insert(billingPaymentAdjustments)
			.values(input)
			.onConflictDoNothing({
				target: billingPaymentAdjustments.stripeEventId,
			})
			.returning({ id: billingPaymentAdjustments.id });

		return inserted !== undefined;
	}

	async sumRefundIncrementsByStripeObjectId(
		stripeObjectId: string,
		client: BillingPaymentAdjustmentsClient = this.db,
	): Promise<number> {
		const [row] = await client
			.select({
				total: sql<number>`coalesce(sum(${billingPaymentAdjustments.amountCents}), 0)::int`,
			})
			.from(billingPaymentAdjustments)
			.where(
				and(
					eq(billingPaymentAdjustments.kind, "refund"),
					eq(billingPaymentAdjustments.stripeObjectId, stripeObjectId),
				),
			);

		return Number(row?.total ?? 0);
	}
}
