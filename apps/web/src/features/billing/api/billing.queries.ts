// TanStack Query keys and read hooks for the billing catalog and the current
// user's subscription view.

import { useQuery } from "@tanstack/react-query";

import { getActiveWorkspaceId } from "@/features/workspaces/lib/workspace-scope";

import { getBillingPlans, getBillingSubscription } from "./billing.services";

// The subscription view is workspace-scoped (the header selects whose money);
// the public plan catalog is global and keeps an unscoped key.
export const billingKeys = {
	all: ["billing"] as const,
	scope: () => [...billingKeys.all, getActiveWorkspaceId()] as const,
	plans: () => [...billingKeys.all, "plans"] as const,
	subscription: () => [...billingKeys.scope(), "subscription"] as const,
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
