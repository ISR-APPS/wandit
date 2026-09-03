import { Controller, Get, Inject, Query } from "@nestjs/common";
import {
	type AdminListPublicationsQuery,
	type AdminListPublicationsResponse,
	adminListPublicationsQuerySchema,
} from "@wandit/contracts";

import { ZodValidationPipe } from "../../../../../infrastructure/http/zod-validation.pipe";
import { AdminPublicationsService } from "../../../application/services/admin-publications.service";
import { AdminOnly } from "../decorators/admin-only.decorator";
import { AdminPermission } from "../decorators/admin-permission.decorator";

@Controller("v1/admin/publications")
@AdminOnly()
@AdminPermission({ publications: ["read"] })
export class AdminPublicationsController {
	constructor(
		@Inject(AdminPublicationsService)
		private readonly adminPublicationsService: AdminPublicationsService,
	) {}

	@Get()
	list(
		@Query(new ZodValidationPipe(adminListPublicationsQuerySchema))
		query: AdminListPublicationsQuery,
	): Promise<AdminListPublicationsResponse> {
		return this.adminPublicationsService.listPublications(query);
	}
}
