import { Inject, Injectable } from "@nestjs/common";
import { PURCHASED_CREDIT_BUCKETS } from "@wandit/contracts";
import { and, eq, inArray, sql } from "@wandit/db";
import {
	subscriptionRefillSlots,
	subscriptions,
} from "@wandit/db/schema/billing";
import { creditLedger } from "@wandit/db/schema/credits";

import {
	DATABASE,
	type Database,
} from "../../../../infrastructure/database/database.constants";

export type BillingCreditLedgerRow = typeof creditLedger.$inferSelect;

export type BillingCreditLedgerTransaction = Parameters<
	Parameters<Database["transaction"]>[0]
>[0];

type BillingCreditLedgerClient = Pick<
	Database,
	"execute" | "select" | "update"
>;

@Injectable()
export class BillingCreditLedgerRepository {
	constructor(@Inject(DATABASE) private readonly db: Database) {}

	async withChargeLock<T>(
		chargeId: string,
		fn: (tx: BillingCreditLedgerTransaction) => Promise<T>,
	): Promise<T> {
		return this.db.transaction(async (tx) => {
			await tx.execute(
				sql`select pg_advisory_xact_lock(hashtext('stripe-credit-clawback:' || ${chargeId}::text))`,
			);

			return fn(tx);
		});
	}

	async findPositiveRowsForPayment(
		input: {
			chargeId: string;
			paymentIntentId: string | null;
		},
		client: BillingCreditLedgerClient = this.db,
	): Promise<BillingCreditLedgerRow[]> {
		const paymentReference = input.paymentIntentId
			? sql`(${creditLedger.meta}->>'chargeId' = ${input.chargeId} OR (${creditLedger.meta}->>'chargeId' IS NULL AND ${creditLedger.meta}->>'paymentIntentId' = ${input.paymentIntentId}))`
			: sql`${creditLedger.meta}->>'chargeId' = ${input.chargeId}`;

		const rows = await client
			.select()
			.from(creditLedger)
			.where(
				and(
					inArray(creditLedger.kind, ["grant", "topup"]),
					sql`${creditLedger.delta} > 0`,
					sql`coalesce(${creditLedger.meta}->>'billingAdjustment', '') <> 'clawback_restore'`,
					paymentReference,
				),
			);

		this.assertPurchasedBuckets(rows);

		return rows;
	}

	async findRestorationRowsForPayment(
		input: {
			chargeId: string;
			paymentIntentId: string | null;
		},
		client: BillingCreditLedgerClient = this.db,
	): Promise<BillingCreditLedgerRow[]> {
		const paymentReference = input.paymentIntentId
			? sql`(${creditLedger.meta}->>'chargeId' = ${input.chargeId} OR (${creditLedger.meta}->>'chargeId' IS NULL AND ${creditLedger.meta}->>'paymentIntentId' = ${input.paymentIntentId}))`
			: sql`${creditLedger.meta}->>'chargeId' = ${input.chargeId}`;
		const rows = await client
			.select()
			.from(creditLedger)
			.where(
				and(
					eq(creditLedger.kind, "grant"),
					sql`${creditLedger.delta} > 0`,
					sql`${creditLedger.meta}->>'billingAdjustment' = 'clawback_restore'`,
					paymentReference,
				),
			);

		this.assertPurchasedBuckets(rows);

		return rows;
	}

	async acquireUserLock(
		userId: string,
		client: BillingCreditLedgerClient,
	): Promise<void> {
		await client.execute(
			sql`select pg_advisory_xact_lock(hashtext(${userId}))`,
		);
	}

	async findPendingRefillSlotUserIdsForCharge(
		chargeId: string,
		client: BillingCreditLedgerClient = this.db,
	): Promise<string[]> {
		const rows = await client
			.select({ userId: subscriptions.userId })
			.from(subscriptionRefillSlots)
			.innerJoin(
				subscriptions,
				eq(subscriptionRefillSlots.subscriptionId, subscriptions.id),
			)
			.where(
				and(
					eq(subscriptionRefillSlots.fundingChargeId, chargeId),
					eq(subscriptionRefillSlots.status, "pending"),
				),
			);

		return [...new Set(rows.map((row) => row.userId))];
	}

	async cancelPendingRefillSlotsForCharge(
		chargeId: string,
		client: BillingCreditLedgerClient = this.db,
	): Promise<number> {
		const rows = await client
			.update(subscriptionRefillSlots)
			.set({ status: "canceled" })
			.where(
				and(
					eq(subscriptionRefillSlots.fundingChargeId, chargeId),
					eq(subscriptionRefillSlots.status, "pending"),
				),
			)
			.returning({ id: subscriptionRefillSlots.id });

		return rows.length;
	}

	async findRevocationRowsForPayment(
		input: {
			chargeId: string;
			paymentIntentId: string | null;
		},
		client: BillingCreditLedgerClient = this.db,
	): Promise<BillingCreditLedgerRow[]> {
		const paymentReference = input.paymentIntentId
			? sql`(${creditLedger.meta}->>'chargeId' = ${input.chargeId} OR (${creditLedger.meta}->>'chargeId' IS NULL AND ${creditLedger.meta}->>'paymentIntentId' = ${input.paymentIntentId}))`
			: sql`${creditLedger.meta}->>'chargeId' = ${input.chargeId}`;

		const rows = await client
			.select()
			.from(creditLedger)
			.where(
				and(
					inArray(creditLedger.kind, ["revoke"]),
					sql`${creditLedger.delta} < 0`,
					paymentReference,
				),
			);

		this.assertPurchasedBuckets(rows);

		return rows;
	}

	async findPositiveRowsByPaymentIntentId(
		paymentIntentId: string,
	): Promise<BillingCreditLedgerRow[]> {
		const rows = await this.db
			.select()
			.from(creditLedger)
			.where(
				and(
					inArray(creditLedger.kind, ["grant", "topup"]),
					sql`${creditLedger.delta} > 0`,
					sql`coalesce(${creditLedger.meta}->>'billingAdjustment', '') <> 'clawback_restore'`,
					sql`${creditLedger.meta}->>'paymentIntentId' = ${paymentIntentId}`,
				),
			);

		this.assertPurchasedBuckets(rows);

		return rows;
	}

	private assertPurchasedBuckets(rows: BillingCreditLedgerRow[]): void {
		for (const row of rows) {
			if (
				!(PURCHASED_CREDIT_BUCKETS as readonly string[]).includes(row.bucket)
			) {
				throw new Error(
					`Payment-linked ${row.bucket} credit row ${row.id} violates purchased-credit bucket invariants`,
				);
			}
		}
	}
}
