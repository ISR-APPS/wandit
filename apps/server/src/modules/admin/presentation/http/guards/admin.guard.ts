/**
 * Restricts a route to admin users.
 *
 * Runs after the global AuthGuard (which populates `request.user`). Non-admin
 * sessions get 404 — never 403 — so the admin surface is not discoverable
 * (docs/api-security.md).
 */
import {
	type CanActivate,
	type ExecutionContext,
	Injectable,
	NotFoundException,
} from "@nestjs/common";
import { isAdminRole } from "@wandit/contracts";
import { env } from "@wandit/env/server";

import type { MaybeAuthenticatedRequest } from "../../../../auth";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

const ALLOWED_WRITE_ORIGINS = [env.ADMIN_ORIGIN, env.CORS_ORIGIN].filter(
	(origin): origin is string => Boolean(origin),
);

@Injectable()
export class AdminGuard implements CanActivate {
	canActivate(context: ExecutionContext): boolean {
		const request = context
			.switchToHttp()
			.getRequest<MaybeAuthenticatedRequest>();

		if (!isAdminRole(request.user?.role)) {
			throw new NotFoundException();
		}

		if (!SAFE_METHODS.has(request.method)) {
			this.assertSameSiteWrite(request);
		}

		return true;
	}

	/**
	 * CSRF defence for state-changing admin calls.
	 *
	 * Session cookies are SameSite=None in the https deploys (web/admin and API
	 * sit on different sites), so a browser attaches them to cross-site requests.
	 * Nest's FastifyAdapter always registers an `application/x-www-form-urlencoded`
	 * body parser, so a plain auto-submitting HTML form — no preflight, no CORS
	 * check — would otherwise reach these handlers carrying an admin's cookie.
	 * Such a form can never send a JSON content type and always sends `Origin`,
	 * so requiring both closes it while leaving the SPA and non-browser JSON
	 * callers (which send no `Origin`) working.
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

		if (origin !== undefined && !ALLOWED_WRITE_ORIGINS.includes(origin)) {
			throw new NotFoundException();
		}
	}
}
