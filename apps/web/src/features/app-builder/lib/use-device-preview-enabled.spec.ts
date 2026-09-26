import { describe, expect, it } from "vitest";

import { resolveDevicePreviewEnabled } from "./use-device-preview-enabled";

describe("resolveDevicePreviewEnabled", () => {
	it("stays off while the flag loads and when the flag is off", () => {
		expect(
			resolveDevicePreviewEnabled({
				flagEnabled: undefined,
				hasAnalytics: true,
			}),
		).toBe(false);
		expect(
			resolveDevicePreviewEnabled({ flagEnabled: false, hasAnalytics: true }),
		).toBe(false);
	});

	it("turns on with the flag, and without a PostHog client", () => {
		expect(
			resolveDevicePreviewEnabled({ flagEnabled: true, hasAnalytics: true }),
		).toBe(true);
		expect(
			resolveDevicePreviewEnabled({
				flagEnabled: undefined,
				hasAnalytics: false,
			}),
		).toBe(true);
	});
});
