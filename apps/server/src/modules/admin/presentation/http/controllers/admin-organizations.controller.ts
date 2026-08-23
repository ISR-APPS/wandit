import {
	Body,
	Controller,
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
	type AdminGrantCreditsInput,
	type AdminListOrganizationsQuery,
	type AdminListOrganizationsResponse,
	type AdminOrganizationDetail,
	type AdminSetMemberRoleInput,
	adminGrantCreditsInputSchema,
	adminListOrganizationsQuerySchema,
	adminSetMemberRoleInputSchema,
} from "@wandit/contracts";

import { ZodValidationPipe } from "../../../../../infrastructure/http/zod-validation.pipe";
import { CurrentUser } from "../../../../auth";
import { AdminOrganizationsService } from "../../../application/services/admin-organizations.service";
import { AdminOnly } from "../decorators/admin-only.decorator";
import { AdminPermission } from "../decorators/admin-permission.decorator";

@Controller("v1/admin/organizations")
@AdminOnly()
@AdminPermission({ organizations: ["read"] })
export class AdminOrganizationsController {
	constructor(
		@Inject(AdminOrganizationsService)
		private readonly adminOrganizationsService: AdminOrganizationsService,
	) {}

	@Get()
	list(
		@Query(new ZodValidationPipe(adminListOrganizationsQuerySchema))
		query: AdminListOrganizationsQuery,
	): Promise<AdminListOrganizationsResponse> {
		return this.adminOrganizationsService.listOrganizations(query);
	}

	@Get(":organizationId")
	detail(
		@Param("organizationId") organizationId: string,
	): Promise<AdminOrganizationDetail> {
		return this.adminOrganizationsService.getOrganizationDetail(organizationId);
	}

	@Post(":organizationId/credits")
	@AdminPermission({ organizations: ["manage"] })
	@HttpCode(200)
	grantCredits(
		@Param("organizationId") organizationId: string,
		@Body(new ZodValidationPipe(adminGrantCreditsInputSchema))
		body: AdminGrantCreditsInput,
		@CurrentUser() admin: AuthUser,
	): Promise<AdminOrganizationDetail> {
		return this.adminOrganizationsService.grantCredits(
			admin.id,
			organizationId,
			body,
		);
	}

	@Patch(":organizationId/members/:userId/role")
	@AdminPermission({ organizations: ["manage"] })
	@HttpCode(200)
	setMemberRole(
		@Param("organizationId") organizationId: string,
		@Param("userId") userId: string,
		@Body(new ZodValidationPipe(adminSetMemberRoleInputSchema))
		body: AdminSetMemberRoleInput,
		@CurrentUser() admin: AuthUser,
	): Promise<AdminOrganizationDetail> {
		return this.adminOrganizationsService.setMemberRole(
			admin.id,
			organizationId,
			userId,
			body,
		);
	}
}
