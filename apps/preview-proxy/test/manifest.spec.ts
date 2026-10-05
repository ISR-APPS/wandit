import { afterEach, describe, expect, it, vi } from "vitest";

import {
	isManifestContentType,
	type ManifestRewrite,
	rewriteManifestBody,
} from "../src/manifest";

const REWRITE: ManifestRewrite = {
	packagerHost: "p-1.preview.test",
	phoneHost: "m-a--p-1.preview.test",
	expoUsername: "zack",
};

afterEach(() => {
	vi.restoreAllMocks();
});

describe("isManifestContentType", () => {
	it.each([
		["application/json; charset=utf-8", true],
		["application/expo+json", true],
		["multipart/mixed; boundary=----formdata-x", true],
		// The browser debug view of Expo CLI stays unchanged.
		["text/plain", false],
		["application/javascript", false],
	])("answers %s with %s", (contentType, expected) => {
		expect(isManifestContentType(contentType)).toBe(expected);
	});
});

describe("rewriteManifestBody error paths", () => {
	it("keeps the phone host swap and logs when the JSON body is not JSON", () => {
		// The spy only silences and counts the log line of the failure path.
		const log = vi.spyOn(console, "error").mockImplementation(() => {});

		const body = rewriteManifestBody(
			"not json p-1.preview.test",
			"application/json",
			REWRITE,
		);

		expect(body).toBe("not json m-a--p-1.preview.test");
		expect(log).toHaveBeenCalledOnce();
	});

	it("leaves a JSON body without extra.expoGo without a username and logs", () => {
		const log = vi.spyOn(console, "error").mockImplementation(() => {});

		const body = rewriteManifestBody(
			JSON.stringify({ launchAsset: { url: "https://p-1.preview.test/x" } }),
			"application/expo+json",
			REWRITE,
		);

		expect(JSON.parse(body)).toEqual({
			launchAsset: { url: "https://m-a--p-1.preview.test/x" },
		});
		expect(log).toHaveBeenCalledOnce();
	});

	it("swaps the host but writes no username when the multipart type has no boundary", () => {
		const log = vi.spyOn(console, "error").mockImplementation(() => {});
		const body = `{"extra":{"expoGo":{"debuggerHost":"p-1.preview.test"}}}`;

		expect(rewriteManifestBody(body, "multipart/mixed", REWRITE)).toBe(
			`{"extra":{"expoGo":{"debuggerHost":"m-a--p-1.preview.test"}}}`,
		);
		expect(log).toHaveBeenCalledOnce();
	});
});
