import {
	adminEndManualSubscriptionInputSchema,
	adminGrantManualSubscriptionInputSchema,
	adminListManualRequestsQuerySchema,
	adminListManualSubscriptionsQuerySchema,
	adminRenewManualSubscriptionInputSchema,
	adminRoutes,
	adminUpdateManualRequestBodySchema,
} from "@wandit/contracts";

import { apiGet, apiPatch, apiPost } from "@/lib/api-client";

import {
	type AdminGrantManualSubscriptionInput,
	type AdminListManualRequestsResponse,
	type AdminListManualSubscriptionsResponse,
	type AdminManualBillingStats,
	type AdminManualRequest,
	type AdminManualSubscriptionDetail,
	type EndManualSubscriptionInput,
	type ListManualRequestsParams,
	type ListManualSubscriptionsParams,
	mapManualBillingStatsDto,
	mapManualRequestDto,
	mapManualRequestsDto,
	mapManualSubscriptionDetailDto,
	mapManualSubscriptionsDto,
	type RenewManualSubscriptionInput,
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

export async function grantManualSubscription(
	input: AdminGrantManualSubscriptionInput,
): Promise<AdminManualSubscriptionDetail> {
	const body = adminGrantManualSubscriptionInputSchema.parse(input);
	const payload = await apiPost<unknown>(adminRoutes.manualSubscriptions, body);

	return mapManualSubscriptionDetailDto(payload);
}

export async function renewManualSubscription({
	subscriptionId,
	body,
}: RenewManualSubscriptionInput): Promise<AdminManualSubscriptionDetail> {
	const payload = await apiPost<unknown>(
		adminRoutes.manualSubscriptionRenew(subscriptionId),
		adminRenewManualSubscriptionInputSchema.parse(body),
	);

	return mapManualSubscriptionDetailDto(payload);
}

export async function endManualSubscription({
	subscriptionId,
	body,
}: EndManualSubscriptionInput): Promise<AdminManualSubscriptionDetail> {
	const payload = await apiPost<unknown>(
		adminRoutes.manualSubscriptionEnd(subscriptionId),
		adminEndManualSubscriptionInputSchema.parse(body),
	);

	return mapManualSubscriptionDetailDto(payload);
}

export async function getManualBillingStats(): Promise<AdminManualBillingStats> {
	const payload = await apiGet<unknown>(adminRoutes.manualBillingStats);

	return mapManualBillingStatsDto(payload);
}
