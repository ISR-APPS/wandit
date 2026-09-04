import { Inject, Injectable } from "@nestjs/common";
import { ENTITLED_SUBSCRIPTION_STATUSES } from "@wandit/contracts";
import { and, asc, desc, eq, gt, inArray, isNull, or, sql } from "@wandit/db";
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
 * refunded or disputed; `ownership`: its subscription stopped being the
 * owner's canonical entitled mirror (deletion, replacement).
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

	/**
	 * The resolution authority for grant/expiry/refill decisions. OWNER-keyed:
	 * a creator with a personal Pro AND an org Business shares one userId
	 * across two entitled rows, and a user-keyed lookup silently cross-talks
	 * between them (confirmed review critical — dead-lettered invoices,
	 * skipped expiry, canceled refills).
	 */
	async findCanonicalEntitledByOwner(
		owner: CreditOwner,
		client: SubscriptionCreditsClient = this.db,
	): Promise<SubscriptionCreditRow | null> {
		const ownerPredicate =
			owner.type === "user"
				? and(
						eq(subscriptions.userId, owner.userId),
						isNull(subscriptions.organizationId),
					)
				: eq(subscriptions.organizationId, owner.organizationId);
		const [row] = await client
			.select()
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
					// Initial invoices always grant a positive allotment unless they
					// were skipped after a newer renewal. Keep those audit-only rows
					// out of the paid predecessor chain for subsequent upgrades.
					sql`(${billingInvoiceApplications.billingReason} <> 'subscription_create' OR ${billingInvoiceApplications.creditsDelta} > 0)`,
				),
			)
			.orderBy(
				desc(billingInvoiceApplications.appliedAt),
				desc(billingInvoiceApplications.stripeInvoiceId),
			)
			.limit(1);

		return row ?? null;
	}

	async findCycleAtOrAfter(
		subscriptionId: string,
		periodEnd: Date,
		client: SubscriptionCreditsClient = this.db,
	): Promise<InvoiceApplicationRow | null> {
		const [row] = await client
			.select()
			.from(billingInvoiceApplications)
			.where(
				and(
					eq(billingInvoiceApplications.subscriptionId, subscriptionId),
					eq(billingInvoiceApplications.billingReason, "subscription_cycle"),
					sql`${billingInvoiceApplications.periodEnd} >= ${periodEnd}`,
				),
			)
			.orderBy(desc(billingInvoiceApplications.periodEnd))
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

	async cancelPendingSlotsByFunding(
		input: {
			chargeId?: string | null;
			invoiceId?: string | null;
			paymentIntentId?: string | null;
		},
		client: SubscriptionCreditsClient = this.db,
	): Promise<number> {
		const matches = [
			input.chargeId
				? eq(subscriptionRefillSlots.fundingChargeId, input.chargeId)
				: undefined,
			input.invoiceId
				? eq(subscriptionRefillSlots.fundingInvoiceId, input.invoiceId)
				: undefined,
			input.paymentIntentId
				? eq(
						subscriptionRefillSlots.fundingPaymentIntentId,
						input.paymentIntentId,
					)
				: undefined,
		].filter((condition) => condition !== undefined);

		if (matches.length === 0) {
			return 0;
		}

		const fundingMatch = matches.length === 1 ? matches[0] : or(...matches);
		const rows = await client
			.update(subscriptionRefillSlots)
			.set(canceledSlotValues({ reason: "clawback" }))
			.where(and(eq(subscriptionRefillSlots.status, "pending"), fundingMatch))
			.returning({ id: subscriptionRefillSlots.id });

		return rows.length;
	}

	async listDueSlotIds(now: Date, limit = 100): Promise<string[]> {
		const rows = await this.db
			.select({ id: subscriptionRefillSlots.id })
			.from(subscriptionRefillSlots)
			.where(
				and(
					eq(subscriptionRefillSlots.status, "pending"),
					sql`${subscriptionRefillSlots.dueAt} <= ${now}`,
				),
			)
			.orderBy(
				asc(subscriptionRefillSlots.dueAt),
				asc(subscriptionRefillSlots.periodOrdinal),
			)
			.limit(limit);

		return rows.map((row) => row.id);
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

	async cancelPendingSlot(
		slotId: string,
		provenance: RefillSlotCancellation,
		client: SubscriptionCreditsClient = this.db,
	): Promise<boolean> {
		const [row] = await client
			.update(subscriptionRefillSlots)
			.set(canceledSlotValues(provenance))
			.where(
				and(
					eq(subscriptionRefillSlots.id, slotId),
					eq(subscriptionRefillSlots.status, "pending"),
				),
			)
			.returning({ id: subscriptionRefillSlots.id });

		return row !== undefined;
	}
}
