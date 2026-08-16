import { describe, expect, it } from "vitest";

import { readRequestCountryCode } from "./request-country-code";

describe("readRequestCountryCode", () => {
	it("normalizes Vercel country and gives it precedence over Cloudflare", () => {
		expect(
			readRequestCountryCode(
				new Headers({
					"cf-ipcountry": "CA",
					"x-vercel-ip-country": " dz ",
				}),
			),
		).toBe("DZ");
	});

	it("falls back to the Cloudflare country header", () => {
		expect(readRequestCountryCode({ "cf-ipcountry": "fr" })).toBe("FR");
	});

	it.each([
		"XX",
		"T1",
		"",
		"USA",
		"?",
	])("rejects the non-country value %j", (value) => {
		expect(readRequestCountryCode({ "cf-ipcountry": value })).toBeNull();
	});

	it("does not fall through to Cloudflare when a Vercel sentinel is present", () => {
		expect(
			readRequestCountryCode({
				"cf-ipcountry": "US",
				"x-vercel-ip-country": "XX",
			}),
		).toBeNull();
	});
});
