import { Inject, Injectable } from "@nestjs/common";
import { and, inArray, sql } from "@wandit/db";
import { creditLedger } from "@wandit/db/schema/credits";

import {
	DATABASE,
	type Database,
} from "../../../../infrastructure/database/database.constants";

export type BillingCreditLedgerRow = typeof creditLedger.$inferSelect;

@Injectable()
export class BillingCreditLedgerRepository {
	constructor(@Inject(DATABASE) private readonly db: Database) {}

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
