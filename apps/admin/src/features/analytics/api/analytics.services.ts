import {
	adminAnalyticsAcquisitionResponseSchema,
	adminAnalyticsEngagementResponseSchema,
	adminAnalyticsFeaturesResponseSchema,
	adminAnalyticsFunnelResponseSchema,
	adminAnalyticsHealthResponseSchema,
	adminAnalyticsQuerySchema,
	adminAnalyticsRevenueResponseSchema,
	adminAnalyticsRoutes,
} from "@wandit/contracts";

import { apiGet } from "@/lib/api-client";

import type {
	AnalyticsAcquisitionResponse,
	AnalyticsEngagementResponse,
	AnalyticsFeaturesResponse,
	AnalyticsFunnelResponse,
	AnalyticsHealthResponse,
	AnalyticsQuery,
	AnalyticsRevenueResponse,
} from "./analytics.dto";

function analyticsRequestQuery(query: AnalyticsQuery) {
	// Parsing at the boundary both canonicalizes country/source values and keeps
	// every URL-backed filter in the request sent to the analytics endpoints.
	return adminAnalyticsQuerySchema.parse(query);
}

export async function getAdminAnalyticsAcquisition(
	query: AnalyticsQuery,
): Promise<AnalyticsAcquisitionResponse> {
	const parsedQuery = analyticsRequestQuery(query);
	const payload = await apiGet<unknown>(
		adminAnalyticsRoutes.acquisition,
		parsedQuery,
	);

	return adminAnalyticsAcquisitionResponseSchema.parse(payload);
}

export async function getAdminAnalyticsFunnel(
	query: AnalyticsQuery,
): Promise<AnalyticsFunnelResponse> {
	const parsedQuery = analyticsRequestQuery(query);
	const payload = await apiGet<unknown>(
		adminAnalyticsRoutes.funnel,
		parsedQuery,
	);

	return adminAnalyticsFunnelResponseSchema.parse(payload);
}

export async function getAdminAnalyticsEngagement(
	query: AnalyticsQuery,
): Promise<AnalyticsEngagementResponse> {
	const parsedQuery = analyticsRequestQuery(query);
	const payload = await apiGet<unknown>(
		adminAnalyticsRoutes.engagement,
		parsedQuery,
	);

	return adminAnalyticsEngagementResponseSchema.parse(payload);
}

export async function getAdminAnalyticsRevenue(
	query: AnalyticsQuery,
): Promise<AnalyticsRevenueResponse> {
	const parsedQuery = analyticsRequestQuery(query);
	const payload = await apiGet<unknown>(
		adminAnalyticsRoutes.revenue,
		parsedQuery,
	);

	return adminAnalyticsRevenueResponseSchema.parse(payload);
}

export async function getAdminAnalyticsFeatures(
	query: AnalyticsQuery,
): Promise<AnalyticsFeaturesResponse> {
	const parsedQuery = analyticsRequestQuery(query);
	const payload = await apiGet<unknown>(
		adminAnalyticsRoutes.features,
		parsedQuery,
	);

	return adminAnalyticsFeaturesResponseSchema.parse(payload);
}

export async function getAdminAnalyticsHealth(
	query: AnalyticsQuery,
): Promise<AnalyticsHealthResponse> {
	const parsedQuery = analyticsRequestQuery(query);
	const payload = await apiGet<unknown>(
		adminAnalyticsRoutes.health,
		parsedQuery,
	);

	return adminAnalyticsHealthResponseSchema.parse(payload);
}
