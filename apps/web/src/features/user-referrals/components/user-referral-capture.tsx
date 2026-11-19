/**
 * Catches the invite code of an invite link and claims it after sign-in. It renders nothing.
 * routes/__root.tsx mounts it one time, beside AffiliateCapture, with the id of the signed-in user.
 * It keeps the code in the browser storage and posts the claim through the claim mutation.
 */
import { useLocation } from "@tanstack/react-router";
import { useEffect, useEffectEvent, useRef, useState } from "react";
import { toast } from "sonner";

import { isApiClientError } from "@/lib/api-client";
import { useTranslation } from "@/lib/i18n";
import { useClaimUserReferralMutation } from "../api/user-referrals.mutations";
import {
	clearStoredInviteCode,
	isFinalClaimRefusal,
	parseInviteCode,
	parseInviteCodeOfDestination,
	readBonusShownUserId,
	readStoredInviteCode,
	removeInviteParam,
	storeBonusShownUserId,
	storeInviteCode,
} from "../lib/helpers";
import { useCreditPhrase } from "../lib/hooks";

type UserReferralCaptureProps = {
	/** Id of the signed-in user, from the session. Undefined for a visitor, and while the session loads. */
	userId: string | undefined;
};

/** Takes the `invite` parameter out of the address bar. The page does not load again. */
function removeInviteFromAddress() {
	const addressWithoutInvite = removeInviteParam(window.location.href);
	if (addressWithoutInvite === null) return;
	// The router listens to this call. The same history state keeps the router entry.
	window.history.replaceState(window.history.state, "", addressWithoutInvite);
}

/**
 * The address keeps its `invite` parameter until the API gives a final answer for the code.
 * Thus a visitor who moves to a different browser before sign-in takes the code along.
 * An address that brings back a code after its claim loses the parameter at once.
 */
export function UserReferralCapture({ userId }: UserReferralCaptureProps) {
	const { t } = useTranslation();
	const creditPhrase = useCreditPhrase();
	const { mutate: postClaim } = useClaimUserReferralMutation();
	// The raw query of the current page, for example "?invite=abcd1234".
	const search = useLocation({ select: (location) => location.searchStr });
	// The state copy of the stored code. It also holds the code when the browser blocks the storage.
	const [storedCode, setStoredCode] = useState(readStoredInviteCode);
	// The user and code of the last claim, as "<userId>:<code>". It stops a second POST for the same pair.
	const lastClaimRef = useRef<string | null>(null);

	useEffect(() => {
		// The auth gate moves the invite link of a user without onboarding into `next`.
		// The user can close that tab, so the code must not wait there.
		const code =
			parseInviteCode(search) ?? parseInviteCodeOfDestination(search);
		if (code === null) return;
		// The magic-link destination brings the code back after onboarding, where the claim already ran.
		// A second store makes the next full page load claim again for nothing.
		if (lastClaimRef.current === `${userId}:${code}`) {
			removeInviteFromAddress();
			return;
		}
		storeInviteCode(code);
		setStoredCode(code);
	}, [search, userId]);

	const forgetCode = () => {
		clearStoredInviteCode();
		setStoredCode(null);
		// With the parameter in the address, each full page load claims again for nothing.
		removeInviteFromAddress();
	};

	// `claimingUserId` is the signed-in user at the time of the POST. The session can change before the answer.
	const claimCode = useEffectEvent((claimingUserId: string, code: string) => {
		postClaim(code, {
			onSuccess: (response) => {
				// Each HTTP 200 is a final answer, also a rejection. The code has no more use.
				forgetCode();
				if (response.outcome !== "claimed" || response.friendCredits <= 0) {
					return;
				}
				// The API answers `claimed` again when the same code comes back. The credits arrive one time only.
				if (readBonusShownUserId() === claimingUserId) return;
				storeBonusShownUserId(claimingUserId);
				toast.success(
					t("userReferrals.claim.bonusTitle", {
						friend: creditPhrase(response.friendCredits),
					}),
					{ description: t("userReferrals.claim.bonusBody") },
				);
			},
			onError: (error) => {
				// After a failure that can pass, the code stays for the next page load.
				// An error that is not from the API, such as a bad answer body, also keeps the code.
				if (isApiClientError(error) && isFinalClaimRefusal(error.statusCode)) {
					forgetCode();
				}
			},
		});
	});

	useEffect(() => {
		if (userId === undefined || storedCode === null) return;
		// One claim for each user and code. A render or a second effect run must not post again.
		const claimKey = `${userId}:${storedCode}`;
		if (lastClaimRef.current === claimKey) return;
		lastClaimRef.current = claimKey;
		claimCode(userId, storedCode);
	}, [userId, storedCode]);

	return null;
}
