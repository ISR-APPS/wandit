import { describe, expect, it } from "vitest";

import { AffiliateTokenCodec } from "./affiliate-token";

const SECRET = "affiliate-test-secret-that-is-at-least-32-characters";
const OTHER_SECRET = "other-affiliate-secret-that-is-at-least-32-characters";

describe("AffiliateTokenCodec", () => {
	it("signs and verifies the exact referral payload", () => {
		const codec = new AffiliateTokenCodec(SECRET);
		const payload = {
			issuedAt: 1_785_643_200_000,
			linkCode: "partner_Code-123",
		};

		const token = codec.sign(payload);

		expect(token.split(".")).toHaveLength(3);
		expect(codec.verify(token)).toEqual(payload);
	});

	it("rejects payload, signature, version, and structure tampering", () => {
		const codec = new AffiliateTokenCodec(SECRET);
		const token = codec.sign({
			issuedAt: 1_785_643_200_000,
			linkCode: "partner1",
		});
		const [version, payload, signature] = token.split(".") as [
			string,
			string,
			string,
		];
		const decoded = JSON.parse(
			Buffer.from(payload, "base64url").toString("utf8"),
		) as Record<string, unknown>;
		const changedPayload = Buffer.from(
			JSON.stringify({ ...decoded, linkCode: "partner2" }),
		).toString("base64url");
		const changedSignature = `${signature.slice(0, -1)}${signature.endsWith("A") ? "B" : "A"}`;

		expect(
			codec.verify(`${version}.${changedPayload}.${signature}`),
		).toBeNull();
		expect(
			codec.verify(`${version}.${payload}.${changedSignature}`),
		).toBeNull();
		expect(codec.verify(`v2.${payload}.${signature}`)).toBeNull();
		expect(codec.verify(`${version}.${payload}`)).toBeNull();
		expect(codec.verify("not-a-token")).toBeNull();
	});

	it("does not verify a token under a different derived secret", () => {
		const token = new AffiliateTokenCodec(SECRET).sign({
			issuedAt: 1_785_643_200_000,
			linkCode: "partner1",
		});

		expect(new AffiliateTokenCodec(OTHER_SECRET).verify(token)).toBeNull();
	});

	it("rejects invalid payloads and undersized secrets", () => {
		expect(() => new AffiliateTokenCodec("too-short")).toThrow(
			"Affiliate token secret must be at least 32 characters",
		);

		const codec = new AffiliateTokenCodec(SECRET);
		expect(() => codec.sign({ issuedAt: 0, linkCode: "partner1" })).toThrow(
			"Invalid affiliate attribution token payload",
		);
		expect(() =>
			codec.sign({ issuedAt: 1_785_643_200_000, linkCode: "short" }),
		).toThrow("Invalid affiliate attribution token payload");
	});

	it("hashes normalized IPs deterministically without exposing the address", () => {
		const codec = new AffiliateTokenCodec(SECRET);
		const first = codec.hashIp(" 2001:DB8::1 ");
		const equivalent = codec.hashIp("2001:db8::1");
		const differentIp = codec.hashIp("2001:db8::2");
		const differentSecret = new AffiliateTokenCodec(OTHER_SECRET).hashIp(
			"2001:db8::1",
		);

		expect(first).toMatch(/^[0-9a-f]{64}$/);
		expect(first).toBe(equivalent);
		expect(first).not.toContain("2001");
		expect(first).not.toBe(differentIp);
		expect(first).not.toBe(differentSecret);
	});
});
