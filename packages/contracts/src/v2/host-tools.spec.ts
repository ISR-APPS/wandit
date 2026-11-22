import { describe, expect, it } from "vitest";
import { publicWebAddressSchema, publicWebUrlSchema } from "./host-tools";

describe("publicWebUrlSchema", () => {
	// A URL that passes goes to Firecrawl, so each refused row is a private host or a credential.
	it.each([
		["https://docs.example.com/guide?page=2#install", true],
		["ftp://example.com/file", false],
		["javascript:alert(1)", false],
		["https://user:secret@example.com/", false],
		["http://localhost:3000/", false],
		["http://127.0.0.1/", false],
		// The URL parser turns this number into 127.0.0.1.
		["http://2130706433/", false],
		["http://[::1]/", false],
		["http://10.0.0.5/admin", false],
		["http://intranet/", false],
		["https://x.internal/", false],
		// 501 chars: one more than the limit.
		[`https://example.com/${"a".repeat(481)}`, false],
	])("parses %s as public: %s", (url, isPublic) => {
		expect(publicWebUrlSchema.safeParse(url).success).toBe(isPublic);
	});
});

describe("publicWebAddressSchema", () => {
	// A typed address without a scheme gets https://. The added scheme must not open a private host.
	it.each([
		["website.shop.dz", "https://website.shop.dz"],
		["  www.example.com/pricing ", "https://www.example.com/pricing"],
		["http://example.com/", "http://example.com/"],
		["HTTPS://Example.com", "HTTPS://Example.com"],
		["ftp://example.com", null],
		["localhost:3000", null],
		["192.168.1.1", null],
		// The parser reads "mailto" as a user name, so the credential check refuses it.
		["mailto:me@example.com", null],
		["javascript:alert(1)", null],
		["example", null],
	])("parses %s to %s", (address, expected) => {
		const parsed = publicWebAddressSchema.safeParse(address);
		expect(parsed.success ? parsed.data : null).toBe(expected);
	});
});
