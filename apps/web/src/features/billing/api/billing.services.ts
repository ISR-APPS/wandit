// Raw billing HTTP functions. ApiService unwraps the shared { data, meta }
// envelope, then the contract schemas validate the inner payload here.

import {
	billingCheckoutResponseSchema,
	billingPlansResponseSchema,
	billingPortalResponseSchema,
	billingRoutes,
	billingSubscriptionViewResponseSchema,
} from "@wandit/contracts";

import { ApiService } from "@/lib/api-client";
import type {
	BillingCheckoutResponse,
	BillingPlansResponse,
	BillingPortalResponse,
	BillingSubscriptionViewResponse,
	ChangeBillingSubscriptionBody,
	CreateBillingCheckoutBody,
	CreateBillingTopupBody,
} from "./billing.dto";

export async function getBillingPlans(): Promise<BillingPlansResponse> {
	const payload = await ApiService.get<unknown>(billingRoutes.plans);

	return billingPlansResponseSchema.parse(payload);
}

export async function getBillingSubscription(): Promise<BillingSubscriptionViewResponse> {
	const payload = await ApiService.get<unknown>(billingRoutes.subscription);

	return billingSubscriptionViewResponseSchema.parse(payload);
}

export async function createBillingCheckout(
	body: CreateBillingCheckoutBody,
): Promise<BillingCheckoutResponse> {
	const payload = await ApiService.post<unknown, CreateBillingCheckoutBody>(
		billingRoutes.checkout,
		body,
	);

	return billingCheckoutResponseSchema.parse(payload);
}

export async function createBillingTopupCheckout(
	body: CreateBillingTopupBody,
): Promise<BillingCheckoutResponse> {
	const payload = await ApiService.post<unknown, CreateBillingTopupBody>(
		billingRoutes.topup,
		body,
	);

	return billingCheckoutResponseSchema.parse(payload);
}

export async function createBillingPortal(): Promise<BillingPortalResponse> {
	const payload = await ApiService.post<unknown>(billingRoutes.portal);

	return billingPortalResponseSchema.parse(payload);
}

export async function changeBillingSubscription(
	body: ChangeBillingSubscriptionBody,
): Promise<BillingSubscriptionViewResponse> {
	const payload = await ApiService.post<unknown, ChangeBillingSubscriptionBody>(
		billingRoutes.change,
		body,
	);

	return billingSubscriptionViewResponseSchema.parse(payload);
}

export async function cancelBillingSubscription(): Promise<BillingSubscriptionViewResponse> {
	const payload = await ApiService.post<unknown>(billingRoutes.cancel);

	return billingSubscriptionViewResponseSchema.parse(payload);
}

export async function resumeBillingSubscription(): Promise<BillingSubscriptionViewResponse> {
	const payload = await ApiService.post<unknown>(billingRoutes.resume);

	return billingSubscriptionViewResponseSchema.parse(payload);
}

export async function syncBillingSubscription(): Promise<BillingSubscriptionViewResponse> {
	const payload = await ApiService.post<unknown>(billingRoutes.sync);

	return billingSubscriptionViewResponseSchema.parse(payload);
}
