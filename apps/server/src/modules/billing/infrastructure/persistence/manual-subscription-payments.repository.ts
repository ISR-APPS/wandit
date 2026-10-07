/**
 * Reads and writes `manual_subscription_payments`, one row per paid period of a manual subscription.
 * ManualSubscriptionsService records the rows. SlickpayPaymentsService looks up the rows of a SlickPay payment.
 * Drizzle only.
 */
import { Inject, Injectable } from "@nestjs/common";
import type { ManualPaymentMethod } from "@wandit/contracts";
import { and, desc, eq, sql } from "@wandit/db";
import { user } from "@wandit/db/schema/auth";
import { manualSubscriptionPayments } from "@wandit/db/schema/billing";

import {
	DATABASE,
	type Database,
} from "../../../../infrastructure/database/database.constants";

export type ManualSubscriptionPaymentRow =
	typeof manualSubscriptionPayments.$inferSelect;

export type InsertManualSubscriptionPaymentInput = {
	amountMinor: number;
	currency: string;
	idempotencyKey: string;
	kind: ManualSubscriptionPaymentRow["kind"];
	method: ManualPaymentMethod;
	note: string | null;
	periodEnd: Date;
	periodStart: Date;
	recordedByUserId: string;
	reference: string | null;
	requestId: string | null;
	subscriptionId: string;
};

export type ManualSubscriptionPaymentAdminRow = {
	payment: ManualSubscriptionPaymentRow;
	recordedBy: {
		email: string;
		id: string;
		image: string | null;
		name: string;
	} | null;
};

export type ManualSubscriptionPaymentSummary = {
	count: number;
	lastPaymentAt: Date | null;
};

type ManualSubscriptionPaymentsClient = Pick<Database, "insert" | "select">;

@Injectable()
export class ManualSubscriptionPaymentsRepository {
	constructor(@Inject(DATABASE) private readonly db: Database) {}

	async insert(
		input: InsertManualSubscriptionPaymentInput,
		client: ManualSubscriptionPaymentsClient = this.db,
	): Promise<ManualSubscriptionPaymentRow> {
		const [inserted] = await client
			.insert(manualSubscriptionPayments)
			.values(input)
			.onConflictDoNothing({
				target: manualSubscriptionPayments.idempotencyKey,
			})
			.returning();

		if (inserted) {
			return inserted;
		}

		const existing = await this.findByIdempotencyKey(
			input.idempotencyKey,
			client,
		);

		if (!existing) {
			throw new Error(
				"Manual subscription payment conflict did not resolve to a row",
			);
		}

		return existing;
	}

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

	async getSummaryBySubscription(
		subscriptionId: string,
		client: ManualSubscriptionPaymentsClient = this.db,
	): Promise<ManualSubscriptionPaymentSummary> {
		const [row] = await client
			.select({
				count: sql<number>`count(*)::int`,
				lastPaymentAt: sql<Date | null>`max(${manualSubscriptionPayments.createdAt})`,
			})
			.from(manualSubscriptionPayments)
			.where(eq(manualSubscriptionPayments.subscriptionId, subscriptionId));

		return row ?? { count: 0, lastPaymentAt: null };
	}

	/** Recorded offline money per currency in [from, until). */
	async sumByCurrencyBetween(
		from: Date,
		until: Date,
		client: ManualSubscriptionPaymentsClient = this.db,
	): Promise<
		Array<{ amountMinor: number; currency: string; payments: number }>
	> {
		return client
			.select({
				amountMinor: sql<number>`coalesce(sum(${manualSubscriptionPayments.amountMinor}), 0)::int`,
				currency: manualSubscriptionPayments.currency,
				payments: sql<number>`count(*)::int`,
			})
			.from(manualSubscriptionPayments)
			.where(
				and(
					sql`${manualSubscriptionPayments.createdAt} >= ${from}`,
					sql`${manualSubscriptionPayments.createdAt} < ${until}`,
				),
			)
			.groupBy(manualSubscriptionPayments.currency)
			.orderBy(manualSubscriptionPayments.currency);
	}
}
