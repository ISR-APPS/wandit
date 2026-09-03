import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { adminAnalyticsFunnelStepUsersQuerySchema } from "@wandit/contracts";

import type {
	AnalyticsFunnelStepUsersQueryInput,
	AnalyticsFunnelUserStep,
	AnalyticsQuery,
} from "./analytics.dto";
import {
	getAdminAnalyticsAcquisition,
	getAdminAnalyticsEngagement,
	getAdminAnalyticsFeatures,
	getAdminAnalyticsFunnel,
	getAdminAnalyticsFunnelStepUsers,
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

function funnelStepUsersQueryDimensions(
	query: AnalyticsFunnelStepUsersQueryInput,
) {
	const parsedQuery = adminAnalyticsFunnelStepUsersQuerySchema.parse(query);

	return [
		...analyticsQueryDimensions(parsedQuery),
		parsedQuery.page,
		parsedQuery.pageSize,
		parsedQuery.contacted,
	] as const;
}

export const adminAnalyticsKeys = {
	all: ["admin-analytics"] as const,
	funnelStepUsersAll: () =>
		[...adminAnalyticsKeys.all, "funnel-step-users"] as const,
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
	funnelStepUsers: (
		step: AnalyticsFunnelUserStep,
		query: AnalyticsFunnelStepUsersQueryInput,
	) =>
		[
			...adminAnalyticsKeys.funnelStepUsersAll(),
			step,
			...funnelStepUsersQueryDimensions(query),
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

export function useAdminAnalyticsFunnelStepUsersQuery(
	step: AnalyticsFunnelUserStep,
	query: AnalyticsFunnelStepUsersQueryInput,
	{ enabled }: { enabled: boolean },
) {
	return useQuery({
		queryKey: adminAnalyticsKeys.funnelStepUsers(step, query),
		queryFn: () => getAdminAnalyticsFunnelStepUsers(step, query),
		enabled,
		placeholderData: keepPreviousData,
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
