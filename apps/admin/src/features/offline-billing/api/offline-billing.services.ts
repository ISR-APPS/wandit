/**
 * HTTP calls of the offline billing feature: requests, top-up receipts, old manual subscriptions, stats.
 * Called by the query and mutation hooks. Calls the admin API through the api-client.
 */
import {
	adminListManualRequestsQuerySchema,
	adminListManualSubscriptionsQuerySchema,
	adminListTopupReceiptsQuerySchema,
	adminRecordTopupInputSchema,
	adminReverseTopupInputSchema,
	adminRoutes,
	adminUpdateManualRequestBodySchema,
} from "@wandit/contracts";

import { apiGet, apiPatch, apiPost } from "@/lib/api-client";

import {
	type AdminListManualRequestsResponse,
	type AdminListManualSubscriptionsResponse,
	type AdminListTopupReceiptsResponse,
	type AdminManualBillingReceiptConfig,
	type AdminManualBillingStats,
	type AdminManualRequest,
	type AdminManualSubscriptionDetail,
	type AdminRecordTopupInput,
	type AdminTopupReceipt,
	type ListManualRequestsParams,
	type ListManualSubscriptionsParams,
	type ListTopupReceiptsParams,
	mapManualBillingReceiptConfigDto,
	mapManualBillingStatsDto,
	mapManualRequestDto,
	mapManualRequestsDto,
	mapManualSubscriptionDetailDto,
	mapManualSubscriptionsDto,
	mapTopupReceiptDto,
	mapTopupReceiptsDto,
	type UpdateManualRequestInput,
} from "./offline-billing.dto";

export async function listManualRequests(
	params: ListManualRequestsParams,
): Promise<AdminListManualRequestsResponse> {
	const query = adminListManualRequestsQuerySchema.parse(params);
	const payload = await apiGet<unknown>(adminRoutes.manualRequests, query);

	return mapManualRequestsDto(payload);
}

export async function getManualRequest(
	requestId: string,
): Promise<AdminManualRequest> {
	const payload = await apiGet<unknown>(adminRoutes.manualRequest(requestId));

	return mapManualRequestDto(payload);
}

export async function updateManualRequest({
	requestId,
	body,
}: UpdateManualRequestInput): Promise<AdminManualRequest> {
	const payload = await apiPatch<unknown>(
		adminRoutes.manualRequest(requestId),
		adminUpdateManualRequestBodySchema.parse(body),
	);

	return mapManualRequestDto(payload);
}

export async function listManualSubscriptions(
	params: ListManualSubscriptionsParams,
): Promise<AdminListManualSubscriptionsResponse> {
	const query = adminListManualSubscriptionsQuerySchema.parse(params);
	const payload = await apiGet<unknown>(adminRoutes.manualSubscriptions, query);

	return mapManualSubscriptionsDto(payload);
}

export async function getManualSubscription(
	subscriptionId: string,
): Promise<AdminManualSubscriptionDetail> {
	const payload = await apiGet<unknown>(
		adminRoutes.manualSubscription(subscriptionId),
	);

	return mapManualSubscriptionDetailDto(payload);
}

/** "Record top-up". A retry with the same idempotency key returns the first receipt. */
export async function recordTopup(
	input: AdminRecordTopupInput,
): Promise<AdminTopupReceipt> {
	const payload = await apiPost<unknown>(
		adminRoutes.topupReceipts,
		adminRecordTopupInputSchema.parse(input),
	);

	return mapTopupReceiptDto(payload);
}

/** "Reverse top-up" of one SlickPay or offline receipt. The API takes back its credits. */
export async function reverseTopup(
	receiptId: string,
): Promise<AdminTopupReceipt> {
	const payload = await apiPost<unknown>(
		adminRoutes.topupReceiptReverse,
		adminReverseTopupInputSchema.parse({ receiptId }),
	);

	return mapTopupReceiptDto(payload);
}

/** GET the admin top-up receipts. Parses the query and the response with the contract schemas. */
export async function listTopupReceipts(
	params: ListTopupReceiptsParams,
): Promise<AdminListTopupReceiptsResponse> {
	const query = adminListTopupReceiptsQuerySchema.parse(params);
	const payload = await apiGet<unknown>(adminRoutes.topupReceipts, query);

	return mapTopupReceiptsDto(payload);
}

export async function getManualBillingStats(): Promise<AdminManualBillingStats> {
	const payload = await apiGet<unknown>(adminRoutes.manualBillingStats);

	return mapManualBillingStatsDto(payload);
}

export async function getManualBillingReceiptConfig(): Promise<AdminManualBillingReceiptConfig> {
	const payload = await apiGet<unknown>(adminRoutes.manualBillingReceiptConfig);

	return mapManualBillingReceiptConfigDto(payload);
}
