/**
 * Drizzle queries of the user referral program: `user_referral_codes` and `user_referrals`.
 * UserReferralsService calls it, from the API and from the Trigger task `user-referral-sweep`.
 * It also READS tables of other modules: `user`, `subscriptions`, the two plan payment tables,
 * `billing_topup_receipts`, `credit_ledger`, and `affiliate_attributions`. It writes only the two referral tables.
 */
import { Inject, Injectable } from "@nestjs/common";
import { TOPUP_MIN_AMOUNT_USD } from "@wandit/contracts";
import {
	alias,
	and,
	desc,
	eq,
	gt,
	isNull,
	lte,
	or,
	type SQL,
	sql,
} from "@wandit/db";
import { affiliateAttributions } from "@wandit/db/schema/affiliates";
import { user } from "@wandit/db/schema/auth";
import {
	billingInvoiceApplications,
	billingTopupReceipts,
	manualSubscriptionPayments,
	subscriptions,
} from "@wandit/db/schema/billing";
import { creditLedger } from "@wandit/db/schema/credits";
import {
	userReferralCodes,
	userReferrals,
} from "@wandit/db/schema/user-referrals";

import {
	DATABASE,
	type Database,
} from "../../../../infrastructure/database/database.constants";
import type { UserReferralReward } from "../../domain/user-referral-rules";

/** The `inv:<invoice id>:grant` ledger row of a plan invoice. The revoke rows are a second `credit_ledger` scan. */
const invoiceGrant = alias(creditLedger, "referral_invoice_grant");

/**
 * Centi-credits that refunds and disputes took back from one payment, as a scalar subquery.
 * Revoke rows are negative and clawback restores are positive, so the net revoke is minus their sum.
 * The rule copies `revokedCentiCreditsQuery` of BillingTopupReceiptsRepository, plus a payment intent match
 * when the charge id is null. A SlickPay or offline payment has neither id, so the result is 0.
 */
function netRevokedCentiCredits(chargeId: SQL, paymentIntentId: SQL): SQL {
	return sql`(
		select -coalesce(sum(${creditLedger.delta}), 0)
		from ${creditLedger}
		where (
				${creditLedger.kind} = 'revoke'
				or (
					${creditLedger.kind} = 'grant'
					and ${creditLedger.meta}->>'billingAdjustment' = 'clawback_restore'
				)
			)
			and (
				${creditLedger.meta}->>'chargeId' = ${chargeId}
				or (${chargeId} is null and ${creditLedger.meta}->>'paymentIntentId' = ${paymentIntentId})
			)
	)`;
}

/**
 * True when a top-up receipt is worth TOPUP_MIN_AMOUNT_USD (10 USD) or more. markFirstPayments and hasLivePersonalPayment use it.
 * Fraud rule: a 1 USD Starter pass must not earn the referrer the 100-credit paid reward.
 * A receipt from before v8 has no `amount_usd_cents`; a USD one then uses `amount_cents`. Other NULL rows do not count.
 */
export const receiptReachesTopupMinimum = sql`coalesce(
	${billingTopupReceipts.amountUsdCents},
	case when ${billingTopupReceipts.currency} = 'usd' then ${billingTopupReceipts.amountCents} end
) >= ${TOPUP_MIN_AMOUNT_USD * 100}`;

/** One row of `user_referrals`. The three credit columns are centi-credits. */
export type UserReferralRow = typeof userReferrals.$inferSelect;

/**
 * The transaction of `UserReferralsRepository.transaction`.
 * It is the same type as `CreditsTransaction`, so `CreditsService.grant` can write in it.
 */
export type UserReferralsTransaction = Parameters<
	Parameters<Database["transaction"]>[0]
>[0];

/** The pool or an open transaction. Inside a transaction, each read must use the transaction. */
type UserReferralsReader = Pick<Database, "select">;

/** Position of the last row of a sweep page. The next page starts after it. */
export type UserReferralCursor = {
	/** `created_at` as Postgres text, with microseconds. A JS `Date` has only milliseconds. */
	createdAt: string;
	/** Id of the row in `user_referrals`. */
	id: string;
};

/** One row of a sweep page, with the cursor value of its `created_at`. */
export type UserReferralPageRow = {
	referral: UserReferralRow;
	/** `created_at` as Postgres text. It goes into `UserReferralCursor.createdAt`. */
	cursorCreatedAt: string;
};

/** Totals over all friends of one referrer. Credits are centi-credits. */
export type UserReferralStats = {
	joinedCount: number;
	/** Friends with an activation mark or a first payment mark. */
	activatedCount: number;
	subscribedCount: number;
	/** Referrer rewards that are in the ledger. */
	earnedCentiCredits: number;
	/** Referrer rewards that are marked but not granted. */
	pendingCentiCredits: number;
};

/** One friend in the referrer's list, with the name and the email from the `user` table. */
export type UserReferralFriendRow = {
	referral: UserReferralRow;
	name: string;
	email: string;
};

@Injectable()
export class UserReferralsRepository {
	constructor(@Inject(DATABASE) private readonly db: Database) {}

	/**
	 * Runs `work` in one database transaction. A throw rolls back each write of `work`.
	 * The Trigger task has a pool of one connection: `work` must send each query through `tx`.
	 */
	transaction<T>(
		work: (tx: UserReferralsTransaction) => Promise<T>,
	): Promise<T> {
		return this.db.transaction(work);
	}

	/** The invite code of the user, or null before the first read of the summary. */
	async findCodeByUserId(userId: string): Promise<string | null> {
		const [row] = await this.db
			.select({ code: userReferralCodes.code })
			.from(userReferralCodes)
			.where(eq(userReferralCodes.userId, userId))
			.limit(1);

		return row?.code ?? null;
	}

	/**
	 * Stores `code` for the user, then returns the code that the user has.
	 * Returns null when a different user has `code`: the caller tries again with a new code.
	 */
	async saveCodeIfFree(userId: string, code: string): Promise<string | null> {
		// No conflict target: the insert is a no-op on the user primary key and on the unique code.
		// Two summary reads at the same time then give the same code.
		await this.db
			.insert(userReferralCodes)
			.values({ code, userId })
			.onConflictDoNothing();

		return this.findCodeByUserId(userId);
	}

	/** The user who owns the invite code, or null when no user has it. */
	async findUserIdByCode(code: string): Promise<string | null> {
		const [row] = await this.db
			.select({ userId: userReferralCodes.userId })
			.from(userReferralCodes)
			.where(eq(userReferralCodes.code, code))
			.limit(1);

		return row?.userId ?? null;
	}

	/** `user.created_at`, the signup time. Null when the user row does not exist. */
	async findUserCreatedAt(userId: string): Promise<Date | null> {
		const [row] = await this.db
			.select({ createdAt: user.createdAt })
			.from(user)
			.where(eq(user.id, userId))
			.limit(1);

		return row?.createdAt ?? null;
	}

	/** The referral row of a referred friend. A user has at most one. */
	async findReferralByReferredUserId(
		referredUserId: string,
	): Promise<UserReferralRow | null> {
		const [row] = await this.db
			.select()
			.from(userReferrals)
			.where(eq(userReferrals.referredUserId, referredUserId))
			.limit(1);

		return row ?? null;
	}

	/**
	 * True when the user has a row in `affiliate_attributions`, in any status.
	 * A cross-module read: the affiliate program wins over a referral.
	 * The read is here so that this module does not import AffiliatesModule.
	 */
	async hasAffiliateAttribution(
		userId: string,
		client: UserReferralsReader = this.db,
	): Promise<boolean> {
		const [row] = await client
			.select({ id: affiliateAttributions.id })
			.from(affiliateAttributions)
			.where(eq(affiliateAttributions.userId, userId))
			.limit(1);

		return row !== undefined;
	}

	/**
	 * True when the user has one personal payment with a net revoke of 0.
	 * The payment is a top-up receipt of 10 USD or more, or a paid invoice or manual payment of a personal plan.
	 * The sweep calls it after the 7-day hold. It is a cross-module read: the billing module stays unchanged.
	 */
	async hasLivePersonalPayment(
		userId: string,
		tx: UserReferralsTransaction,
	): Promise<boolean> {
		// Strict money rule: a refund of any size makes that payment "not paid". A full dispute restore makes it paid again.
		const [row] = await tx
			.select({ id: user.id })
			.from(user)
			.where(
				and(
					eq(user.id, userId),
					sql`(
						exists (
							select 1 from ${billingTopupReceipts}
							where ${billingTopupReceipts.userId} = ${userId}
								and ${billingTopupReceipts.organizationId} is null
								and ${receiptReachesTopupMinimum}
								and ${billingTopupReceipts.reversedAt} is null
								and ${netRevokedCentiCredits(
									sql`${billingTopupReceipts.chargeId}`,
									sql`${billingTopupReceipts.paymentIntentId}`,
								)} = 0
						)
						or exists (
							select 1 from ${subscriptions}
							where ${subscriptions.userId} = ${userId}
								and ${subscriptions.organizationId} is null
								and (
									exists (
										select 1 from ${billingInvoiceApplications}
										inner join ${creditLedger} as ${invoiceGrant}
											on ${invoiceGrant.idempotencyKey} = 'inv:' || ${billingInvoiceApplications.stripeInvoiceId} || ':grant'
										where ${billingInvoiceApplications.subscriptionId} = ${subscriptions.id}
											and ${billingInvoiceApplications.amountPaidMinor} > 0
											and ${netRevokedCentiCredits(
												sql`${invoiceGrant.meta}->>'chargeId'`,
												sql`${invoiceGrant.meta}->>'paymentIntentId'`,
											)} = 0
									)
									or exists (
										select 1 from ${manualSubscriptionPayments}
										where ${manualSubscriptionPayments.subscriptionId} = ${subscriptions.id}
											and ${manualSubscriptionPayments.amountMinor} > 0
									)
								)
						)
					)`,
				),
			)
			.limit(1);

		return row !== undefined;
	}

	/**
	 * Inserts the referral row of a new friend. The credit values are the snapshot, in centi-credits.
	 * Returns null when the friend already has a row: the first claim wins.
	 */
	async insertReferral(input: {
		referrerUserId: string;
		referredUserId: string;
		friendCredits: number;
		activationCredits: number;
		paidCredits: number;
	}): Promise<UserReferralRow | null> {
		const [row] = await this.db
			.insert(userReferrals)
			.values(input)
			.onConflictDoNothing({ target: userReferrals.referredUserId })
			.returning();

		return row ?? null;
	}

	/** Totals over ALL referral rows of the referrer, in one query. */
	async getReferrerStats(referrerUserId: string): Promise<UserReferralStats> {
		const [row] = await this.db
			.select({
				activatedCount: sql<number>`(count(*) filter (where ${userReferrals.activatedAt} is not null or ${userReferrals.firstPaidAt} is not null))::int`,
				// The same two sums as `referrerRewardCentiCredits` in the domain rules.
				earnedCentiCredits: sql<number>`(
					coalesce(sum(${userReferrals.activationCredits}) filter (where ${userReferrals.activationGrantedAt} is not null), 0)
					+ coalesce(sum(${userReferrals.paidCredits}) filter (where ${userReferrals.paidGrantedAt} is not null), 0)
				)::int`,
				joinedCount: sql<number>`count(*)::int`,
				pendingCentiCredits: sql<number>`(
					coalesce(sum(${userReferrals.activationCredits}) filter (where ${userReferrals.activatedAt} is not null and ${userReferrals.activationGrantedAt} is null), 0)
					+ coalesce(sum(${userReferrals.paidCredits}) filter (where ${userReferrals.firstPaidAt} is not null and ${userReferrals.paidGrantedAt} is null), 0)
				)::int`,
				subscribedCount: sql<number>`(count(*) filter (where ${userReferrals.firstPaidAt} is not null))::int`,
			})
			.from(userReferrals)
			.where(eq(userReferrals.referrerUserId, referrerUserId));

		if (!row) {
			throw new Error("The user referral stats query returned no row");
		}

		return row;
	}

	/** The newest friends of the referrer, newest first, with the name and the email of each friend. */
	listFriends(
		referrerUserId: string,
		limit: number,
	): Promise<UserReferralFriendRow[]> {
		return this.db
			.select({ email: user.email, name: user.name, referral: userReferrals })
			.from(userReferrals)
			.innerJoin(user, eq(user.id, userReferrals.referredUserId))
			.where(eq(userReferrals.referrerUserId, referrerUserId))
			.orderBy(desc(userReferrals.createdAt), desc(userReferrals.id))
			.limit(limit);
	}

	/**
	 * Sets `first_paid_at` on each referral whose friend has a real personal payment and no mark.
	 * A real payment is a top-up receipt of 10 USD or more, or a plan payment above 0. Team payments do not count.
	 * A cross-module read of the billing tables: it covers Stripe, manual, SlickPay, and offline with no billing hook.
	 * The refund check comes later, in `hasLivePersonalPayment`, after the hold.
	 */
	async markFirstPayments(now: Date): Promise<void> {
		// LIMIT: each run reads all rows with no payment mark. Upgrade: a partial index on first_paid_at IS NULL, or a mark from the billing hook.
		await this.db
			.update(userReferrals)
			.set({ firstPaidAt: now })
			.where(
				and(
					isNull(userReferrals.firstPaidAt),
					// Product rule: only real money counts, a top-up or a paid personal plan.
					// A free admin grant and the dev seed plan have no row with an amount above 0.
					sql`(exists (
						select 1 from ${billingTopupReceipts}
						where ${billingTopupReceipts.userId} = ${userReferrals.referredUserId}
							and ${billingTopupReceipts.organizationId} is null
							and ${receiptReachesTopupMinimum}
							and ${billingTopupReceipts.reversedAt} is null
					)
					or exists (
						select 1 from ${subscriptions}
						where ${subscriptions.userId} = ${userReferrals.referredUserId}
							and ${subscriptions.organizationId} is null
							and (
								exists (
									select 1 from ${billingInvoiceApplications}
									where ${billingInvoiceApplications.subscriptionId} = ${subscriptions.id}
										and ${billingInvoiceApplications.amountPaidMinor} > 0
								)
								or exists (
									select 1 from ${manualSubscriptionPayments}
									where ${manualSubscriptionPayments.subscriptionId} = ${subscriptions.id}
										and ${manualSubscriptionPayments.amountMinor} > 0
								)
							)
					))`,
				),
			);
	}

	/**
	 * One page of the referrals that are not activated and that joined after `joinedAfter`.
	 * Ordered and keyset paged by (created_at, id), so the sweep reads each candidate one time.
	 */
	listActivationCandidates(input: {
		/** Start of the activation window: `now` minus 30 days. */
		joinedAfter: Date;
		/** Null on the first page. */
		after: UserReferralCursor | null;
		limit: number;
	}): Promise<UserReferralPageRow[]> {
		return this.listPage(
			and(
				isNull(userReferrals.activatedAt),
				gt(userReferrals.createdAt, input.joinedAfter),
			),
			input.after,
			input.limit,
		);
	}

	/**
	 * One page of the referrals that can have a due reward, ordered and keyset paged by (created_at, id).
	 * The page holds each row with an open friend bonus, or an activation mark with no grant.
	 * It also holds each row with a first payment mark at or before `paidOnOrBefore` and no paid grant.
	 */
	listDueReferrals(input: {
		/** End of the paid hold: `now` minus 7 days. */
		paidOnOrBefore: Date;
		/** Null on the first page. */
		after: UserReferralCursor | null;
		limit: number;
	}): Promise<UserReferralPageRow[]> {
		// LIMIT: no index serves this filter, so each run reads the whole table. Upgrade: a partial index on the open stamps.
		return this.listPage(
			or(
				isNull(userReferrals.friendGrantedAt),
				sql`(${userReferrals.activatedAt} is not null and ${userReferrals.activationGrantedAt} is null)`,
				and(
					lte(userReferrals.firstPaidAt, input.paidOnOrBefore),
					isNull(userReferrals.paidGrantedAt),
				),
			),
			input.after,
			input.limit,
		);
	}

	/**
	 * Takes the activation lock of one referrer until the transaction ends.
	 * Two sweeps then count the cap of this referrer one after the other.
	 */
	async lockReferrer(
		referrerUserId: string,
		tx: UserReferralsTransaction,
	): Promise<void> {
		await tx.execute(
			sql`select pg_advisory_xact_lock(hashtext(${`user-referral:${referrerUserId}`}))`,
		);
	}

	/** Counts the referrals of the referrer that activated after `since` with a reward above 0. */
	async countPayingActivations(
		referrerUserId: string,
		since: Date,
		tx: UserReferralsTransaction,
	): Promise<number> {
		const [row] = await tx
			.select({ total: sql<number>`count(*)::int` })
			.from(userReferrals)
			.where(
				and(
					eq(userReferrals.referrerUserId, referrerUserId),
					gt(userReferrals.activatedAt, since),
					gt(userReferrals.activationCredits, 0),
				),
			);

		return row?.total ?? 0;
	}

	/**
	 * Marks the referral as activated at `now` and writes its final activation reward, in centi-credits.
	 * A no-op when the row already has the mark.
	 */
	async markActivated(
		referralId: string,
		activationCredits: number,
		now: Date,
		tx: UserReferralsTransaction,
	): Promise<void> {
		await tx
			.update(userReferrals)
			.set({ activatedAt: now, activationCredits })
			.where(
				and(
					eq(userReferrals.id, referralId),
					isNull(userReferrals.activatedAt),
				),
			);
	}

	/**
	 * Reads one referral row and locks it until the transaction ends.
	 * Two deliveries of the same reward then run one after the other.
	 */
	async lockReferral(
		referralId: string,
		tx: UserReferralsTransaction,
	): Promise<UserReferralRow | null> {
		const [row] = await tx
			.select()
			.from(userReferrals)
			.where(eq(userReferrals.id, referralId))
			.for("update");

		return row ?? null;
	}

	/**
	 * Closes one reward: writes its final amount, in centi-credits, and its `*_granted_at` stamp.
	 * A no-op when the stamp is already set, so a repeated delivery changes nothing.
	 */
	async stampRewardGranted(
		referralId: string,
		reward: UserReferralReward,
		credits: number,
		now: Date,
		tx: UserReferralsTransaction,
	): Promise<void> {
		const update = tx.update(userReferrals);
		const isReferral = eq(userReferrals.id, referralId);

		switch (reward) {
			case "friend":
				await update
					.set({ friendCredits: credits, friendGrantedAt: now })
					.where(and(isReferral, isNull(userReferrals.friendGrantedAt)));
				break;
			case "activation":
				await update
					.set({ activationCredits: credits, activationGrantedAt: now })
					.where(and(isReferral, isNull(userReferrals.activationGrantedAt)));
				break;
			case "paid":
				await update
					.set({ paidCredits: credits, paidGrantedAt: now })
					.where(and(isReferral, isNull(userReferrals.paidGrantedAt)));
				break;
		}
	}

	private listPage(
		filter: SQL | undefined,
		after: UserReferralCursor | null,
		limit: number,
	): Promise<UserReferralPageRow[]> {
		return this.db
			.select({
				cursorCreatedAt: sql<string>`${userReferrals.createdAt}::text`,
				referral: userReferrals,
			})
			.from(userReferrals)
			.where(
				and(
					filter,
					// The cursor keeps the microseconds of Postgres, so a page boundary skips no row
					// and repeats no row.
					after
						? sql`(${userReferrals.createdAt}, ${userReferrals.id}) > (${after.createdAt}::timestamptz, ${after.id}::uuid)`
						: undefined,
				),
			)
			.orderBy(userReferrals.createdAt, userReferrals.id)
			.limit(limit);
	}
}
