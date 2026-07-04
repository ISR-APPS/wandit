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

@Injectable()
export class AuthGuard implements CanActivate {
	constructor(
		@Inject(AUTH_INSTANCE) private readonly auth: Auth,
		@Inject(Reflector)
		private readonly reflector: Reflector,
	) {}

	async canActivate(context: ExecutionContext) {
		const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
			context.getHandler(),
			context.getClass(),
		]);

		if (isPublic) {
			return true;
		}

		const request = context
			.switchToHttp()
			.getRequest<MaybeAuthenticatedRequest>();
		const session = await this.auth.api.getSession({
			headers: toWebHeaders(request.headers),
		});

		if (!session) {
			throw new UnauthorizedException();
		}

		request.session = session.session;
		request.user = session.user;

		return true;
	}
}
