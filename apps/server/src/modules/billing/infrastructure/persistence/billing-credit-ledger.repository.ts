import { Inject, Injectable } from "@nestjs/common";
import { and, inArray, sql } from "@wandit/db";
import { creditLedger } from "@wandit/db/schema/credits";

import {
	DATABASE,
	type Database,
} from "../../../../infrastructure/database/database.constants";

export type BillingCreditLedgerRow = typeof creditLedger.$inferSelect;

export type BillingCreditLedgerTransaction = Parameters<
	Parameters<Database["transaction"]>[0]
>[0];

type BillingCreditLedgerClient = Pick<Database, "select">;

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

	findPositiveRowsForPayment(
		input: {
			chargeId: string;
			paymentIntentId: string | null;
		},
		client: BillingCreditLedgerClient = this.db,
	): Promise<BillingCreditLedgerRow[]> {
		const paymentReference = input.paymentIntentId
			? sql`(${creditLedger.meta}->>'chargeId' = ${input.chargeId} OR (${creditLedger.meta}->>'chargeId' IS NULL AND ${creditLedger.meta}->>'paymentIntentId' = ${input.paymentIntentId}))`
			: sql`${creditLedger.meta}->>'chargeId' = ${input.chargeId}`;

		return client
			.select()
			.from(creditLedger)
			.where(
				and(
					inArray(creditLedger.kind, ["grant", "topup"]),
					sql`${creditLedger.delta} > 0`,
					paymentReference,
				),
			);
	}

	findRevocationRowsForPayment(
		input: {
			chargeId: string;
			paymentIntentId: string | null;
		},
		client: BillingCreditLedgerClient = this.db,
	): Promise<BillingCreditLedgerRow[]> {
		const paymentReference = input.paymentIntentId
			? sql`(${creditLedger.meta}->>'chargeId' = ${input.chargeId} OR (${creditLedger.meta}->>'chargeId' IS NULL AND ${creditLedger.meta}->>'paymentIntentId' = ${input.paymentIntentId}))`
			: sql`${creditLedger.meta}->>'chargeId' = ${input.chargeId}`;

		return client
			.select()
			.from(creditLedger)
			.where(
				and(
					inArray(creditLedger.kind, ["revoke"]),
					sql`${creditLedger.delta} < 0`,
					paymentReference,
				),
			);
	}

	findPositiveRowsByPaymentIntentId(
		paymentIntentId: string,
	): Promise<BillingCreditLedgerRow[]> {
		return this.db
			.select()
			.from(creditLedger)
			.where(
				and(
					inArray(creditLedger.kind, ["grant", "topup"]),
					sql`${creditLedger.delta} > 0`,
					sql`${creditLedger.meta}->>'paymentIntentId' = ${paymentIntentId}`,
				),
			);
	}
}
