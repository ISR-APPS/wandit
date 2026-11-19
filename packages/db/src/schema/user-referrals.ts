/**
 * Tables of the user referral program: one invite code per user, and one row per referred friend.
 * The server module `user-referrals` reads and writes them through its repository.
 * The affiliate program has its own tables in `affiliates.ts`. This file does not use them.
 */
import { sql } from "drizzle-orm";
import {
	check,
	index,
	integer,
	pgTable,
	text,
	timestamp,
	uniqueIndex,
	uuid,
} from "drizzle-orm/pg-core";
import { user } from "./auth";

/** The permanent invite code of a user. The row is created on the first read of the summary. */
export const userReferralCodes = pgTable(
	"user_referral_codes",
	{
		userId: text("user_id")
			.primaryKey()
			// restrict: mirrors `user_attributions.user_id` and `affiliate_attributions.user_id`.
			.references(() => user.id, { onDelete: "restrict" }),
		// 8 characters of lowercase Crockford base32. The invite link holds it as `?invite=<code>`.
		code: text("code").notNull(),
		createdAt: timestamp("created_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
	},
	(table) => [uniqueIndex("user_referral_codes_code_uq").on(table.code)],
);

/**
 * One row per referred friend. `created_at` is the time the friend joined.
 * The three credit columns are a snapshot of the settings at claim time.
 */
export const userReferrals = pgTable(
	"user_referrals",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		// restrict on both users: mirrors `user_attributions.user_id` and
		// `affiliate_attributions.user_id`. The rows are a part of the credit history.
		referrerUserId: text("referrer_user_id")
			.notNull()
			.references(() => user.id, { onDelete: "restrict" }),
		referredUserId: text("referred_user_id")
			.notNull()
			.references(() => user.id, { onDelete: "restrict" }),
		// UNIT: centi-credits. The bonus of the friend.
		friendCredits: integer("friend_credits").notNull(),
		// UNIT: centi-credits. The reward of the referrer when the friend builds. 0 = no reward.
		activationCredits: integer("activation_credits").notNull(),
		// UNIT: centi-credits. The reward of the referrer when the friend pays. 0 = no reward.
		paidCredits: integer("paid_credits").notNull(),
		// The time the friend bonus is in the ledger, or the time a zero bonus is closed.
		friendGrantedAt: timestamp("friend_granted_at", { withTimezone: true }),
		// The time the sweep sees that the friend used the minimum credits.
		activatedAt: timestamp("activated_at", { withTimezone: true }),
		// The time the activation reward is in the ledger, or the time a zero reward is closed.
		activationGrantedAt: timestamp("activation_granted_at", {
			withTimezone: true,
		}),
		// The time the sweep sees the first real payment of the friend. The hold starts here.
		firstPaidAt: timestamp("first_paid_at", { withTimezone: true }),
		// The time the paid reward is in the ledger, or the time a zero reward is closed.
		paidGrantedAt: timestamp("paid_granted_at", { withTimezone: true }),
		createdAt: timestamp("created_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
	},
	(table) => [
		// A user has at most one referrer. The claim insert uses this index for first-wins.
		uniqueIndex("user_referrals_referredUserId_uq").on(table.referredUserId),
		// Serves the friends list and the stats of one referrer.
		index("user_referrals_referrerUserId_createdAt_idx").on(
			table.referrerUserId,
			table.createdAt,
		),
		// Serves the keyset walk of the sweep over the rows that are not activated.
		index("user_referrals_activationCandidates_idx")
			.on(table.createdAt, table.id)
			.where(sql`${table.activatedAt} IS NULL`),
		check(
			"user_referrals_friend_credits_nonnegative_ck",
			sql`${table.friendCredits} >= 0`,
		),
		check(
			"user_referrals_activation_credits_nonnegative_ck",
			sql`${table.activationCredits} >= 0`,
		),
		check(
			"user_referrals_paid_credits_nonnegative_ck",
			sql`${table.paidCredits} >= 0`,
		),
		check(
			"user_referrals_not_self_ck",
			sql`${table.referrerUserId} <> ${table.referredUserId}`,
		),
	],
);
