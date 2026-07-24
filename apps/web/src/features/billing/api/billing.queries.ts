// TanStack Query keys and read hooks for the billing catalog and the current
// user's subscription view.

import { useQuery } from "@tanstack/react-query";

import { getBillingPlans, getBillingSubscription } from "./billing.services";

export const billingKeys = {
	all: ["billing"] as const,
	plans: () => [...billingKeys.all, "plans"] as const,
	subscription: () => [...billingKeys.all, "subscription"] as const,
};

export function useBillingPlansQuery() {
	return useQuery({
		queryKey: billingKeys.plans(),
		queryFn: getBillingPlans,
	});
}

export function useBillingSubscriptionQuery() {
	return useQuery({
		queryKey: billingKeys.subscription(),
		queryFn: getBillingSubscription,
	});
}
