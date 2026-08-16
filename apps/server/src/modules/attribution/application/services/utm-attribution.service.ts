import { Inject, Injectable, Logger } from "@nestjs/common";
import { UTM_ATTRIBUTION_COOKIE_NAME } from "@wandit/contracts";
import type { GenericEndpointContext, User } from "better-auth";

import { classifyDeviceFromUserAgent } from "../../../../infrastructure/http/device-class";
import { readRequestCountryCode } from "../../../../infrastructure/http/request-country-code";
import {
	UserAttributionRepository,
	type UserAttributionRow,
} from "../../infrastructure/persistence/user-attribution.repository";
import { UtmAttributionTokenService } from "./utm-attribution-token.service";

@Injectable()
export class UtmAttributionService {
	private readonly logger = new Logger(UtmAttributionService.name);

	constructor(
		@Inject(UserAttributionRepository)
		private readonly repository: UserAttributionRepository,
		@Inject(UtmAttributionTokenService)
		private readonly tokenService: UtmAttributionTokenService,
	) {}

	async lockForCreatedUser(
		newUser: Pick<User, "id">,
		ctx: GenericEndpointContext | null,
		now = new Date(),
	): Promise<UserAttributionRow | null> {
		try {
			const token = ctx?.getCookie(UTM_ATTRIBUTION_COOKIE_NAME);

			if (!token) {
				return null;
			}

			const payload = this.tokenService.verify(token, now);

			if (!payload) {
				return null;
			}

			return await this.repository.insertFirstWins({
				country: readRequestCountryCode(ctx?.headers),
				device: classifyDeviceFromUserAgent(ctx?.headers?.get("user-agent")),
				landingPath: payload.landingPath ?? null,
				referrer: payload.referrer ?? null,
				source: "cookie",
				storyLinkSlug: payload.storyLinkSlug ?? null,
				userId: newUser.id,
				utmCampaign: payload.utmCampaign ?? null,
				utmContent: payload.utmContent ?? null,
				utmMedium: payload.utmMedium ?? null,
				utmSource: payload.utmSource ?? null,
			});
		} catch (error) {
			this.logger.warn(
				`Failed to lock UTM attribution for user ${newUser.id}`,
				error,
			);
			return null;
		}
	}
}
