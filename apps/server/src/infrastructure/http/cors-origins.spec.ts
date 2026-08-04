import {
	allowedCorsWebOrigin,
	corsExtraOriginsSchema,
	corsWebOrigins,
} from "@wandit/env/cors-origins";
import { describe, expect, it } from "vitest";

describe("CORS web origins", () => {
	it("uses no extra origins when the variable is unset or empty", () => {
		expect(corsExtraOriginsSchema.parse(undefined)).toEqual([]);
		expect(corsExtraOriginsSchema.parse(" ,  , ")).toEqual([]);
	});

	it("trims, drops empty entries, and normalizes URL origins", () => {
		expect(
			corsExtraOriginsSchema.parse(
				" https://wandit.dev, , https://www.wandit.dev/ ",
			),
		).toEqual(["https://wandit.dev", "https://www.wandit.dev"]);
	});

	it.each([
		"not-a-url",
		"ftp://wandit.dev",
		"https://wandit.dev/path",
		"https://wandit.dev?preview=true",
		"https://user:secret@wandit.dev",
	])("rejects non-origin entry %s", (value) => {
		expect(() => corsExtraOriginsSchema.parse(value)).toThrow();
	});

	it("rejects wildcard hostnames but accepts literal subdomains", () => {
		const wildcardResult = corsExtraOriginsSchema.safeParse(
			"https://*.wandit.dev",
		);

		expect(wildcardResult.success).toBe(false);
		if (wildcardResult.success) {
			throw new Error("Expected a wildcard hostname validation error");
		}
		expect(wildcardResult.error.issues.map((issue) => issue.message)).toContain(
			"Each CORS origin hostname must not contain wildcard characters",
		);
		expect(corsExtraOriginsSchema.parse("https://sub.wandit.dev")).toEqual([
			"https://sub.wandit.dev",
		]);
	});

	it("matches canonical and extra origins but rejects other origins", () => {
		const canonical = "https://wandit.dev";
		const extras = ["https://www.wandit.dev"];

		expect(corsWebOrigins(canonical, extras)).toEqual([
			canonical,
			"https://www.wandit.dev",
		]);
		expect(allowedCorsWebOrigin(canonical, canonical, extras)).toBe(canonical);
		expect(
			allowedCorsWebOrigin("https://www.wandit.dev", canonical, extras),
		).toBe("https://www.wandit.dev");
		expect(
			allowedCorsWebOrigin("https://preview.vercel.app", canonical, extras),
		).toBeUndefined();
	});
});
