import { describe, expect, it } from "vitest";

import { resolveV2BuilderEnabled } from "./v2-builder-flag";

describe("resolveV2BuilderEnabled", () => {
	it("is false while the product setting is unknown", () => {
		expect(
			resolveV2BuilderEnabled({
				flagEnabled: true,
				hasAnalytics: true,
				settingEnabled: undefined,
			}),
		).toBe(false);
	});

	it("is true when the setting and the flag are on", () => {
		expect(
			resolveV2BuilderEnabled({
				flagEnabled: true,
				hasAnalytics: true,
				settingEnabled: true,
			}),
		).toBe(true);
	});

	it("is false when the flag is off or unknown under analytics", () => {
		expect(
			resolveV2BuilderEnabled({
				flagEnabled: false,
				hasAnalytics: true,
				settingEnabled: true,
			}),
		).toBe(false);
		expect(
			resolveV2BuilderEnabled({
				flagEnabled: undefined,
				hasAnalytics: true,
				settingEnabled: true,
			}),
		).toBe(false);
	});

	it("follows the setting alone when there is no analytics client", () => {
		expect(
			resolveV2BuilderEnabled({
				flagEnabled: undefined,
				hasAnalytics: false,
				settingEnabled: true,
			}),
		).toBe(true);
		expect(
			resolveV2BuilderEnabled({
				flagEnabled: undefined,
				hasAnalytics: false,
				settingEnabled: false,
			}),
		).toBe(false);
	});
});
