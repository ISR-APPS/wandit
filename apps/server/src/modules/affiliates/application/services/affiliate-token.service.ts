import { Injectable } from "@nestjs/common";
import { env } from "@wandit/env/server";

import {
	type AffiliateAttributionTokenPayload,
	AffiliateTokenCodec,
} from "../../domain/affiliate-token";

@Injectable()
export class AffiliateTokenService {
	private readonly codec = new AffiliateTokenCodec(env.BETTER_AUTH_SECRET);

	hashIp(ip: string): string {
		return this.codec.hashIp(ip);
	}

	sign(payload: AffiliateAttributionTokenPayload): string {
		return this.codec.sign(payload);
	}

	verify(token: string): AffiliateAttributionTokenPayload | null {
		return this.codec.verify(token);
	}
}
