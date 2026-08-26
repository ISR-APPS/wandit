/**
 * Restricts a route to staff with the declared admin permission.
 *
 * Runs after the global AuthGuard (which populates `request.user`). Non-staff
 * sessions get 404 so the admin surface is not discoverable. Staff sessions
 * that lack a declared permission get 403 (docs/api-security.md).
 */
import {
	type CanActivate,
	type ExecutionContext,
	Inject,
	Injectable,
	NotFoundException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import {
	type AdminPermissionRequest,
	adminRoleHasPermission,
} from "@wandit/auth/admin-permissions";
import { isAdminRole, isStaffRole } from "@wandit/contracts";
import { env } from "@wandit/env/server";

import type { MaybeAuthenticatedRequest } from "../../../../auth";
import { AdminPermissionRequiredError } from "../../../domain/errors/admin-permission-required.error";
import { ADMIN_PERMISSION_KEY } from "../decorators/admin-permission.decorator";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

const ALLOWED_WRITE_ORIGINS = [env.ADMIN_ORIGIN].filter(
	(origin): origin is string => Boolean(origin),
);

@Injectable()
export class AdminGuard implements CanActivate {
	constructor(
		@Inject(Reflector)
		private readonly reflector: Reflector,
	) {}

	canActivate(context: ExecutionContext): boolean {
		const request = context
			.switchToHttp()
			.getRequest<MaybeAuthenticatedRequest>();
		const role = request.user?.role;

		if (!isStaffRole(role)) {
			throw new NotFoundException();
		}

		if (!SAFE_METHODS.has(request.method)) {
			this.assertSameSiteWrite(request);
		}

		const required = this.reflector.getAllAndOverride<
			AdminPermissionRequest | undefined
		>(ADMIN_PERMISSION_KEY, [context.getHandler(), context.getClass()]);

		if (required === undefined) {
			if (isAdminRole(role)) {
				return true;
			}

			throw new AdminPermissionRequiredError();
		}

		if (!adminRoleHasPermission(role, required)) {
			throw new AdminPermissionRequiredError();
		}

		return true;
	}

	/**
	 * CSRF defence for state-changing admin calls — the admin surface's own
	 * layer behind the global CrossSiteWriteGuard, the SameSite cookie policy
	 * and the urlencoded-parser removal in main.ts (see
	 * docs/features/csrf-and-security-headers.md).
	 *
	 * Kept on purpose: a plain auto-submitting HTML form can never send a JSON
	 * content type, and requiring both JSON and the configured admin Origin
	 * also prevents non-browser callers from bypassing the surface boundary
	 * by omitting Origin entirely (the global guard lets Origin-less requests
	 * through for the native app).
	 */
	private assertSameSiteWrite(request: MaybeAuthenticatedRequest): void {
		const contentType = request.headers["content-type"]
			?.split(";")[0]
			?.trim()
			.toLowerCase();

		if (contentType !== "application/json") {
			throw new NotFoundException();
		}

		const origin = request.headers.origin;

		if (origin === undefined || !ALLOWED_WRITE_ORIGINS.includes(origin)) {
			throw new NotFoundException();
		}
	}
}
