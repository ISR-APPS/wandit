import {
	HttpException,
	HttpStatus,
	Inject,
	Injectable,
	NotFoundException,
} from "@nestjs/common";
import type {
	AffiliateClickBody,
	AffiliateClickResponse,
} from "@wandit/contracts";

import { AffiliatesRepository } from "../../infrastructure/persistence/affiliates.repository";
import { AffiliateClickThrottle } from "./affiliate-click-throttle";
import { AffiliateTokenService } from "./affiliate-token.service";

const DAY_SECONDS = 24 * 60 * 60;
const MAX_USER_AGENT_LENGTH = 1_024;

export type AffiliateClickResult = AffiliateClickResponse & {
	maxAgeSeconds: number;
};

@Injectable()
export class AffiliateClickService {
	constructor(
		@Inject(AffiliatesRepository)
		private readonly affiliatesRepository: AffiliatesRepository,
		@Inject(AffiliateClickThrottle)
		private readonly throttle: AffiliateClickThrottle,
		@Inject(AffiliateTokenService)
		private readonly tokenService: AffiliateTokenService,
	) {}

	async capture(
		body: AffiliateClickBody,
		request: { ip: string; userAgent: string | null },
		now = new Date(),
	): Promise<AffiliateClickResult> {
		if (!this.throttle.allow(request.ip, now.getTime())) {
			throw new HttpException(
				"Too many referral click requests",
				HttpStatus.TOO_MANY_REQUESTS,
			);
		}

		const link = await this.affiliatesRepository.findLinkTerms(body.code);

		if (
			!link?.active ||
			link.affiliateStatus !== "active" ||
			link.programStatus !== "active" ||
			(link.expiresAt !== null && link.expiresAt.getTime() <= now.getTime())
		) {
			throw new NotFoundException("Affiliate link not found");
		}

		const issuedAt = Math.floor(now.getTime() / 1_000);
		const token = this.tokenService.sign({
			issuedAt,
			linkCode: link.code,
		});
		const cookieWindowSeconds = link.cookieWindowDays * DAY_SECONDS;
		const expiryWindowSeconds = link.expiresAt
			? Math.floor((link.expiresAt.getTime() - now.getTime()) / 1_000)
			: cookieWindowSeconds;
		const maxAgeSeconds = Math.max(
			0,
			Math.min(cookieWindowSeconds, expiryWindowSeconds),
		);

		if (maxAgeSeconds <= 0) {
			throw new NotFoundException("Affiliate link not found");
		}

		await this.affiliatesRepository.insertClick({
			ipHash: this.tokenService.hashIp(request.ip),
			landingUrl: body.landingUrl,
			linkId: link.id,
			userAgent: request.userAgent?.slice(0, MAX_USER_AGENT_LENGTH) ?? null,
		});

		return {
			attributionToken: token,
			expiresAt: new Date(now.getTime() + maxAgeSeconds * 1_000).toISOString(),
			maxAgeSeconds,
		};
	}
}
