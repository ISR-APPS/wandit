import {
	Body,
	Controller,
	Delete,
	Get,
	HttpCode,
	Inject,
	Param,
	Patch,
	Post,
	Query,
} from "@nestjs/common";
import type { AuthUser } from "@wandit/auth";
import {
	type CreateMonthlyCostRequest,
	createMonthlyCostRequestSchema,
	type ListMonthlyCostsQuery,
	type ListMonthlyCostsResponse,
	listMonthlyCostsQuerySchema,
	type MonthKey,
	type MonthlyCostResponse,
	monthKeySchema,
	type UpdateMonthlyCostRequest,
	updateMonthlyCostRequestSchema,
} from "@wandit/contracts";

import { ZodValidationPipe } from "../../../../../infrastructure/http/zod-validation.pipe";
import { CurrentUser } from "../../../../auth";
import { AdminCostsService } from "../../../application/services/admin-costs.service";
import { AdminOnly } from "../decorators/admin-only.decorator";

@Controller("v1/admin/costs")
@AdminOnly()
export class AdminCostsController {
	constructor(
		@Inject(AdminCostsService)
		private readonly adminCostsService: AdminCostsService,
	) {}

	@Get()
	list(
		@Query(new ZodValidationPipe(listMonthlyCostsQuerySchema))
		query: ListMonthlyCostsQuery,
	): Promise<ListMonthlyCostsResponse> {
		return this.adminCostsService.list(query);
	}

	@Post()
	create(
		@Body(new ZodValidationPipe(createMonthlyCostRequestSchema))
		body: CreateMonthlyCostRequest,
		@CurrentUser() admin: AuthUser,
	): Promise<MonthlyCostResponse> {
		return this.adminCostsService.create(admin.id, body);
	}

	@Patch(":month")
	update(
		@Param("month", new ZodValidationPipe(monthKeySchema)) month: MonthKey,
		@Body(new ZodValidationPipe(updateMonthlyCostRequestSchema))
		body: UpdateMonthlyCostRequest,
		@CurrentUser() admin: AuthUser,
	): Promise<MonthlyCostResponse> {
		return this.adminCostsService.update(admin.id, month, body);
	}

	@Delete(":month")
	@HttpCode(204)
	async delete(
		@Param("month", new ZodValidationPipe(monthKeySchema)) month: MonthKey,
	): Promise<void> {
		await this.adminCostsService.delete(month);
	}
}
