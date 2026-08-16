import { Inject, Injectable, Logger } from "@nestjs/common";
import { env } from "@wandit/env/server";

import { AffiliateTokenService } from "../../../affiliates/application/services/affiliate-token.service";
import { UtmAttributionTokenService } from "../../../attribution/application/services/utm-attribution-token.service";
import {
	StoryLinkClickRepository,
	type StoryLinkRedirectTerms,
} from "../../infrastructure/persistence/story-link-click.repository";
import { StoryLinkClickThrottle } from "./story-link-click-throttle";

const MAX_USER_AGENT_LENGTH = 1_024;
const STORY_LINK_SLUG_PATTERN = /^[a-z0-9][a-z0-9-]{1,63}$/;

export type StoryLinkRedirectRequest = {
	ip: string;
	userAgent: string | null;
};

export type StoryLinkRedirectResult = {
	attributionToken: string | null;
	destination: string;
};

@Injectable()
export class StoryLinkRedirectService {
	private readonly logger = new Logger(StoryLinkRedirectService.name);

	constructor(
		@Inject(StoryLinkClickRepository)
		private readonly storyLinkClickRepository: StoryLinkClickRepository,
		@Inject(StoryLinkClickThrottle)
		private readonly throttle: StoryLinkClickThrottle,
		@Inject(AffiliateTokenService)
		private readonly affiliateTokenService: AffiliateTokenService,
		@Inject(UtmAttributionTokenService)
		private readonly utmAttributionTokenService: UtmAttributionTokenService,
	) {}

	async resolve(
		slug: string,
		request: StoryLinkRedirectRequest,
		now = new Date(),
	): Promise<StoryLinkRedirectResult> {
		const webRoot = new URL("/", env.CORS_ORIGIN);
		const normalizedSlug = slug.toLowerCase();

		if (!STORY_LINK_SLUG_PATTERN.test(normalizedSlug)) {
			return fallback(webRoot);
		}

		let link: StoryLinkRedirectTerms | null;
		try {
			link = await this.storyLinkClickRepository.findBySlug(normalizedSlug);
		} catch {
			return fallback(webRoot);
		}

		if (!link || link.archivedAt !== null) {
			return fallback(webRoot);
		}

		const destination = new URL(link.destinationPath, webRoot);
		if (destination.origin !== webRoot.origin) {
			return fallback(webRoot);
		}

		destination.searchParams.set("utm_source", link.utmSource);
		destination.searchParams.set("utm_medium", link.utmMedium);
		destination.searchParams.set("utm_campaign", link.utmCampaign);
		if (link.utmContent !== null) {
			destination.searchParams.set("utm_content", link.utmContent);
		} else {
			destination.searchParams.delete("utm_content");
		}

		try {
			if (this.throttle.allow(request.ip, now.getTime())) {
				await this.storyLinkClickRepository.insertClick({
					ipHash: this.affiliateTokenService.hashIp(request.ip),
					storyLinkId: link.id,
					userAgent: request.userAgent?.slice(0, MAX_USER_AGENT_LENGTH) ?? null,
				});
			}
		} catch {
			// Click analytics are best-effort and must never block a visitor.
		}

		let attributionToken: string | null = null;

		try {
			attributionToken = this.utmAttributionTokenService.sign({
				issuedAt: Math.floor(now.getTime() / 1_000),
				landingPath: link.destinationPath,
				storyLinkSlug: normalizedSlug,
				utmCampaign: link.utmCampaign,
				utmContent: link.utmContent ?? undefined,
				utmMedium: link.utmMedium,
				utmSource: link.utmSource,
			});
		} catch (error) {
			this.logger.warn(
				`Failed to sign UTM attribution for story link ${normalizedSlug}`,
				error,
			);
		}

		return { attributionToken, destination: destination.toString() };
	}
}

function fallback(webRoot: URL): StoryLinkRedirectResult {
	return { attributionToken: null, destination: webRoot.toString() };
}
