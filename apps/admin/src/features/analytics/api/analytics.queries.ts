import { useQuery } from "@tanstack/react-query";

import type { AnalyticsQuery } from "./analytics.dto";
import {
	getAdminAnalyticsAcquisition,
	getAdminAnalyticsEngagement,
	getAdminAnalyticsFeatures,
	getAdminAnalyticsFunnel,
	getAdminAnalyticsHealth,
	getAdminAnalyticsRevenue,
} from "./analytics.services";

function analyticsQueryDimensions(query: AnalyticsQuery) {
	return [
		query.range,
		query.from ?? null,
		query.to ?? null,
		query.source ?? null,
		query.country ?? null,
		query.device ?? null,
		query.cohortOnly,
	] as const;
}

export const adminAnalyticsKeys = {
	all: ["admin-analytics"] as const,
	acquisition: (query: AnalyticsQuery) =>
		[
			...adminAnalyticsKeys.all,
			"acquisition",
			...analyticsQueryDimensions(query),
		] as const,
	funnel: (query: AnalyticsQuery) =>
		[
			...adminAnalyticsKeys.all,
			"funnel",
			...analyticsQueryDimensions(query),
		] as const,
	engagement: (query: AnalyticsQuery) =>
		[
			...adminAnalyticsKeys.all,
			"engagement",
			...analyticsQueryDimensions(query),
		] as const,
	revenue: (query: AnalyticsQuery) =>
		[
			...adminAnalyticsKeys.all,
			"revenue",
			...analyticsQueryDimensions(query),
		] as const,
	features: (query: AnalyticsQuery) =>
		[
			...adminAnalyticsKeys.all,
			"features",
			...analyticsQueryDimensions(query),
		] as const,
	health: (query: AnalyticsQuery) =>
		[
			...adminAnalyticsKeys.all,
			"health",
			...analyticsQueryDimensions(query),
		] as const,
};

export function useAdminAnalyticsAcquisitionQuery(query: AnalyticsQuery) {
	return useQuery({
		queryKey: adminAnalyticsKeys.acquisition(query),
		queryFn: () => getAdminAnalyticsAcquisition(query),
	});
}

export function useAdminAnalyticsFunnelQuery(query: AnalyticsQuery) {
	return useQuery({
		queryKey: adminAnalyticsKeys.funnel(query),
		queryFn: () => getAdminAnalyticsFunnel(query),
	});
}

export function useAdminAnalyticsEngagementQuery(query: AnalyticsQuery) {
	return useQuery({
		queryKey: adminAnalyticsKeys.engagement(query),
		queryFn: () => getAdminAnalyticsEngagement(query),
	});
}

export function useAdminAnalyticsRevenueQuery(query: AnalyticsQuery) {
	return useQuery({
		queryKey: adminAnalyticsKeys.revenue(query),
		queryFn: () => getAdminAnalyticsRevenue(query),
	});
}

export function useAdminAnalyticsFeaturesQuery(query: AnalyticsQuery) {
	return useQuery({
		queryKey: adminAnalyticsKeys.features(query),
		queryFn: () => getAdminAnalyticsFeatures(query),
	});
}

export function useAdminAnalyticsHealthQuery(query: AnalyticsQuery) {
	return useQuery({
		queryKey: adminAnalyticsKeys.health(query),
		queryFn: () => getAdminAnalyticsHealth(query),
	});
}
