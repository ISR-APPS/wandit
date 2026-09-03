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
	staffHasPermission,
} from "@wandit/auth/admin-permissions";
import { isAdminRole, isStaffRole } from "@wandit/contracts";
import { env } from "@wandit/env/server";

import type { MaybeAuthenticatedRequest } from "../../../../auth";
import { AdminPermissionRequiredError } from "../../../domain/errors/admin-permission-required.error";
import {
	AdminViewGrantsRepository,
	filterKnownAdminViews,
} from "../../../infrastructure/persistence/admin-view-grants.repository";
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
		@Inject(AdminViewGrantsRepository)
		private readonly adminViewGrantsRepository: AdminViewGrantsRepository,
	) {}

	async canActivate(context: ExecutionContext): Promise<boolean> {
		const request = context
			.switchToHttp()
			.getRequest<MaybeAuthenticatedRequest>();
		const user = request.user;
		const role = user?.role;

		if (!user || !isStaffRole(role)) {
			throw new NotFoundException();
		}

		if (!SAFE_METHODS.has(request.method)) {
			this.assertSameSiteWrite(request);
		}

		const required = this.reflector.getAllAndOverride<
			AdminPermissionRequest | "any-staff" | undefined
		>(ADMIN_PERMISSION_KEY, [context.getHandler(), context.getClass()]);

		if (required === "any-staff") {
			return true;
		}

		// Admins always have the full matrix. Keep this branch before the grant
		// lookup so the common full-admin path has zero database overhead.
		if (isAdminRole(role)) {
			if (required === undefined) {
				return true;
			}

			if (staffHasPermission(role, null, required)) {
				return true;
			}

			throw new AdminPermissionRequiredError();
		}

		const supportAccess =
			await this.adminViewGrantsRepository.findSupportAccess(user.id);

		if (!supportAccess || !isStaffRole(supportAccess.role)) {
			throw new NotFoundException();
		}

		if (required === undefined) {
			if (isAdminRole(supportAccess.role)) {
				return true;
			}

			throw new AdminPermissionRequiredError();
		}

		const views = filterKnownAdminViews(supportAccess.views);

		if (staffHasPermission(supportAccess.role, views, required)) {
			return true;
		}

		throw new AdminPermissionRequiredError();
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
