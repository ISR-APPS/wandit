import {
	Body,
	Controller,
	Get,
	HttpCode,
	Inject,
	Param,
	Post,
	Query,
	Res,
} from "@nestjs/common";
import type { AuthUser } from "@wandit/auth";
import {
	type AdminAnalyticsAcquisitionResponse,
	type AdminAnalyticsEngagementResponse,
	type AdminAnalyticsFeaturesResponse,
	type AdminAnalyticsFunnelContactInput,
	type AdminAnalyticsFunnelContactResponse,
	type AdminAnalyticsFunnelResponse,
	type AdminAnalyticsFunnelStepUsersExportQuery,
	type AdminAnalyticsFunnelStepUsersQuery,
	type AdminAnalyticsFunnelStepUsersResponse,
	type AdminAnalyticsFunnelUserStep,
	type AdminAnalyticsHealthResponse,
	type AdminAnalyticsQuery,
	type AdminAnalyticsRevenueResponse,
	adminAnalyticsFunnelContactInputSchema,
	adminAnalyticsFunnelStepUsersExportQuerySchema,
	adminAnalyticsFunnelStepUsersQuerySchema,
	adminAnalyticsFunnelUserStepSchema,
	adminAnalyticsQuerySchema,
	adminAnalyticsRoutes,
} from "@wandit/contracts";
import type { FastifyReply } from "fastify";

import { SkipResponseEnvelope } from "../../../../../infrastructure/http/skip-envelope.decorator";
import { ZodValidationPipe } from "../../../../../infrastructure/http/zod-validation.pipe";
import { CurrentUser } from "../../../../auth";
import { AdminAnalyticsService } from "../../../application/services/admin-analytics.service";
import { AdminOnly } from "../decorators/admin-only.decorator";
import { AdminPermission } from "../decorators/admin-permission.decorator";

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
@AdminPermission({ analytics: ["read"] })
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

	@Get(analyticsChildPath(adminAnalyticsRoutes.funnelStepUsers(":step")))
	getFunnelStepUsers(
		@Param("step", new ZodValidationPipe(adminAnalyticsFunnelUserStepSchema))
		step: AdminAnalyticsFunnelUserStep,
		@Query(new ZodValidationPipe(adminAnalyticsFunnelStepUsersQuerySchema))
		query: AdminAnalyticsFunnelStepUsersQuery,
	): Promise<AdminAnalyticsFunnelStepUsersResponse> {
		return this.adminAnalyticsService.getFunnelStepUsers(step, query);
	}

	@Get(analyticsChildPath(adminAnalyticsRoutes.funnelStepUsersExport(":step")))
	@SkipResponseEnvelope()
	async exportFunnelStepUsersCsv(
		@Param("step", new ZodValidationPipe(adminAnalyticsFunnelUserStepSchema))
		step: AdminAnalyticsFunnelUserStep,
		@Query(
			new ZodValidationPipe(adminAnalyticsFunnelStepUsersExportQuerySchema),
		)
		query: AdminAnalyticsFunnelStepUsersExportQuery,
		@Res() reply: FastifyReply,
	): Promise<void> {
		const download = await this.adminAnalyticsService.getFunnelStepUsersCsv(
			step,
			query,
		);

		await reply
			.header("Content-Type", "text/csv; charset=utf-8")
			.header(
				"Content-Disposition",
				`attachment; filename="${download.fileName}"`,
			)
			.header("Cache-Control", "private, no-store")
			.send(download.content);
	}

	@Post(analyticsChildPath(adminAnalyticsRoutes.funnelContact(":userId")))
	@AdminPermission({ analytics: ["manage"] })
	@HttpCode(200)
	setFunnelContact(
		@Param("userId") userId: string,
		@Body(new ZodValidationPipe(adminAnalyticsFunnelContactInputSchema))
		body: AdminAnalyticsFunnelContactInput,
		@CurrentUser() admin: AuthUser,
	): Promise<AdminAnalyticsFunnelContactResponse> {
		return this.adminAnalyticsService.setFunnelContact(admin.id, userId, body);
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
