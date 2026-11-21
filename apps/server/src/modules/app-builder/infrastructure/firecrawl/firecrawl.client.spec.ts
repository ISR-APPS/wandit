import { afterEach, describe, expect, it, vi } from "vitest";

import {
	captureWithFirecrawl,
	fetchPageWithFirecrawl,
} from "./firecrawl.client";

const PAGE_URL = "https://example.com/pricing";

/** Makes `fetch` answer each call with the next response of the list. */
function stubFetch(...responses: Response[]) {
	const fetchMock = vi.fn<typeof fetch>();
	for (const response of responses) {
		fetchMock.mockResolvedValueOnce(response);
	}
	vi.stubGlobal("fetch", fetchMock);
	return fetchMock;
}

/** The JSON text that the client sent in call `index`. */
function sentBodyOf(
	fetchMock: ReturnType<typeof stubFetch>,
	index: number,
): string {
	return String(fetchMock.mock.calls[index]?.[1]?.body);
}

afterEach(() => {
	vi.unstubAllGlobals();
});

describe("fetchPageWithFirecrawl", () => {
	it.each([
		{
			name: "HTTP 200 with success false",
			response: () =>
				Response.json({
					code: "SCRAPE_DNS_RESOLUTION_ERROR",
					error: "DNS resolution failed",
					success: false,
				}),
		},
		{
			name: "a target page status of 404",
			response: () =>
				Response.json({
					data: { markdown: "# Not found", metadata: { statusCode: 404 } },
					success: true,
				}),
		},
		{
			name: "HTTP 402",
			response: () =>
				Response.json(
					{ error: "Insufficient credits", success: false },
					{ status: 402 },
				),
		},
	])("answers failed on $name", async ({ response }) => {
		stubFetch(response());

		const outcome = await fetchPageWithFirecrawl("fc-key", PAGE_URL, undefined);

		expect(outcome.status).toBe("failed");
	});

	it("keeps the message well-formed when the 500-char cut splits an emoji", async () => {
		// 499 chars, then an emoji of two UTF-16 code units across the cut.
		const bodyStart = "a".padEnd(499, " b");
		stubFetch(new Response(`${bodyStart}\u{1F600} more text`, { status: 502 }));

		const outcome = await fetchPageWithFirecrawl("fc-key", PAGE_URL, undefined);

		// Postgres jsonb refuses a lone surrogate, so the half must become U+FFFD.
		expect(outcome).toEqual({
			message: `Firecrawl answered 502: ${bodyStart}\uFFFD`,
			status: "failed",
		});
	});
});

describe("captureWithFirecrawl", () => {
	it("sends one second request without the page script when Firecrawl refuses actions", async () => {
		const fetchMock = stubFetch(
			Response.json(
				{
					code: "SCRAPE_ACTIONS_NOT_SUPPORTED",
					error: "Actions are not supported",
					success: false,
				},
				{ status: 400 },
			),
			Response.json({
				data: {
					metadata: { statusCode: 200, url: PAGE_URL },
					screenshot: "https://storage.example.com/shot.jpg",
				},
				success: true,
			}),
		);

		const outcome = await captureWithFirecrawl(
			"fc-key",
			{ device: "desktop", url: PAGE_URL },
			undefined,
		);

		expect(outcome).toMatchObject({
			capture: {
				screenshotUrl: "https://storage.example.com/shot.jpg",
				styleMap: null,
			},
			status: "ok",
		});
		expect(fetchMock).toHaveBeenCalledTimes(2);
		expect(sentBodyOf(fetchMock, 0)).toContain('"actions"');
		expect(sentBodyOf(fetchMock, 1)).not.toContain('"actions"');
		expect(sentBodyOf(fetchMock, 1)).not.toContain('"branding"');
	});

	it("keeps the capture and drops the style map when the page script returns text that is not JSON", async () => {
		stubFetch(
			Response.json({
				data: {
					actions: { javascriptReturns: [{ value: "<html>not json</html>" }] },
					screenshot: "https://storage.example.com/shot.jpg",
				},
				success: true,
			}),
		);

		const outcome = await captureWithFirecrawl(
			"fc-key",
			{ device: "mobile", url: PAGE_URL },
			undefined,
		);

		expect(outcome).toMatchObject({
			capture: { styleMap: null },
			status: "ok",
		});
	});
});
