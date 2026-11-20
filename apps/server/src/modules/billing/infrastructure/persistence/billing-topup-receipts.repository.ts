/**
 * Stores the wallet receipts: one `billing_topup_receipts` row per paid top-up, any provider.
 * SubscriptionCreditsService inserts Stripe rows. SlickpayPaymentsService and ManualSubscriptionsService insert
 * SlickPay and offline rows. BillingService reads the payment history and the top-up status.
 * Reads `credit_ledger` for the credits that a refund or a dispute took back.
 */
import { Inject, Injectable } from "@nestjs/common";
import type {
	AdminListTopupReceiptsQuery,
	PaginatedResult,
} from "@wandit/contracts";
import { alias, and, desc, eq, inArray, isNull, or, sql } from "@wandit/db";
import { user } from "@wandit/db/schema/auth";
import { billingTopupReceipts } from "@wandit/db/schema/billing";
import { creditLedger } from "@wandit/db/schema/credits";
import { organization } from "@wandit/db/schema/organizations";

import {
	DATABASE,
	type Database,
} from "../../../../infrastructure/database/database.constants";
import type { CreditOwner } from "../../../credits/domain/credit-owner";

export type BillingTopupReceiptRow = typeof billingTopupReceipts.$inferSelect;
export type InsertBillingTopupReceipt =
	typeof billingTopupReceipts.$inferInsert;

/** One receipt of the payment history, with the credits that Stripe refunds and disputes took back. */
export type BillingTopupReceiptWithRevoked = {
	receipt: BillingTopupReceiptRow;
	/** UNIT: centi-credits. Revoke rows minus clawback restores of the charge. Null when the receipt has no charge id. */
	revokedCentiCredits: number | null;
};

/** GET /billing/payments shows this many receipts, newest first. */
const PAYMENT_HISTORY_LIMIT = 50;

/** A user as the admin app shows it: the buyer, the admin who recorded, or the admin who reversed. */
type TopupReceiptUserRow = Pick<
	typeof user.$inferSelect,
	"email" | "id" | "image" | "name"
>;

/** One receipt with the users and the organization that the admin app shows. */
export type AdminTopupReceiptRow = {
	receipt: BillingTopupReceiptRow;
	user: TopupReceiptUserRow;
	organization: Pick<
		typeof organization.$inferSelect,
		"id" | "name" | "slug"
	> | null;
	recordedBy: TopupReceiptUserRow | null;
	reversedBy: TopupReceiptUserRow | null;
};

type BillingTopupReceiptsClient = Pick<
	Database,
	"insert" | "select" | "update"
>;

const recordedByUser = alias(user, "topup_receipt_recorded_by");
const reversedByUser = alias(user, "topup_receipt_reversed_by");

@Injectable()
export class BillingTopupReceiptsRepository {
	constructor(@Inject(DATABASE) private readonly db: Database) {}

	/** Idempotent on providerReference — the same spine as the `topup:{sessionId}` ledger key. */
	async insertIfAbsent(
		input: InsertBillingTopupReceipt,
		client: BillingTopupReceiptsClient = this.db,
	): Promise<BillingTopupReceiptRow | null> {
		const [row] = await client
			.insert(billingTopupReceipts)
			.values(input)
			.onConflictDoNothing({ target: billingTopupReceipts.providerReference })
			.returning();

		return row ?? null;
	}

	/** The receipt with `providerReference`, or null. The offline "Record top-up" replay reads it under the owner lock. */
	async findByProviderReference(
		providerReference: string,
		client: BillingTopupReceiptsClient = this.db,
	): Promise<BillingTopupReceiptRow | null> {
		const [row] = await client
			.select()
			.from(billingTopupReceipts)
			.where(eq(billingTopupReceipts.providerReference, providerReference))
			.limit(1);

		return row ?? null;
	}

	/** The receipt row, or null. "Reverse top-up" reads it to find the owner, then again under the owner lock. */
	async findById(
		id: string,
		client: BillingTopupReceiptsClient = this.db,
	): Promise<BillingTopupReceiptRow | null> {
		const [row] = await client
			.select()
			.from(billingTopupReceipts)
			.where(eq(billingTopupReceipts.id, id))
			.limit(1);

		return row ?? null;
	}

	/**
	 * Sets reversed_at and reversed_by_user_id once. Returns null when the receipt is already reversed.
	 * "Reverse top-up" calls it in the same transaction as the ledger revoke.
	 */
	async markReversed(
		id: string,
		reversedByUserId: string,
		reversedAt: Date,
		client: BillingTopupReceiptsClient = this.db,
	): Promise<BillingTopupReceiptRow | null> {
		const [row] = await client
			.update(billingTopupReceipts)
			.set({ reversedAt, reversedByUserId })
			.where(
				and(
					eq(billingTopupReceipts.id, id),
					isNull(billingTopupReceipts.reversedAt),
				),
			)
			.returning();

		return row ?? null;
	}

	/** One page of receipts for the admin offline billing page, newest first. SlickPay and offline receipts when the query has no provider. */
	async listForAdmin(
		query: AdminListTopupReceiptsQuery,
	): Promise<PaginatedResult<AdminTopupReceiptRow>> {
		// The page lists only the receipts an admin can reverse. Stripe receipts stay out unless the query names Stripe.
		const where = query.provider
			? eq(billingTopupReceipts.provider, query.provider)
			: inArray(billingTopupReceipts.provider, ["slickpay", "offline"]);
		const [totalRow] = await this.db
			.select({ total: sql<number>`count(*)::int` })
			.from(billingTopupReceipts)
			.where(where);
		const items = await this.adminSelect()
			.where(where)
			.orderBy(desc(billingTopupReceipts.paidAt), desc(billingTopupReceipts.id))
			.limit(query.pageSize)
			.offset((query.page - 1) * query.pageSize);

		return {
			items,
			page: query.page,
			pageSize: query.pageSize,
			total: totalRow?.total ?? 0,
		};
	}

	/** One receipt with its owner and admin names, or null. The answer of "Record top-up" and "Reverse top-up" reads it. */
	async findAdminById(id: string): Promise<AdminTopupReceiptRow | null> {
		const [row] = await this.adminSelect()
			.where(eq(billingTopupReceipts.id, id))
			.limit(1);

		return row ?? null;
	}

	/**
	 * The Stripe receipt of `sessionId` when `userId` paid it, or null.
	 * `credits` is in centi-credits. It is null on a receipt from before pricing v8.
	 */
	async findStripeReceiptForPayer(
		sessionId: string,
		userId: string,
	): Promise<Pick<BillingTopupReceiptRow, "credits" | "packId"> | null> {
		const [row] = await this.db
			.select({
				credits: billingTopupReceipts.credits,
				packId: billingTopupReceipts.packId,
			})
			.from(billingTopupReceipts)
			// Security: the payer filter stops a caller from reading the status of another user's session.
			.where(
				and(
					eq(billingTopupReceipts.providerReference, sessionId),
					eq(billingTopupReceipts.userId, userId),
					eq(billingTopupReceipts.provider, "stripe"),
				),
			)
			.limit(1);

		return row ?? null;
	}

	/**
	 * Paid time of the newest SlickPay or offline receipt of the personal pool, or null.
	 * A reversed receipt does not count: its money went back. AdminUserRefundsService calls it.
	 */
	async findLatestPersonalOfflinePaidAt(userId: string): Promise<Date | null> {
		// `billing_topup_receipts_userId_paidAt_idx` serves the user filter and the order.
		const [row] = await this.db
			.select({ paidAt: billingTopupReceipts.paidAt })
			.from(billingTopupReceipts)
			.where(
				and(
					eq(billingTopupReceipts.userId, userId),
					isNull(billingTopupReceipts.organizationId),
					inArray(billingTopupReceipts.provider, ["slickpay", "offline"]),
					isNull(billingTopupReceipts.reversedAt),
				),
			)
			.orderBy(desc(billingTopupReceipts.paidAt))
			.limit(1);

		return row?.paidAt ?? null;
	}

	/** The last 50 receipts of the pool, newest first. Two queries in total, whatever the row count. */
	async listRecentForOwner(
		owner: CreditOwner,
	): Promise<BillingTopupReceiptWithRevoked[]> {
		// A team receipt holds its buyer in `user_id`, so the personal read pins `organization_id IS NULL`.
		const ownerCondition =
			owner.type === "user"
				? and(
						eq(billingTopupReceipts.userId, owner.userId),
						isNull(billingTopupReceipts.organizationId),
					)
				: eq(billingTopupReceipts.organizationId, owner.organizationId);
		const receipts = await this.db
			.select()
			.from(billingTopupReceipts)
			.where(ownerCondition)
			.orderBy(desc(billingTopupReceipts.paidAt), desc(billingTopupReceipts.id))
			.limit(PAYMENT_HISTORY_LIMIT);
		const chargeIds = [
			...new Set(
				receipts.flatMap((receipt) =>
					receipt.chargeId === null ? [] : [receipt.chargeId],
				),
			),
		];
		const revokedByChargeId = new Map<string, number>();

		if (chargeIds.length > 0) {
			const rows = await this.revokedCentiCreditsQuery(chargeIds);

			for (const row of rows) {
				revokedByChargeId.set(row.chargeId, row.revokedCentiCredits);
			}
		}

		return receipts.map((receipt) => ({
			receipt,
			revokedCentiCredits:
				receipt.chargeId === null
					? null
					: (revokedByChargeId.get(receipt.chargeId) ?? 0),
		}));
	}

	private adminSelect() {
		return this.db
			.select({
				organization: {
					id: organization.id,
					name: organization.name,
					slug: organization.slug,
				},
				receipt: billingTopupReceipts,
				recordedBy: {
					email: recordedByUser.email,
					id: recordedByUser.id,
					image: recordedByUser.image,
					name: recordedByUser.name,
				},
				reversedBy: {
					email: reversedByUser.email,
					id: reversedByUser.id,
					image: reversedByUser.image,
					name: reversedByUser.name,
				},
				user: {
					email: user.email,
					id: user.id,
					image: user.image,
					name: user.name,
				},
			})
			.from(billingTopupReceipts)
			.innerJoin(user, eq(user.id, billingTopupReceipts.userId))
			.leftJoin(
				organization,
				eq(organization.id, billingTopupReceipts.organizationId),
			)
			.leftJoin(
				recordedByUser,
				eq(recordedByUser.id, billingTopupReceipts.recordedByUserId),
			)
			.leftJoin(
				reversedByUser,
				eq(reversedByUser.id, billingTopupReceipts.reversedByUserId),
			);
	}

	// Revoke rows are negative and clawback restores are positive, so the revoked
	// amount is minus their sum. `credit_ledger_chargeId_idx` serves the charge filter.
	private revokedCentiCreditsQuery(chargeIds: string[]) {
		const chargeId = sql<string>`${creditLedger.meta}->>'chargeId'`;

		return this.db
			.select({
				chargeId,
				revokedCentiCredits:
					sql<number>`-coalesce(sum(${creditLedger.delta}), 0)`.mapWith(Number),
			})
			.from(creditLedger)
			.where(
				and(
					inArray(chargeId, chargeIds),
					or(
						eq(creditLedger.kind, "revoke"),
						and(
							eq(creditLedger.kind, "grant"),
							sql`${creditLedger.meta}->>'billingAdjustment' = 'clawback_restore'`,
						),
					),
				),
			)
			.groupBy(chargeId);
	}
}
