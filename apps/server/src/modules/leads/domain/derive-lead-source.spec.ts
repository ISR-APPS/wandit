import { describe, expect, it } from "vitest";
import { deriveLeadSource } from "./derive-lead-source";

describe("deriveLeadSource", () => {
	it("prefers platform click ids over utm_source", () => {
		expect(deriveLeadSource({ fbclid: "abc", utm_source: "tiktok" })).toBe(
			"facebook",
		);
		expect(deriveLeadSource({ ttclid: "xyz" })).toBe("tiktok");
	});

	it("falls back to utm_source aliases", () => {
		expect(deriveLeadSource({ utm_source: "Facebook" })).toBe("facebook");
		expect(deriveLeadSource({ utm_source: "ig" })).toBe("facebook");
		expect(deriveLeadSource({ utm_source: "TikTok" })).toBe("tiktok");
	});

	it("is direct for anything else", () => {
		expect(deriveLeadSource(null)).toBe("direct");
		expect(deriveLeadSource(undefined)).toBe("direct");
		expect(deriveLeadSource({})).toBe("direct");
		expect(deriveLeadSource({ utm_source: "google" })).toBe("direct");
		expect(deriveLeadSource({ fbclid: "" })).toBe("direct");
		expect(deriveLeadSource("facebook")).toBe("direct");
	});
});
