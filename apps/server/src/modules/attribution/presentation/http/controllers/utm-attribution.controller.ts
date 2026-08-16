import {
	Body,
	Controller,
	HttpCode,
	Inject,
	Logger,
	Post,
	Req,
	Res,
} from "@nestjs/common";
import {
	type UtmAttributionBody,
	utmAttributionBodySchema,
} from "@wandit/contracts";
import type { FastifyReply, FastifyRequest } from "fastify";

import { ZodValidationPipe } from "../../../../../infrastructure/http/zod-validation.pipe";
import { Public } from "../../../../auth";
import { UtmAttributionThrottle } from "../../../application/services/utm-attribution-throttle";
import { UtmAttributionTokenService } from "../../../application/services/utm-attribution-token.service";
import { buildUtmAttributionCookie } from "../utm-attribution-cookie";

@Public()
@Controller("v1/attribution")
export class UtmAttributionController {
	private readonly logger = new Logger(UtmAttributionController.name);

	constructor(
		@Inject(UtmAttributionThrottle)
		private readonly throttle: UtmAttributionThrottle,
		@Inject(UtmAttributionTokenService)
		private readonly tokenService: UtmAttributionTokenService,
	) {}

	@Post("utm")
	@HttpCode(204)
	capture(
		@Body(new ZodValidationPipe(utmAttributionBodySchema))
		body: UtmAttributionBody,
		@Req() request: FastifyRequest,
		@Res({ passthrough: true }) reply: FastifyReply,
	): void {
		try {
			if (!this.throttle.allow(clientIp(request))) {
				return;
			}

			const token = this.tokenService.sign({
				...body,
				issuedAt: Math.floor(Date.now() / 1_000),
			});

			reply.header("set-cookie", buildUtmAttributionCookie(token));
		} catch (error) {
			this.logger.warn("Failed to capture UTM attribution", error);
		}
	}
}

function clientIp(request: FastifyRequest): string {
	const forwarded = request.headers["x-forwarded-for"];
	const first = Array.isArray(forwarded) ? forwarded[0] : forwarded;
	const ip = first?.split(",")[0]?.trim();

	return ip || request.ip;
}
