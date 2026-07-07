/**
 * Checks if the request is logged in.
 *
 * Express version: this is like auth middleware that runs before routes.
 * Nest version: a "guard" decides if a controller method is allowed to run.
 *
 * If login is valid, this guard puts `request.user` and `request.session` on the
 * request so controllers can use `@CurrentUser()`.
 */
import {
	type CanActivate,
	type ExecutionContext,
	Inject,
	Injectable,
	UnauthorizedException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { Auth } from "@wandit/auth";

import { toWebHeaders } from "../../../../../infrastructure/http/fastify-headers";
import { AUTH_INSTANCE } from "../../../auth.constants";
import { IS_PUBLIC_KEY } from "../decorators/public.decorator";
import type { MaybeAuthenticatedRequest } from "../types/authenticated-request";

// `@Injectable()` lets Nest create this class and pass its dependencies into the
// constructor. A guard returns true to continue or throws to stop the request.
@Injectable()
export class AuthGuard implements CanActivate {
	constructor(
		// `@Inject(AUTH_INSTANCE)` means: "Nest, give me the Better Auth object
		// registered under this token." Reflector reads decorator flags.
		@Inject(AUTH_INSTANCE) private readonly auth: Auth,
		@Inject(Reflector)
		private readonly reflector: Reflector,
	) {}

	// Nest runs this before the controller method.
	async canActivate(context: ExecutionContext) {
		// `@Public()` sets a flag. If the flag exists, skip login checks.
		const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
			context.getHandler(),
			context.getClass(),
		]);

		if (isPublic) {
			return true;
		}

		// Get the real Fastify request object.
		const request = context
			.switchToHttp()
			.getRequest<MaybeAuthenticatedRequest>();
		// Better Auth expects Web Headers, so convert Fastify headers first.
		const session = await this.auth.api.getSession({
			headers: toWebHeaders(request.headers),
		});

		if (!session) {
			// No session means HTTP 401.
			throw new UnauthorizedException();
		}

		// Save the logged-in identity on the request for later code.
		request.session = session.session;
		request.user = session.user;

		return true;
	}
}
