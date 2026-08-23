// TanStack Query mutations for billing. Checkout-session mutations hand the
// browser to the validated provider URL; subscription writes refresh the
// canonical subscription cache with the server response.

import {
	type QueryClient,
	useMutation,
	useQueryClient,
} from "@tanstack/react-query";

import { creditsKeys } from "@/features/credits/api/credits.queries";
import type {
	BillingCancelRequest,
	BillingSubscriptionViewResponse,
	ChangeBillingSubscriptionBody,
	CreateBillingCheckoutBody,
	CreateBillingTopupBody,
	CreateManualSubscriptionRequestBody,
	PreviewBillingSubscriptionChangeBody,
} from "./billing.dto";
import { billingKeys } from "./billing.queries";
import {
	cancelBillingSubscription,
	cancelManualSubscriptionRequest,
	changeBillingSubscription,
	createBillingCheckout,
	createBillingPortal,
	createBillingTopupCheckout,
	createManualSubscriptionRequest,
	previewBillingSubscriptionChange,
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

export function useCreateManualSubscriptionRequest() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: (body: CreateManualSubscriptionRequestBody) =>
			createManualSubscriptionRequest(body),
		onMutate: () => ({ queryKey: billingKeys.manualRequest() }),
		onSuccess: (view, _body, context) => {
			queryClient.setQueryData(context.queryKey, view);
		},
	});
}

export function useCancelManualSubscriptionRequest() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: cancelManualSubscriptionRequest,
		onMutate: () => ({ queryKey: billingKeys.manualRequest() }),
		onSuccess: (view, _variables, context) => {
			queryClient.setQueryData(context.queryKey, view);
		},
	});
}

export function usePreviewBillingSubscriptionChange() {
	return useMutation({
		mutationFn: (body: PreviewBillingSubscriptionChangeBody) =>
			previewBillingSubscriptionChange(body),
	});
}

export function useChangeBillingSubscription() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: (body: ChangeBillingSubscriptionBody) =>
			changeBillingSubscription(body),
		onSuccess: ({ balance, subscription }) => {
			const subscriptionView = {
				balance,
				subscription,
			};
			queryClient.setQueryData(billingKeys.subscription(), subscriptionView);
			refreshCreditCaches(queryClient, subscriptionView, true);
		},
	});
}

export function useCancelBillingSubscription() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: (body: BillingCancelRequest) => cancelBillingSubscription(body),
		onSuccess: (subscriptionView) => {
			queryClient.setQueryData(billingKeys.subscription(), subscriptionView);
			refreshCreditCaches(queryClient, subscriptionView, false);
		},
	});
}

export function useResumeBillingSubscription() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: resumeBillingSubscription,
		onSuccess: (subscriptionView) => {
			queryClient.setQueryData(billingKeys.subscription(), subscriptionView);
			refreshCreditCaches(queryClient, subscriptionView, false);
		},
	});
}

export function useSyncBillingSubscription() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: syncBillingSubscription,
		onSuccess: (subscriptionView) => {
			queryClient.setQueryData(billingKeys.subscription(), subscriptionView);
			refreshCreditCaches(queryClient, subscriptionView, true);
		},
	});
}

function refreshCreditCaches(
	queryClient: QueryClient,
	view: BillingSubscriptionViewResponse,
	invalidateLedger: boolean,
) {
	queryClient.setQueryData(creditsKeys.balance(), view.balance);
	void queryClient.invalidateQueries({ queryKey: creditsKeys.balance() });

	if (invalidateLedger) {
		void queryClient.invalidateQueries({ queryKey: creditsKeys.activities() });
	}
}
