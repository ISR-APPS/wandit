import { Response, type fetch as undiciFetch } from "undici";
import { describe, expect, it } from "vitest";
import { fetchPublicBytes, type PublicFetchLimits } from "./public-fetch";

const IMAGE_LIMITS: PublicFetchLimits = {
	allowedMediaTypes: ["image/png"],
	maxBytes: 4,
	timeoutMs: 5_000,
};

/** A fetch that answers each call with the next response and records the URLs. */
function fakeFetch(responses: Response[]) {
	const requestedUrls: string[] = [];
	const fetchImpl: typeof undiciFetch = async (input) => {
		requestedUrls.push(String(input));
		const response = responses.shift();

		if (!response) {
			throw new Error("The fake fetch has no response left.");
		}

		return response;
	};

	return { fetchImpl, requestedUrls };
}

function redirectTo(location: string): Response {
	return new Response(null, { headers: { location }, status: 302 });
}

function pngOf(byteCount: number, contentType = "image/png"): Response {
	return new Response(new Uint8Array(byteCount), {
		headers: { "content-type": contentType },
	});
}

describe("fetchPublicBytes", () => {
	it("refuses a DNS name that resolves to a private address, through the real DNS hook", async () => {
		await expect(
			fetchPublicBytes("https://localhost/x", IMAGE_LIMITS, undefined),
		).resolves.toEqual({ reason: "private_address", status: "refused" });
	});

	it.each([
		["https://10.0.0.5/a", "private_address"],
		// `new URL` writes this host as `[::ffff:a9fe:a9fe]`, the cloud metadata address.
		["https://[::ffff:169.254.169.254]/a", "private_address"],
		["http://example.com/a", "not_https"],
	])("refuses a redirect to %s as %s and does not request it", async (location, reason) => {
		const { fetchImpl, requestedUrls } = fakeFetch([redirectTo(location)]);

		await expect(
			fetchPublicBytes(
				"https://example.com/start",
				IMAGE_LIMITS,
				undefined,
				fetchImpl,
			),
		).resolves.toEqual({ reason, status: "refused" });
		expect(requestedUrls).toEqual(["https://example.com/start"]);
	});

	it("follows 3 redirects and refuses the 4th", async () => {
		const threeRedirects = fakeFetch([
			redirectTo("/1"),
			redirectTo("/2"),
			redirectTo("/3"),
			pngOf(1),
		]);
		const fourRedirects = fakeFetch([
			redirectTo("/1"),
			redirectTo("/2"),
			redirectTo("/3"),
			redirectTo("/4"),
		]);

		await expect(
			fetchPublicBytes(
				"https://example.com/start",
				IMAGE_LIMITS,
				undefined,
				threeRedirects.fetchImpl,
			),
		).resolves.toMatchObject({ status: "ok" });
		await expect(
			fetchPublicBytes(
				"https://example.com/start",
				IMAGE_LIMITS,
				undefined,
				fourRedirects.fetchImpl,
			),
		).resolves.toEqual({ reason: "too_many_redirects", status: "refused" });
	});

	it("keeps a body of maxBytes and refuses a body of maxBytes + 1", async () => {
		const atLimit = fakeFetch([pngOf(IMAGE_LIMITS.maxBytes)]);
		const overLimit = fakeFetch([pngOf(IMAGE_LIMITS.maxBytes + 1)]);

		await expect(
			fetchPublicBytes(
				"https://example.com/a.png",
				IMAGE_LIMITS,
				undefined,
				atLimit.fetchImpl,
			),
		).resolves.toEqual({
			bytes: Buffer.alloc(IMAGE_LIMITS.maxBytes),
			mediaType: "image/png",
			status: "ok",
		});
		await expect(
			fetchPublicBytes(
				"https://example.com/a.png",
				IMAGE_LIMITS,
				undefined,
				overLimit.fetchImpl,
			),
		).resolves.toEqual({ reason: "too_large", status: "refused" });
	});

	it.each([
		["text/html; charset=utf-8", { reason: "media_type", status: "refused" }],
		["Image/PNG; charset=binary", { mediaType: "image/png", status: "ok" }],
	])("compares the content type %s without parameters and case", async (contentType, expected) => {
		const { fetchImpl } = fakeFetch([pngOf(1, contentType)]);

		await expect(
			fetchPublicBytes(
				"https://example.com/a.png",
				IMAGE_LIMITS,
				undefined,
				fetchImpl,
			),
		).resolves.toMatchObject(expected);
	});
});
