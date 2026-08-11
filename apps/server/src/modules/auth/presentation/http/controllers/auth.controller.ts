import { All, Controller, Inject, Logger, Req, Res } from "@nestjs/common";
import type { Auth } from "@wandit/auth";
import type { FastifyReply, FastifyRequest } from "fastify";

import { AUTH_INSTANCE } from "../../../auth.constants";
import { Public } from "../decorators/public.decorator";
import { forwardBetterAuthRequest } from "./better-auth-request-forwarder";

@Public()
@Controller("auth")
export class AuthController {
	private readonly logger = new Logger(AuthController.name);

	constructor(@Inject(AUTH_INSTANCE) private readonly auth: Auth) {}

	@All()
	async handleAuthRoot(
		@Req() request: FastifyRequest,
		@Res() reply: FastifyReply,
	) {
		await forwardBetterAuthRequest(this.auth, request, reply, this.logger);
	}

	@All("*")
	async handleAuthPath(
		@Req() request: FastifyRequest,
		@Res() reply: FastifyReply,
	) {
		await forwardBetterAuthRequest(this.auth, request, reply, this.logger);
	}
}
