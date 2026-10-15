/**
 * Admin HTTP routes of the "Refund last payment" action on a user.
 * The admin SPA calls them from the users table. Calls AdminUserRefundsService.
 * Only full admins pass: the support role has no billing:manage.
 */
import {
	Body,
	Controller,
	Get,
	HttpCode,
	Inject,
	Param,
	Post,
} from "@nestjs/common";
import type { AuthUser } from "@wandit/auth";
import {
	type AdminUserRefundInput,
	type AdminUserRefundPreview,
	type AdminUserRefundResult,
	adminUserRefundInputSchema,
} from "@wandit/contracts";

import { ZodValidationPipe } from "../../../../../infrastructure/http/zod-validation.pipe";
import { AdminOnly } from "../../../../admin/presentation/http/decorators/admin-only.decorator";
import { AdminPermission } from "../../../../admin/presentation/http/decorators/admin-permission.decorator";
import { CurrentUser } from "../../../../auth";
import { AdminUserRefundsService } from "../../../application/services/admin-user-refunds.service";

/** GET reads Stripe only. POST moves money: a 409 or 502 body says what the admin must do next. */
@Controller("v1/admin/users")
@AdminOnly()
@AdminPermission({ billing: ["manage"] })
export class AdminUserRefundsController {
	constructor(
		@Inject(AdminUserRefundsService)
		private readonly adminUserRefundsService: AdminUserRefundsService,
	) {}

	@Get(":userId/refund")
	preview(@Param("userId") userId: string): Promise<AdminUserRefundPreview> {
		return this.adminUserRefundsService.preview(userId);
	}

	@Post(":userId/refund")
	@HttpCode(200)
	refund(
		@CurrentUser() admin: AuthUser,
		@Param("userId") userId: string,
		@Body(new ZodValidationPipe(adminUserRefundInputSchema))
		body: AdminUserRefundInput,
	): Promise<AdminUserRefundResult> {
		return this.adminUserRefundsService.refund(admin.id, userId, body);
	}
}
