import { Controller, Get, Inject, Query } from "@nestjs/common";
import {
	type AdminAnalyticsAcquisitionResponse,
	type AdminAnalyticsEngagementResponse,
	type AdminAnalyticsFeaturesResponse,
	type AdminAnalyticsFunnelResponse,
	type AdminAnalyticsHealthResponse,
	type AdminAnalyticsQuery,
	type AdminAnalyticsRevenueResponse,
	adminAnalyticsQuerySchema,
	adminAnalyticsRoutes,
} from "@wandit/contracts";

import { ZodValidationPipe } from "../../../../../infrastructure/http/zod-validation.pipe";
import { AdminAnalyticsService } from "../../../application/services/admin-analytics.service";
import { AdminOnly } from "../decorators/admin-only.decorator";

const API_PREFIX = "/api/";

function withoutGlobalApiPrefix(route: string): string {
	return route.startsWith(API_PREFIX) ? route.slice(API_PREFIX.length) : route;
}

const ADMIN_ANALYTICS_CONTROLLER_PATH = withoutGlobalApiPrefix(
	adminAnalyticsRoutes.revenue,
).replace(/\/revenue$/, "");

function analyticsChildPath(route: string): string {
	return withoutGlobalApiPrefix(route).slice(
		ADMIN_ANALYTICS_CONTROLLER_PATH.length + 1,
	);
}

@Controller(ADMIN_ANALYTICS_CONTROLLER_PATH)
@AdminOnly()
export class AdminAnalyticsController {
	constructor(
		@Inject(AdminAnalyticsService)
		private readonly adminAnalyticsService: AdminAnalyticsService,
	) {}

	@Get(analyticsChildPath(adminAnalyticsRoutes.revenue))
	revenue(
		@Query(new ZodValidationPipe(adminAnalyticsQuerySchema))
		query: AdminAnalyticsQuery,
	): Promise<AdminAnalyticsRevenueResponse> {
		return this.adminAnalyticsService.getRevenue(query);
	}

	@Get(analyticsChildPath(adminAnalyticsRoutes.acquisition))
	getAcquisition(
		@Query(new ZodValidationPipe(adminAnalyticsQuerySchema))
		query: AdminAnalyticsQuery,
	): Promise<AdminAnalyticsAcquisitionResponse> {
		return this.adminAnalyticsService.getAcquisition(query);
	}

	@Get(analyticsChildPath(adminAnalyticsRoutes.funnel))
	getFunnel(
		@Query(new ZodValidationPipe(adminAnalyticsQuerySchema))
		query: AdminAnalyticsQuery,
	): Promise<AdminAnalyticsFunnelResponse> {
		return this.adminAnalyticsService.getFunnel(query);
	}

	@Get(analyticsChildPath(adminAnalyticsRoutes.engagement))
	getEngagement(
		@Query(new ZodValidationPipe(adminAnalyticsQuerySchema))
		query: AdminAnalyticsQuery,
	): Promise<AdminAnalyticsEngagementResponse> {
		return this.adminAnalyticsService.getEngagement(query);
	}

	@Get(analyticsChildPath(adminAnalyticsRoutes.features))
	features(
		@Query(new ZodValidationPipe(adminAnalyticsQuerySchema))
		query: AdminAnalyticsQuery,
	): Promise<AdminAnalyticsFeaturesResponse> {
		return this.adminAnalyticsService.getFeatures(query);
	}

	@Get(analyticsChildPath(adminAnalyticsRoutes.health))
	health(
		@Query(new ZodValidationPipe(adminAnalyticsQuerySchema))
		query: AdminAnalyticsQuery,
	): Promise<AdminAnalyticsHealthResponse> {
		return this.adminAnalyticsService.getHealth(query);
	}
}
