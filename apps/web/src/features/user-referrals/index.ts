// Public surface of the user-referrals feature. Pages are never exported from barrels.

// The "Get free credits" card of the dashboard sidebar.
export { ReferralCard } from "./components/referral-card";
// The compact dialog behind the gift button of the two project shells.
export { ReferralDialog } from "./components/referral-dialog";
// Stores the invite code of a link and claims it after sign-in. The root route mounts it.
export { UserReferralCapture } from "./components/user-referral-capture";
// The invite code of an address, for the route "/". The stored invite code, for the sign-in forms.
export { parseInviteCode, readStoredInviteCode } from "./lib/helpers";
// The program switch and the credit phrase, for the entry points in other features.
export { useCreditPhrase, useUserReferralsEnabled } from "./lib/hooks";
