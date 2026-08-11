import { All, Controller, Inject, Logger, Req, Res } from "@nestjs/common";
import type { AdminAuth } from "@wandit/auth";
import type { FastifyReply, FastifyRequest } from "fastify";

import { ADMIN_AUTH_INSTANCE } from "../../../auth.constants";
import { Public } from "../decorators/public.decorator";
import { forwardBetterAuthRequest } from "./better-auth-request-forwarder";

@Public()
@Controller("admin-auth")
export class AdminAuthController {
	private readonly logger = new Logger(AdminAuthController.name);

	constructor(
		@Inject(ADMIN_AUTH_INSTANCE) private readonly adminAuth: AdminAuth,
	) {}

	@All()
	async handleAuthRoot(
		@Req() request: FastifyRequest,
		@Res() reply: FastifyReply,
	) {
		await forwardBetterAuthRequest(this.adminAuth, request, reply, this.logger);
	}

	@All("*")
	async handleAuthPath(
		@Req() request: FastifyRequest,
		@Res() reply: FastifyReply,
	) {
		await forwardBetterAuthRequest(this.adminAuth, request, reply, this.logger);
	}
}
