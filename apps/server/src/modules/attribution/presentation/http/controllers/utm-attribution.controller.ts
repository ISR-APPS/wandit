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
	UTM_ATTRIBUTION_COOKIE_NAME,
	type UtmAttributionBody,
	utmAttributionBodySchema,
} from "@wandit/contracts";
import type { FastifyReply, FastifyRequest } from "fastify";

import { ZodValidationPipe } from "../../../../../infrastructure/http/zod-validation.pipe";
import { Public } from "../../../../auth";
import { UtmAttributionThrottle } from "../../../application/services/utm-attribution-throttle";
import { UtmAttributionTokenService } from "../../../application/services/utm-attribution-token.service";
import type { UtmAttributionTokenPayload } from "../../../domain/utm-attribution-token";
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

			const storyLinkSlug = this.storyLinkSlugForRecapture(body, request);
			const token = this.tokenService.sign({
				...body,
				...(storyLinkSlug ? { storyLinkSlug } : {}),
				issuedAt: Math.floor(Date.now() / 1_000),
			});

			reply.header("set-cookie", buildUtmAttributionCookie(token));
		} catch (error) {
			this.logger.warn("Failed to capture UTM attribution", error);
		}
	}

	private storyLinkSlugForRecapture(
		body: UtmAttributionBody,
		request: FastifyRequest,
	): string | undefined {
		const existingToken = requestCookie(request, UTM_ATTRIBUTION_COOKIE_NAME);

		if (!existingToken) {
			return undefined;
		}

		let existingPayload: UtmAttributionTokenPayload | null;
		try {
			existingPayload = this.tokenService.verify(existingToken);
		} catch {
			return undefined;
		}

		// Landing-page UTM recapture used to overwrite the story-link cookie and
		// wipe its slug. Carry it forward only when this is the same campaign visit.
		if (
			!existingPayload?.storyLinkSlug ||
			existingPayload.utmSource !== body.utmSource ||
			existingPayload.utmMedium !== body.utmMedium ||
			existingPayload.utmCampaign !== body.utmCampaign ||
			!nullableUtmValuesMatch(existingPayload.utmContent, body.utmContent)
		) {
			return undefined;
		}

		return existingPayload.storyLinkSlug;
	}
}

function clientIp(request: FastifyRequest): string {
	const forwarded = request.headers["x-forwarded-for"];
	const first = Array.isArray(forwarded) ? forwarded[0] : forwarded;
	const ip = first?.split(",")[0]?.trim();

	return ip || request.ip;
}

function requestCookie(
	request: FastifyRequest,
	name: string,
): string | undefined {
	const cookieHeader = request.headers.cookie;

	if (!cookieHeader) {
		return undefined;
	}

	for (const cookie of cookieHeader.split(";")) {
		const separatorIndex = cookie.indexOf("=");

		if (separatorIndex < 0 || cookie.slice(0, separatorIndex).trim() !== name) {
			continue;
		}

		const encodedValue = cookie.slice(separatorIndex + 1).trim();
		if (!encodedValue) {
			return undefined;
		}

		try {
			return decodeURIComponent(encodedValue);
		} catch {
			return undefined;
		}
	}

	return undefined;
}

function nullableUtmValuesMatch(
	left: string | null | undefined,
	right: string | null | undefined,
): boolean {
	return (left ?? null) === (right ?? null);
}
