/**
 * Admin API for the credit grant log at /api/v1/admin/credit-grants.
 * The admin app "Credit grants" page calls it. It calls AdminCreditGrantsService.
 * Staff need credits:read. Admins have it; support has it when an admin ticks the "credits" view.
 */
import { Controller, Get, Inject, Query } from "@nestjs/common";
import {
	type AdminListCreditGrantsQuery,
	type AdminListCreditGrantsResponse,
	adminListCreditGrantsQuerySchema,
} from "@wandit/contracts";

import { ZodValidationPipe } from "../../../../../infrastructure/http/zod-validation.pipe";
import { AdminCreditGrantsService } from "../../../application/services/admin-credit-grants.service";
import { AdminOnly } from "../decorators/admin-only.decorator";
import { AdminPermission } from "../decorators/admin-permission.decorator";

/** GET only. The decorator spec pins its credits:read gate. */
@Controller("v1/admin/credit-grants")
@AdminOnly()
@AdminPermission({ credits: ["read"] })
export class AdminCreditGrantsController {
	constructor(
		@Inject(AdminCreditGrantsService)
		private readonly adminCreditGrantsService: AdminCreditGrantsService,
	) {}

	@Get()
	list(
		@Query(new ZodValidationPipe(adminListCreditGrantsQuerySchema))
		query: AdminListCreditGrantsQuery,
	): Promise<AdminListCreditGrantsResponse> {
		return this.adminCreditGrantsService.listCreditGrants(query);
	}
}
