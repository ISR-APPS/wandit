/**
 * The public lead capture endpoint — the first route in the /api/public
 * namespace. No auth, no cookies, addressed by the project's unguessable
 * publicFormId; published pages post here cross-origin without credentials.
 */
import {
	Body,
	Controller,
	HttpCode,
	Inject,
	Param,
	Post,
	Req,
	Res,
} from "@nestjs/common";
import { type LeadCaptureResponse, uuidSchema } from "@wandit/contracts";
import type { FastifyReply, FastifyRequest } from "fastify";

import { ZodValidationPipe } from "../../../../../infrastructure/http/zod-validation.pipe";
import { Public } from "../../../../auth";
import {
	LeadsCaptureRateLimitException,
	LeadsCaptureService,
} from "../../../application/services/leads-capture.service";

@Public()
@Controller("public/leads")
export class LeadsCaptureController {
	constructor(
		@Inject(LeadsCaptureService)
		private readonly leadsCaptureService: LeadsCaptureService,
	) {}

	// 200 (not 201) on purpose: success, honeypot discard, and duplicate drop
	// must be indistinguishable to the caller.
	@Post(":publicFormId")
	@HttpCode(200)
	async capture(
		@Param("publicFormId", new ZodValidationPipe(uuidSchema))
		publicFormId: string,
		@Body() body: unknown,
		@Req() request: FastifyRequest,
		@Res({ passthrough: true }) reply: FastifyReply,
	): Promise<LeadCaptureResponse> {
		try {
			return await this.leadsCaptureService.capture(
				publicFormId,
				body,
				clientIp(request),
			);
		} catch (error) {
			if (error instanceof LeadsCaptureRateLimitException) {
				reply.header("Retry-After", String(error.retryAfterSeconds));
			}
			throw error;
		}
	}
}

// Behind the production proxy the socket address is the proxy itself; the
// first x-forwarded-for hop is the real client. Spoofable in theory, but this
// only keys the rate limiter — never auth.
function clientIp(request: FastifyRequest): string {
	const forwarded = request.headers["x-forwarded-for"];
	const first = Array.isArray(forwarded) ? forwarded[0] : forwarded;
	const ip = first?.split(",")[0]?.trim();

	return ip || request.ip;
}
