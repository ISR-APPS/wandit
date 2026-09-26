import { Logger } from "@nestjs/common";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PreviewProxyClient } from "./preview-proxy.client";

const RUN_URL =
	"https://r-abcdef123456--p-11111111-1111-4111-8111-111111111111.wanditpreview.app/?wt=tok";
const EXPO_URL =
	"exps://m-abcdefghijklmnopqrs27--p-11111111-1111-4111-8111-111111111111.wanditpreview.app";

afterEach(() => {
	vi.unstubAllGlobals();
	vi.restoreAllMocks();
});

describe("PreviewProxyClient", () => {
	it("posts the token as the body to the mint route of the run host", async () => {
		const calls: { url: string; init?: RequestInit }[] = [];
		// A network stub: the client calls the global fetch.
		vi.stubGlobal("fetch", async (input: URL, init?: RequestInit) => {
			calls.push({ url: String(input), init });
			return Response.json({
				expoUrl: EXPO_URL,
				expiresAt: "2026-09-26T11:00:00.000Z",
			});
		});

		const link = await new PreviewProxyClient().mintPhoneLink(RUN_URL, "tok");

		expect(link.expoUrl).toBe(EXPO_URL);
		expect(calls[0]?.url).toBe(
			"https://r-abcdef123456--p-11111111-1111-4111-8111-111111111111.wanditpreview.app/__wandit/phone-link",
		);
		expect(calls[0]?.init).toMatchObject({ body: "tok", method: "POST" });
	});

	it("throws on a mint error status", async () => {
		vi.stubGlobal(
			"fetch",
			async () => new Response("Forbidden", { status: 403 }),
		);

		await expect(
			new PreviewProxyClient().mintPhoneLink(RUN_URL, "tok"),
		).rejects.toThrow("HTTP 403");
	});

	it("reads Metro as running only on the packager status text", async () => {
		const urls: string[] = [];
		vi.stubGlobal("fetch", async (input: URL) => {
			urls.push(String(input));
			return new Response("packager-status:running");
		});
		const client = new PreviewProxyClient();

		expect(await client.isMetroRunning(EXPO_URL)).toBe(true);
		expect(urls[0]).toBe(
			"https://m-abcdefghijklmnopqrs27--p-11111111-1111-4111-8111-111111111111.wanditpreview.app/status",
		);

		vi.stubGlobal(
			"fetch",
			async () => new Response("Preview not running", { status: 503 }),
		);
		expect(await client.isMetroRunning(EXPO_URL)).toBe(false);
	});

	it("reads a network failure as not running", async () => {
		// Nest's Logger is a library class; the spy only silences the warning.
		vi.spyOn(Logger.prototype, "warn").mockImplementation(() => {});
		vi.stubGlobal("fetch", async () => {
			throw new TypeError("fetch failed");
		});

		expect(await new PreviewProxyClient().isMetroRunning(EXPO_URL)).toBe(false);
	});
});
