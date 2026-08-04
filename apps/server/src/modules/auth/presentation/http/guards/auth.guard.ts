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
import type { Auth, AuthUser } from "@wandit/auth";
import { sql } from "@wandit/db";
import { Sentry } from "@wandit/observability/nestjs";

import {
	DATABASE,
	type Database,
} from "../../../../../infrastructure/database/database.constants";
import { toWebHeaders } from "../../../../../infrastructure/http/fastify-headers";
import { AUTH_INSTANCE } from "../../../auth.constants";
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
		// `@Inject(AUTH_INSTANCE)` means: "Nest, give me the Better Auth object
		// registered under this token." Reflector reads decorator flags.
		@Inject(AUTH_INSTANCE) private readonly auth: Auth,
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
		// Better Auth expects Web Headers, so convert Fastify headers first.
		const session = await this.auth.api.getSession({
			headers: toWebHeaders(request.headers),
		});

		if (!session) {
			// No session means HTTP 401.
			throw new UnauthorizedException();
		}

		// Banning only deletes the target's sessions once, so a session created in
		// that race window would otherwise authenticate forever. No cookie cache is
		// configured, so the user row above is read fresh on every request.
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
