/**
 * Hooks of the user referral program that are not queries: the program switch, the reward amounts, and the credit phrase.
 * The components of this feature call them. The entry points in other features call them through the barrel.
 * They read the public settings, and the local pricing of the billing feature.
 */
import { useLocalPricingQuery } from "@/features/billing";
import { formatCreditAmount } from "@/features/credits";
import { usePublicSettingsQuery } from "@/features/settings";
import { useTranslation } from "@/lib/i18n";

/** The reward amounts that the texts of the program show. All values are decimal credits from the public settings. */
export type UserReferralRewards = {
	/** The bonus of the invited friend, right after signup. */
	friendCredits: number;
	/** The reward of the inviter when the friend uses the minimum credits. */
	activationCredits: number;
	/** The reward of the inviter when the friend pays. Null while no purchase is possible: the UI then hides the paid step. */
	paidCredits: number | null;
	/** The most that one friend can give the inviter: the activation reward plus the paid reward. */
	maxCredits: number;
};

/** True when the admin switch `userReferralsEnabled` is on. False while the public settings load. */
export function useUserReferralsEnabled(): boolean {
	return usePublicSettingsQuery().data?.userReferralsEnabled === true;
}

/**
 * True when a friend can buy a plan, so the paid reward is reachable. Undefined while the answer loads.
 * This is not `usePurchasesEnabled` of the billing feature: a top-up is a purchase, but it gives no paid reward.
 */
function usePaidRewardReachable(): boolean | undefined {
	const settings = usePublicSettingsQuery().data;
	const localPricingQuery = useLocalPricingQuery();

	if (!settings) return undefined;

	if (settings.paidSubscriptionsEnabled || settings.manualPaymentsEnabled) {
		return true;
	}

	// SlickPay sells plans too. It does not depend on the switches above: it is on when the visitor is in Algeria.
	if (!localPricingQuery.data) {
		return localPricingQuery.isError ? false : undefined;
	}

	return localPricingQuery.data.slickpay !== null;
}

/**
 * The reward amounts for the texts of the program.
 * Undefined while the program is off, and while the settings or the purchase switch load. Callers then show no amount.
 */
export function useUserReferralRewards(): UserReferralRewards | undefined {
	const settings = usePublicSettingsQuery().data;
	const isPaidRewardReachable = usePaidRewardReachable();

	if (!settings?.userReferralsEnabled || isPaidRewardReachable === undefined) {
		return undefined;
	}

	// Product rule: a text never promises the paid reward while a friend cannot pay.
	const paidCredits = isPaidRewardReachable
		? settings.userReferralPaidCredits
		: null;

	return {
		friendCredits: settings.userReferralFriendCredits,
		activationCredits: settings.userReferralActivationCredits,
		paidCredits,
		maxCredits: settings.userReferralActivationCredits + (paidCredits ?? 0),
	};
}

/**
 * Gives a function that writes an amount as a phrase in the current language, for example "10 credits".
 * The amount is in decimal credits. Pass the phrase to a translated sentence as one parameter.
 */
export function useCreditPhrase(): (credits: number) => string {
	const { locale, t } = useTranslation();
	return (credits) =>
		t("credits.creditUnit", {
			count: credits,
			countDisplay: formatCreditAmount(credits, locale),
		});
}
