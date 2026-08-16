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
	Logger,
	UnauthorizedException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { AdminAuth, Auth, AuthUser } from "@wandit/auth";
import { sql } from "@wandit/db";
import { Sentry } from "@wandit/observability/nestjs";

import {
	DATABASE,
	type Database,
} from "../../../../../infrastructure/database/database.constants";
import { toWebHeaders } from "../../../../../infrastructure/http/fastify-headers";
import {
	ADMIN_AUTH_INSTANCE,
	ADMIN_AUTH_SURFACE,
	AUTH_INSTANCE,
	AUTH_SURFACE_KEY,
} from "../../../auth.constants";
import { IS_PUBLIC_KEY } from "../decorators/public.decorator";
import type { MaybeAuthenticatedRequest } from "../types/authenticated-request";

// How stale `user.last_seen_at` may get before the next request refreshes it.
const LAST_SEEN_THROTTLE_MINUTES = 5;

// `@Injectable()` lets Nest create this class and pass its dependencies into the
// constructor. A guard returns true to continue or throws to stop the request.
@Injectable()
export class AuthGuard implements CanActivate {
	private readonly logger = new Logger(AuthGuard.name);

	constructor(
		// Injection tokens keep the two Better Auth instances explicit. Reflector
		// selects exactly one from route metadata before any cookie is parsed.
		@Inject(AUTH_INSTANCE) private readonly auth: Auth,
		@Inject(ADMIN_AUTH_INSTANCE) private readonly adminAuth: AdminAuth,
		@Inject(Reflector)
		private readonly reflector: Reflector,
		@Inject(DATABASE) private readonly db: Database,
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
		// Both cookies coexist on the API host. Route metadata — never fallback
		// ordering — decides which Better Auth instance may authenticate them.
		const surface = this.reflector.getAllAndOverride<string>(AUTH_SURFACE_KEY, [
			context.getHandler(),
			context.getClass(),
		]);
		const auth = surface === ADMIN_AUTH_SURFACE ? this.adminAuth : this.auth;

		// Better Auth expects Web Headers, so convert Fastify headers first.
		const session = await auth.api.getSession({
			headers: toWebHeaders(request.headers),
		});

		if (!session) {
			// No session means HTTP 401.
			throw new UnauthorizedException();
		}

		// A newly applied ban can remain in the signed session cache for at most its
		// five-minute lifetime. After that, Better Auth reads the Postgres session
		// row again; the admin ban flow deletes those rows to enforce revocation.
		if (isBanActive(session.user)) {
			throw new UnauthorizedException();
		}

		this.touchLastSeen(session.user.id);

		// Attribute every Sentry capture on this request to the signed-in user.
		// The SDK's request isolation scopes this per request — no leakage.
		Sentry.setUser({ id: session.user.id, email: session.user.email });

		// Save the logged-in identity on the request for later code.
		request.session = session.session;
		request.user = session.user;

		return true;
	}

	/**
	 * Refresh the durable activity stamp the admin dashboard reads.
	 *
	 * Fire-and-forget on purpose: never block the request, and never fail it if
	 * the write does. Raw SQL rather than the drizzle update builder because the
	 * builder would also fire the user table's `$onUpdate` and bump `updated_at`
	 * on every heartbeat.
	 */
	private touchLastSeen(userId: string): void {
		void this.db
			.execute(
				sql`
					update "user"
					set "last_seen_at" = now()
					where "id" = ${userId}
						and (
							"last_seen_at" is null
							or "last_seen_at" < now() - make_interval(mins => ${LAST_SEEN_THROTTLE_MINUTES})
						)
				`,
			)
			.catch((error: unknown) => {
				this.logger.warn(`Failed to refresh last_seen_at for ${userId}`, error);
			});
	}
}

function isBanActive(user: AuthUser): boolean {
	if (!user.banned) {
		return false;
	}

	return !user.banExpires || new Date(user.banExpires).getTime() > Date.now();
}
