import { Controller, Get, Inject, Query, UseGuards } from "@nestjs/common";
import {
	type AdminSignupStats,
	type AdminSignupStatsQuery,
	adminSignupStatsQuerySchema,
} from "@wandit/contracts";

import { ZodValidationPipe } from "../../../../../infrastructure/http/zod-validation.pipe";
import { AdminStatsService } from "../../../application/services/admin-stats.service";
import { AdminGuard } from "../guards/admin.guard";

@Controller("v1/admin/stats")
@UseGuards(AdminGuard)
export class AdminStatsController {
	constructor(
		@Inject(AdminStatsService)
		private readonly adminStatsService: AdminStatsService,
	) {}

	@Get("signups")
	signups(
		@Query(new ZodValidationPipe(adminSignupStatsQuerySchema))
		query: AdminSignupStatsQuery,
	): Promise<AdminSignupStats> {
		return this.adminStatsService.getSignupStats(query);
	}
}
