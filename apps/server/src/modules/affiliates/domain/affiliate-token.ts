import { createHmac, timingSafeEqual } from "node:crypto";

const TOKEN_VERSION = "v1";
const TOKEN_SIGNING_CONTEXT = "wandit/affiliate-attribution-token/v1";
const IP_HASH_CONTEXT = "wandit/affiliate-click-ip/v1";
const LINK_CODE_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]{5,127}$/;

export type AffiliateAttributionTokenPayload = {
	issuedAt: number;
	linkCode: string;
};

/**
 * Compact, authenticated referral token codec.
 *
 * The token is deliberately not encrypted: the code and server timestamp are
 * not secrets. HMAC authentication is what prevents a browser from inventing
 * or changing either field. Purpose-derived keys keep click-IP hashes and
 * attribution tokens cryptographically separate even though both ultimately
 * derive from BETTER_AUTH_SECRET.
 */
export class AffiliateTokenCodec {
	private readonly ipHashKey: Buffer;
	private readonly signingKey: Buffer;

	constructor(secret: string) {
		if (secret.length < 32) {
			throw new Error("Affiliate token secret must be at least 32 characters");
		}

		this.signingKey = deriveKey(secret, TOKEN_SIGNING_CONTEXT);
		this.ipHashKey = deriveKey(secret, IP_HASH_CONTEXT);
	}

	sign(payload: AffiliateAttributionTokenPayload): string {
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

	verify(token: string): AffiliateAttributionTokenPayload | null {
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

			if (!isPayload(candidate)) {
				return null;
			}

			return candidate;
		} catch {
			return null;
		}
	}

	hashIp(ip: string): string {
		return createHmac("sha256", this.ipHashKey)
			.update(ip.trim().toLowerCase())
			.digest("hex");
	}
}

function deriveKey(secret: string, context: string): Buffer {
	return createHmac("sha256", secret).update(context).digest();
}

function isPayload(value: unknown): value is AffiliateAttributionTokenPayload {
	if (!value || typeof value !== "object" || Array.isArray(value)) {
		return false;
	}

	const record = value as Record<string, unknown>;

	return (
		Object.keys(record).length === 2 &&
		typeof record.linkCode === "string" &&
		LINK_CODE_PATTERN.test(record.linkCode) &&
		Number.isSafeInteger(record.issuedAt) &&
		(record.issuedAt as number) > 0
	);
}

function assertPayload(
	payload: AffiliateAttributionTokenPayload,
): asserts payload is AffiliateAttributionTokenPayload {
	if (!isPayload(payload)) {
		throw new Error("Invalid affiliate attribution token payload");
	}
}
