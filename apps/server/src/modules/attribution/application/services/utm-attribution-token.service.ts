import { Injectable } from "@nestjs/common";
import { env } from "@wandit/env/server";

import {
	UTM_ATTRIBUTION_WINDOW_SECONDS,
	UtmAttributionTokenCodec,
	type UtmAttributionTokenPayload,
} from "../../domain/utm-attribution-token";

@Injectable()
export class UtmAttributionTokenService {
	private readonly codec = new UtmAttributionTokenCodec(env.BETTER_AUTH_SECRET);

	sign(payload: UtmAttributionTokenPayload): string {
		return this.codec.sign(payload);
	}

	verify(token: string, now = new Date()): UtmAttributionTokenPayload | null {
		const payload = this.codec.verify(token);

		if (!payload) {
			return null;
		}

		const nowSeconds = Math.floor(now.getTime() / 1_000);
		const ageSeconds = nowSeconds - payload.issuedAt;

		if (ageSeconds < 0 || ageSeconds >= UTM_ATTRIBUTION_WINDOW_SECONDS) {
			return null;
		}

		return payload;
	}
}
