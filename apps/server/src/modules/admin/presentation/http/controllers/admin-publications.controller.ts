/**
 * Admin API for the platform publish log and the take-down switch of a V2 app.
 * The admin app calls these routes under /api/v1/admin/publications.
 * The list calls AdminPublicationsService; suspend and unsuspend call
 * PublicationSuspensionService. AdminGuard checks the permission.
 */
import {
	Body,
	Controller,
	Get,
	HttpCode,
	Inject,
	Param,
	Post,
	Query,
	Req,
} from "@nestjs/common";
import type { AuthUser } from "@wandit/auth";
import {
	type AdminListPublicationsQuery,
	type AdminListPublicationsResponse,
	type AdminPublicationSuspensionResponse,
	type AdminSuspendPublicationInput,
	adminListPublicationsQuerySchema,
	adminSuspendPublicationInputSchema,
	uuidSchema,
} from "@wandit/contracts";
import type { FastifyRequest } from "fastify";

import { readClientIp } from "../../../../../infrastructure/http/client-ip";
import { ZodValidationPipe } from "../../../../../infrastructure/http/zod-validation.pipe";
import { CurrentUser } from "../../../../auth";
import { AdminPublicationsService } from "../../../application/services/admin-publications.service";
import { PublicationSuspensionService } from "../../../application/services/publication-suspension.service";
import { AdminOnly } from "../decorators/admin-only.decorator";
import { AdminPermission } from "../decorators/admin-permission.decorator";

@Controller("v1/admin/publications")
@AdminOnly()
@AdminPermission({ publications: ["read"] })
export class AdminPublicationsController {
	constructor(
		@Inject(AdminPublicationsService)
		private readonly adminPublicationsService: AdminPublicationsService,
		@Inject(PublicationSuspensionService)
		private readonly publicationSuspensionService: PublicationSuspensionService,
	) {}

	@Get()
	list(
		@Query(new ZodValidationPipe(adminListPublicationsQuerySchema))
		query: AdminListPublicationsQuery,
	): Promise<AdminListPublicationsResponse> {
		return this.adminPublicationsService.listPublications(query);
	}

	@Post(":projectId/suspend")
	@AdminPermission({ publications: ["suspend"] })
	@HttpCode(200)
	suspend(
		@Param("projectId", new ZodValidationPipe(uuidSchema))
		projectId: string,
		@Body(new ZodValidationPipe(adminSuspendPublicationInputSchema))
		body: AdminSuspendPublicationInput,
		@CurrentUser() admin: AuthUser,
		@Req() request: FastifyRequest,
	): Promise<AdminPublicationSuspensionResponse> {
		return this.publicationSuspensionService.suspend(
			admin,
			projectId,
			body,
			readClientIp(request),
		);
	}

	@Post(":projectId/unsuspend")
	@AdminPermission({ publications: ["suspend"] })
	@HttpCode(200)
	unsuspend(
		@Param("projectId", new ZodValidationPipe(uuidSchema))
		projectId: string,
		@CurrentUser() admin: AuthUser,
		@Req() request: FastifyRequest,
	): Promise<AdminPublicationSuspensionResponse> {
		return this.publicationSuspensionService.unsuspend(
			admin,
			projectId,
			readClientIp(request),
		);
	}
}
