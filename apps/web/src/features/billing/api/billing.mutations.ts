// TanStack Query mutations for billing. A checkout mutation returns the
// provider URL; the caller records the product event, then opens the URL.

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { creditsKeys } from "@/features/credits";
import { isApiClientError } from "@/lib/api-client";
import type {
	CreateBillingTopupBody,
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

/**
 * Reloads the wallet and the balance after a 409 STARTER_PASS_NOT_AVAILABLE.
 * The pool already has its pass, or the switch is off. The fresh wallet moves the dialog out of the Starter pass mode.
 */
function useReloadWalletOnStarterPassRefusal() {
	const queryClient = useQueryClient();

	return (error: Error) => {
		if (
			isApiClientError(error) &&
			error.code === "STARTER_PASS_NOT_AVAILABLE"
		) {
			void queryClient.invalidateQueries({ queryKey: billingKeys.wallet() });
			void queryClient.invalidateQueries({ queryKey: creditsKeys.all });
		}
	};
}

/** Creates the SlickPay invoice of a top-up or of the Starter pass. The caller records the product event, then opens the URL. */
export function useStartSlickpayCheckout() {
	const onError = useReloadWalletOnStarterPassRefusal();

	return useMutation({
		mutationFn: (body: StartSlickpayCheckoutBody) =>
			startSlickpayCheckout(body),
		onError,
	});
}

/** Opens a Stripe session for a top-up or for the Starter pass. The caller emits `upgrade_clicked`, then navigates. */
export function useCreateBillingTopupCheckout() {
	const onError = useReloadWalletOnStarterPassRefusal();

	return useMutation({
		mutationFn: (body: CreateBillingTopupBody) =>
			createBillingTopupCheckout(body),
		onError,
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
