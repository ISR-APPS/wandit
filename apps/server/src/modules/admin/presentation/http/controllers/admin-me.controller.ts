import { Controller, Get, Inject, NotFoundException } from "@nestjs/common";
import type { AuthUser } from "@wandit/auth";
import {
	adminViews,
	defaultSupportViews,
	staffEffectiveStatements,
} from "@wandit/auth/admin-permissions";
import {
	isAdminRole,
	isStaffRole,
	normalizeStoredRole,
} from "@wandit/contracts";

import { CurrentUser } from "../../../../auth";
import {
	AdminViewGrantsRepository,
	filterKnownAdminViews,
} from "../../../infrastructure/persistence/admin-view-grants.repository";
import { AdminOnly } from "../decorators/admin-only.decorator";
import { AdminPermission } from "../decorators/admin-permission.decorator";

@Controller("v1/admin/me")
@AdminOnly()
@AdminPermission("any-staff")
export class AdminMeController {
	constructor(
		@Inject(AdminViewGrantsRepository)
		private readonly adminViewGrantsRepository: AdminViewGrantsRepository,
	) {}

	@Get("permissions")
	async permissions(@CurrentUser() user: AuthUser) {
		const access = await this.adminViewGrantsRepository.findSupportAccess(
			user.id,
		);

		if (!access) {
			throw new NotFoundException();
		}

		const roleValue = access.role;
		const views = isAdminRole(roleValue)
			? [...adminViews]
			: isStaffRole(roleValue)
				? (filterKnownAdminViews(access.views) ?? [...defaultSupportViews])
				: [];

		return {
			permissions: staffEffectiveStatements(roleValue, views),
			role: normalizeStoredRole(roleValue),
			views,
		};
	}
}
