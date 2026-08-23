import { Inject, Injectable } from "@nestjs/common";
import {
	ENTITLED_SUBSCRIPTION_STATUSES,
	PURCHASED_CREDIT_BUCKETS,
} from "@wandit/contracts";
import { and, desc, eq, inArray, isNull, sql } from "@wandit/db";
import {
	subscriptionRefillSlots,
	subscriptions,
} from "@wandit/db/schema/billing";
import { creditLedger } from "@wandit/db/schema/credits";
import {
	DATABASE,
	type Database,
} from "../../../../infrastructure/database/database.constants";
import {
	type CreditOwner,
	creditOwnerKey,
	creditOwnerLockValue,
	ownerFromIds,
} from "../../../credits/domain/credit-owner";
import { canceledSlotValues } from "./subscription-credits.repository";

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

	async acquireOwnerLock(
		owner: CreditOwner,
		client: BillingCreditLedgerClient,
	): Promise<void> {
		// Byte-compatible with CreditsRepository's balance lock via the shared
		// creditOwnerLockValue helper (personal = raw user id).
		await client.execute(
			sql`select pg_advisory_xact_lock(hashtext(${creditOwnerLockValue(owner)}))`,
		);
	}

	/**
	 * OWNER-derived on purpose: an org slot's subscription carries a provenance
	 * userId (the purchasing admin) that must never be compared against
	 * org-resolved grant rows — that mismatch would abort the clawback and
	 * leave refunded org credits unrevoked (confirmed review finding).
	 */
	async findPendingRefillSlotOwnersForCharge(
		chargeId: string,
		client: BillingCreditLedgerClient = this.db,
	): Promise<CreditOwner[]> {
		const rows = await client
			.select({
				organizationId: subscriptions.organizationId,
				userId: subscriptions.userId,
			})
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
		const byKey = new Map<string, CreditOwner>();

		for (const row of rows) {
			const owner = ownerFromIds(row.userId, row.organizationId);
			byKey.set(creditOwnerKey(owner), owner);
		}

		return [...byKey.values()];
	}

	async cancelPendingRefillSlotsForCharge(
		chargeId: string,
		client: BillingCreditLedgerClient = this.db,
	): Promise<number> {
		const rows = await client
			.update(subscriptionRefillSlots)
			.set(canceledSlotValues({ reason: "clawback" }))
			.where(
				and(
					eq(subscriptionRefillSlots.fundingChargeId, chargeId),
					eq(subscriptionRefillSlots.status, "pending"),
				),
			)
			.returning({ id: subscriptionRefillSlots.id });

		return rows.length;
	}

	/**
	 * Won dispute: put back the future months a clawback canceled. Only
	 * `clawback` rows qualify (`replaced`/`ownership` rows were canceled for
	 * reasons the dispute outcome does not reverse), only future months, and
	 * only while the slot's subscription is still its owner's canonical
	 * entitled mirror. Returns the restored and skipped slot ids.
	 */
	async restorePendingRefillSlotsForCharge(
		chargeId: string,
		now: Date,
		client: BillingCreditLedgerClient = this.db,
	): Promise<{ restored: string[]; skipped: string[] }> {
		const candidates = await client
			.select({
				id: subscriptionRefillSlots.id,
				organizationId: subscriptions.organizationId,
				subscriptionId: subscriptions.id,
				userId: subscriptions.userId,
			})
			.from(subscriptionRefillSlots)
			.innerJoin(
				subscriptions,
				eq(subscriptionRefillSlots.subscriptionId, subscriptions.id),
			)
			.where(
				and(
					eq(subscriptionRefillSlots.fundingChargeId, chargeId),
					eq(subscriptionRefillSlots.status, "canceled"),
					eq(subscriptionRefillSlots.canceledReason, "clawback"),
					sql`${subscriptionRefillSlots.dueAt} > ${now}`,
				),
			);
		const restored: string[] = [];
		const skipped: string[] = [];

		for (const candidate of candidates) {
			const canonical = await this.findCanonicalEntitledByOwner(
				ownerFromIds(candidate.userId, candidate.organizationId),
				client,
			);

			if (canonical?.id !== candidate.subscriptionId) {
				skipped.push(candidate.id);
				continue;
			}

			const [row] = await client
				.update(subscriptionRefillSlots)
				.set({
					canceledAt: null,
					canceledReason: null,
					status: "pending",
					supersededByInvoiceId: null,
				})
				.where(
					and(
						eq(subscriptionRefillSlots.id, candidate.id),
						eq(subscriptionRefillSlots.status, "canceled"),
					),
				)
				.returning({ id: subscriptionRefillSlots.id });

			if (row) {
				restored.push(row.id);
			}
		}

		return { restored, skipped };
	}

	/**
	 * Plan credits from a refunded charge that ALREADY expired (rollover cap,
	 * subscription end) must not be clawed back a second time out of live
	 * credits bought with newer money. Sums the `expire` rows of the grant
	 * owner's plan bucket written at or after the earliest grant for the same
	 * subscription, ONCE per (owner, subscription) no matter how many grants
	 * the charge funded (a yearly charge funds one refill slot per month),
	 * capped at the total of those grants.
	 */
	async findExpiredPlanCreditsForPayment(
		input: { chargeId: string; paymentIntentId: string | null },
		client: BillingCreditLedgerClient = this.db,
	): Promise<number> {
		const grants = (
			await this.findPositiveRowsForPayment(input, client)
		).filter((row) => row.bucket === "plan");
		const groups = new Map<
			string,
			{
				earliestGrantAt: Date;
				granted: number;
				owner: CreditOwner;
				subscriptionId: string;
			}
		>();

		for (const grant of grants) {
			const meta = (grant.meta ?? {}) as Record<string, unknown>;
			const subscriptionId =
				typeof meta.subscriptionId === "string" ? meta.subscriptionId : null;

			if (!subscriptionId) {
				continue;
			}

			const owner = ownerFromIds(grant.userId, grant.organizationId);
			const key = `${creditOwnerKey(owner)}|${subscriptionId}`;
			const group = groups.get(key);

			if (group) {
				group.granted += grant.delta;

				if (grant.createdAt < group.earliestGrantAt) {
					group.earliestGrantAt = grant.createdAt;
				}
			} else {
				groups.set(key, {
					earliestGrantAt: grant.createdAt,
					granted: grant.delta,
					owner,
					subscriptionId,
				});
			}
		}

		let expired = 0;

		for (const group of groups.values()) {
			const ownerPredicate =
				group.owner.type === "org"
					? eq(creditLedger.organizationId, group.owner.organizationId)
					: and(
							eq(creditLedger.userId, group.owner.userId),
							isNull(creditLedger.organizationId),
						);
			const [row] = await client
				.select({
					expired:
						sql<number>`coalesce(sum(-${creditLedger.delta}), 0)::bigint`.mapWith(
							Number,
						),
				})
				.from(creditLedger)
				.where(
					and(
						ownerPredicate,
						eq(creditLedger.kind, "expire"),
						eq(creditLedger.bucket, "plan"),
						sql`${creditLedger.delta} < 0`,
						sql`${creditLedger.createdAt} >= ${group.earliestGrantAt}`,
						sql`${creditLedger.meta}->>'subscriptionId' = ${group.subscriptionId}`,
					),
				);

			expired += Math.min(group.granted, row?.expired ?? 0);
		}

		return expired;
	}

	private async findCanonicalEntitledByOwner(
		owner: CreditOwner,
		client: BillingCreditLedgerClient,
	) {
		const ownerPredicate =
			owner.type === "user"
				? and(
						eq(subscriptions.userId, owner.userId),
						isNull(subscriptions.organizationId),
					)
				: eq(subscriptions.organizationId, owner.organizationId);
		const [row] = await client
			.select({ id: subscriptions.id })
			.from(subscriptions)
			.where(
				and(
					ownerPredicate,
					inArray(
						subscriptions.status,
						ENTITLED_SUBSCRIPTION_STATUSES as unknown as string[],
					),
				),
			)
			.orderBy(desc(subscriptions.updatedAt), desc(subscriptions.createdAt))
			.limit(1);

		return row ?? null;
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
