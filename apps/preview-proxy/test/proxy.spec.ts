import {
	createExecutionContext,
	env,
	fetchMock,
	waitOnExecutionContext,
} from "cloudflare:test";
import {
	PHONE_LINK_PATH,
	PREVIEW_COOKIE_NAME,
	type PreviewTokenClaims,
	packagerHostFor,
	parsePreviewHost,
	phonePreviewHostFor,
	phonePreviewLinkResponseSchema,
	previewHostFor,
	previewTokenClaimsSchema,
	signPreviewToken,
} from "@wandit/contracts";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import worker from "../src/index";

// Matches the PREVIEW_TOKEN_SIGNING_KEY binding in vitest.config.ts.
const KEY = "test-key";
const UPSTREAM = "https://x-5173.vercel.run";
const PROJECT_ID = "11111111-1111-4111-8111-111111111111";
const RUN_ID = "22222222-2222-4222-8222-222222222222";
const OTHER_PROJECT_ID = "33333333-3333-4333-8333-333333333333";
const OTHER_RUN_ID = "66666666-6666-4666-8666-666666666666";
// The last-seen test gets its own project: the module-level write map is
// per isolate, so a shared pid could already hold a write from an earlier test.
const SEEN_PROJECT_ID = "44444444-4444-4444-8444-444444444444";
const SEEN_RUN_ID = "55555555-5555-4555-8555-555555555555";
// Same reason as SEEN_PROJECT_ID: the module-level write map is per isolate,
// so this test needs a pid with no earlier write.
const THROTTLE_PROJECT_ID = "77777777-7777-4777-8777-777777777777";
const THROTTLE_RUN_ID = "88888888-8888-4888-8888-888888888888";
// A phone id of 21 base32 characters that no test mints.
const UNKNOWN_PHONE_ID = "aaaaaaaaaaaaaaaaaaaaa";

beforeAll(() => {
	fetchMock.activate();
	fetchMock.disableNetConnect();
});

afterEach(() => {
	fetchMock.assertNoPendingInterceptors();
});

async function dispatch(
	request: Request,
	envOverride: Env = env,
): Promise<Response> {
	const ctx = createExecutionContext();
	const response = await worker.fetch(request, envOverride, ctx);
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

// Mints a phone link through the Worker route and returns the phone host.
async function mintPhoneHost(
	claims: PreviewTokenClaims = makeClaims(),
): Promise<string> {
	const token = await signPreviewToken(claims, KEY);
	const response = await dispatch(
		new Request(
			`https://${previewHost(claims.pid, claims.rid)}${PHONE_LINK_PATH}`,
			{ method: "POST", body: token },
		),
	);
	const link = phonePreviewLinkResponseSchema.parse(await response.json());
	return link.expoUrl.slice("exps://".length);
}

// The KV row of a phone host, written by the mint route.
async function phoneRowOf(phoneHost: string): Promise<PreviewTokenClaims> {
	const parsed = parsePreviewHost(phoneHost, env.PREVIEW_DOMAIN);
	if (parsed?.kind !== "phone") {
		throw new Error(`not a phone host: ${phoneHost}`);
	}
	return previewTokenClaimsSchema.parse(
		await env.PREVIEW_KV.get(`phone:${parsed.phoneId}`, "json"),
	);
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

	it("403s a token minted for another run of the same project", async () => {
		const token = await signPreviewToken(
			makeClaims({ rid: OTHER_RUN_ID }),
			KEY,
		);
		const host = previewHost(PROJECT_ID, RUN_ID);

		const response = await dispatch(
			new Request(`https://${host}/?wt=${token}`),
		);

		expect(response.status).toBe(403);
	});

	it("drops an upstream Set-Cookie of the token cookie and keeps the app's own", async () => {
		const token = await signPreviewToken(makeClaims(), KEY);
		const host = previewHost(PROJECT_ID, RUN_ID);
		fetchMock
			.get(UPSTREAM)
			.intercept({ path: "/login" })
			.reply(200, "ok", {
				headers: {
					"set-cookie": [
						`${PREVIEW_COOKIE_NAME}=forged; Secure; Path=/`,
						"app_session=1; Path=/",
					],
				},
			});

		const response = await dispatch(
			cookieRequest(`https://${host}/login`, token),
		);

		expect(response.status).toBe(200);
		expect(response.headers.getSetCookie()).toEqual(["app_session=1; Path=/"]);
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
		// Metro builds its URLs from these, so the vendor host stays hidden.
		expect(headerOf(seenHeaders, "x-forwarded-host")).toBe(host);
		expect(headerOf(seenHeaders, "x-forwarded-proto")).toBe("https");
		expect(headerOf(seenHeaders, "cookie")).toBe("theme=dark");
		expectSecurityHeaders(response);
		expect(response.headers.get("x-frame-options")).toBeNull();
	});

	it("forwards a request whose only cookie is the wandit cookie with no Cookie header at all", async () => {
		const token = await signPreviewToken(makeClaims(), KEY);
		const host = previewHost(PROJECT_ID, RUN_ID);
		let seenHeaders: Headers | Record<string, string> = {};
		fetchMock
			.get(UPSTREAM)
			.intercept({ path: "/app.js" })
			.reply(200, (opts) => {
				seenHeaders = opts.headers;
				return "bundle";
			});

		const response = await dispatch(
			cookieRequest(`https://${host}/app.js`, token),
		);

		expect(response.status).toBe(200);
		expect(headerOf(seenHeaders, "cookie")).toBeNull();
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

	it("answers 500 with the error page and records outcome error when the proxy itself throws", async () => {
		const token = await signPreviewToken(makeClaims(), KEY);
		const host = previewHost(PROJECT_ID, RUN_ID);
		const points: AnalyticsEngineDataPoint[] = [];
		const envOverride: Env = {
			...env,
			// A binding that throws gives the same 500 branch as a bug inside the proxy.
			PREVIEW_RATE: {
				limit: () => Promise.reject(new Error("boom")),
			},
			PREVIEW_ANALYTICS: {
				writeDataPoint: (point: AnalyticsEngineDataPoint) => {
					points.push(point);
				},
			},
		};

		const response = await dispatch(
			cookieRequest(`https://${host}/`, token),
			envOverride,
		);

		expect(response.status).toBe(500);
		expect(await response.text()).toContain("Preview error");
		expectSecurityHeaders(response);
		expect(points).toHaveLength(1);
		expect(points[0]?.blobs?.[2]).toBe("error");
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

	it("writes preview:last-seen at most once per 60 s per project", async () => {
		const token = await signPreviewToken(
			makeClaims({ pid: THROTTLE_PROJECT_ID, rid: THROTTLE_RUN_ID }),
			KEY,
		);
		const host = previewHost(THROTTLE_PROJECT_ID, THROTTLE_RUN_ID);
		fetchMock.get(UPSTREAM).intercept({ path: "/" }).reply(200, "ok").times(2);
		// A spy on the third-party binding counts the writes; it calls through.
		const putSpy = vi.spyOn(env.PREVIEW_KV, "put");

		const first = await dispatch(cookieRequest(`https://${host}/`, token));
		const second = await dispatch(cookieRequest(`https://${host}/`, token));

		expect(first.status).toBe(200);
		expect(second.status).toBe(200);
		expect(putSpy).toHaveBeenCalledTimes(1);
		putSpy.mockRestore();
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

describe("phone link", () => {
	it("mints a phone link: 200 with the exps URL, CORS, and a 60-minute KV row with a new jti", async () => {
		const claims = makeClaims({ expoUsername: "zack" });
		const token = await signPreviewToken(claims, KEY);
		const before = Math.floor(Date.now() / 1000);

		const response = await dispatch(
			new Request(
				`https://${previewHost(PROJECT_ID, RUN_ID)}${PHONE_LINK_PATH}`,
				{ method: "POST", body: token },
			),
		);

		expect(response.status).toBe(200);
		expect(response.headers.get("access-control-allow-origin")).toBe("*");
		const link = phonePreviewLinkResponseSchema.parse(await response.json());
		const phoneHost = link.expoUrl.slice("exps://".length);
		expect(parsePreviewHost(phoneHost, env.PREVIEW_DOMAIN)).toMatchObject({
			kind: "phone",
			projectId: PROJECT_ID,
		});
		const row = await phoneRowOf(phoneHost);
		expect(row.exp).toBeGreaterThanOrEqual(before + 3600);
		expect(Date.parse(link.expiresAt)).toBe(row.exp * 1000);
		expect(row.jti).not.toBe(claims.jti);
		expect(row).toMatchObject({
			pid: PROJECT_ID,
			rid: RUN_ID,
			up: UPSTREAM,
			expoUsername: "zack",
		});
	});

	it("401s a mint with a bad signature and 403s a mint for another project, both readable by any origin", async () => {
		const badToken = await signPreviewToken(makeClaims(), "wrong-key");
		const otherToken = await signPreviewToken(
			makeClaims({ pid: OTHER_PROJECT_ID }),
			KEY,
		);
		const url = `https://${previewHost(PROJECT_ID, RUN_ID)}${PHONE_LINK_PATH}`;

		const bad = await dispatch(
			new Request(url, { method: "POST", body: badToken }),
		);
		const other = await dispatch(
			new Request(url, { method: "POST", body: otherToken }),
		);

		expect(bad.status).toBe(401);
		expect(bad.headers.get("access-control-allow-origin")).toBe("*");
		expect(other.status).toBe(403);
	});

	it("401s a phone host with no KV row as plain text, and the sandbox gets nothing", async () => {
		const host = phonePreviewHostFor(
			PROJECT_ID,
			UNKNOWN_PHONE_ID,
			env.PREVIEW_DOMAIN,
		);

		const response = await dispatch(
			new Request(`https://${host}/`, {
				headers: { "expo-platform": "ios" },
			}),
		);

		expect(response.status).toBe(401);
		expect(response.headers.get("content-type")).toContain("text/plain");
	});

	it("401s a phone host whose row expired before KV deleted it", async () => {
		const phoneHost = await mintPhoneHost();
		const row = await phoneRowOf(phoneHost);
		const parsed = parsePreviewHost(phoneHost, env.PREVIEW_DOMAIN);
		if (parsed?.kind !== "phone") {
			throw new Error("mint gave no phone host");
		}
		await env.PREVIEW_KV.put(
			`phone:${parsed.phoneId}`,
			JSON.stringify({ ...row, exp: Math.floor(Date.now() / 1000) - 1 }),
		);

		const response = await dispatch(new Request(`https://${phoneHost}/`));

		expect(response.status).toBe(401);
	});

	it("403s a phone id under the host of another project", async () => {
		const phoneHost = await mintPhoneHost();
		const parsed = parsePreviewHost(phoneHost, env.PREVIEW_DOMAIN);
		if (parsed?.kind !== "phone") {
			throw new Error("mint gave no phone host");
		}
		const swapped = phonePreviewHostFor(
			OTHER_PROJECT_ID,
			parsed.phoneId,
			env.PREVIEW_DOMAIN,
		);

		const response = await dispatch(new Request(`https://${swapped}/`));

		expect(response.status).toBe(403);
	});

	it("answers 429 with Retry-After: 60 when the budget is spent, on the mint route and on a phone host", async () => {
		const phoneHost = await mintPhoneHost();
		const token = await signPreviewToken(makeClaims(), KEY);
		// A binding that always refuses stands in for a spent budget.
		const envOverride: Env = {
			...env,
			PREVIEW_RATE: { limit: () => Promise.resolve({ success: false }) },
		};

		const mint = await dispatch(
			new Request(
				`https://${previewHost(PROJECT_ID, RUN_ID)}${PHONE_LINK_PATH}`,
				{ method: "POST", body: token },
			),
			envOverride,
		);
		const phone = await dispatch(
			new Request(`https://${phoneHost}/`),
			envOverride,
		);

		expect(mint.status).toBe(429);
		expect(mint.headers.get("retry-after")).toBe("60");
		expect(mint.headers.get("access-control-allow-origin")).toBe("*");
		expect(phone.status).toBe(429);
		expect(phone.headers.get("retry-after")).toBe("60");
	});

	it("passes a JSON answer on a path that is not a manifest path unchanged", async () => {
		const phoneHost = await mintPhoneHost(makeClaims({ expoUsername: "zack" }));
		const packagerHost = packagerHostFor(PROJECT_ID, env.PREVIEW_DOMAIN);
		const symbolicated = JSON.stringify({ stack: [{ file: packagerHost }] });
		fetchMock
			.get(UPSTREAM)
			.intercept({ path: "/symbolicate", method: "POST" })
			.reply(200, symbolicated, {
				headers: { "content-type": "application/json" },
			});

		const response = await dispatch(
			new Request(`https://${phoneHost}/symbolicate`, {
				method: "POST",
				body: "{}",
			}),
		);

		expect(await response.text()).toBe(symbolicated);
	});

	it("404s the fixed Metro host: it lives in manifests only", async () => {
		const response = await dispatch(
			new Request(
				`https://${packagerHostFor(PROJECT_ID, env.PREVIEW_DOMAIN)}/`,
			),
		);

		expect(response.status).toBe(404);
	});

	it("forwards a bundle request with no cookie and no redirect, with the phone host as x-forwarded-host", async () => {
		const phoneHost = await mintPhoneHost();
		let seenHeaders: Headers | Record<string, string> = {};
		fetchMock
			.get(UPSTREAM)
			.intercept({
				path: "/node_modules/expo-router/entry.bundle",
				query: { platform: "ios", dev: "true" },
			})
			.reply(200, (opts) => {
				seenHeaders = opts.headers;
				return "bundle";
			});

		const response = await dispatch(
			new Request(
				`https://${phoneHost}/node_modules/expo-router/entry.bundle?platform=ios&dev=true`,
			),
		);

		expect(response.status).toBe(200);
		expect(await response.text()).toBe("bundle");
		expect(headerOf(seenHeaders, "x-forwarded-host")).toBe(phoneHost);
		expect(headerOf(seenHeaders, "cookie")).toBeNull();
	});

	it("writes the phone host and the username into an application/expo+json manifest", async () => {
		const phoneHost = await mintPhoneHost(makeClaims({ expoUsername: "zack" }));
		const packagerHost = packagerHostFor(PROJECT_ID, env.PREVIEW_DOMAIN);
		const manifest = {
			launchAsset: { url: `https://${packagerHost}/index.bundle?platform=ios` },
			extra: {
				expoClient: { hostUri: packagerHost, name: "app" },
				expoGo: { debuggerHost: packagerHost, mainModuleName: "index" },
				scopeKey: "@anonymous/app",
			},
		};
		let seenPlatform: string | null = null;
		fetchMock
			.get(UPSTREAM)
			.intercept({ path: "/" })
			.reply(
				200,
				(opts) => {
					seenPlatform = headerOf(opts.headers, "expo-platform");
					return JSON.stringify(manifest);
				},
				{ headers: { "content-type": "application/expo+json" } },
			);

		const response = await dispatch(
			new Request(`https://${phoneHost}/`, {
				headers: {
					"expo-platform": "ios",
					accept: "application/expo+json,application/json",
				},
			}),
		);

		expect(response.status).toBe(200);
		expect(seenPlatform).toBe("ios");
		const body = await response.text();
		expect(body).not.toContain(`"${packagerHost}`);
		expect(body).not.toContain(`//${packagerHost}`);
		expect(JSON.parse(body)).toEqual({
			launchAsset: { url: `https://${phoneHost}/index.bundle?platform=ios` },
			extra: {
				expoClient: { hostUri: phoneHost, name: "app" },
				expoGo: {
					debuggerHost: phoneHost,
					mainModuleName: "index",
					username: "zack",
				},
				scopeKey: "@anonymous/app",
			},
		});
	});

	it("rewrites only the manifest part of a multipart/mixed manifest", async () => {
		const phoneHost = await mintPhoneHost(makeClaims({ expoUsername: "zack" }));
		const packagerHost = packagerHostFor(PROJECT_ID, env.PREVIEW_DOMAIN);
		const boundary = "----formdata-abc123";
		const manifestJson = JSON.stringify({
			launchAsset: { url: `https://${packagerHost}/index.bundle` },
			extra: { expoGo: { debuggerHost: packagerHost } },
		});
		const multipart = `--${boundary}\r\nContent-Disposition: form-data; name="manifest"; filename="manifest"\r\nContent-Type: application/json\r\n\r\n${manifestJson}\r\n--${boundary}--\r\n\r\n`;
		fetchMock
			.get(UPSTREAM)
			.intercept({ path: "/" })
			.reply(200, multipart, {
				headers: {
					"content-type": `multipart/mixed; boundary=${boundary}`,
				},
			});

		const response = await dispatch(
			new Request(`https://${phoneHost}/`, {
				headers: { "expo-platform": "android", accept: "multipart/mixed" },
			}),
		);

		const body = await response.text();
		// The part framing stays byte for byte; only the JSON between changes.
		const head = `--${boundary}\r\nContent-Disposition: form-data; name="manifest"; filename="manifest"\r\nContent-Type: application/json\r\n\r\n`;
		const tail = `\r\n--${boundary}--\r\n\r\n`;
		expect(body.startsWith(head)).toBe(true);
		expect(body.endsWith(tail)).toBe(true);
		expect(JSON.parse(body.slice(head.length, -tail.length))).toEqual({
			launchAsset: { url: `https://${phoneHost}/index.bundle` },
			extra: { expoGo: { debuggerHost: phoneHost, username: "zack" } },
		});
	});

	it("leaves the manifest username out when the user typed none", async () => {
		const phoneHost = await mintPhoneHost();
		fetchMock
			.get(UPSTREAM)
			.intercept({ path: "/" })
			.reply(200, JSON.stringify({ extra: { expoGo: {} } }), {
				headers: { "content-type": "application/json" },
			});

		const response = await dispatch(
			new Request(`https://${phoneHost}/`, {
				headers: { "expo-platform": "android" },
			}),
		);

		expect(JSON.parse(await response.text())).toEqual({
			extra: { expoGo: {} },
		});
	});

	it("passes a Metro /hot WebSocket upgrade on a phone host", async () => {
		const phoneHost = await mintPhoneHost();
		// Same network stub as the run-host WebSocket test: fetchMock hands
		// every Upgrade request to the real fetch.
		const realFetch = globalThis.fetch;
		const pair = new WebSocketPair();
		pair[1].accept();
		let upstreamUrl: string | null = null;
		globalThis.fetch = (input, init) => {
			upstreamUrl = new Request(input, init).url;
			return Promise.resolve(
				new Response(null, { status: 101, webSocket: pair[0] }),
			);
		};
		try {
			const response = await dispatch(
				new Request(`https://${phoneHost}/hot`, {
					headers: { upgrade: "websocket" },
				}),
			);

			expect(response.status).toBe(101);
			expect(upstreamUrl).toBe(`${UPSTREAM}/hot`);
		} finally {
			globalThis.fetch = realFetch;
		}
	});
});
