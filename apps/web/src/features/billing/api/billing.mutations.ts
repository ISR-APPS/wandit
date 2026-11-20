// TanStack Query mutations for billing. A checkout mutation returns the
// provider URL; the caller records the product event, then opens the URL.

import { useMutation, useQueryClient } from "@tanstack/react-query";

import type {
	CreateManualSubscriptionRequestBody,
	StartSlickpayCheckoutBody,
} from "./billing.dto";
import { billingKeys } from "./billing.queries";
import {
	cancelManualSubscriptionRequest,
	createBillingPortal,
	createBillingTopupCheckout,
	createManualSubscriptionRequest,
	startSlickpayCheckout,
} from "./billing.services";

/** Creates the SlickPay invoice. The caller records the product event, then opens the returned URL. */
export function useStartSlickpayCheckout() {
	return useMutation({
		mutationFn: (body: StartSlickpayCheckoutBody) =>
			startSlickpayCheckout(body),
	});
}

/** Opens a Stripe top-up session for an amount in whole USD. The caller emits `upgrade_clicked`, then navigates. */
export function useCreateBillingTopupCheckout() {
	return useMutation({
		mutationFn: (amountUsd: number) => createBillingTopupCheckout(amountUsd),
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
