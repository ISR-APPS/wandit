/**
 * TanStack query of the user referral program. The link panel, the sidebar card, and the /refer page read it.
 * It calls user-referrals.services.ts.
 */
import { useQuery } from "@tanstack/react-query";

import { getUserReferralSummary } from "./user-referrals.services";

/** Query keys of this feature. The summary belongs to the user, not to a workspace, so no key holds a workspace id. */
export const userReferralsKeys = {
	all: ["user-referrals"] as const,
	summary: () => [...userReferralsKeys.all, "summary"] as const,
};

/** The code, the totals, and the newest friends of the signed-in user. */
export function useUserReferralSummaryQuery(
	options: {
		/** False stops the request. The API answers 403 while the program is off. */
		enabled?: boolean;
	} = {},
) {
	return useQuery({
		queryKey: userReferralsKeys.summary(),
		queryFn: getUserReferralSummary,
		enabled: options.enabled ?? true,
	});
}
