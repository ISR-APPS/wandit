import { GUARDS_METADATA } from "@nestjs/common/constants";
import { describe, expect, it } from "vitest";

import { AffiliateAdminController } from "../../../../affiliates/presentation/http/controllers/affiliate-admin.controller";
import {
	ADMIN_AUTH_SURFACE,
	AUTH_SURFACE_KEY,
} from "../../../../auth/auth.constants";
import { AdminSettingsController } from "../../../../settings/presentation/http/controllers/admin-settings.controller";
import { AdminOrganizationsController } from "../controllers/admin-organizations.controller";
import { AdminProjectsController } from "../controllers/admin-projects.controller";
import { AdminStatsController } from "../controllers/admin-stats.controller";
import { AdminUsersController } from "../controllers/admin-users.controller";
import { AdminWebhooksController } from "../controllers/admin-webhooks.controller";
import { AdminGuard } from "../guards/admin.guard";

const adminControllers = [
	AdminOrganizationsController,
	AdminProjectsController,
	AdminStatsController,
	AdminUsersController,
	AdminWebhooksController,
	AffiliateAdminController,
	AdminSettingsController,
];

describe("AdminOnly", () => {
	it.each(
		adminControllers,
	)("marks $name for admin-session authentication and authorization", (controller) => {
		expect(Reflect.getMetadata(AUTH_SURFACE_KEY, controller)).toBe(
			ADMIN_AUTH_SURFACE,
		);
		expect(Reflect.getMetadata(GUARDS_METADATA, controller)).toEqual([
			AdminGuard,
		]);
	});
});
