/**
 * Drizzle queries for plan credits: subscriptions, invoice applications, and refill slots.
 * The subscription credit, refill, manual billing, and admin refund services call it.
 * Takes the same owner advisory lock as CreditsRepository, so ledger writes serialize.
 */
import { Inject, Injectable } from "@nestjs/common";
import { and, asc, desc, eq, gt, isNull, or, sql } from "@wandit/db";
import {
	billingInvoiceApplications,
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
	creditOwnerLockValue,
} from "../../../credits/domain/credit-owner";

export type SubscriptionCreditsTransaction = Parameters<
	Parameters<Database["transaction"]>[0]
>[0];

type SubscriptionCreditsClient = Pick<
	Database,
	"execute" | "insert" | "select" | "update"
>;

export type InvoiceApplicationRow =
	typeof billingInvoiceApplications.$inferSelect;
export type RefillSlotRow = typeof subscriptionRefillSlots.$inferSelect;
export type SubscriptionCreditRow = typeof subscriptions.$inferSelect;

/**
 * Why a pending slot was canceled. `replaced`: a newer invoice's slots
 * superseded it (upgrade/renewal); `clawback`: its funding charge was
 * refunded or disputed. Pricing v8 writes only these two. `ownership` and
 * `ended` stay for rows that older code wrote.
 */
export type RefillSlotCancelReason =
	| "clawback"
	| "ended"
	| "ownership"
	| "replaced";

export type RefillSlotCancellation = {
	reason: RefillSlotCancelReason;
	supersededByInvoiceId?: string | null;
};

export function canceledSlotValues(provenance: RefillSlotCancellation) {
	return {
		canceledAt: new Date(),
		canceledReason: provenance.reason,
		status: "canceled" as const,
		supersededByInvoiceId: provenance.supersededByInvoiceId ?? null,
	};
}

export type InsertInvoiceApplication =
	typeof billingInvoiceApplications.$inferInsert;
export type InsertRefillSlot = typeof subscriptionRefillSlots.$inferInsert;

@Injectable()
export class SubscriptionCreditsRepository {
	constructor(@Inject(DATABASE) private readonly db: Database) {}

	withOwnerLock<T>(
		owner: CreditOwner,
		fn: (tx: SubscriptionCreditsTransaction) => Promise<T>,
	): Promise<T> {
		return this.db.transaction(async (tx) => {
			// This must remain byte-for-byte compatible with CreditsRepository's
			// lock key so policy rows and ledger rows serialize together —
			// creditOwnerLockValue is that single source of truth.
			await tx.execute(
				sql`select pg_advisory_xact_lock(hashtext(${creditOwnerLockValue(owner)}))`,
			);

			return fn(tx);
		});
	}

	async findSubscriptionByProviderId(
		providerSubscriptionId: string,
		client: SubscriptionCreditsClient = this.db,
	): Promise<SubscriptionCreditRow | null> {
		const [row] = await client
			.select()
			.from(subscriptions)
			.where(eq(subscriptions.providerSubscriptionId, providerSubscriptionId))
			.limit(1);

		return row ?? null;
	}

	async findInvoiceApplication(
		stripeInvoiceId: string,
		client: SubscriptionCreditsClient = this.db,
	): Promise<InvoiceApplicationRow | null> {
		const [row] = await client
			.select()
			.from(billingInvoiceApplications)
			.where(eq(billingInvoiceApplications.stripeInvoiceId, stripeInvoiceId))
			.limit(1);

		return row ?? null;
	}

	/**
	 * The last paid invoice of the user's personal Stripe plan, with its subscription.
	 * The admin refund preview reads it. Team plans and offline plans never match.
	 */
	async findLatestPaidPersonalStripeInvoice(userId: string): Promise<{
		invoice: InvoiceApplicationRow;
		subscription: SubscriptionCreditRow;
	} | null> {
		const [row] = await this.db
			.select({
				invoice: billingInvoiceApplications,
				subscription: subscriptions,
			})
			.from(billingInvoiceApplications)
			.innerJoin(
				subscriptions,
				eq(subscriptions.id, billingInvoiceApplications.subscriptionId),
			)
			.where(
				and(
					eq(subscriptions.userId, userId),
					isNull(subscriptions.organizationId),
					eq(subscriptions.provider, "stripe"),
					// Old rows have no amount snapshot. A zero amount means Stripe collected nothing.
					or(
						isNull(billingInvoiceApplications.amountPaidMinor),
						gt(billingInvoiceApplications.amountPaidMinor, 0),
					),
				),
			)
			// Old rows have no paid_at. The apply time is close to the payment time.
			.orderBy(
				desc(
					sql`coalesce(${billingInvoiceApplications.paidAt}, ${billingInvoiceApplications.appliedAt})`,
				),
				desc(billingInvoiceApplications.stripeInvoiceId),
			)
			.limit(1);

		return row ?? null;
	}

	async hasGrossGrant(
		owner: CreditOwner,
		idempotencyKey: string,
		client: SubscriptionCreditsClient = this.db,
	): Promise<boolean> {
		const ownerPredicate =
			owner.type === "user"
				? and(
						eq(creditLedger.userId, owner.userId),
						isNull(creditLedger.organizationId),
					)
				: eq(creditLedger.organizationId, owner.organizationId);
		const [row] = await client
			.select({ id: creditLedger.id })
			.from(creditLedger)
			.where(
				and(
					ownerPredicate,
					eq(creditLedger.idempotencyKey, idempotencyKey),
					eq(creditLedger.kind, "grant"),
					gt(creditLedger.delta, 0),
				),
			)
			.limit(1);

		return row !== undefined;
	}

	async findLatestInvoiceApplication(
		subscriptionId: string,
		client: SubscriptionCreditsClient = this.db,
	): Promise<InvoiceApplicationRow | null> {
		const [row] = await client
			.select()
			.from(billingInvoiceApplications)
			.where(
				and(
					eq(billingInvoiceApplications.subscriptionId, subscriptionId),
					// Old code skipped a late create invoice with creditsDelta 0.
					// Keep those audit-only rows out of the paid predecessor chain.
					sql`(${billingInvoiceApplications.billingReason} <> 'subscription_create' OR ${billingInvoiceApplications.creditsDelta} > 0)`,
				),
			)
			// Pricing v8 (I4): a late invoice of an older period now grants and
			// writes a row. The newest period, not the newest write, is the predecessor.
			.orderBy(
				desc(billingInvoiceApplications.periodEnd),
				desc(billingInvoiceApplications.appliedAt),
				desc(billingInvoiceApplications.stripeInvoiceId),
			)
			.limit(1);

		return row ?? null;
	}

	async insertInvoiceApplication(
		input: InsertInvoiceApplication,
		client: SubscriptionCreditsClient = this.db,
	): Promise<InvoiceApplicationRow> {
		const [inserted] = await client
			.insert(billingInvoiceApplications)
			.values(input)
			.onConflictDoNothing({
				target: billingInvoiceApplications.stripeInvoiceId,
			})
			.returning();

		if (inserted) {
			return inserted;
		}

		const existing = await this.findInvoiceApplication(
			input.stripeInvoiceId,
			client,
		);

		if (!existing) {
			throw new Error(
				`Billing invoice application ${input.stripeInvoiceId} disappeared after conflict`,
			);
		}

		return existing;
	}

	async insertRefillSlots(
		inputs: InsertRefillSlot[],
		client: SubscriptionCreditsClient = this.db,
	): Promise<RefillSlotRow[]> {
		if (inputs.length === 0) {
			return [];
		}

		return client
			.insert(subscriptionRefillSlots)
			.values(inputs)
			.onConflictDoNothing({
				target: [
					subscriptionRefillSlots.subscriptionId,
					subscriptionRefillSlots.fundingInvoiceId,
					subscriptionRefillSlots.periodOrdinal,
				],
			})
			.returning();
	}

	async cancelPendingSlotsForSubscription(
		subscriptionId: string,
		provenance: RefillSlotCancellation,
		client: SubscriptionCreditsClient = this.db,
	): Promise<number> {
		const rows = await client
			.update(subscriptionRefillSlots)
			.set(canceledSlotValues(provenance))
			.where(
				and(
					eq(subscriptionRefillSlots.subscriptionId, subscriptionId),
					eq(subscriptionRefillSlots.status, "pending"),
				),
			)
			.returning({ id: subscriptionRefillSlots.id });

		return rows.length;
	}

	async findDuePendingSlotsForSubscription(
		subscriptionId: string,
		dueThrough: Date,
		client: SubscriptionCreditsClient = this.db,
	): Promise<RefillSlotRow[]> {
		return client
			.select()
			.from(subscriptionRefillSlots)
			.where(
				and(
					eq(subscriptionRefillSlots.subscriptionId, subscriptionId),
					eq(subscriptionRefillSlots.status, "pending"),
					sql`${subscriptionRefillSlots.dueAt} <= ${dueThrough}`,
				),
			)
			.orderBy(
				asc(subscriptionRefillSlots.dueAt),
				asc(subscriptionRefillSlots.periodOrdinal),
				asc(subscriptionRefillSlots.id),
			);
	}

	async findSlotWithSubscription(
		slotId: string,
		client: SubscriptionCreditsClient = this.db,
	): Promise<{
		slot: RefillSlotRow;
		subscription: SubscriptionCreditRow;
	} | null> {
		const [row] = await client
			.select({
				slot: subscriptionRefillSlots,
				subscription: subscriptions,
			})
			.from(subscriptionRefillSlots)
			.innerJoin(
				subscriptions,
				eq(subscriptionRefillSlots.subscriptionId, subscriptions.id),
			)
			.where(eq(subscriptionRefillSlots.id, slotId))
			.limit(1);

		return row ?? null;
	}

	/**
	 * Sets one `pending` slot to `granted`, due or not. Only the pay-as-you-go
	 * cutover grant calls it. Returns null when another writer changed the slot first.
	 */
	async claimPendingSlot(
		slotId: string,
		grantedAt: Date,
		client: SubscriptionCreditsClient = this.db,
	): Promise<RefillSlotRow | null> {
		const [row] = await client
			.update(subscriptionRefillSlots)
			.set({ grantedAt, status: "granted" })
			.where(
				and(
					eq(subscriptionRefillSlots.id, slotId),
					eq(subscriptionRefillSlots.status, "pending"),
				),
			)
			.returning();

		return row ?? null;
	}

	async claimDueSlot(
		slotId: string,
		now: Date,
		client: SubscriptionCreditsClient = this.db,
	): Promise<RefillSlotRow | null> {
		const [row] = await client
			.update(subscriptionRefillSlots)
			.set({ grantedAt: now, status: "granted" })
			.where(
				and(
					eq(subscriptionRefillSlots.id, slotId),
					eq(subscriptionRefillSlots.status, "pending"),
					sql`${subscriptionRefillSlots.dueAt} <= ${now}`,
				),
			)
			.returning();

		return row ?? null;
	}
}
