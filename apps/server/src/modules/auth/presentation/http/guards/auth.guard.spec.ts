import { type ExecutionContext, UnauthorizedException } from "@nestjs/common";
import { GUARDS_METADATA } from "@nestjs/common/constants";
import { Reflector } from "@nestjs/core";
import type { AdminAuth, Auth } from "@wandit/auth";
import { describe, expect, it, vi } from "vitest";

import type { Database } from "../../../../../infrastructure/database/database.constants";
import { AdminOnly } from "../../../../admin/presentation/http/decorators/admin-only.decorator";
import { AdminGuard } from "../../../../admin/presentation/http/guards/admin.guard";
import { ADMIN_AUTH_SURFACE, AUTH_SURFACE_KEY } from "../../../auth.constants";
import { AuthGuard } from "./auth.guard";

const COEXISTING_COOKIES =
	"better-auth.session_token=web-session; wandit-admin.session_token=admin-session";

@AdminOnly()
class AdminController {}

class WebController {}

function contextFor(controller: new () => object): ExecutionContext {
	return {
		getClass: () => controller,
		getHandler: () => contextFor,
		switchToHttp: () => ({
			getRequest: () => ({
				headers: { cookie: COEXISTING_COOKIES },
				method: "GET",
			}),
		}),
	} as unknown as ExecutionContext;
}

function setup() {
	const webGetSession = vi.fn();
	const adminGetSession = vi.fn();
	const guard = new AuthGuard(
		{ api: { getSession: webGetSession } } as unknown as Auth,
		{ api: { getSession: adminGetSession } } as unknown as AdminAuth,
		new Reflector(),
		{} as Database,
	);

	return { adminGetSession, guard, webGetSession };
}

describe("AuthGuard session surfaces", () => {
	it("couples AdminGuard to explicit admin-auth metadata", () => {
		expect(Reflect.getMetadata(AUTH_SURFACE_KEY, AdminController)).toBe(
			ADMIN_AUTH_SURFACE,
		);
		expect(Reflect.getMetadata(GUARDS_METADATA, AdminController)).toEqual([
			AdminGuard,
		]);
	});

	it("rejects a valid web session on an admin route", async () => {
		const { adminGetSession, guard, webGetSession } = setup();
		webGetSession.mockResolvedValue({ session: {}, user: { id: "web-user" } });
		adminGetSession.mockResolvedValue(null);

		await expect(
			guard.canActivate(contextFor(AdminController)),
		).rejects.toBeInstanceOf(UnauthorizedException);

		expect(adminGetSession).toHaveBeenCalledOnce();
		expect(webGetSession).not.toHaveBeenCalled();
	});

	it("rejects a valid admin session on a web route", async () => {
		const { adminGetSession, guard, webGetSession } = setup();
		webGetSession.mockResolvedValue(null);
		adminGetSession.mockResolvedValue({
			session: {},
			user: { id: "admin-user" },
		});

		await expect(
			guard.canActivate(contextFor(WebController)),
		).rejects.toBeInstanceOf(UnauthorizedException);

		expect(webGetSession).toHaveBeenCalledOnce();
		expect(adminGetSession).not.toHaveBeenCalled();
	});
});
