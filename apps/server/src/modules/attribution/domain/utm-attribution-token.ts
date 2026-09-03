import { createHmac, timingSafeEqual } from "node:crypto";

const TOKEN_VERSION = "v1";
const TOKEN_SIGNING_CONTEXT = "wandit/utm-attribution-token/v1";
const STORY_LINK_SLUG_PATTERN = /^[a-z0-9][a-z0-9-]{1,63}$/;
const LANDING_PATH_PATTERN = /^\/(?!\/)/;
const ALLOWED_KEYS = new Set([
	"issuedAt",
	"landingPath",
	"referrer",
	"storyLinkSlug",
	"utmCampaign",
	"utmContent",
	"utmMedium",
	"utmSource",
]);

export const UTM_ATTRIBUTION_WINDOW_SECONDS = 30 * 24 * 60 * 60;

export type UtmAttributionTokenPayload = {
	issuedAt: number;
	landingPath?: string;
	referrer?: string;
	storyLinkSlug?: string;
	utmCampaign?: string;
	utmContent?: string;
	utmMedium?: string;
	utmSource?: string;
};

/** Compact authenticated token for last-touch UTM attribution. */
export class UtmAttributionTokenCodec {
	private readonly signingKey: Buffer;

	constructor(secret: string) {
		if (secret.length < 32) {
			throw new Error(
				"UTM attribution token secret must be at least 32 characters",
			);
		}

		this.signingKey = createHmac("sha256", secret)
			.update(TOKEN_SIGNING_CONTEXT)
			.digest();
	}

	sign(payload: UtmAttributionTokenPayload): string {
		assertPayload(payload);

		const encodedPayload = Buffer.from(
			JSON.stringify(payload),
			"utf8",
		).toString("base64url");
		const authenticated = `${TOKEN_VERSION}.${encodedPayload}`;
		const signature = createHmac("sha256", this.signingKey)
			.update(authenticated)
			.digest("base64url");

		return `${authenticated}.${signature}`;
	}

	verify(token: string): UtmAttributionTokenPayload | null {
		const parts = token.split(".");

		if (parts.length !== 3 || parts[0] !== TOKEN_VERSION) {
			return null;
		}

		const [, encodedPayload, suppliedSignature] = parts;

		if (!encodedPayload || !suppliedSignature) {
			return null;
		}

		const authenticated = `${TOKEN_VERSION}.${encodedPayload}`;
		const expectedSignature = createHmac("sha256", this.signingKey)
			.update(authenticated)
			.digest();
		let supplied: Buffer;

		try {
			supplied = Buffer.from(suppliedSignature, "base64url");
		} catch {
			return null;
		}

		if (
			supplied.length !== expectedSignature.length ||
			!timingSafeEqual(supplied, expectedSignature)
		) {
			return null;
		}

		try {
			const candidate: unknown = JSON.parse(
				Buffer.from(encodedPayload, "base64url").toString("utf8"),
			);

			return isPayload(candidate) ? candidate : null;
		} catch {
			return null;
		}
	}
}

function isPayload(value: unknown): value is UtmAttributionTokenPayload {
	if (!value || typeof value !== "object" || Array.isArray(value)) {
		return false;
	}

	const record = value as Record<string, unknown>;

	if (
		Object.keys(record).some((key) => !ALLOWED_KEYS.has(key)) ||
		!Number.isSafeInteger(record.issuedAt) ||
		(record.issuedAt as number) <= 0 ||
		!optionalString(record.utmSource, 200) ||
		!optionalString(record.utmMedium, 200) ||
		!optionalString(record.utmCampaign, 200) ||
		!optionalString(record.utmContent, 500) ||
		!optionalString(record.referrer, 2_048) ||
		!optionalLandingPath(record.landingPath) ||
		!optionalStoryLinkSlug(record.storyLinkSlug)
	) {
		return false;
	}

	return (
		record.utmSource !== undefined ||
		record.referrer !== undefined ||
		record.storyLinkSlug !== undefined
	);
}

function optionalString(value: unknown, maxLength: number): boolean {
	return (
		value === undefined ||
		(typeof value === "string" &&
			value.trim().length > 0 &&
			value.length <= maxLength)
	);
}

function optionalLandingPath(value: unknown): boolean {
	return (
		value === undefined ||
		(typeof value === "string" &&
			value.length <= 2_048 &&
			LANDING_PATH_PATTERN.test(value))
	);
}

function optionalStoryLinkSlug(value: unknown): boolean {
	return (
		value === undefined ||
		(typeof value === "string" && STORY_LINK_SLUG_PATTERN.test(value))
	);
}

function assertPayload(
	payload: UtmAttributionTokenPayload,
): asserts payload is UtmAttributionTokenPayload {
	if (!isPayload(payload)) {
		throw new Error("Invalid UTM attribution token payload");
	}
}
