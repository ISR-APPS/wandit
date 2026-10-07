import { describe, expect, it } from "vitest";

import { resolveCloudTabEnabled } from "./use-cloud-tab-enabled";

// Every check passes; each case changes one input.
const OPEN = {
	engine: "v2_app",
	v2BuilderEnabled: true,
	flagEnabled: true,
	hasAnalytics: true,
} as const;

describe("resolveCloudTabEnabled", () => {
	it("is true for a v2_app project with the rollout and the flag on", () => {
		expect(resolveCloudTabEnabled(OPEN)).toBe(true);
	});

	it("is false for a v1_page project and for a missing project", () => {
		expect(resolveCloudTabEnabled({ ...OPEN, engine: "v1_page" })).toBe(false);
		expect(resolveCloudTabEnabled({ ...OPEN, engine: undefined })).toBe(false);
	});

	it("is false while the V2 builder is closed or its setting loads", () => {
		expect(resolveCloudTabEnabled({ ...OPEN, v2BuilderEnabled: false })).toBe(
			false,
		);
	});

	it("is false when the flag is off or still unknown", () => {
		expect(resolveCloudTabEnabled({ ...OPEN, flagEnabled: false })).toBe(false);
		expect(resolveCloudTabEnabled({ ...OPEN, flagEnabled: undefined })).toBe(
			false,
		);
	});

	it("skips the flag when there is no PostHog client", () => {
		expect(
			resolveCloudTabEnabled({
				...OPEN,
				flagEnabled: undefined,
				hasAnalytics: false,
			}),
		).toBe(true);
		expect(
			resolveCloudTabEnabled({
				...OPEN,
				v2BuilderEnabled: false,
				hasAnalytics: false,
			}),
		).toBe(false);
	});
});
