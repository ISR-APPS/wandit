/**
 * HTTP calls of the user referral program. The queries and mutations of this feature call them.
 * They call the API routes of `userReferralsRoutes`. A zod schema of the contract parses each answer.
 */
import {
	claimUserReferralResponseSchema,
	userReferralSummarySchema,
	userReferralsRoutes,
} from "@wandit/contracts";

import { ApiService } from "@/lib/api-client";
import type { ClaimUserReferralResponse, UserReferralSummary } from "./dto";

/** Loads the code, the totals, and the newest friends of the caller. The first call creates the code. A 403 means the program is off. */
export async function getUserReferralSummary(): Promise<UserReferralSummary> {
	const data = await ApiService.get<unknown>(userReferralsRoutes.me);
	return userReferralSummarySchema.parse(data);
}

/**
 * Claims the invite code for the signed-in friend. A refusal is an HTTP 200 with `outcome: "rejected"`.
 * @param code The invite code from the link, 8 characters.
 */
export async function claimUserReferral(
	code: string,
): Promise<ClaimUserReferralResponse> {
	const data = await ApiService.post<unknown>(
		userReferralsRoutes.claim,
		{ code },
		// The claim runs in the background. A 401 must not send the user to the sign-in page.
		{ skipAuthRedirect: true },
	);
	return claimUserReferralResponseSchema.parse(data);
}
