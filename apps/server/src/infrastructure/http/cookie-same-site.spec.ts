import {
	browserSiteKey,
	isSameBrowserSite,
	resolveAuthCookieSameSite,
} from "@wandit/env/cookie-same-site";
import { describe, expect, it } from "vitest";

describe("browserSiteKey", () => {
	it.each([
		["wandit.dev", "wandit.dev"],
		["api.wandit.dev", "wandit.dev"],
		["www.wandit.dev", "wandit.dev"],
		["deep.api-staging.wandit.dev", "wandit.dev"],
		["WANDIT.DEV.", "wandit.dev"],
		["localhost", "localhost"],
		["127.0.0.1", "127.0.0.1"],
		["192.168.1.10", "192.168.1.10"],
		["[::1]", "[::1]"],
		["wandit-web-git-dev.vercel.app", "wandit-web-git-dev.vercel.app"],
		[
			"server-production-4214.up.railway.app",
			"server-production-4214.up.railway.app",
		],
		["preview.pages.dev", "preview.pages.dev"],
	])("maps %s to site %s", (hostname, site) => {
		expect(browserSiteKey(hostname)).toBe(site);
	});
});

describe("isSameBrowserSite", () => {
	it("treats the production web, admin and API hosts as one site", () => {
		expect(
			isSameBrowserSite("https://api.wandit.dev", "https://wandit.dev"),
		).toBe(true);
		expect(
			isSameBrowserSite("https://api.wandit.dev", "https://www.wandit.dev"),
		).toBe(true);
		expect(
			isSameBrowserSite("https://api.wandit.dev", "https://admin.wandit.dev"),
		).toBe(true);
	});

	it("treats a vercel preview and the staging API as different sites", () => {
		expect(
			isSameBrowserSite(
				"https://api-staging.wandit.dev",
				"https://wandit-web-git-dev.vercel.app",
			),
		).toBe(false);
	});

	it("is schemeful", () => {
		expect(
			isSameBrowserSite("https://api.wandit.dev", "http://wandit.dev"),
		).toBe(false);
	});
});

describe("resolveAuthCookieSameSite", () => {
	it("chooses lax when every browser origin shares the API site", () => {
		expect(
			resolveAuthCookieSameSite({
				apiUrl: "https://api.wandit.dev",
				browserOrigins: [
					"https://wandit.dev",
					"https://www.wandit.dev",
					"https://admin.wandit.dev",
				],
			}),
		).toBe("lax");
	});

	it("falls back to none as soon as one origin is cross-site", () => {
		expect(
			resolveAuthCookieSameSite({
				apiUrl: "https://api-staging.wandit.dev",
				browserOrigins: [
					"https://wandit-web-git-dev.vercel.app",
					"https://admin-staging.wandit.dev",
				],
			}),
		).toBe("none");
	});

	it("lets the operator override the guess in both directions", () => {
		expect(
			resolveAuthCookieSameSite({
				apiUrl: "https://api.wandit.dev",
				browserOrigins: ["https://wandit.dev"],
				override: "none",
			}),
		).toBe("none");
		expect(
			resolveAuthCookieSameSite({
				apiUrl: "https://api-staging.wandit.dev",
				browserOrigins: ["https://wandit-web-git-dev.vercel.app"],
				override: "lax",
			}),
		).toBe("lax");
	});
});
