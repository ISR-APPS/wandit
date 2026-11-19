/**
 * Pure rules of the user referral program.
 * They cover the invite code, the claim checks, the reward states, and the display name of a friend.
 * UserReferralsService calls these functions. They read no database and no clock.
 */
import { randomBytes } from "node:crypto";
import {
	creditsToCentiCredits,
	USER_REFERRAL_ACTIVATION_MIN_CREDITS,
	USER_REFERRAL_ACTIVATION_WINDOW_DAYS,
	USER_REFERRAL_PAID_HOLD_DAYS,
	type UserReferralClaimRejectionReason,
	type UserReferralStatus,
} from "@wandit/contracts";

import { maskAffiliateEmail } from "../../affiliates/domain/affiliate-privacy";

const MS_PER_HOUR = 3_600_000;
const MS_PER_DAY = 24 * MS_PER_HOUR;

/** 24 hours. A user can claim an invite code only this long after signup. Server-only. */
const USER_REFERRAL_CLAIM_WINDOW_MS = 24 * MS_PER_HOUR;

/** 30 days. The time a friend has to activate, and the length of the rolling cap window. */
export const USER_REFERRAL_ACTIVATION_WINDOW_MS =
	USER_REFERRAL_ACTIVATION_WINDOW_DAYS * MS_PER_DAY;

/** 7 days. The time between the first payment mark and the paid reward. */
export const USER_REFERRAL_PAID_HOLD_MS =
	USER_REFERRAL_PAID_HOLD_DAYS * MS_PER_DAY;

/** 800 centi-credits. Settled net consumption of the friend that activates the referral. */
export const USER_REFERRAL_ACTIVATION_MIN_CENTI_CREDITS = creditsToCentiCredits(
	USER_REFERRAL_ACTIVATION_MIN_CREDITS,
);

/**
 * The three credit grants of one referral. `friend` goes to the invited friend.
 * `activation` and `paid` go to the referrer. The name is also the end of the ledger key.
 */
export type UserReferralReward = "friend" | "activation" | "paid";

/** The state columns of a `user_referrals` row that the rules read. Credits are centi-credits. */
export type UserReferralState = {
	friendGrantedAt: Date | null;
	activatedAt: Date | null;
	activationCredits: number;
	activationGrantedAt: Date | null;
	firstPaidAt: Date | null;
	paidCredits: number;
	paidGrantedAt: Date | null;
};

// Lowercase Crockford base32: 32 symbols, without i, l, o, and u.
const CODE_ALPHABET = "0123456789abcdefghjkmnpqrstvwxyz";
const CODE_LENGTH = 8;

// Digits, one `e`, digits: JSON reads such a code as a number, for example `1e234567`.
const NUMBER_LIKE_CODE = /^\d+e\d+$/;

/**
 * Makes a random invite code that matches `userReferralCodeSchema`.
 * The caller stores it and makes a new one when the unique index refuses it.
 * @param readRandomBytes Source of the random bytes. Only the spec passes a different one.
 */
export function generateUserReferralCode(
	readRandomBytes: (size: number) => Uint8Array = randomBytes,
): string {
	let code: string;

	// The web router parses each query value as JSON and writes it again.
	// A code that is a JSON number changes there, and its invite link then never works.
	do {
		code = "";
		for (const byte of readRandomBytes(CODE_LENGTH)) {
			// 256 is a multiple of 32, so the low 5 bits (`& 31`) give each symbol the same chance.
			code += CODE_ALPHABET.charAt(byte & 31);
		}
	} while (NUMBER_LIKE_CODE.test(code));

	return code;
}

/**
 * Says why a claim gets no bonus, or null when the claim is valid.
 * The service answers `disabled` and `code_not_found` before it calls this function.
 */
export function claimRejectionReason(input: {
	/** Id of the signed-in user who claims the code. */
	callerUserId: string;
	/** `user.created_at` of the caller. */
	callerCreatedAt: Date;
	/** Owner of the code. */
	referrerUserId: string;
	/** Referrer on the referral row that the caller already has. Null when the caller has no row. */
	existingReferrerUserId: string | null;
	/** True when the caller has a row in `affiliate_attributions`. */
	hasAffiliateAttribution: boolean;
	now: Date;
}): UserReferralClaimRejectionReason | null {
	if (input.referrerUserId === input.callerUserId) {
		return "own_code";
	}

	// Product rule: a repeat claim for the same referrer is valid at any time.
	// The first answer can get lost, and the friend must still see the bonus.
	if (input.existingReferrerUserId === input.referrerUserId) {
		return null;
	}

	// Product rule: only a new account can be a referred friend.
	if (
		input.now.getTime() - input.callerCreatedAt.getTime() >
		USER_REFERRAL_CLAIM_WINDOW_MS
	) {
		return "not_new_account";
	}

	if (input.existingReferrerUserId !== null) {
		return "already_referred";
	}

	// Product rule: the affiliate program wins. Its partner gets cash for this user.
	if (input.hasAffiliateAttribution) {
		return "affiliate_attributed";
	}

	return null;
}

/** True when the reward is marked, not in the ledger, and its wait time is over at `now`. */
export function isRewardDue(
	referral: UserReferralState,
	reward: UserReferralReward,
	now: Date,
): boolean {
	switch (reward) {
		case "friend":
			return referral.friendGrantedAt === null;
		case "activation":
			return (
				referral.activatedAt !== null && referral.activationGrantedAt === null
			);
		case "paid":
			return (
				referral.firstPaidAt !== null &&
				referral.paidGrantedAt === null &&
				// Product rule: the paid reward waits 7 days, so an early refund pays nothing.
				now.getTime() - referral.firstPaidAt.getTime() >=
					USER_REFERRAL_PAID_HOLD_MS
			);
	}
}

/** Progress of the friend for the referrer's list. `subscribed` wins over `activated`. */
export function userReferralStatus(
	referral: Pick<UserReferralState, "activatedAt" | "firstPaidAt">,
): UserReferralStatus {
	if (referral.firstPaidAt !== null) {
		return "subscribed";
	}

	return referral.activatedAt !== null ? "activated" : "joined";
}

/**
 * Referrer rewards of one friend, in centi-credits.
 * `earned` is in the ledger. `pending` is marked but not granted, such as a paid reward in its hold.
 * The stats query of the repository uses the same two sums in SQL.
 */
export function referrerRewardCentiCredits(referral: UserReferralState): {
	earned: number;
	pending: number;
} {
	let earned = 0;
	let pending = 0;

	if (referral.activationGrantedAt !== null) {
		earned += referral.activationCredits;
	} else if (referral.activatedAt !== null) {
		pending += referral.activationCredits;
	}

	if (referral.paidGrantedAt !== null) {
		earned += referral.paidCredits;
	} else if (referral.firstPaidAt !== null) {
		pending += referral.paidCredits;
	}

	return { earned, pending };
}

/**
 * Name of a friend in the referrer's list: the first name, or a masked email when the name is empty.
 * The referrer never gets the full email of a friend.
 */
export function friendDisplayName(name: string, email: string): string {
	const [firstName] = name.trim().split(/\s+/);

	return firstName ? firstName : maskAffiliateEmail(email);
}
