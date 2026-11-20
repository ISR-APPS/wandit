// Raw billing HTTP functions. ApiService unwraps the shared { data, meta }
// envelope, then the contract schemas validate the inner payload here.

import {
	billingCheckoutResponseSchema,
	billingLocalPricingResponseSchema,
	billingPaymentsResponseSchema,
	billingPortalResponseSchema,
	billingRoutes,
	billingTopupStatusResponseSchema,
	billingWalletResponseSchema,
	manualSubscriptionRequestViewResponseSchema,
	slickpayPaymentViewSchema,
	startSlickpayCheckoutResponseSchema,
} from "@wandit/contracts";

import { ApiService } from "@/lib/api-client";
import type {
	BillingCheckoutResponse,
	BillingLocalPricingResponse,
	BillingPaymentsResponse,
	BillingPortalResponse,
	BillingTopupStatusResponse,
	BillingWalletResponse,
	CreateBillingTopupBody,
	CreateManualSubscriptionRequestBody,
	ManualSubscriptionRequestViewResponse,
	SlickpayPaymentView,
	StartSlickpayCheckoutBody,
	StartSlickpayCheckoutResponse,
} from "./billing.dto";

/** Wallet of the active workspace: balance, paid owner flag, and the top-up limits that the dialog uses. */
export async function getBillingWallet(): Promise<BillingWalletResponse> {
	const payload = await ApiService.get<unknown>(billingRoutes.wallet);

	return billingWalletResponseSchema.parse(payload);
}

/** The last 50 receipts of the active workspace wallet, newest first. The API allows it only to a billing manager. */
export async function getBillingPayments(): Promise<BillingPaymentsResponse> {
	const payload = await ApiService.get<unknown>(billingRoutes.payments);

	return billingPaymentsResponseSchema.parse(payload);
}

/** "credited" when the receipt of this Stripe Checkout Session exists for the session user. */
export async function getBillingTopupStatus(
	sessionId: string,
): Promise<BillingTopupStatusResponse> {
	const payload = await ApiService.get<unknown>(billingRoutes.topupStatus, {
		query: { sessionId },
	});

	return billingTopupStatusResponseSchema.parse(payload);
}

export async function getManualSubscriptionRequest(): Promise<ManualSubscriptionRequestViewResponse> {
	const payload = await ApiService.get<unknown>(billingRoutes.manualRequest);

	return manualSubscriptionRequestViewResponseSchema.parse(payload);
}

/**
 * Opens a Stripe Checkout Session for a wallet top-up of `amountUsd` whole USD.
 * The API computes the credits. The caller sends the browser to the returned URL.
 */
export async function createBillingTopupCheckout(
	amountUsd: number,
): Promise<BillingCheckoutResponse> {
	const payload = await ApiService.post<unknown, CreateBillingTopupBody>(
		billingRoutes.topup,
		{ amountUsd },
	);

	return billingCheckoutResponseSchema.parse(payload);
}

export async function createManualSubscriptionRequest(
	body: CreateManualSubscriptionRequestBody,
): Promise<ManualSubscriptionRequestViewResponse> {
	const payload = await ApiService.post<
		unknown,
		CreateManualSubscriptionRequestBody
	>(billingRoutes.manualRequest, body);

	return manualSubscriptionRequestViewResponseSchema.parse(payload);
}

export async function cancelManualSubscriptionRequest(): Promise<ManualSubscriptionRequestViewResponse> {
	const payload = await ApiService.post<unknown>(
		billingRoutes.manualRequestCancel,
	);

	return manualSubscriptionRequestViewResponseSchema.parse(payload);
}

export async function createBillingPortal(): Promise<BillingPortalResponse> {
	const payload = await ApiService.post<unknown>(billingRoutes.portal);

	return billingPortalResponseSchema.parse(payload);
}

/** Public route. The answer depends on the IP country of the visitor, so the API never caches it. */
export async function getLocalPricing(): Promise<BillingLocalPricingResponse> {
	const payload = await ApiService.get<unknown>(billingRoutes.localPricing);

	return billingLocalPricingResponseSchema.parse(payload);
}

/** Creates a SlickPay invoice. Each call is a real invoice, so the API limits the calls per user. */
export async function startSlickpayCheckout(
	body: StartSlickpayCheckoutBody,
): Promise<StartSlickpayCheckoutResponse> {
	const payload = await ApiService.post<unknown, StartSlickpayCheckoutBody>(
		billingRoutes.slickpayCheckout,
		body,
	);

	return startSlickpayCheckoutResponseSchema.parse(payload);
}

/** Asks the API to read the invoice state from SlickPay. A repeated call is safe: it only refreshes the row. */
export async function confirmSlickpayPayment(
	paymentId: string,
): Promise<SlickpayPaymentView> {
	const payload = await ApiService.post<unknown>(
		billingRoutes.slickpayConfirm(paymentId),
	);

	return slickpayPaymentViewSchema.parse(payload);
}
