import { Controller, Get, Inject, Query } from "@nestjs/common";
import {
	type AdminOverviewQuery,
	type AdminOverviewSnapshot,
	type AdminSignupStats,
	type AdminSignupStatsQuery,
	adminOverviewQuerySchema,
	adminSignupStatsQuerySchema,
} from "@wandit/contracts";

import { ZodValidationPipe } from "../../../../../infrastructure/http/zod-validation.pipe";
import { AdminStatsService } from "../../../application/services/admin-stats.service";
import { AdminOnly } from "../decorators/admin-only.decorator";

@Controller("v1/admin/stats")
@AdminOnly()
export class AdminStatsController {
	constructor(
		@Inject(AdminStatsService)
		private readonly adminStatsService: AdminStatsService,
	) {}

	@Get("overview")
	overview(
		@Query(new ZodValidationPipe(adminOverviewQuerySchema))
		query: AdminOverviewQuery,
	): Promise<AdminOverviewSnapshot> {
		return this.adminStatsService.getOverviewStats(query);
	}

	@Get("signups")
	signups(
		@Query(new ZodValidationPipe(adminSignupStatsQuerySchema))
		query: AdminSignupStatsQuery,
	): Promise<AdminSignupStats> {
		return this.adminStatsService.getSignupStats(query);
	}
}
