import {
	Controller,
	Get,
	Inject,
	Logger,
	Param,
	Req,
	Res,
} from "@nestjs/common";
import { env } from "@wandit/env/server";
import type { FastifyReply, FastifyRequest } from "fastify";
import { buildUtmAttributionCookie } from "../../../../attribution/presentation/http/utm-attribution-cookie";
import { Public } from "../../../../auth";
import type { StoryLinkRedirectResult } from "../../../application/services/story-link-redirect.service";
import { StoryLinkRedirectService } from "../../../application/services/story-link-redirect.service";

@Public()
@Controller("v1/s")
export class StoryLinkRedirectController {
	private readonly logger = new Logger(StoryLinkRedirectController.name);

	constructor(
		@Inject(StoryLinkRedirectService)
		private readonly service: StoryLinkRedirectService,
	) {}

	@Get(":slug")
	async redirect(
		@Param("slug") slug: string,
		@Req() request: FastifyRequest,
		@Res() reply: FastifyReply,
	): Promise<void> {
		let result: StoryLinkRedirectResult;

		try {
			result = await this.service.resolve(slug, {
				ip: clientIp(request),
				userAgent: request.headers["user-agent"] ?? null,
			});
		} catch {
			// A campaign lookup or click-counter failure must never strand a visitor.
			result = {
				attributionToken: null,
				destination: new URL("/", env.CORS_ORIGIN).toString(),
			};
		}

		if (result.attributionToken) {
			try {
				reply.header(
					"set-cookie",
					buildUtmAttributionCookie(result.attributionToken),
				);
			} catch (error) {
				this.logger.warn(
					"Failed to set the story-link attribution cookie",
					error,
				);
			}
		}

		reply.header("Cache-Control", "no-store");
		reply.redirect(result.destination, 302);
	}
}

function clientIp(request: FastifyRequest): string {
	const forwarded = request.headers["x-forwarded-for"];
	const first = Array.isArray(forwarded) ? forwarded[0] : forwarded;
	const ip = first?.split(",")[0]?.trim();

	return ip || request.ip;
}
