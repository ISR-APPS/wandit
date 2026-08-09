import { describe, expect, it } from "vitest";

import { buildAuthCallbackUrls } from "./auth-navigation";

describe("buildAuthCallbackUrls", () => {
	it("preserves an order checkout return path on OAuth success and error", () => {
		const destination =
			"/billing/success?purpose=order&session_id=cs_checkout_return";

		expect(
			buildAuthCallbackUrls("https://wandit.example", destination),
		).toEqual({
			callbackURL:
				"https://wandit.example/billing/success?purpose=order&session_id=cs_checkout_return",
			errorCallbackURL:
				"https://wandit.example/?auth=error&next=%2Fbilling%2Fsuccess%3Fpurpose%3Dorder%26session_id%3Dcs_checkout_return",
		});
	});

	it("falls back to the dashboard for an unsafe destination", () => {
		expect(
			buildAuthCallbackUrls("https://wandit.example", "//evil.example"),
		).toEqual({
			callbackURL: "https://wandit.example/dashboard",
			errorCallbackURL: "https://wandit.example/?auth=error&next=%2Fdashboard",
		});
	});
});
