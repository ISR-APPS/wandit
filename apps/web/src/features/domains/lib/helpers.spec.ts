import { describe, expect, it } from "vitest";

import { domainLiveUrl } from "./helpers";

describe("domainLiveUrl", () => {
	it("uses the provisioned www hostname for an external domain", () => {
		expect(domainLiveUrl({ name: "example.com", source: "external" })).toBe(
			"https://www.example.com",
		);
	});

	it("keeps the apex URL for a purchased domain", () => {
		expect(domainLiveUrl({ name: "example.com", source: "purchased" })).toBe(
			"https://example.com",
		);
	});
});
