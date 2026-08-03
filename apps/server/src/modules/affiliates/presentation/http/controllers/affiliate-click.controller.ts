import {
	Body,
	Controller,
	HttpCode,
	Inject,
	Post,
	Req,
	Res,
} from "@nestjs/common";
import {
	AFFILIATE_ATTRIBUTION_COOKIE_NAME,
	type AffiliateClickBody,
	type AffiliateClickResponse,
	affiliateClickBodySchema,
} from "@wandit/contracts";
import { env } from "@wandit/env/server";
import type { FastifyReply, FastifyRequest } from "fastify";

import { ZodValidationPipe } from "../../../../../infrastructure/http/zod-validation.pipe";
import { Public } from "../../../../auth";
import { AffiliateClickService } from "../../../application/services/affiliate-click.service";

@Public()
@Controller("v1/affiliates")
export class AffiliateClickController {
	constructor(
		@Inject(AffiliateClickService)
		private readonly affiliateClickService: AffiliateClickService,
	) {}

	@Post("click")
	@HttpCode(200)
	async click(
		@Body(new ZodValidationPipe(affiliateClickBodySchema))
		body: AffiliateClickBody,
		@Req() request: FastifyRequest,
		@Res({ passthrough: true }) reply: FastifyReply,
	): Promise<AffiliateClickResponse> {
		const result = await this.affiliateClickService.capture(body, {
			ip: clientIp(request),
			userAgent: request.headers["user-agent"] ?? null,
		});
		const crossSiteCookies = env.BETTER_AUTH_URL.startsWith("https://");
		const attributes = [
			`${AFFILIATE_ATTRIBUTION_COOKIE_NAME}=${encodeURIComponent(result.attributionToken)}`,
			`Max-Age=${result.maxAgeSeconds}`,
			"Path=/",
			"HttpOnly",
			crossSiteCookies ? "SameSite=None" : "SameSite=Lax",
			...(crossSiteCookies ? ["Secure"] : []),
		];

		reply.header("set-cookie", attributes.join("; "));

		return {
			attributionToken: result.attributionToken,
			expiresAt: result.expiresAt,
		};
	}
}

function clientIp(request: FastifyRequest): string {
	const forwarded = request.headers["x-forwarded-for"];
	const first = Array.isArray(forwarded) ? forwarded[0] : forwarded;
	const ip = first?.split(",")[0]?.trim();

	return ip || request.ip;
}
