/**
 * Holds the one "paid owner" rule of pricing v8 (spec section 6).
 * The V2 backend limit, the V2 device minutes, the project move, the page
 * badge gate, the lifecycle dispatcher, BillingService, and AdminOrganizationsService
 * call `isPaidOwner`. `personalPaidOwnerFilter` in admin.repository.ts is a SQL copy
 * of this rule for list queries: change both.
 * Reads `subscriptions` and `credit_ledger` through Drizzle.
 */
import { Inject, Injectable } from "@nestjs/common";
import { and, eq, isNull, notInArray, type SQL, sql } from "@wandit/db";
import { subscriptions } from "@wandit/db/schema/billing";
import { creditLedger } from "@wandit/db/schema/credits";

import {
	DATABASE,
	type Database,
} from "../../../../infrastructure/database/database.constants";
import type { CreditOwner } from "../../../credits/domain/credit-owner";

/**
 * SQL condition that is true when the pool of `owner` is a paid owner: it has
 * a ledger row of kind `topup`, or a subscription that got past its first payment.
 */
export function paidOwnerCondition(owner: CreditOwner): SQL {
	// A team subscription row holds the buyer in `user_id`. A personal check
	// without `organization_id is null` makes each team buyer a personal paid owner.
	const subscriptionOwner =
		owner.type === "user"
			? and(
					eq(subscriptions.userId, owner.userId),
					isNull(subscriptions.organizationId),
				)
			: eq(subscriptions.organizationId, owner.organizationId);
	const ledgerOwner =
		owner.type === "user"
			? and(
					eq(creditLedger.userId, owner.userId),
					isNull(creditLedger.organizationId),
				)
			: eq(creditLedger.organizationId, owner.organizationId);

	// Product rule: a row stays "paid" after a cancel, a refund, or a lost
	// dispute. Only a subscription whose first payment never completed is not paid.
	// LIMIT: no index serves `canceled` rows, so this half is a sequential scan.
	// The table stops growing (no new subscription). Upgrade: a plain index on
	// `user_id` and on `organization_id`.
	// `bucket = 'topup'` lets `credit_ledger_userId_bucket_idx` (personal) or
	// `credit_ledger_orgId_bucket_idx` (team) serve the ledger half.
	// `kind = 'topup'` excludes the `consume` and `revoke` rows of the bucket.
	return sql`(
		exists (
			select 1 from ${subscriptions}
			where ${and(
				subscriptionOwner,
				notInArray(subscriptions.status, ["incomplete", "incomplete_expired"]),
			)}
		)
		or exists (
			select 1 from ${creditLedger}
			where ${and(
				ledgerOwner,
				eq(creditLedger.bucket, "topup"),
				eq(creditLedger.kind, "topup"),
			)}
		)
	)`;
}

/** Not exported by BillingModule: each reader module lists it as its own provider. It needs only DATABASE. */
@Injectable()
export class PaidOwnerRepository {
	constructor(@Inject(DATABASE) private readonly db: Database) {}

	/**
	 * True when the pool has one or more top-ups, or had a subscription.
	 * A paid owner never becomes free again: a refund writes a `revoke` row and deletes nothing.
	 */
	async isPaidOwner(owner: CreditOwner): Promise<boolean> {
		const result = await this.db.execute<{ paid: boolean }>(
			sql`select ${paidOwnerCondition(owner)} as paid`,
		);

		return result.rows[0]?.paid === true;
	}
}
