/**
 * Signs and verifies the preview token the preview-proxy Worker trusts, and
 * derives the secret id of the frame host. The API `PreviewTokenService`
 * calls `signPreviewToken` and `previewFrameIdFor`; the Worker calls
 * `verifyPreviewToken` and `previewFrameIdFor`. Both runtimes share this
 * file, so it uses WebCrypto (`globalThis.crypto.subtle`) only — no `node:`
 * import, no `Buffer`.
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

/** RFC 4648 base32 in lower case: the alphabet of the `m-` and `f-` host labels. */
const BASE32_ALPHABET = "abcdefghijklmnopqrstuvwxyz234567";

/**
 * Encodes bytes as lower-case base32 without padding. 13 bytes (104 bits)
 * give 21 characters. Hex would need 26 and push the host label over the
 * DNS limit of 63. The Worker encodes phone ids with it, and
 * `previewFrameIdFor` encodes frame ids.
 */
export function base32Encode(bytes: Uint8Array): string {
	let pending = 0;
	let pendingBits = 0;
	let encoded = "";
	for (const byte of bytes) {
		pending = (pending << 8) | byte;
		pendingBits += 8;
		// One base32 character holds 5 bits.
		while (pendingBits >= 5) {
			pendingBits -= 5;
			encoded += BASE32_ALPHABET.charAt((pending >> pendingBits) & 31);
		}
		// Keep only the bits not yet written, so the number stays small.
		pending &= (1 << pendingBits) - 1;
	}
	// The last bits fill the high end of one more character.
	if (pendingBits > 0) {
		encoded += BASE32_ALPHABET.charAt((pending << (5 - pendingBits)) & 31);
	}
	return encoded;
}

/** 13 bytes: 104 bits of secret in the 21 characters of a host label. */
const FRAME_ID_BYTES = 13;

/**
 * Secret id of the frame host of one run and one user: the first 104 bits of
 * an HMAC over `pid`, `rid`, and `uid`. The API puts it in `previewUrl`; the
 * Worker checks it against the token before it stores the claims. A renewal
 * keeps the id, so the app keeps its origin and its browser storage.
 */
export async function previewFrameIdFor(
	claims: Pick<PreviewTokenClaims, "pid" | "rid" | "uid">,
	key: string,
): Promise<string> {
	const cryptoKey = await importSigningKey(key);
	// The token HMAC signs base64url text, which has no ":". So this input
	// can never equal a token payload, and one key serves both uses. `pid`
	// and `rid` are UUIDs with no ":", so `uid` can hold any character.
	const mac = await crypto.subtle.sign(
		"HMAC",
		cryptoKey,
		textEncoder.encode(`frame:${claims.pid}:${claims.rid}:${claims.uid}`),
	);
	return base32Encode(new Uint8Array(mac, 0, FRAME_ID_BYTES));
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
