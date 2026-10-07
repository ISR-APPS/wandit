// TanStack Query keys and read hooks for the billing catalog, the current
// user's subscription view, the DZD pricing of Algeria, and SlickPay payments.

import { useQuery } from "@tanstack/react-query";

import { getActiveWorkspaceId } from "@/features/workspaces/lib/workspace-scope";

import type { SlickpayPaymentView } from "./billing.dto";
import {
	confirmSlickpayPayment,
	getBillingPlans,
	getBillingSubscription,
	getLocalPricing,
	getManualSubscriptionRequest,
} from "./billing.services";

// 5 min. The country of a visitor does not change during a visit.
const LOCAL_PRICING_STALE_TIME_MS = 5 * 60_000;

// The subscription view is workspace-scoped (the header selects whose money);
// the public plan catalog is global and keeps an unscoped key.
export const billingKeys = {
	all: ["billing"] as const,
	scope: () => [...billingKeys.all, getActiveWorkspaceId()] as const,
	plans: () => [...billingKeys.all, "plans"] as const,
	subscription: () => [...billingKeys.scope(), "subscription"] as const,
	manualRequest: () => [...billingKeys.scope(), "manual-request"] as const,
	// Not workspace-scoped: the answer depends only on the IP country of the visitor.
	localPricing: () => [...billingKeys.all, "local-pricing"] as const,
	// Not workspace-scoped: a SlickPay payment row belongs to the user who pays.
	slickpayPayment: (paymentId: string) =>
		[...billingKeys.all, "slickpay-payment", paymentId] as const,
};

export function useBillingPlansQuery() {
	return useQuery({
		queryKey: billingKeys.plans(),
		queryFn: getBillingPlans,
	});
}

/** `enabled: false` skips the fetch, for a caller that also renders for a signed-out visitor. */
export function useBillingSubscriptionQuery(
	options: { enabled?: boolean } = {},
) {
	return useQuery({
		queryKey: billingKeys.subscription(),
		queryFn: getBillingSubscription,
		enabled: options.enabled ?? true,
	});
}

export function useManualSubscriptionRequestQuery() {
	return useQuery({
		queryKey: billingKeys.manualRequest(),
		queryFn: getManualSubscriptionRequest,
	});
}

/** SlickPay rate for visitors in Algeria. `data.slickpay` is null for all other visitors. */
export function useLocalPricingQuery() {
	return useQuery({
		queryKey: billingKeys.localPricing(),
		queryFn: getLocalPricing,
		staleTime: LOCAL_PRICING_STALE_TIME_MS,
	});
}

/**
 * Confirms a SlickPay payment, then calls the API again on the caller cadence.
 * A query, not a mutation: the confirm route only refreshes the row, and the return page polls it.
 */
export function useConfirmSlickpayPayment(
	paymentId: string,
	options: {
		/** False stops all calls, for example after the return page times out. */
		enabled: boolean;
		/** Delay in ms before the next call for the last answer, or false to stop. */
		refetchInterval: (view: SlickpayPaymentView | undefined) => number | false;
	},
) {
	return useQuery({
		queryKey: billingKeys.slickpayPayment(paymentId),
		queryFn: () => confirmSlickpayPayment(paymentId),
		enabled: options.enabled,
		refetchInterval: (query) => options.refetchInterval(query.state.data),
	});
}
