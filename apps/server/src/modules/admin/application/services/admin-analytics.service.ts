import { Inject, Injectable } from "@nestjs/common";
import type {
	AdminAnalyticsAcquisitionResponse,
	AdminAnalyticsEngagementResponse,
	AdminAnalyticsFeaturesResponse,
	AdminAnalyticsFunnelResponse,
	AdminAnalyticsHealthResponse,
	AdminAnalyticsQuery,
	AdminAnalyticsRevenueResponse,
} from "@wandit/contracts";

import { AdminAnalyticsRepository } from "../../infrastructure/persistence/admin-analytics.repository";
import {
	assembleAcquisitionResponse,
	assembleEngagementResponse,
	assembleFeaturesResponse,
	assembleFunnelResponse,
	assembleHealthResponse,
	assembleRevenueResponse,
} from "./admin-analytics.metrics";
import { resolveAdminDashboardRange } from "./admin-dashboard-range";

@Injectable()
export class AdminAnalyticsService {
	constructor(
		@Inject(AdminAnalyticsRepository)
		private readonly adminAnalyticsRepository: AdminAnalyticsRepository,
	) {}

	async getRevenue(
		query: AdminAnalyticsQuery,
	): Promise<AdminAnalyticsRevenueResponse> {
		const generatedAt = new Date();
		const resolvedRange = resolveAdminDashboardRange(query, generatedAt);
		const snapshot = await this.adminAnalyticsRepository.getRevenue(
			resolvedRange.bounds,
		);

		return assembleRevenueResponse(snapshot, generatedAt);
	}

	async getAcquisition(
		query: AdminAnalyticsQuery,
	): Promise<AdminAnalyticsAcquisitionResponse> {
		const generatedAt = new Date();
		const resolvedRange = resolveAdminDashboardRange(query, generatedAt);
		const snapshot = await this.adminAnalyticsRepository.getAcquisition(
			resolvedRange.bounds,
			analyticsAttributionFilters(query),
		);

		return assembleAcquisitionResponse(snapshot, generatedAt);
	}

	async getFunnel(
		query: AdminAnalyticsQuery,
	): Promise<AdminAnalyticsFunnelResponse> {
		const generatedAt = new Date();
		const resolvedRange = resolveAdminDashboardRange(query, generatedAt);
		const snapshot = await this.adminAnalyticsRepository.getFunnel(
			resolvedRange.bounds,
			analyticsAttributionFilters(query),
		);

		return assembleFunnelResponse(snapshot, generatedAt);
	}

	async getEngagement(
		query: AdminAnalyticsQuery,
	): Promise<AdminAnalyticsEngagementResponse> {
		const generatedAt = new Date();
		const resolvedRange = resolveAdminDashboardRange(query, generatedAt);
		const snapshot = await this.adminAnalyticsRepository.getEngagement(
			resolvedRange.bounds,
			{
				...analyticsAttributionFilters(query),
				cohortOnly: query.cohortOnly,
			},
		);

		return assembleEngagementResponse(snapshot, generatedAt);
	}

	async getFeatures(
		query: AdminAnalyticsQuery,
	): Promise<AdminAnalyticsFeaturesResponse> {
		const generatedAt = new Date();
		const resolvedRange = resolveAdminDashboardRange(query, generatedAt);
		const snapshot = await this.adminAnalyticsRepository.getFeatures(
			resolvedRange.bounds,
		);

		return assembleFeaturesResponse(snapshot, generatedAt);
	}

	async getHealth(
		query: AdminAnalyticsQuery,
	): Promise<AdminAnalyticsHealthResponse> {
		const generatedAt = new Date();
		const resolvedRange = resolveAdminDashboardRange(query, generatedAt);
		const snapshot = await this.adminAnalyticsRepository.getHealth(
			resolvedRange.bounds,
		);

		return assembleHealthResponse(snapshot, generatedAt);
	}
}

function analyticsAttributionFilters(
	query: AdminAnalyticsQuery,
): Pick<AdminAnalyticsQuery, "country" | "device" | "source"> {
	const filters: Pick<AdminAnalyticsQuery, "country" | "device" | "source"> =
		{};

	if (query.source !== undefined) filters.source = query.source;
	if (query.country !== undefined) filters.country = query.country;
	if (query.device !== undefined) filters.device = query.device;

	return filters;
}
