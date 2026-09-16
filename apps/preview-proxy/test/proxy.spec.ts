import {
	createExecutionContext,
	env,
	fetchMock,
	waitOnExecutionContext,
} from "cloudflare:test";
import {
	PREVIEW_COOKIE_NAME,
	type PreviewTokenClaims,
	previewHostFor,
	signPreviewToken,
} from "@wandit/contracts";
import { afterEach, beforeAll, describe, expect, it } from "vitest";

import worker from "../src/index";

// Matches the PREVIEW_TOKEN_SIGNING_KEY binding in vitest.config.ts.
const KEY = "test-key";
const UPSTREAM = "https://x-5173.vercel.run";
const PROJECT_ID = "11111111-1111-4111-8111-111111111111";
const RUN_ID = "22222222-2222-4222-8222-222222222222";
const OTHER_PROJECT_ID = "33333333-3333-4333-8333-333333333333";
// The last-seen test gets its own project: the module-level write map is
// per isolate, so a shared pid could already hold a write from an earlier test.
const SEEN_PROJECT_ID = "44444444-4444-4444-8444-444444444444";
const SEEN_RUN_ID = "55555555-5555-4555-8555-555555555555";

beforeAll(() => {
	fetchMock.activate();
	fetchMock.disableNetConnect();
});

afterEach(() => {
	fetchMock.assertNoPendingInterceptors();
});

async function dispatch(request: Request): Promise<Response> {
	const ctx = createExecutionContext();
	const response = await worker.fetch(request, env, ctx);
	await waitOnExecutionContext(ctx);
	return response;
}

// A fresh jti per call keeps the per-token rate limit isolated per test.
function makeClaims(
	overrides: Partial<PreviewTokenClaims> = {},
): PreviewTokenClaims {
	return {
		pid: PROJECT_ID,
		rid: RUN_ID,
		uid: "user-1",
		up: UPSTREAM,
		exp: Math.floor(Date.now() / 1000) + 900,
		jti: crypto.randomUUID(),
		...overrides,
	};
}

function previewHost(projectId: string, runId: string): string {
	return previewHostFor(projectId, runId, env.PREVIEW_DOMAIN);
}

function cookieRequest(
	url: string,
	token: string,
	headers: Record<string, string> = {},
): Request {
	return new Request(url, {
		headers: { ...headers, cookie: `${PREVIEW_COOKIE_NAME}=${token}` },
	});
}

// fetchMock hands request headers to the reply callback as a union.
function headerOf(
	headers: Headers | Record<string, string>,
	name: string,
): string | null {
	if (headers instanceof Headers) {
		return headers.get(name);
	}
	return headers[name] ?? null;
}

function expectSecurityHeaders(response: Response): void {
	expect(response.headers.get("content-security-policy")).toBe(
		`frame-ancestors ${env.FRAME_ANCESTORS}`,
	);
	expect(response.headers.get("x-robots-tag")).toBe("noindex");
	expect(response.headers.get("referrer-policy")).toBe(
		"strict-origin-when-cross-origin",
	);
	expect(response.headers.get("x-content-type-options")).toBe("nosniff");
	expect(response.headers.get("cache-control")).toBe("no-store");
}

describe("preview proxy", () => {
	it("answers a valid ?wt= with a 302 to / and the cookie with its four attributes", async () => {
		const token = await signPreviewToken(makeClaims(), KEY);
		const host = previewHost(PROJECT_ID, RUN_ID);

		const response = await dispatch(
			new Request(`https://${host}/?wt=${token}`),
		);

		expect(response.status).toBe(302);
		expect(response.headers.get("location")).toBe(`https://${host}/`);
		const setCookie = response.headers.get("set-cookie") ?? "";
		expect(setCookie).toContain(`${PREVIEW_COOKIE_NAME}=${token}`);
		expect(setCookie).toContain("Secure");
		expect(setCookie).toContain("HttpOnly");
		expect(setCookie).toContain("SameSite=None");
		expect(setCookie).toContain("Path=/");
		expectSecurityHeaders(response);
	});

	it("403s a token minted for another project", async () => {
		const token = await signPreviewToken(
			makeClaims({ pid: OTHER_PROJECT_ID }),
			KEY,
		);
		const host = previewHost(PROJECT_ID, RUN_ID);

		const response = await dispatch(
			new Request(`https://${host}/?wt=${token}`),
		);

		expect(response.status).toBe(403);
	});

	it("401s a token with a bad signature", async () => {
		const token = await signPreviewToken(makeClaims(), "wrong-key");
		const host = previewHost(PROJECT_ID, RUN_ID);

		const response = await dispatch(
			new Request(`https://${host}/?wt=${token}`),
		);

		expect(response.status).toBe(401);
	});

	it("401s an expired token: the token-expired page on a navigation, plain text otherwise", async () => {
		const token = await signPreviewToken(
			makeClaims({ exp: Math.floor(Date.now() / 1000) - 60 }),
			KEY,
		);
		const host = previewHost(PROJECT_ID, RUN_ID);

		const navigation = await dispatch(
			new Request(`https://${host}/?wt=${token}`, {
				headers: { "sec-fetch-mode": "navigate" },
			}),
		);
		const asset = await dispatch(new Request(`https://${host}/?wt=${token}`));

		expect(navigation.status).toBe(401);
		expect(navigation.headers.get("content-type")).toContain("text/html");
		const body = await navigation.text();
		expect(body).toContain("Preview session expired");
		expect(body).toContain(
			'parent.postMessage({"type":"wandit:preview","event":"token-expired"}',
		);
		expect(asset.status).toBe(401);
		expect(asset.headers.get("content-type")).toContain("text/plain");
	});

	it("401s a request with no ?wt= and no cookie, with the five headers", async () => {
		const host = previewHost(PROJECT_ID, RUN_ID);

		const response = await dispatch(new Request(`https://${host}/`));

		expect(response.status).toBe(401);
		expectSecurityHeaders(response);
	});

	it("forwards a cookie request with the upstream Host, without the wandit cookie, and adds the five headers", async () => {
		const token = await signPreviewToken(makeClaims(), KEY);
		const host = previewHost(PROJECT_ID, RUN_ID);
		let seenHeaders: Headers | Record<string, string> = {};
		fetchMock
			.get(UPSTREAM)
			.intercept({ path: "/app.js", query: { v: "1" } })
			.reply(
				200,
				(opts) => {
					seenHeaders = opts.headers;
					return "bundle";
				},
				{ headers: { "x-frame-options": "DENY" } },
			);

		const response = await dispatch(
			new Request(`https://${host}/app.js?v=1`, {
				headers: {
					cookie: `${PREVIEW_COOKIE_NAME}=${token}; theme=dark`,
				},
			}),
		);

		expect(response.status).toBe(200);
		expect(await response.text()).toBe("bundle");
		expect(headerOf(seenHeaders, "host")).toBe("x-5173.vercel.run");
		expect(headerOf(seenHeaders, "cookie")).toBe("theme=dark");
		expectSecurityHeaders(response);
		expect(response.headers.get("x-frame-options")).toBeNull();
	});

	it("returns a 101 WebSocket answer from the upstream untouched", async () => {
		// fetchMock hands every request with an Upgrade header to the real
		// fetch (test-internal.mjs), so this stubs globalThis.fetch: a network
		// stub, not a repo module mock. It records the Upgrade header and
		// answers 101 with the client side of a WebSocketPair.
		const realFetch = globalThis.fetch;
		const pair = new WebSocketPair();
		pair[1].accept();
		let upgradeSeen: string | null = null;
		globalThis.fetch = (input, init) => {
			upgradeSeen = new Request(input, init).headers.get("upgrade");
			return Promise.resolve(
				new Response(null, { status: 101, webSocket: pair[0] }),
			);
		};
		try {
			const token = await signPreviewToken(makeClaims(), KEY);
			const host = previewHost(PROJECT_ID, RUN_ID);

			const response = await dispatch(
				cookieRequest(`https://${host}/hmr`, token, {
					upgrade: "websocket",
				}),
			);

			expect(upgradeSeen).toBe("websocket");
			expect(response.status).toBe(101);
			expect(response.webSocket).not.toBeNull();
		} finally {
			globalThis.fetch = realFetch;
		}
	});

	it("answers 503 with Retry-After: 5 and the not-running page on an upstream fetch failure", async () => {
		const token = await signPreviewToken(makeClaims(), KEY);
		const host = previewHost(PROJECT_ID, RUN_ID);
		fetchMock
			.get(UPSTREAM)
			.intercept({ path: "/" })
			.replyWithError(new Error("connect ECONNREFUSED"));

		const response = await dispatch(cookieRequest(`https://${host}/`, token));

		expect(response.status).toBe(503);
		expect(response.headers.get("retry-after")).toBe("5");
		const body = await response.text();
		expect(body).toContain("Preview not running");
		expect(body).toContain('"event":"not-running"');
	});

	it("answers 503 when the upstream replies 502", async () => {
		const token = await signPreviewToken(makeClaims(), KEY);
		const host = previewHost(PROJECT_ID, RUN_ID);
		fetchMock.get(UPSTREAM).intercept({ path: "/" }).reply(502, "bad gateway");

		const response = await dispatch(cookieRequest(`https://${host}/`, token));

		expect(response.status).toBe(503);
		expect(response.headers.get("retry-after")).toBe("5");
	});

	it("answers 429 with Retry-After: 60 on request 601 of one jti", async () => {
		const token = await signPreviewToken(
			makeClaims({ jti: "jti-rate-limit-test-000000" }),
			KEY,
		);
		const host = previewHost(PROJECT_ID, RUN_ID);
		fetchMock
			.get(UPSTREAM)
			.intercept({ path: "/" })
			.reply(200, "ok")
			.times(600);

		let last: Response | undefined;
		for (let i = 0; i < 601; i++) {
			last = await dispatch(cookieRequest(`https://${host}/`, token));
		}

		expect(last?.status).toBe(429);
		expect(last?.headers.get("retry-after")).toBe("60");
	});

	it("writes preview:last-seen:<pid> to PREVIEW_KV on a forwarded request", async () => {
		const token = await signPreviewToken(
			makeClaims({ pid: SEEN_PROJECT_ID, rid: SEEN_RUN_ID }),
			KEY,
		);
		const host = previewHost(SEEN_PROJECT_ID, SEEN_RUN_ID);
		fetchMock.get(UPSTREAM).intercept({ path: "/" }).reply(200, "ok");

		const response = await dispatch(cookieRequest(`https://${host}/`, token));

		expect(response.status).toBe(200);
		const seen = await env.PREVIEW_KV.get(
			`preview:last-seen:${SEEN_PROJECT_ID}`,
		);
		expect(seen).toBeTruthy();
	});

	it("404s an unknown host with the five headers", async () => {
		const response = await dispatch(
			new Request(`https://${env.PREVIEW_DOMAIN}/`),
		);

		expect(response.status).toBe(404);
		expectSecurityHeaders(response);
	});

	it("redirects ?wt= with another query pair to the URL that keeps the other pair", async () => {
		const token = await signPreviewToken(makeClaims(), KEY);
		const host = previewHost(PROJECT_ID, RUN_ID);

		const response = await dispatch(
			new Request(`https://${host}/foo?x=1&wt=${token}`),
		);

		expect(response.status).toBe(302);
		expect(response.headers.get("location")).toBe(`https://${host}/foo?x=1`);
	});
});
