import { describe, expect, it } from "vitest";

import {
	buildAuthCallbackUrls,
	sanitizeAuthRedirectPath,
} from "./auth-navigation";

describe("sanitizeAuthRedirectPath", () => {
	it("keeps internal paths with query and hash", () => {
		expect(sanitizeAuthRedirectPath("/dashboard")).toBe("/dashboard");
		expect(sanitizeAuthRedirectPath("/billing/success?purpose=order#x")).toBe(
			"/billing/success?purpose=order#x",
		);
	});

	it("rejects every form of cross-origin escape", () => {
		// WHATWG URL treats "\" as "/" and strips tab/CR/LF, so each of these
		// resolves to another origin when passed to new URL(next, origin).
		for (const next of [
			"//evil.example",
			"/\\evil.example",
			"/\n/evil.example",
			"/\t/evil.example",
			"https://evil.example",
			"javascript:alert(1)",
			"",
			undefined,
		]) {
			expect(sanitizeAuthRedirectPath(next), JSON.stringify(next)).toBe(
				undefined,
			);
		}
	});
});

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
