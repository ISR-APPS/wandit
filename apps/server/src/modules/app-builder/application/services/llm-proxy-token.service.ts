/**
 * Mints and verifies the short-lived run tokens the LLM proxy accepts.
 * WANDIT-166 mints a token per builder turn; `LlmProxyService` verifies it
 * on every proxied call. Format: `base64url(json).base64url(hmac-sha256)`.
 * HMAC runs over the encoded payload string with `LLM_PROXY_SIGNING_KEY`.
 */
import { createHmac, timingSafeEqual } from "node:crypto";

import { ServiceUnavailableException } from "@nestjs/common";
import {
	type LlmProxyTokenClaims,
	llmProxyTokenClaimsSchema,
} from "@wandit/contracts";

import type { LlmProxyEnv } from "../../domain/llm-upstream";

/**
 * Seconds a run token lives: 65 minutes. A builder turn can run 60
 * minutes. The extra 5 minutes keep the token alive mid-call (cross-issue
 * review point 1).
 */
export const LLM_PROXY_TOKEN_TTL_SECONDS = 65 * 60;

/** Claims the caller supplies; `exp` is derived at mint time. */
export type LlmProxyTokenClaimsInput = Omit<LlmProxyTokenClaims, "exp">;

/**
 * Thrown for every token problem: malformed, bad signature, bad claims, or
 * expired. One class keeps token detail out of the HTTP answer.
 */
export class LlmProxyTokenError extends Error {
	override readonly name = "LlmProxyTokenError";
}

function signingKeys(envLike: LlmProxyEnv): [string, ...string[]] {
	const keys = (envLike.LLM_PROXY_SIGNING_KEY ?? "")
		.split(",")
		.map((key) => key.trim())
		.filter((key) => key.length > 0);
	if (keys.length === 0) {
		throw new ServiceUnavailableException({
			code: "V2_ENV_MISSING",
			message: "LLM_PROXY_SIGNING_KEY is not set",
		});
	}
	// SAFETY: the length check above guarantees a first key.
	return keys as [string, ...string[]];
}

/**
 * Signs claims with the FIRST key of `LLM_PROXY_SIGNING_KEY`; later keys
 * only verify, which is how a rotation rolls without downtime.
 */
export function mintLlmProxyToken(
	claims: LlmProxyTokenClaimsInput,
	envLike: LlmProxyEnv,
	nowSeconds: number = Math.floor(Date.now() / 1000),
): string {
	const keys = signingKeys(envLike);
	const payload: LlmProxyTokenClaims = {
		...claims,
		exp: nowSeconds + LLM_PROXY_TOKEN_TTL_SECONDS,
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
 * Verifies a `payload.signature` token against every configured key and
 * returns its claims. Throws `LlmProxyTokenError` on any failure; throws
 * `ServiceUnavailableException` when no signing key is configured.
 */
export function verifyLlmProxyToken(
	token: string,
	envLike: LlmProxyEnv,
	nowSeconds: number = Math.floor(Date.now() / 1000),
): LlmProxyTokenClaims {
	const keys = signingKeys(envLike);

	// base64url never contains ".", so exactly one dot means well formed.
	const dot = token.indexOf(".");
	if (dot <= 0 || token.indexOf(".", dot + 1) !== -1) {
		throw new LlmProxyTokenError("Malformed run token");
	}
	const payloadPart = token.slice(0, dot);
	const signaturePart = token.slice(dot + 1);

	const given = Buffer.from(signaturePart, "base64url");
	// Constant-time compare per key; the length check keeps timingSafeEqual
	// from throwing on a malformed signature without leaking which failed.
	const signed = keys.some((key) => {
		const expected = createHmac("sha256", key).update(payloadPart).digest();
		return expected.length === given.length && timingSafeEqual(expected, given);
	});
	if (!signed) {
		throw new LlmProxyTokenError("Bad run token signature");
	}

	let json: unknown;
	try {
		json = JSON.parse(Buffer.from(payloadPart, "base64url").toString("utf8"));
	} catch {
		throw new LlmProxyTokenError("Unreadable run token payload");
	}
	const parsed = llmProxyTokenClaimsSchema.safeParse(json);
	if (!parsed.success) {
		throw new LlmProxyTokenError("Invalid run token claims");
	}
	if (parsed.data.exp <= nowSeconds) {
		throw new LlmProxyTokenError("Run token expired");
	}
	return parsed.data;
}
