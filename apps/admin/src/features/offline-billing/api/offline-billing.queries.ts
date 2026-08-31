import { keepPreviousData, useQuery } from "@tanstack/react-query";

import type {
	ListManualRequestsParams,
	ListManualSubscriptionsParams,
} from "./offline-billing.dto";
import {
	getManualBillingReceiptConfig,
	getManualBillingStats,
	getManualRequest,
	getManualSubscription,
	listManualRequests,
	listManualSubscriptions,
} from "./offline-billing.services";

export const offlineBillingKeys = {
	all: ["admin-offline-billing"] as const,
	receiptConfig: () => [...offlineBillingKeys.all, "receipt-config"] as const,
	stats: () => [...offlineBillingKeys.all, "stats"] as const,
	requests: () => [...offlineBillingKeys.all, "requests"] as const,
	requestLists: () => [...offlineBillingKeys.requests(), "list"] as const,
	requestList: (params: ListManualRequestsParams) =>
		[...offlineBillingKeys.requestLists(), params] as const,
	requestDetails: () => [...offlineBillingKeys.requests(), "detail"] as const,
	requestDetail: (requestId: string) =>
		[...offlineBillingKeys.requestDetails(), requestId] as const,
	subscriptions: () => [...offlineBillingKeys.all, "subscriptions"] as const,
	subscriptionLists: () =>
		[...offlineBillingKeys.subscriptions(), "list"] as const,
	subscriptionList: (params: ListManualSubscriptionsParams) =>
		[...offlineBillingKeys.subscriptionLists(), params] as const,
	subscriptionDetails: () =>
		[...offlineBillingKeys.subscriptions(), "detail"] as const,
	subscriptionDetail: (subscriptionId: string) =>
		[...offlineBillingKeys.subscriptionDetails(), subscriptionId] as const,
};

export function useManualRequestsQuery(params: ListManualRequestsParams) {
	return useQuery({
		queryKey: offlineBillingKeys.requestList(params),
		queryFn: () => listManualRequests(params),
		placeholderData: keepPreviousData,
	});
}

export function useManualRequestQuery(
	requestId: string | undefined,
	enabled = true,
) {
	return useQuery({
		queryKey: offlineBillingKeys.requestDetail(requestId ?? "none"),
		queryFn: () => getManualRequest(requestId as string),
		enabled: enabled && Boolean(requestId),
	});
}

export function useManualSubscriptionsQuery(
	params: ListManualSubscriptionsParams,
) {
	return useQuery({
		queryKey: offlineBillingKeys.subscriptionList(params),
		queryFn: () => listManualSubscriptions(params),
		placeholderData: keepPreviousData,
	});
}

export function useManualSubscriptionQuery(
	subscriptionId: string | undefined,
	enabled = true,
) {
	return useQuery({
		queryKey: offlineBillingKeys.subscriptionDetail(subscriptionId ?? "none"),
		queryFn: () => getManualSubscription(subscriptionId as string),
		enabled: enabled && Boolean(subscriptionId),
	});
}

export function useManualBillingStatsQuery() {
	return useQuery({
		queryKey: offlineBillingKeys.stats(),
		queryFn: getManualBillingStats,
	});
}

export function useManualBillingReceiptConfigQuery() {
	return useQuery({
		queryKey: offlineBillingKeys.receiptConfig(),
		queryFn: getManualBillingReceiptConfig,
	});
}
