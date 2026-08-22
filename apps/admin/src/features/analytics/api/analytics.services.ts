import {
	adminAnalyticsAcquisitionResponseSchema,
	adminAnalyticsEngagementResponseSchema,
	adminAnalyticsFeaturesResponseSchema,
	adminAnalyticsFunnelContactInputSchema,
	adminAnalyticsFunnelContactResponseSchema,
	adminAnalyticsFunnelResponseSchema,
	adminAnalyticsFunnelStepUsersExportQuerySchema,
	adminAnalyticsFunnelStepUsersQuerySchema,
	adminAnalyticsFunnelStepUsersResponseSchema,
	adminAnalyticsFunnelUserStepSchema,
	adminAnalyticsHealthResponseSchema,
	adminAnalyticsQuerySchema,
	adminAnalyticsRevenueResponseSchema,
	adminAnalyticsRoutes,
} from "@wandit/contracts";

import { apiGet, apiGetRaw, apiPost } from "@/lib/api-client";

import type {
	AnalyticsAcquisitionResponse,
	AnalyticsEngagementResponse,
	AnalyticsFeaturesResponse,
	AnalyticsFunnelContactInput,
	AnalyticsFunnelContactResponse,
	AnalyticsFunnelResponse,
	AnalyticsFunnelStepUsersExportQuery,
	AnalyticsFunnelStepUsersExportQueryInput,
	AnalyticsFunnelStepUsersQueryInput,
	AnalyticsFunnelStepUsersResponse,
	AnalyticsFunnelUserStep,
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

export async function getAdminAnalyticsFunnelStepUsers(
	step: AnalyticsFunnelUserStep,
	query: AnalyticsFunnelStepUsersQueryInput,
): Promise<AnalyticsFunnelStepUsersResponse> {
	const parsedStep = adminAnalyticsFunnelUserStepSchema.parse(step);
	const parsedQuery = adminAnalyticsFunnelStepUsersQuerySchema.parse(query);
	const payload = await apiGet<unknown>(
		adminAnalyticsRoutes.funnelStepUsers(parsedStep),
		parsedQuery,
	);

	return adminAnalyticsFunnelStepUsersResponseSchema.parse(payload);
}

export async function setAdminFunnelContact(input: {
	userId: string;
	contacted: boolean;
}): Promise<AnalyticsFunnelContactResponse> {
	const body: AnalyticsFunnelContactInput =
		adminAnalyticsFunnelContactInputSchema.parse({
			contacted: input.contacted,
		});
	const payload = await apiPost<unknown>(
		adminAnalyticsRoutes.funnelContact(input.userId),
		body,
	);

	return adminAnalyticsFunnelContactResponseSchema.parse(payload);
}

export async function downloadFunnelStepUsersCsv(
	step: AnalyticsFunnelUserStep,
	query: AnalyticsFunnelStepUsersExportQueryInput,
): Promise<string> {
	const parsedStep = adminAnalyticsFunnelUserStepSchema.parse(step);
	const parsedQuery =
		adminAnalyticsFunnelStepUsersExportQuerySchema.parse(query);
	const response = await apiGetRaw(
		adminAnalyticsRoutes.funnelStepUsersExport(parsedStep),
		parsedQuery,
		"text/csv",
	);
	const blob = await response.blob();
	const fileName = csvFileName(
		response.headers.get("Content-Disposition"),
		parsedStep,
		parsedQuery.contacted,
	);
	const url = URL.createObjectURL(blob);
	const anchor = document.createElement("a");
	anchor.href = url;
	anchor.download = fileName;
	anchor.hidden = true;
	document.body.append(anchor);
	anchor.click();
	anchor.remove();
	URL.revokeObjectURL(url);
	return fileName;
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

function csvFileName(
	contentDisposition: string | null,
	step: AnalyticsFunnelUserStep,
	contacted: AnalyticsFunnelStepUsersExportQuery["contacted"],
): string {
	const match = contentDisposition?.match(/filename="?([^";]+)"?/i);
	const stepSlug = step.replace(/([a-z])([A-Z])/g, "$1-$2").toLowerCase();
	const contactedSuffix =
		contacted === "all"
			? ""
			: `-${contacted.replace(/([a-z])([A-Z])/g, "$1-$2").toLowerCase()}`;
	const now = new Date();
	const localDate = [
		now.getFullYear(),
		String(now.getMonth() + 1).padStart(2, "0"),
		String(now.getDate()).padStart(2, "0"),
	].join("-");

	return (
		match?.[1] ?? `funnel-${stepSlug}-users${contactedSuffix}-${localDate}.csv`
	);
}
