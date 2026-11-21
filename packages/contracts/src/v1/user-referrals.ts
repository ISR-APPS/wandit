/**
 * API contract of the user referral program: a user invites friends and gets credits.
 * The server module `user-referrals` and the web feature `user-referrals` read it.
 * All credit values here are decimal credits. The server stores centi-credits.
 * The affiliate program (`v1/affiliates.ts`, `?ref=`) is a different program.
 */
import { z } from "zod";
import { isoDateTimeSchema, uuidSchema } from "./shared/primitives";

/** Name of the query parameter in an invite link: `<web origin>/?invite=<code>`. */
export const USER_REFERRAL_INVITE_PARAM = "invite";

/** Whole credits. The friend must use this much, settled, before the referrer gets the activation reward. */
export const USER_REFERRAL_ACTIVATION_MIN_CREDITS = 8;

/** Days after the join in which the friend can activate. Also the length of the cap window. */
export const USER_REFERRAL_ACTIVATION_WINDOW_DAYS = 30;

/** Paying activation rewards per referrer in a rolling 30 days. Later activations pay 0. */
export const USER_REFERRAL_ACTIVATION_CAP = 10;

/** Days between the first real payment of the friend and the paid reward of the referrer. */
export const USER_REFERRAL_PAID_HOLD_DAYS = 7;

/**
 * Invite code of a user: 8 characters of lowercase Crockford base32.
 * The alphabet has no `i`, `l`, `o`, or `u`, so a person can read a code aloud.
 */
export const userReferralCodeSchema = z
	.string()
	.regex(/^[0-9a-hjkmnp-tv-z]{8}$/);

/** Progress of one friend. `subscribed` wins over `activated`, and `activated` wins over `joined`. */
export const userReferralStatusSchema = z.enum([
	"joined",
	"activated",
	"subscribed",
]);

export type UserReferralStatus = z.infer<typeof userReferralStatusSchema>;

/** One invited friend, as the referrer sees it. It holds no full email and no user id. */
export const userReferralFriendSchema = z.object({
	// Id of the row in `user_referrals`.
	id: uuidSchema,
	// First name of the friend. A masked email when the name is empty.
	displayName: z.string(),
	// Time the friend claimed the code, right after signup.
	joinedAt: isoDateTimeSchema,
	status: userReferralStatusSchema,
	// Decimal credits. Referrer rewards that are in the ledger for this friend.
	earnedCredits: z.number().nonnegative(),
	// Decimal credits. Referrer rewards that are marked but not paid, such as a paid reward in its hold.
	pendingCredits: z.number().nonnegative(),
});

export type UserReferralFriend = z.infer<typeof userReferralFriendSchema>;

/** Answer of `GET /api/v1/user-referrals/me`. The first call creates the code. */
export const userReferralSummarySchema = z.object({
	code: userReferralCodeSchema,
	// Totals over ALL friends of the caller, not only the friends in the list.
	stats: z.object({
		joinedCount: z.int().nonnegative(),
		// Friends that used the minimum credits. A subscribed friend counts here too.
		activatedCount: z.int().nonnegative(),
		subscribedCount: z.int().nonnegative(),
		// Decimal credits.
		earnedCredits: z.number().nonnegative(),
		// Decimal credits.
		pendingCredits: z.number().nonnegative(),
	}),
	// The newest 50 friends. The API has no pagination.
	friends: z.array(userReferralFriendSchema),
});

export type UserReferralSummary = z.infer<typeof userReferralSummarySchema>;

/** Body of `POST /api/v1/user-referrals/claim`. The caller is the invited friend. */
export const claimUserReferralBodySchema = z.object({
	code: userReferralCodeSchema,
});

export type ClaimUserReferralBody = z.infer<typeof claimUserReferralBodySchema>;

/** Why a claim gets no bonus. The web clears the stored code on each of them. */
export const userReferralClaimRejectionReasonSchema = z.enum([
	// The admin switch `userReferralsEnabled` is off.
	"disabled",
	"code_not_found",
	"own_code",
	// The account of the caller is older than the claim window.
	"not_new_account",
	// A different referrer already has the caller.
	"already_referred",
	// The caller has an affiliate attribution. The affiliate program wins.
	"affiliate_attributed",
]);

export type UserReferralClaimRejectionReason = z.infer<
	typeof userReferralClaimRejectionReasonSchema
>;

/**
 * Answer of the claim route. Each outcome is an HTTP 200.
 * A repeat claim for the same referrer answers `claimed` again.
 */
export const claimUserReferralResponseSchema = z.discriminatedUnion("outcome", [
	z.object({
		outcome: z.literal("claimed"),
		// Decimal credits. The bonus of the friend, from the snapshot on the referral row.
		friendCredits: z.number().nonnegative(),
	}),
	z.object({
		outcome: z.literal("rejected"),
		reason: userReferralClaimRejectionReasonSchema,
	}),
]);

export type ClaimUserReferralResponse = z.infer<
	typeof claimUserReferralResponseSchema
>;

/** Full paths of the user referral routes. Both need a signed-in user. */
export const userReferralsRoutes = {
	me: "/api/v1/user-referrals/me",
	claim: "/api/v1/user-referrals/claim",
} as const;
