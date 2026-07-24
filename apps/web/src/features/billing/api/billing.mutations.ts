// TanStack Query mutations for billing. Checkout-session mutations hand the
// browser to the validated provider URL; subscription writes refresh the
// canonical subscription cache with the server response.

import { useMutation, useQueryClient } from "@tanstack/react-query";

import type {
	ChangeBillingSubscriptionBody,
	CreateBillingCheckoutBody,
	CreateBillingTopupBody,
} from "./billing.dto";
import { billingKeys } from "./billing.queries";
import {
	cancelBillingSubscription,
	changeBillingSubscription,
	createBillingCheckout,
	createBillingPortal,
	createBillingTopupCheckout,
	resumeBillingSubscription,
	syncBillingSubscription,
} from "./billing.services";

export function useCreateBillingCheckout() {
	return useMutation({
		mutationFn: (body: CreateBillingCheckoutBody) =>
			createBillingCheckout(body),
		onSuccess: ({ url }) => {
			window.location.assign(url);
		},
	});
}

export function useCreateBillingTopupCheckout() {
	return useMutation({
		mutationFn: (body: CreateBillingTopupBody) =>
			createBillingTopupCheckout(body),
		onSuccess: ({ url }) => {
			window.location.assign(url);
		},
	});
}

export function useCreateBillingPortal() {
	return useMutation({
		mutationFn: createBillingPortal,
		onSuccess: ({ url }) => {
			window.location.assign(url);
		},
	});
}

export function useChangeBillingSubscription() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: (body: ChangeBillingSubscriptionBody) =>
			changeBillingSubscription(body),
		onSuccess: (subscriptionView) => {
			queryClient.setQueryData(billingKeys.subscription(), subscriptionView);
		},
	});
}

export function useCancelBillingSubscription() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: cancelBillingSubscription,
		onSuccess: (subscriptionView) => {
			queryClient.setQueryData(billingKeys.subscription(), subscriptionView);
		},
	});
}

export function useResumeBillingSubscription() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: resumeBillingSubscription,
		onSuccess: (subscriptionView) => {
			queryClient.setQueryData(billingKeys.subscription(), subscriptionView);
		},
	});
}

export function useSyncBillingSubscription() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: syncBillingSubscription,
		onSuccess: (subscriptionView) => {
			queryClient.setQueryData(billingKeys.subscription(), subscriptionView);
		},
	});
}
