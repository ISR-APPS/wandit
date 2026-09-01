import { RequestMethod } from "@nestjs/common";
import {
	GUARDS_METADATA,
	METHOD_METADATA,
	PATH_METADATA,
} from "@nestjs/common/constants";
import {
	type AdminPermissionRequest,
	adminViews,
	defaultSupportViews,
	staffHasPermission,
} from "@wandit/auth/admin-permissions";
import { describe, expect, it, vi } from "vitest";

// This is a metadata-only test. Avoid loading the Academy HTML sanitizer and
// its CommonJS/ESM transitive graph just to import the controller class.
vi.mock("../../../../academy/application/services/academy.service", () => ({
	AcademyService: class AcademyService {},
}));

import { AcademyAdminController } from "../../../../academy/presentation/http/controllers/academy-admin.controller";
import { AffiliateAdminController } from "../../../../affiliates/presentation/http/controllers/affiliate-admin.controller";
import {
	ADMIN_AUTH_SURFACE,
	AUTH_SURFACE_KEY,
} from "../../../../auth/auth.constants";
import { AdminSignupGrantsController } from "../../../../auth/presentation/http/controllers/admin-signup-grants.controller";
import { AdminManualBillingController } from "../../../../billing/presentation/http/controllers/admin-manual-billing.controller";
import { FeedbackAdminController } from "../../../../feedback/presentation/http/controllers/feedback-admin.controller";
import { AdminSettingsController } from "../../../../settings/presentation/http/controllers/admin-settings.controller";
import { StoryLinkAdminController } from "../../../../story-links/presentation/http/controllers/story-link-admin.controller";
import { AdminAnalyticsController } from "../controllers/admin-analytics.controller";
import { AdminConversationsController } from "../controllers/admin-conversations.controller";
import { AdminCostsController } from "../controllers/admin-costs.controller";
import { AdminMeController } from "../controllers/admin-me.controller";
import { AdminOrganizationsController } from "../controllers/admin-organizations.controller";
import { AdminProjectsController } from "../controllers/admin-projects.controller";
import { AdminPublicationsController } from "../controllers/admin-publications.controller";
import { AdminStatsController } from "../controllers/admin-stats.controller";
import { AdminUsersController } from "../controllers/admin-users.controller";
import { AdminWebhooksController } from "../controllers/admin-webhooks.controller";
import { AdminGuard } from "../guards/admin.guard";
import { ADMIN_PERMISSION_KEY } from "./admin-permission.decorator";

const adminControllers = [
	AcademyAdminController,
	AdminAnalyticsController,
	AdminConversationsController,
	AdminCostsController,
	AdminMeController,
	FeedbackAdminController,
	AdminManualBillingController,
	AdminOrganizationsController,
	AdminProjectsController,
	AdminPublicationsController,
	AdminSignupGrantsController,
	AdminStatsController,
	AdminUsersController,
	AdminWebhooksController,
	AffiliateAdminController,
	AdminSettingsController,
	StoryLinkAdminController,
];

const SUPPORT_ALLOWED_WRITE_HANDLERS = new Set([
	"AdminUsersController.setBanned",
	// Support holds feedback:manage by design (see the permission matrix spec).
	"FeedbackAdminController.remove",
	"FeedbackAdminController.update",
]);

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

	it.each(
		adminControllers,
	)("gives every $name route handler an explicit effective admin permission", (controller) => {
		const handlerNames = Object.getOwnPropertyNames(
			controller.prototype,
		).filter((name) => {
			const handler =
				controller.prototype[name as keyof typeof controller.prototype];

			return (
				typeof handler === "function" &&
				(Reflect.getMetadata(PATH_METADATA, handler) !== undefined ||
					Reflect.getMetadata(METHOD_METADATA, handler) !== undefined)
			);
		});

		expect(handlerNames.length).toBeGreaterThan(0);

		for (const handlerName of handlerNames) {
			const handler =
				controller.prototype[handlerName as keyof typeof controller.prototype];
			const permission: AdminPermissionRequest | "any-staff" | undefined =
				Reflect.getMetadata(ADMIN_PERMISSION_KEY, handler) ??
				Reflect.getMetadata(ADMIN_PERMISSION_KEY, controller);

			if (permission === "any-staff") {
				expect(permission, `${controller.name}.${handlerName}`).toBe(
					"any-staff",
				);
				continue;
			}

			expect(permission, `${controller.name}.${handlerName}`).toBeTypeOf(
				"object",
			);
			expect(
				Object.keys(permission ?? {}).length,
				`${controller.name}.${handlerName}`,
			).toBeGreaterThan(0);
			expect(
				Object.values(permission ?? {}).every(
					(actions) => Array.isArray(actions) && actions.length > 0,
				),
				`${controller.name}.${handlerName}`,
			).toBe(true);
		}
	});

	it.each(
		adminControllers,
	)("keeps $name write handlers unavailable to support unless allowlisted", (controller) => {
		const handlerNames = Object.getOwnPropertyNames(
			controller.prototype,
		).filter((name) => {
			const handler =
				controller.prototype[name as keyof typeof controller.prototype];

			return (
				typeof handler === "function" &&
				(Reflect.getMetadata(PATH_METADATA, handler) !== undefined ||
					Reflect.getMetadata(METHOD_METADATA, handler) !== undefined)
			);
		});

		for (const handlerName of handlerNames) {
			const handler =
				controller.prototype[handlerName as keyof typeof controller.prototype];
			const requestMethod = Reflect.getMetadata(METHOD_METADATA, handler) as
				| RequestMethod
				| undefined;
			const routeName = `${controller.name}.${handlerName}`;

			if (requestMethod === undefined || requestMethod === RequestMethod.GET) {
				continue;
			}

			const effectivePermission = (Reflect.getMetadata(
				ADMIN_PERMISSION_KEY,
				handler,
			) ?? Reflect.getMetadata(ADMIN_PERMISSION_KEY, controller)) as
				| AdminPermissionRequest
				| "any-staff";

			expect(
				effectivePermission,
				`${routeName} must not grant write access to any staff member`,
			).not.toBe("any-staff");

			if (
				effectivePermission === "any-staff" ||
				SUPPORT_ALLOWED_WRITE_HANDLERS.has(routeName)
			) {
				continue;
			}

			expect(
				staffHasPermission("support", defaultSupportViews, effectivePermission),
				`${routeName} with default views`,
			).toBe(false);
			expect(
				staffHasPermission("support", adminViews, effectivePermission),
				`${routeName} with every view`,
			).toBe(false);
		}
	});

	it("keeps the users controller read default and sensitive mutation overrides exact", () => {
		expect(
			Reflect.getMetadata(ADMIN_PERMISSION_KEY, AdminUsersController),
		).toEqual({ users: ["read"] });
		expect(
			Reflect.getMetadata(
				ADMIN_PERMISSION_KEY,
				AdminUsersController.prototype.grantCredits,
			),
		).toEqual({ users: ["grant-credits"] });
		expect(
			Reflect.getMetadata(
				ADMIN_PERMISSION_KEY,
				AdminUsersController.prototype.setRole,
			),
		).toEqual({ users: ["set-role"] });
		expect(
			Reflect.getMetadata(
				ADMIN_PERMISSION_KEY,
				AdminUsersController.prototype.setBanned,
			),
		).toEqual({ users: ["ban"] });
		expect(
			Reflect.getMetadata(
				ADMIN_PERMISSION_KEY,
				AdminUsersController.prototype.setAdminViews,
			),
		).toEqual({ users: ["set-role"] });
		expect(
			Reflect.getMetadata(
				ADMIN_PERMISSION_KEY,
				AdminUsersController.prototype.list,
			),
		).toBeUndefined();
	});

	it("reserves any-staff for the GET permissions endpoint", () => {
		const anyStaffHandlers: string[] = [];

		for (const controller of adminControllers) {
			for (const handlerName of Object.getOwnPropertyNames(
				controller.prototype,
			)) {
				const handler =
					controller.prototype[
						handlerName as keyof typeof controller.prototype
					];

				if (typeof handler !== "function") {
					continue;
				}

				const requestMethod = Reflect.getMetadata(METHOD_METADATA, handler) as
					| RequestMethod
					| undefined;

				if (requestMethod === undefined) {
					continue;
				}

				const effectivePermission =
					Reflect.getMetadata(ADMIN_PERMISSION_KEY, handler) ??
					Reflect.getMetadata(ADMIN_PERMISSION_KEY, controller);

				if (effectivePermission !== "any-staff") {
					continue;
				}

				const routeName = `${controller.name}.${handlerName}`;
				anyStaffHandlers.push(routeName);
				expect(requestMethod, routeName).toBe(RequestMethod.GET);
			}
		}

		expect(anyStaffHandlers).toEqual(["AdminMeController.permissions"]);
	});
});
