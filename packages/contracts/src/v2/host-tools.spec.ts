import { describe, expect, it } from "vitest";
import { publicWebUrlSchema } from "./host-tools";

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
