/**
 * Pure parts of the app AI video job: the signed job and billing tokens,
 * the upstream resolution fields of each model, and the settle of a finished video.
 * `AppAiVideoService` calls it. The tokens use the format and the keys of
 * the LLM proxy run token: `base64url(json).base64url(hmac-sha256)`.
 */
import { createHmac, timingSafeEqual } from "node:crypto";

import {
	APP_AI_VIDEO_CAPABILITIES,
	type AppAiVideoBillingClaims,
	type AppAiVideoJobClaims,
	type AppAiVideoModel,
	type AppAiVideoResolution,
	appAiVideoBillingClaimsSchema,
	appAiVideoJobClaimsSchema,
} from "@wandit/contracts";
import type { z } from "zod";

import type { DirectMeteringSettlement } from "../../metering/domain/metering";
import { usdMicrosToCentiCredits } from "../../metering/domain/model-pricing";

/**
 * Seconds a video token lives: 24 hours. The app polls a job for some
 * minutes; a later poll finds a hold that the 40 minute sweep refunded.
 */
export const APP_AI_VIDEO_TOKEN_TTL_SECONDS = 24 * 60 * 60;

// The Seedance size for each tier, from the Vercel docs. The `aspectRatio`
// field sets the orientation. 480p is sent as 864x480, the key of the
// tier map of @ai-sdk/bytedance; the output and the billed frame are 854x480.
const SEEDANCE_SIZES: Partial<
	Record<AppAiVideoResolution, `${number}x${number}`>
> = {
	"480p": "864x480",
	"720p": "1280x720",
	"1080p": "1920x1080",
};

// The MiniMax tier names (upper case, @ai-sdk/minimax). An unknown value
// runs at the default 768P, which costs more than 480P.
const MINIMAX_TIERS: Partial<Record<AppAiVideoResolution, "480P" | "768P">> = {
	"480p": "480P",
	"768p": "768P",
};

/**
 * The resolution fields of `experimental_startVideo` for one model. The
 * caller merges `providerOptions` with the gateway attribution.
 */
export type AppAiVideoUpstreamFields = {
	/** Top-level frame size, `WIDTHxHEIGHT`. Only Seedance takes it. */
	resolution?: `${number}x${number}`;
	/** Provider keys: the HeyGen or MiniMax tier, or the Seedance provider pin. */
	providerOptions:
		| { gateway: { only: string[] } }
		| { heygen: { resolution: AppAiVideoResolution } }
		| { minimax: { resolution: "480P" | "768P" } };
};

/**
 * Gives the upstream resolution fields of a model and a resolution. Each
 * provider reads the tier from another field, and a wrong field runs the
 * provider default tier at another price. Null for a pair the model refuses.
 */
export function appAiVideoUpstreamFields(
	model: AppAiVideoModel,
	resolution: AppAiVideoResolution,
): AppAiVideoUpstreamFields | null {
	if (!APP_AI_VIDEO_CAPABILITIES[model].resolutions.includes(resolution)) {
		return null;
	}
	switch (model) {
		case "bytedance/seedance-2.5":
		case "bytedance/seedance-2.5-flash": {
			const size = SEEDANCE_SIZES[resolution];
			// Money: the price is the bytedance token rate. The pin keeps the job
			// off the tencent endpoint. The docs prove `only` for text models only.
			return size === undefined
				? null
				: {
						resolution: size,
						providerOptions: { gateway: { only: ["bytedance"] } },
					};
		}
		case "heygen/heygen-video-1":
			// HeyGen throws on a top-level size outside its 16 frame sizes.
			return { providerOptions: { heygen: { resolution } } };
		case "minimax/minimax-h3-max": {
			const tier = MINIMAX_TIERS[resolution];
			return tier === undefined
				? null
				: { providerOptions: { minimax: { resolution: tier } } };
		}
	}
}

/**
 * Thrown for every token problem: malformed, bad signature, bad claims, a
 * wrong kind, or expired. One class keeps the token detail out of the answer.
 */
export class AppAiVideoTokenError extends Error {
	override readonly name = "AppAiVideoTokenError";
}

/** Claims of a new token; `mintAppAiVideoToken` adds `exp`. */
export type AppAiVideoTokenInput =
	| Omit<AppAiVideoJobClaims, "exp">
	| Omit<AppAiVideoBillingClaims, "exp">;

/**
 * Signs the claims with the first key of `LLM_PROXY_SIGNING_KEY`. The
 * other keys only verify, so a key rotation needs no downtime.
 */
export function mintAppAiVideoToken(
	claims: AppAiVideoTokenInput,
	keys: readonly [string, ...string[]],
	nowSeconds: number = Math.floor(Date.now() / 1000),
): string {
	const payload = {
		...claims,
		exp: nowSeconds + APP_AI_VIDEO_TOKEN_TTL_SECONDS,
	};
	const encoded = Buffer.from(JSON.stringify(payload), "utf8").toString(
		"base64url",
	);
	const signature = createHmac("sha256", keys[0])
		.update(encoded)
		.digest("base64url");
	return `${encoded}.${signature}`;
}

/**
 * Verifies the job token that the app sends to the status and content
 * routes. Throws `AppAiVideoTokenError` on any failure.
 */
export function verifyAppAiVideoJobToken(
	token: string,
	keys: readonly [string, ...string[]],
	nowSeconds: number = Math.floor(Date.now() / 1000),
): AppAiVideoJobClaims {
	return verifySignedClaims(token, appAiVideoJobClaimsSchema, keys, nowSeconds);
}

/**
 * Verifies the billing token of the webhook URL. Throws
 * `AppAiVideoTokenError` on any failure.
 */
export function verifyAppAiVideoBillingToken(
	token: string,
	keys: readonly [string, ...string[]],
	nowSeconds: number = Math.floor(Date.now() / 1000),
): AppAiVideoBillingClaims {
	return verifySignedClaims(
		token,
		appAiVideoBillingClaimsSchema,
		keys,
		nowSeconds,
	);
}

/**
 * The settle of a finished video, built only from the signed claims. The
 * status, content, and webhook routes build the same values. Thus a second
 * settle is an idempotent replay. The caller adds `provider`.
 */
export function appAiVideoSettlement(
	claims: AppAiVideoJobClaims | AppAiVideoBillingClaims,
): DirectMeteringSettlement {
	return {
		costUsdMicros: claims.costUsdMicros,
		// The credit anchor of the quote, so a config change during the job
		// does not change the price.
		finalCredits: usdMicrosToCentiCredits(
			claims.costUsdMicros,
			claims.usdMicrosPerCredit,
		),
		model: claims.model,
		pricing: "direct",
		pricingSnapshot: {
			audio: claims.audio,
			costUsdMicros: claims.costUsdMicros,
			mode: "measured",
			modelId: claims.model,
			operation: "app_ai_gateway",
			reservedUnits: claims.seconds,
			resolution: claims.resolution,
			unit: "second",
			units: claims.seconds,
			unitUsdMicros: claims.usdMicrosPerSecond,
			usdMicrosPerCredit: claims.usdMicrosPerCredit,
		},
	};
}

function verifySignedClaims<Claims extends { exp: number }>(
	token: string,
	schema: z.ZodType<Claims>,
	keys: readonly [string, ...string[]],
	nowSeconds: number,
): Claims {
	// base64url never contains ".", so exactly one dot means well formed.
	const dot = token.indexOf(".");
	if (dot <= 0 || token.indexOf(".", dot + 1) !== -1) {
		throw new AppAiVideoTokenError("Malformed video token");
	}
	const payloadPart = token.slice(0, dot);
	const given = Buffer.from(token.slice(dot + 1), "utf8");
	// Security: a constant-time compare of the signature text for each key.
	// A base64url decode ignores bad characters and spare bits, so many
	// strings would pass as one token. The length check keeps timingSafeEqual
	// from a throw on a malformed signature.
	const signed = keys.some((key) => {
		const expected = Buffer.from(
			createHmac("sha256", key).update(payloadPart).digest("base64url"),
			"utf8",
		);
		return expected.length === given.length && timingSafeEqual(expected, given);
	});
	if (!signed) {
		throw new AppAiVideoTokenError("Bad video token signature");
	}

	let json: unknown;
	try {
		json = JSON.parse(Buffer.from(payloadPart, "base64url").toString("utf8"));
	} catch {
		// The signature is good, so only a key holder made this payload.
		throw new AppAiVideoTokenError("Unreadable video token payload");
	}
	// Security: the literal `kind` refuses a run token, or the other video
	// token kind, that the same key signed.
	const parsed = schema.safeParse(json);
	if (!parsed.success) {
		throw new AppAiVideoTokenError("Invalid video token claims");
	}
	if (parsed.data.exp <= nowSeconds) {
		throw new AppAiVideoTokenError("Video token expired");
	}
	return parsed.data;
}
