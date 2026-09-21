/**
 * Signs and verifies the preview token the preview-proxy Worker trusts.
 * The API `PreviewTokenService` calls `signPreviewToken`; the Worker calls
 * `verifyPreviewToken`. Both runtimes share this file, so it uses WebCrypto
 * (`globalThis.crypto.subtle`) only — no `node:` import, no `Buffer`.
 */
import { type PreviewTokenClaims, previewTokenClaimsSchema } from "./preview";

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

/**
 * Encodes bytes as base64url: the URL-safe alphabet, no padding. The spec
 * imports it to forge token payloads.
 */
export function base64UrlEncode(bytes: Uint8Array): string {
	let binary = "";
	for (const byte of bytes) {
		binary += String.fromCharCode(byte);
	}
	// btoa gives base64; the swaps make it safe in a query parameter.
	return btoa(binary)
		.replaceAll("+", "-")
		.replaceAll("/", "_")
		.replace(/=+$/, "");
}

/**
 * Decodes base64url back to bytes. Throws on characters outside the alphabet.
 * The `ArrayBuffer` type argument matters: `crypto.subtle.verify` under the
 * DOM lib rejects a `Uint8Array<ArrayBufferLike>`, so web and admin fail.
 */
function base64UrlDecode(value: string): Uint8Array<ArrayBuffer> {
	const base64 = value.replaceAll("-", "+").replaceAll("_", "/");
	// atob needs the `=` padding that base64url strips.
	const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
	const binary = atob(padded);
	const bytes = new Uint8Array(binary.length);
	for (let i = 0; i < binary.length; i++) {
		bytes[i] = binary.charCodeAt(i);
	}
	return bytes;
}

/** Imports the signing key as an HMAC-SHA256 CryptoKey. The key never leaves the process. */
function importSigningKey(key: string) {
	return crypto.subtle.importKey(
		"raw",
		textEncoder.encode(key),
		{ name: "HMAC", hash: "SHA-256" },
		false,
		["sign", "verify"],
	);
}

/**
 * Signs claims into `<payload>.<signature>`, both parts base64url. The
 * HMAC input is the base64url payload string, so the verifier signs the
 * same bytes it received.
 */
export async function signPreviewToken(
	claims: PreviewTokenClaims,
	key: string,
): Promise<string> {
	const payload = base64UrlEncode(textEncoder.encode(JSON.stringify(claims)));
	const cryptoKey = await importSigningKey(key);
	const signature = await crypto.subtle.sign(
		"HMAC",
		cryptoKey,
		textEncoder.encode(payload),
	);
	return `${payload}.${base64UrlEncode(new Uint8Array(signature))}`;
}

/**
 * Verifies a token string; `now` is unix seconds. The signature check runs
 * before the payload parse, so a forged payload never reaches the parser.
 * A failure returns a reason. The Worker maps `malformed` and `signature`
 * to 401, and `expired` to 401 with the token-expired page.
 */
export async function verifyPreviewToken(
	token: string,
	key: string,
	now: number,
): Promise<
	| { ok: true; claims: PreviewTokenClaims }
	| { ok: false; reason: "malformed" | "signature" | "expired" }
> {
	const parts = token.split(".");
	const [payload, signaturePart] = parts;
	if (parts.length !== 2 || !payload || !signaturePart) {
		return { ok: false, reason: "malformed" };
	}
	// The key import stays outside the `try`. A key error must reach the
	// caller, not become a 401.
	const cryptoKey = await importSigningKey(key);
	try {
		const signature = base64UrlDecode(signaturePart);
		// crypto.subtle.verify compares the MAC in constant time; no manual
		// byte loop is needed.
		const signatureOk = await crypto.subtle.verify(
			"HMAC",
			cryptoKey,
			signature,
			textEncoder.encode(payload),
		);
		if (!signatureOk) {
			return { ok: false, reason: "signature" };
		}
		const rawClaims: unknown = JSON.parse(
			textDecoder.decode(base64UrlDecode(payload)),
		);
		const claims = previewTokenClaimsSchema.safeParse(rawClaims);
		if (!claims.success) {
			return { ok: false, reason: "malformed" };
		}
		if (claims.data.exp <= now) {
			return { ok: false, reason: "expired" };
		}
		return { ok: true, claims: claims.data };
	} catch {
		// The base64url decode or the JSON parse rejected the input.
		return { ok: false, reason: "malformed" };
	}
}
