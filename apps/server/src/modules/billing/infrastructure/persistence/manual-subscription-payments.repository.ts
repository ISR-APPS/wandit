/**
 * Reads `manual_subscription_payments`, one row per paid period of a manual plan from before pricing v8.
 * ManualSubscriptionsService reads the history. SlickpayPaymentsService looks up an old row of a SlickPay payment.
 * The offline stats also read the SlickPay and offline rows of `billing_topup_receipts`. Drizzle only.
 */
import { Inject, Injectable } from "@nestjs/common";
import { and, desc, eq, sql } from "@wandit/db";
import { user } from "@wandit/db/schema/auth";
import {
	billingTopupReceipts,
	manualSubscriptionPayments,
} from "@wandit/db/schema/billing";

import {
	DATABASE,
	type Database,
} from "../../../../infrastructure/database/database.constants";

export type ManualSubscriptionPaymentRow =
	typeof manualSubscriptionPayments.$inferSelect;

export type ManualSubscriptionPaymentAdminRow = {
	payment: ManualSubscriptionPaymentRow;
	recordedBy: {
		email: string;
		id: string;
		image: string | null;
		name: string;
	} | null;
};

type ManualSubscriptionPaymentsClient = Pick<Database, "select">;

@Injectable()
export class ManualSubscriptionPaymentsRepository {
	constructor(@Inject(DATABASE) private readonly db: Database) {}

	async findByIdempotencyKey(
		idempotencyKey: string,
		client: ManualSubscriptionPaymentsClient = this.db,
	): Promise<ManualSubscriptionPaymentRow | null> {
		const [row] = await client
			.select()
			.from(manualSubscriptionPayments)
			.where(eq(manualSubscriptionPayments.idempotencyKey, idempotencyKey))
			.limit(1);

		return row ?? null;
	}

	/**
	 * The payment with method "slickpay" and reference `invoiceId`, or null.
	 * The SlickPay fulfillment writes this reference. An admin writes it to resolve a SlickPay payment by hand.
	 */
	async findSlickpayByReference(
		invoiceId: string,
		client: ManualSubscriptionPaymentsClient = this.db,
	): Promise<ManualSubscriptionPaymentRow | null> {
		// LIMIT: reference has no index, so Postgres scans the manual payments. Upgrade: index (method, reference).
		const [row] = await client
			.select()
			.from(manualSubscriptionPayments)
			.where(
				and(
					eq(manualSubscriptionPayments.method, "slickpay"),
					eq(manualSubscriptionPayments.reference, invoiceId),
				),
			)
			.limit(1);

		return row ?? null;
	}

	async listBySubscription(
		subscriptionId: string,
		client: ManualSubscriptionPaymentsClient = this.db,
	): Promise<ManualSubscriptionPaymentAdminRow[]> {
		return client
			.select({
				payment: manualSubscriptionPayments,
				recordedBy: {
					email: user.email,
					id: user.id,
					image: user.image,
					name: user.name,
				},
			})
			.from(manualSubscriptionPayments)
			.leftJoin(user, eq(user.id, manualSubscriptionPayments.recordedByUserId))
			.where(eq(manualSubscriptionPayments.subscriptionId, subscriptionId))
			.orderBy(
				desc(manualSubscriptionPayments.createdAt),
				desc(manualSubscriptionPayments.id),
			);
	}

	/**
	 * Offline money per currency in [from, until): the old plan payments plus the SlickPay and
	 * offline top-up receipts that are not reversed. The admin Offline billing header shows it.
	 * Stripe receipts stay out.
	 */
	async sumByCurrencyBetween(
		from: Date,
		until: Date,
	): Promise<
		Array<{ amountMinor: number; currency: string; payments: number }>
	> {
		// Receipts store the currency in lower case, plan payments in upper case.
		// upper() merges the two and keeps the old display ("DZD").
		// bigint: one month of DZD centimes can pass the int range.
		const result = await this.db.execute<{
			amount_minor: string;
			currency: string;
			payments: string;
		}>(sql`
			select
				upper(p.currency) as currency,
				coalesce(sum(p.amount_minor), 0)::bigint as amount_minor,
				count(*)::bigint as payments
			from (
				select m.currency, m.amount_minor
				from ${manualSubscriptionPayments} m
				where m.created_at >= ${from}
					and m.created_at < ${until}
				union all
				select t.currency, t.amount_cents as amount_minor
				from ${billingTopupReceipts} t
				where t.provider in ('slickpay', 'offline')
					-- A reversed receipt does not count: its money went back or never came.
					and t.reversed_at is null
					and t.paid_at >= ${from}
					and t.paid_at < ${until}
			) p
			group by upper(p.currency)
			order by upper(p.currency)
		`);

		return result.rows.map((row) => ({
			amountMinor: Number(row.amount_minor),
			currency: row.currency,
			payments: Number(row.payments),
		}));
	}
}
