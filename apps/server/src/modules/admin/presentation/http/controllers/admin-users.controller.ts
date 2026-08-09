import {
	Body,
	Controller,
	Get,
	HttpCode,
	Inject,
	Param,
	Post,
	Query,
	UseGuards,
} from "@nestjs/common";
import type { AuthUser } from "@wandit/auth";
import {
	type AdminBetaEnrollInput,
	type AdminGrantCreditsInput,
	type AdminListUsersQuery,
	type AdminListUsersResponse,
	type AdminSetAccessInput,
	type AdminSetBannedInput,
	type AdminSetRoleInput,
	type AdminUserDetail,
	type AdminUserPagesQuery,
	type AdminUserPagesResponse,
	type AdminUserProjectsQuery,
	type AdminUserProjectsResponse,
	adminBetaEnrollInputSchema,
	adminGrantCreditsInputSchema,
	adminListUsersQuerySchema,
	adminSetAccessInputSchema,
	adminSetBannedInputSchema,
	adminSetRoleInputSchema,
	adminUserPagesQuerySchema,
	adminUserProjectsQuerySchema,
} from "@wandit/contracts";

import { ZodValidationPipe } from "../../../../../infrastructure/http/zod-validation.pipe";
import { CurrentUser } from "../../../../auth";
import { AdminUsersService } from "../../../application/services/admin-users.service";
import { AdminGuard } from "../guards/admin.guard";

@Controller("v1/admin/users")
@UseGuards(AdminGuard)
export class AdminUsersController {
	constructor(
		@Inject(AdminUsersService)
		private readonly adminUsersService: AdminUsersService,
	) {}

	@Get()
	list(
		@Query(new ZodValidationPipe(adminListUsersQuerySchema))
		query: AdminListUsersQuery,
	): Promise<AdminListUsersResponse> {
		return this.adminUsersService.listUsers(query);
	}

	@Get(":userId/pages")
	pages(
		@Param("userId") userId: string,
		@Query(new ZodValidationPipe(adminUserPagesQuerySchema))
		query: AdminUserPagesQuery,
	): Promise<AdminUserPagesResponse> {
		return this.adminUsersService.listUserPages(userId, query);
	}

	@Get(":userId/projects")
	projects(
		@Param("userId") userId: string,
		@Query(new ZodValidationPipe(adminUserProjectsQuerySchema))
		query: AdminUserProjectsQuery,
	): Promise<AdminUserProjectsResponse> {
		return this.adminUsersService.listUserProjects(userId, query);
	}

	@Get(":userId")
	detail(@Param("userId") userId: string): Promise<AdminUserDetail> {
		return this.adminUsersService.getUserDetail(userId);
	}

	@Post(":userId/beta-enroll")
	@HttpCode(200)
	betaEnroll(
		@Param("userId") userId: string,
		@Body(new ZodValidationPipe(adminBetaEnrollInputSchema))
		body: AdminBetaEnrollInput,
		@CurrentUser() admin: AuthUser,
	): Promise<AdminUserDetail> {
		return this.adminUsersService.betaEnroll(admin.id, userId, body);
	}

	@Post(":userId/credits")
	@HttpCode(200)
	grantCredits(
		@Param("userId") userId: string,
		@Body(new ZodValidationPipe(adminGrantCreditsInputSchema))
		body: AdminGrantCreditsInput,
		@CurrentUser() admin: AuthUser,
	): Promise<AdminUserDetail> {
		return this.adminUsersService.grantCredits(admin.id, userId, body);
	}

	@Post(":userId/role")
	@HttpCode(200)
	setRole(
		@Param("userId") userId: string,
		@Body(new ZodValidationPipe(adminSetRoleInputSchema))
		body: AdminSetRoleInput,
		@CurrentUser() admin: AuthUser,
	): Promise<AdminUserDetail> {
		return this.adminUsersService.setRole(admin.id, userId, body);
	}

	@Post(":userId/access")
	@HttpCode(200)
	setAccess(
		@Param("userId") userId: string,
		@Body(new ZodValidationPipe(adminSetAccessInputSchema))
		body: AdminSetAccessInput,
		@CurrentUser() admin: AuthUser,
	): Promise<AdminUserDetail> {
		return this.adminUsersService.setAccess(admin.id, userId, body);
	}

	@Post(":userId/banned")
	@HttpCode(200)
	setBanned(
		@Param("userId") userId: string,
		@Body(new ZodValidationPipe(adminSetBannedInputSchema))
		body: AdminSetBannedInput,
		@CurrentUser() admin: AuthUser,
	): Promise<AdminUserDetail> {
		return this.adminUsersService.setBanned(admin.id, userId, body);
	}
}
