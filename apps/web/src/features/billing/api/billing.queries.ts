// TanStack Query keys and read hooks for the wallet, the payment history, the
// top-up status, the offline request, the DZD rate, and SlickPay payments.

import { useQuery } from "@tanstack/react-query";

import { getActiveWorkspaceId } from "@/features/workspaces/lib/workspace-scope";

import type {
	BillingTopupStatusResponse,
	SlickpayPaymentView,
} from "./billing.dto";
import {
	confirmSlickpayPayment,
	getBillingPayments,
	getBillingTopupStatus,
	getBillingWallet,
	getLocalPricing,
	getManualSubscriptionRequest,
} from "./billing.services";

// 5 min. The country of a visitor does not change during a visit.
const LOCAL_PRICING_STALE_TIME_MS = 5 * 60_000;

// The wallet, the payments, and the offline request are workspace-scoped:
// the workspace header selects whose money.
export const billingKeys = {
	all: ["billing"] as const,
	scope: () => [...billingKeys.all, getActiveWorkspaceId()] as const,
	wallet: () => [...billingKeys.scope(), "wallet"] as const,
	payments: () => [...billingKeys.scope(), "payments"] as const,
	// Not workspace-scoped: the API finds the receipt by session id and the session user.
	topupStatus: (sessionId: string) =>
		[...billingKeys.all, "topup-status", sessionId] as const,
	manualRequest: () => [...billingKeys.scope(), "manual-request"] as const,
	// Not workspace-scoped: the answer depends only on the IP country of the visitor.
	localPricing: () => [...billingKeys.all, "local-pricing"] as const,
	// Not workspace-scoped: a SlickPay payment row belongs to the user who pays.
	slickpayPayment: (paymentId: string) =>
		[...billingKeys.all, "slickpay-payment", paymentId] as const,
};

/** Wallet of the active workspace. The top-up dialog, the wallet page, and the credits chip read it. */
export function useBillingWalletQuery() {
	return useQuery({
		queryKey: billingKeys.wallet(),
		queryFn: getBillingWallet,
	});
}

/** Payment history of the active workspace. The API answers only a billing manager, so only the owner view calls it. */
export function useBillingPaymentsQuery() {
	return useQuery({
		queryKey: billingKeys.payments(),
		queryFn: getBillingPayments,
	});
}

/** Polls the top-up status of one Stripe Checkout Session on the caller cadence. */
export function useBillingTopupStatusQuery(
	sessionId: string,
	options: {
		/** False stops all calls, for example after the return page times out. */
		enabled: boolean;
		/** Delay in ms before the next call for the last answer, or false to stop. */
		refetchInterval: (
			status: BillingTopupStatusResponse | undefined,
		) => number | false;
	},
) {
	return useQuery({
		queryKey: billingKeys.topupStatus(sessionId),
		queryFn: () => getBillingTopupStatus(sessionId),
		enabled: options.enabled,
		refetchInterval: (query) => options.refetchInterval(query.state.data),
	});
}

export function useManualSubscriptionRequestQuery() {
	return useQuery({
		queryKey: billingKeys.manualRequest(),
		queryFn: getManualSubscriptionRequest,
	});
}

/** The DZD rate of GET local-pricing. Read the rate with useDzdPerUsdRate, not from `data` directly. */
export function useLocalPricingQuery() {
	return useQuery({
		queryKey: billingKeys.localPricing(),
		queryFn: getLocalPricing,
		staleTime: LOCAL_PRICING_STALE_TIME_MS,
	});
}

/**
 * Decimal DZD per 1 USD for every visitor. The prices show DZD next to USD, and the SlickPay tab shows, only when it is not null.
 * Null while the answer loads, after an error, or when the API has no SlickPay key.
 */
export function useDzdPerUsdRate(): number | null {
	const { data } = useLocalPricingQuery();

	// An API from before the Starter pass sends the rate only in `slickpay`, and only to visitors in Algeria.
	return data?.dzdPerUsdRate ?? data?.slickpay?.dzdPerUsdRate ?? null;
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
