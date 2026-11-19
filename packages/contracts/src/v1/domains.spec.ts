import { describe, expect, it } from "vitest";

import { externalDomainNameSchema, parseExternalDomainName } from "./domains";

describe("parseExternalDomainName", () => {
	it.each([
		["www.example.com", { name: "example.com", sld: "example", tld: "com" }],
		[
			"Example.COM.dz",
			{ name: "example.com.dz", sld: "example", tld: "com.dz" },
		],
		["www.shop.co.uk", { name: "shop.co.uk", sld: "shop", tld: "co.uk" }],
		["a.b.example.com", null],
		["com.dz", null],
	])("parses %s", (input, expected) => {
		expect(parseExternalDomainName(input)).toEqual(expected);
		expect(externalDomainNameSchema.safeParse(input).success).toBe(
			expected !== null,
		);
	});
});
