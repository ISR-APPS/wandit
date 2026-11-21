/**
 * Stores the Starter pass of each credit pool: one live `starter_passes` row per pool.
 * The top-up grants, the receipt reverse, the dispute clawback, the admin routes, the dev seed,
 * and the settings switch call it. Reads `subscriptions`, `credit_ledger`, and `payment_orders` for the backfill.
 */
import { Inject, Injectable } from "@nestjs/common";
import {
	type StarterPassSource,
	topupReceiptProviderSchema,
} from "@wandit/contracts";
import {
	and,
	desc,
	eq,
	inArray,
	isNull,
	ne,
	notInArray,
	type SQL,
	sql,
} from "@wandit/db";
import {
	billingTopupReceipts,
	starterPasses,
	subscriptions,
} from "@wandit/db/schema/billing";
import { creditLedger } from "@wandit/db/schema/credits";
import { paymentOrders } from "@wandit/db/schema/orders";

import {
	DATABASE,
	type Database,
} from "../../../../infrastructure/database/database.constants";
import {
	type CreditOwner,
	ownerColumns,
	ownerFromIds,
} from "../../../credits/domain/credit-owner";

/** One `starter_passes` row. `revokedAt` is null while the pass is live. */
export type StarterPassRow = typeof starterPasses.$inferSelect;

/** The database or an open transaction. Callers pass the transaction of the receipt or the settings write. */
type StarterPassesClient = Pick<
	Database,
	"execute" | "insert" | "select" | "update"
>;

/** The facts of a new pass, apart from its owner. */
export type StarterPassGrant = {
	source: StarterPassSource;
	/** Id of the `billing_topup_receipts` row that gave the pass. Only for a paid top-up. */
	receiptId?: string;
	/** The staff account of an admin grant. */
	grantedByUserId?: string;
	/** The note of an admin grant, or "dev seed". */
	note?: string;
};

/** Who revokes a pass, and why. */
export type StarterPassRevocation = {
	/** The staff account of an admin revoke. Absent for a reverse or a dispute. */
	revokedByUserId?: string;
	/** For example `admin:{note}`, `receipt_reversed:{receiptId}`, or `dispute:{disputeId}`. */
	reason: string;
};

/**
 * The live pass of one pool. A team pass has `user_id` NULL, so a personal match also pins `organization_id`.
 * The credits gate SQL in CreditsRepository also uses it, so the gate and the writers agree.
 */
export function livePassOfOwner(owner: CreditOwner): SQL | undefined {
	const poolOwner =
		owner.type === "user"
			? and(
					eq(starterPasses.userId, owner.userId),
					isNull(starterPasses.organizationId),
				)
			: eq(starterPasses.organizationId, owner.organizationId);

	return and(poolOwner, isNull(starterPasses.revokedAt));
}

/** The receipt that lost its money: its id and its two owner columns. */
type LostReceipt = Pick<
	typeof billingTopupReceipts.$inferSelect,
	"id" | "organizationId" | "userId"
>;

/**
 * Where-clause of the receipts that can take the pass of `receipt`. revokeOrMoveForReceipt uses it.
 * Exported so the spec can read the rendered SQL, because no test database exists.
 */
export function passMoveCandidateCondition(
	receipt: LostReceipt,
): SQL | undefined {
	// A team receipt holds its buyer in `user_id`, so the pool comes from `organization_id` first.
	const owner = ownerFromIds(receipt.userId, receipt.organizationId);
	const pool =
		owner.type === "user"
			? and(
					eq(billingTopupReceipts.userId, owner.userId),
					isNull(billingTopupReceipts.organizationId),
				)
			: eq(billingTopupReceipts.organizationId, owner.organizationId);
	const poolLedger =
		owner.type === "user"
			? and(
					eq(creditLedger.userId, owner.userId),
					isNull(creditLedger.organizationId),
				)
			: eq(creditLedger.organizationId, owner.organizationId);

	// Live: not reversed, no refund or dispute revoke row on its Stripe charge,
	// and never the source of a revoked pass, so a pass cannot bounce back to a lost receipt.
	return and(
		pool,
		ne(billingTopupReceipts.id, receipt.id),
		isNull(billingTopupReceipts.reversedAt),
		inArray(billingTopupReceipts.provider, ["stripe", "slickpay", "offline"]),
		sql`not exists (
			select 1 from ${starterPasses}
			where ${starterPasses.receiptId} = ${billingTopupReceipts.id}
				and ${starterPasses.revokedAt} is not null
		)`,
		sql`(${billingTopupReceipts.chargeId} is null or not exists (
			select 1 from ${creditLedger}
			where ${poolLedger}
				and ${creditLedger.kind} = 'revoke'
				and (${creditLedger.meta} ->> 'chargeId') = ${billingTopupReceipts.chargeId}
		))`,
	);
}

@Injectable()
export class StarterPassesRepository {
	constructor(@Inject(DATABASE) private readonly db: Database) {}

	/** The live pass of the pool, or null when it has none. */
	async findLive(
		owner: CreditOwner,
		client: StarterPassesClient = this.db,
	): Promise<StarterPassRow | null> {
		const [row] = await client
			.select()
			.from(starterPasses)
			.where(livePassOfOwner(owner))
			.limit(1);

		return row ?? null;
	}

	/**
	 * Inserts a live pass for the pool. Returns null when the pool already has one.
	 * The owner is the credit owner of the grant, never the buyer of a team receipt.
	 */
	async grantIfAbsent(
		owner: CreditOwner,
		grant: StarterPassGrant,
		client: StarterPassesClient = this.db,
	): Promise<StarterPassRow | null> {
		// No conflict target: the two partial unique indexes keep one live pass per pool.
		// A second grant, also from a replayed webhook, is then a no-op.
		const [row] = await client
			.insert(starterPasses)
			.values({
				...ownerColumns(owner),
				source: grant.source,
				receiptId: grant.receiptId ?? null,
				grantedByUserId: grant.grantedByUserId ?? null,
				note: grant.note ?? null,
			})
			.onConflictDoNothing()
			.returning();

		return row ?? null;
	}

	/** Revokes the live pass of the pool. Returns the revoked row, or null when the pool had no live pass. */
	async revokeLive(
		owner: CreditOwner,
		revocation: StarterPassRevocation,
		client: StarterPassesClient = this.db,
	): Promise<StarterPassRow | null> {
		const [row] = await client
			.update(starterPasses)
			.set({
				revokedAt: new Date(),
				revokedByUserId: revocation.revokedByUserId ?? null,
				revokedReason: revocation.reason,
			})
			.where(livePassOfOwner(owner))
			.returning();

		return row ?? null;
	}

	/**
	 * Revokes the live pass that `receiptId` gave. Returns null when no live pass points to the receipt.
	 * A receipt belongs to one pool, and a pool has one live pass, so at most one row changes.
	 */
	async revokeForReceipt(
		receiptId: string,
		reason: string,
		client: StarterPassesClient,
	): Promise<StarterPassRow | null> {
		const [row] = await client
			.update(starterPasses)
			.set({ revokedAt: new Date(), revokedReason: reason })
			.where(
				and(
					eq(starterPasses.receiptId, receiptId),
					isNull(starterPasses.revokedAt),
				),
			)
			.returning();

		return row ?? null;
	}

	/**
	 * Takes the pass away from a receipt that lost its money: an admin reverse, or a Stripe dispute.
	 * When the pass came from this receipt, it moves to the newest other live receipt of the pool, else it is revoked.
	 * Call it under the owner lock, in the transaction that takes the credits back. Returns null when the pass was elsewhere.
	 */
	async revokeOrMoveForReceipt(
		receipt: LostReceipt,
		reason: string,
		client: StarterPassesClient,
	): Promise<{ moved: StarterPassRow | null; revoked: StarterPassRow } | null> {
		const revoked = await this.revokeForReceipt(receipt.id, reason, client);

		if (!revoked) {
			return null;
		}

		const owner = ownerFromIds(receipt.userId, receipt.organizationId);
		const [candidate] = await client
			.select({
				id: billingTopupReceipts.id,
				provider: billingTopupReceipts.provider,
			})
			.from(billingTopupReceipts)
			.where(passMoveCandidateCondition(receipt))
			.orderBy(desc(billingTopupReceipts.paidAt))
			.limit(1);

		if (!candidate) {
			return { moved: null, revoked };
		}

		const moved = await this.grantIfAbsent(
			owner,
			{
				// passMoveCandidateCondition keeps only these three providers.
				source: topupReceiptProviderSchema.parse(candidate.provider),
				receiptId: candidate.id,
			},
			client,
		);

		return { moved, revoked };
	}

	/**
	 * revokeOrMoveForReceipt for the Stripe receipt of a disputed payment, found by charge id, else by payment intent id.
	 * Returns null when no Stripe receipt matches, or when its pass was elsewhere. Call it in the clawback transaction.
	 */
	async revokeOrMoveForStripePayment(
		payment: { chargeId: string; paymentIntentId: string | null },
		reason: string,
		client: StarterPassesClient,
	): Promise<{ moved: StarterPassRow | null; revoked: StarterPassRow } | null> {
		const byPayment =
			payment.paymentIntentId === null
				? eq(billingTopupReceipts.chargeId, payment.chargeId)
				: sql`(${billingTopupReceipts.chargeId} = ${payment.chargeId} or ${billingTopupReceipts.paymentIntentId} = ${payment.paymentIntentId})`;
		// A charge-id match wins over a payment-intent match: the charge id is the exact payment.
		const [receipt] = await client
			.select({
				id: billingTopupReceipts.id,
				organizationId: billingTopupReceipts.organizationId,
				userId: billingTopupReceipts.userId,
			})
			.from(billingTopupReceipts)
			.where(and(eq(billingTopupReceipts.provider, "stripe"), byPayment))
			.orderBy(
				sql`(${billingTopupReceipts.chargeId} = ${payment.chargeId}) desc nulls last`,
			)
			.limit(1);

		return receipt
			? this.revokeOrMoveForReceipt(receipt, reason, client)
			: null;
	}

	/**
	 * Gives a `grandfathered` pass to each pool that paid before the switch went on. Returns the count of new passes.
	 * Paid: a subscription past its first payment, a top-up ledger row, an admin credit grant, or a paid domain order.
	 * A pool with any pass row, a revoked one included, gets nothing, so an admin revoke stays. A second run adds nothing.
	 */
	async grandfatherAll(client: StarterPassesClient): Promise<number> {
		// The old paid-owner rule, with no amount threshold: every pool that paid real money keeps working.
		const paidSubscription = notInArray(subscriptions.status, [
			"incomplete",
			"incomplete_expired",
		]);
		const paidOrAdminLedgerRow = sql`((${creditLedger.kind} = 'topup' and ${creditLedger.bucket} = 'topup') or (${creditLedger.meta} ->> 'reason') = 'admin_grant')`;

		// LIMIT: two full scans of credit_ledger, once for each switch flip. Upgrade: batch the backfill by owner id.
		// A personal subscription or ledger row has `organization_id` NULL. A team subscription row holds its buyer in `user_id`.
		const personal = await client.execute(sql`
			insert into ${starterPasses} (user_id, source)
			select paid.user_id, 'grandfathered'::starter_pass_source
			from (
				select ${subscriptions.userId} as user_id from ${subscriptions}
				where ${and(isNull(subscriptions.organizationId), paidSubscription)}
				union
				select ${creditLedger.userId} from ${creditLedger}
				where ${and(isNull(creditLedger.organizationId), sql`${creditLedger.userId} is not null`)}
					and ${paidOrAdminLedgerRow}
				union
				select ${paymentOrders.userId} from ${paymentOrders}
				where ${inArray(paymentOrders.status, ["paid", "fulfilling", "fulfilled"])}
			) as paid
			where not exists (
				select 1 from ${starterPasses}
				where ${starterPasses.userId} = paid.user_id and ${starterPasses.organizationId} is null
			)
			on conflict do nothing
		`);

		// Team ledger grants and top-ups have `user_id` NULL. A domain order is always personal.
		const team = await client.execute(sql`
			insert into ${starterPasses} (organization_id, source)
			select paid.organization_id, 'grandfathered'::starter_pass_source
			from (
				select ${subscriptions.organizationId} as organization_id from ${subscriptions}
				where ${and(sql`${subscriptions.organizationId} is not null`, paidSubscription)}
				union
				select ${creditLedger.organizationId} from ${creditLedger}
				where ${creditLedger.organizationId} is not null and ${paidOrAdminLedgerRow}
			) as paid
			where not exists (
				select 1 from ${starterPasses}
				where ${starterPasses.organizationId} = paid.organization_id
			)
			on conflict do nothing
		`);

		return (personal.rowCount ?? 0) + (team.rowCount ?? 0);
	}
}
