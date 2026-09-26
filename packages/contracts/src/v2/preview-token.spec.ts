import { describe, expect, it } from "vitest";
import {
	expoUsernameSchema,
	type PreviewTokenClaims,
	packagerHostFor,
	parsePreviewHost,
	phonePreviewHostFor,
	previewHostFor,
	previewTokenQuerySchema,
} from "./preview";
import {
	base64UrlEncode,
	signPreviewToken,
	verifyPreviewToken,
} from "./preview-token";

const KEY = "test-key";

const CLAIMS: PreviewTokenClaims = {
	pid: "11111111-1111-4111-8111-111111111111",
	rid: "22222222-2222-4222-8222-222222222222",
	uid: "user-1",
	up: "https://x-5173.vercel.run",
	exp: 1800000000,
	jti: "0123456789abcdef",
};

// Fixed vector: the same claims and key must always produce this token.
// HMAC-SHA256 is deterministic, so a change here means a format change.
const TOKEN =
	"eyJwaWQiOiIxMTExMTExMS0xMTExLTQxMTEtODExMS0xMTExMTExMTExMTEiLCJyaWQiOiIyMjIyMjIyMi0yMjIyLTQyMjItODIyMi0yMjIyMjIyMjIyMjIiLCJ1aWQiOiJ1c2VyLTEiLCJ1cCI6Imh0dHBzOi8veC01MTczLnZlcmNlbC5ydW4iLCJleHAiOjE4MDAwMDAwMDAsImp0aSI6IjAxMjM0NTY3ODlhYmNkZWYifQ.KCsfQH9iVVye07PUxDP88vGNEY_zOsZ8-jJBv3vfnq4";

const DOMAIN = "wanditpreview.app";
// `22222222-2222-4222-8222-222222222222` without dashes, first 12 chars.
const RID12 = "222222222222";
const HOST = `r-${RID12}--p-${CLAIMS.pid}.${DOMAIN}`;
// 21 lower-case base32 characters, the form the Worker mints.
const PHONE_ID = "abcdefghijklmnopqrs27";

// Signs any payload string the way signPreviewToken signs claims, so the
// spec can mint tokens whose payload is not valid claims.
async function signRawPayload(payload: string, key: string): Promise<string> {
	const encodedPayload = base64UrlEncode(new TextEncoder().encode(payload));
	const cryptoKey = await crypto.subtle.importKey(
		"raw",
		new TextEncoder().encode(key),
		{ name: "HMAC", hash: "SHA-256" },
		false,
		["sign"],
	);
	const signature = await crypto.subtle.sign(
		"HMAC",
		cryptoKey,
		new TextEncoder().encode(encodedPayload),
	);
	return `${encodedPayload}.${base64UrlEncode(new Uint8Array(signature))}`;
}

// Changes the first character of a token part to a different base64url
// character; the part stays decodable but no longer matches.
function flipFirstChar(part: string): string {
	const replacement = part[0] === "A" ? "B" : "A";
	return replacement + part.slice(1);
}

describe("signPreviewToken", () => {
	it("produces the fixed token vector", async () => {
		const token = await signPreviewToken(CLAIMS, KEY);
		expect(token).toBe(TOKEN);
	});
});

describe("verifyPreviewToken", () => {
	it("round trips signed claims", async () => {
		const token = await signPreviewToken(CLAIMS, KEY);
		const result = await verifyPreviewToken(token, KEY, CLAIMS.exp - 1);
		expect(result).toEqual({ ok: true, claims: CLAIMS });
	});

	it("rejects a flipped character in the signature part", async () => {
		const dot = TOKEN.indexOf(".");
		const tampered = `${TOKEN.slice(0, dot)}.${flipFirstChar(TOKEN.slice(dot + 1))}`;
		const result = await verifyPreviewToken(tampered, KEY, CLAIMS.exp - 1);
		expect(result).toEqual({ ok: false, reason: "signature" });
	});

	it("rejects a flipped character in the payload part", async () => {
		const dot = TOKEN.indexOf(".");
		// The HMAC covers the payload bytes, so a payload edit is a signature
		// failure, not a parse failure.
		const tampered = `${flipFirstChar(TOKEN.slice(0, dot))}.${TOKEN.slice(dot + 1)}`;
		const result = await verifyPreviewToken(tampered, KEY, CLAIMS.exp - 1);
		expect(result).toEqual({ ok: false, reason: "signature" });
	});

	it("rejects an expired token", async () => {
		const result = await verifyPreviewToken(TOKEN, KEY, CLAIMS.exp);
		expect(result).toEqual({ ok: false, reason: "expired" });
	});

	it.each([
		"abc",
		"",
		"a.b.c",
	])("rejects garbage %j as malformed", async (token) => {
		const result = await verifyPreviewToken(token, KEY, CLAIMS.exp - 1);
		expect(result).toEqual({ ok: false, reason: "malformed" });
	});

	it("rejects a signed payload that is not JSON", async () => {
		const token = await signRawPayload("this is not json", KEY);
		const result = await verifyPreviewToken(token, KEY, CLAIMS.exp - 1);
		expect(result).toEqual({ ok: false, reason: "malformed" });
	});

	it("rejects a signed payload that misses jti", async () => {
		const { jti: _jti, ...claimsWithoutJti } = CLAIMS;
		const token = await signRawPayload(JSON.stringify(claimsWithoutJti), KEY);
		const result = await verifyPreviewToken(token, KEY, CLAIMS.exp - 1);
		expect(result).toEqual({ ok: false, reason: "malformed" });
	});

	it("lets a signing-key error reach the caller", async () => {
		// WebCrypto rejects a zero-length HMAC key. A key error must not
		// become a 401 for every request.
		await expect(
			verifyPreviewToken(TOKEN, "", CLAIMS.exp - 1),
		).rejects.toThrow();
	});
});

describe("preview host helpers", () => {
	it("round trips previewHostFor and parsePreviewHost", () => {
		expect(previewHostFor(CLAIMS.pid, CLAIMS.rid, DOMAIN)).toBe(HOST);
		expect(parsePreviewHost(HOST, DOMAIN)).toEqual({
			kind: "run",
			projectId: CLAIMS.pid,
			rid12: RID12,
		});
	});

	it("parses an upper-case host and lower-cases the parts", () => {
		expect(parsePreviewHost(HOST.toUpperCase(), DOMAIN)).toEqual({
			kind: "run",
			projectId: CLAIMS.pid,
			rid12: RID12,
		});
	});

	it("parses a host when the domain argument is upper-case", () => {
		expect(parsePreviewHost(HOST, DOMAIN.toUpperCase())).toEqual({
			kind: "run",
			projectId: CLAIMS.pid,
			rid12: RID12,
		});
	});

	it("round trips phonePreviewHostFor into a phone host of 63 label characters, the DNS limit", () => {
		const host = phonePreviewHostFor(CLAIMS.pid, PHONE_ID, DOMAIN);

		expect(host.split(".")[0]).toHaveLength(63);
		expect(parsePreviewHost(host, DOMAIN)).toEqual({
			kind: "phone",
			projectId: CLAIMS.pid,
			phoneId: PHONE_ID,
		});
	});

	it.each([
		`r-abc--p-${CLAIMS.pid}.wanditpreview.app`,
		`r-${RID12}--p-${CLAIMS.pid}.evil.app`,
		`x-${RID12}--p-${CLAIMS.pid}.wanditpreview.app`,
		// Base32 has no 0, 1, 8, or 9, and the id has exactly 21 characters.
		`m-abcdefghijklmnopqrs01--p-${CLAIMS.pid}.wanditpreview.app`,
		`m-${PHONE_ID}a--p-${CLAIMS.pid}.wanditpreview.app`,
		// The Metro host sits in manifests only; the Worker serves nothing on it.
		packagerHostFor(CLAIMS.pid, DOMAIN),
	])("returns null for the bad host %s", (host) => {
		expect(parsePreviewHost(host, DOMAIN)).toBeNull();
	});
});

describe("previewTokenQuerySchema", () => {
	it("accepts no query, a phone query, and a phone query with a username", () => {
		expect(previewTokenQuerySchema.safeParse({}).success).toBe(true);
		expect(previewTokenQuerySchema.safeParse({ client: "phone" }).success).toBe(
			true,
		);
		expect(
			previewTokenQuerySchema.safeParse({
				client: "phone",
				expoUsername: "zack_dev-1.test",
			}).success,
		).toBe(true);
	});

	it("rejects a username without client=phone and an unknown client", () => {
		expect(
			previewTokenQuerySchema.safeParse({ expoUsername: "zack" }).success,
		).toBe(false);
		expect(previewTokenQuerySchema.safeParse({ client: "tv" }).success).toBe(
			false,
		);
	});

	it.each([
		"",
		"a b",
		'a"b',
		"robot (robot)",
		"x".repeat(65),
	])("rejects the username %j", (expoUsername) => {
		expect(expoUsernameSchema.safeParse(expoUsername).success).toBe(false);
	});
});
