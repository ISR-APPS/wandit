/**
 * TanStack mutation of the user referral program. UserReferralCapture calls it one time after sign-in.
 * It calls user-referrals.services.ts and reads the credit queries again after a claim.
 */
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { creditsKeys } from "@/features/credits";
import { userReferralsKeys } from "./user-referrals.queries";
import { claimUserReferral } from "./user-referrals.services";

/** Posts the claim of an invite code. A `claimed` answer puts the bonus in the balance, so the credit queries read again. */
export function useClaimUserReferralMutation() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationKey: [...userReferralsKeys.all, "claim"],
		mutationFn: claimUserReferral,
		onSuccess: (response) => {
			if (response.outcome !== "claimed") return;
			// The key root covers the balance, the balance of each workspace, and the activity list.
			void queryClient.invalidateQueries({ queryKey: creditsKeys.all });
		},
	});
}
