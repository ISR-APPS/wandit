import {
	createExecutionContext,
	env,
	fetchMock,
	waitOnExecutionContext,
} from "cloudflare:test";
import {
	appWorkerName,
	DEFAULT_APP_WORKER_LIMITS,
	type HostPointer,
} from "@wandit/contracts/v2/publish";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import worker, { type Env } from "../src/index";

const PROJECT_ID = "11111111-1111-4111-8111-111111111111";
const APP_PROJECT_ID = "33333333-3333-4333-8333-333333333333";
const HTML = "<html><body>hello from wandit</body></html>";

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

async function seedSite(host: string, pointer: Record<string, unknown>) {
	await env.PTR.put(`domain:${host}`, JSON.stringify(pointer));
	await env.SITES.put(`published/${PROJECT_ID}/current.html`, HTML);
}

// Every V2 test uses its own host: the router keeps a pointer in isolate
// memory for 10 s, and that memory outlives the per-test KV rollback.
async function seedApp(host: string, pointer: HostPointer) {
	await env.PTR.put(`domain:${host}`, JSON.stringify(pointer));
}

function appPointer(extra: Partial<HostPointer> = {}): HostPointer {
	return { projectId: APP_PROJECT_ID, kind: "app", source: "slug", ...extra };
}

/** One `DISPATCHER.get` call: the script name and the options the router passed. */
type DispatchCall = {
	name: string;
	options: DynamicDispatchOptions | undefined;
};

// The wrangler config declares DISPATCHER, but no user Worker runs in a
// test, so the tests hand the router a fake binding.
function fakeDispatcher(answer: (request: Request) => Promise<Response>): {
	env: Env;
	calls: DispatchCall[];
} {
	const calls: DispatchCall[] = [];
	const dispatcher: DispatchNamespace = {
		get(name, _args, options) {
			calls.push({ name, options });
			// SAFETY: the router calls only `fetch` on the Fetcher; connect, queue, and scheduled are never reached.
			return { fetch: answer } as Fetcher;
		},
	};
	return { env: { ...env, DISPATCHER: dispatcher }, calls };
}

/** A binding whose `get` throws `error`: the missing-script case, or a guard that the router never dispatched. */
function throwingDispatcher(error: Error): Env {
	return {
		...env,
		DISPATCHER: {
			get() {
				throw error;
			},
		},
	};
}

describe("edge router", () => {
	it("serves a slug host from the pointer + published object", async () => {
		await seedSite("acme.wandit.app", {
			projectId: PROJECT_ID,
			slug: "acme",
			source: "slug",
		});

		const response = await dispatch(new Request("https://acme.wandit.app/"));

		expect(response.status).toBe(200);
		expect(response.headers.get("content-type")).toContain("text/html");
		expect(response.headers.get("etag")).toBeTruthy();
		expect(response.headers.get("cache-control")).toBe("public, max-age=60");
		expect(await response.text()).toBe(HTML);
	});

	it("returns 304 when If-None-Match matches the object etag", async () => {
		await seedSite("acme.wandit.app", { projectId: PROJECT_ID });

		const first = await dispatch(new Request("https://acme.wandit.app/"));
		const etag = first.headers.get("etag");

		expect(etag).toBeTruthy();

		const second = await dispatch(
			new Request("https://acme.wandit.app/", {
				headers: { "if-none-match": etag ?? "" },
			}),
		);

		expect(second.status).toBe(304);
		expect(second.headers.get("etag")).toBe(etag);
	});

	it("serves a custom www host whose pointer has ONLY {projectId, source} — the domains-pipeline shape", async () => {
		// Regression test for the pointer contract: projectId is the only
		// required field. The domains pipeline writes exactly this shape.
		await seedSite("www.brand.com", {
			projectId: PROJECT_ID,
			source: "domain",
		});

		const response = await dispatch(new Request("https://www.brand.com/"));

		expect(response.status).toBe(200);
		expect(await response.text()).toBe(HTML);
	});

	it("301-redirects a bare apex custom domain to www, preserving path and query", async () => {
		const response = await dispatch(
			new Request("https://brand.com/pricing?utm=x"),
		);

		expect(response.status).toBe(301);
		expect(response.headers.get("location")).toBe(
			"https://www.brand.com/pricing?utm=x",
		);
	});

	it("404s an unknown host with no-store", async () => {
		const response = await dispatch(
			new Request("https://nobody-here.wandit.app/"),
		);

		expect(response.status).toBe(404);
		expect(response.headers.get("cache-control")).toBe("no-store");
		expect(await response.text()).toContain("isn’t available");
	});

	it("403s a suspended pointer", async () => {
		await seedSite("banned.wandit.app", {
			projectId: PROJECT_ID,
			status: "suspended",
		});

		const response = await dispatch(new Request("https://banned.wandit.app/"));

		expect(response.status).toBe(403);
		expect(await response.text()).toContain("suspended");
	});

	it("404s with the not-published page when the pointer exists but current.html does not", async () => {
		await env.PTR.put(
			"domain:ghost.wandit.app",
			JSON.stringify({ projectId: "22222222-2222-4222-8222-222222222222" }),
		);

		const response = await dispatch(new Request("https://ghost.wandit.app/"));

		expect(response.status).toBe(404);
		expect(response.headers.get("cache-control")).toBe("no-store");
		expect(await response.text()).toContain("hasn’t published");
	});

	it("answers the SaaS fallback origin with a health body", async () => {
		const response = await dispatch(
			new Request("https://customers.wandit.app/"),
		);

		expect(response.status).toBe(200);
		expect(await response.text()).toContain("wandit-edge: ok");
	});

	it("passes wandit.app and api.wandit.app through to the origin", async () => {
		fetchMock
			.get("https://wandit.app")
			.intercept({ path: "/" })
			.reply(200, "origin-marker");
		fetchMock
			.get("https://api.wandit.app")
			.intercept({ path: "/api/health" })
			.reply(200, "api-marker");

		const site = await dispatch(new Request("https://wandit.app/"));
		const api = await dispatch(
			new Request("https://api.wandit.app/api/health"),
		);

		expect(await site.text()).toBe("origin-marker");
		expect(await api.text()).toBe("api-marker");
	});

	it("405s non-GET/HEAD methods", async () => {
		await seedSite("acme.wandit.app", { projectId: PROJECT_ID });

		const response = await dispatch(
			new Request("https://acme.wandit.app/", { method: "POST" }),
		);

		expect(response.status).toBe(405);
		expect(response.headers.get("allow")).toBe("GET, HEAD");
	});

	it("serves the second GET from the edge cache even after the object is deleted", async () => {
		await seedSite("cached.wandit.app", { projectId: PROJECT_ID });

		const first = await dispatch(new Request("https://cached.wandit.app/"));

		expect(first.status).toBe(200);
		await first.text();

		// If the second response really comes from caches.default, deleting the
		// backing object cannot turn it into a 404.
		await env.SITES.delete(`published/${PROJECT_ID}/current.html`);

		const second = await dispatch(new Request("https://cached.wandit.app/"));

		expect(second.status).toBe(200);
		expect(await second.text()).toBe(HTML);
	});

	it("never touches the dispatcher for a V1 page pointer", async () => {
		await seedSite("plain.wandit.app", { projectId: PROJECT_ID });

		const response = await dispatch(
			new Request("https://plain.wandit.app/"),
			throwingDispatcher(new Error("dispatcher must not be called")),
		);

		expect(response.status).toBe(200);
		expect(await response.text()).toBe(HTML);
	});

	it("dispatches an app pointer to app-<projectId> with the default limits and returns the answer unchanged, plus the two safety headers", async () => {
		await seedApp("acme-app.wandit.app", appPointer());
		const { env: appEnv, calls } = fakeDispatcher(
			async () =>
				new Response("app-body", { status: 201, headers: { "x-app": "1" } }),
		);

		const response = await dispatch(
			new Request("https://acme-app.wandit.app/about"),
			appEnv,
		);

		expect(calls).toEqual([
			{
				name: appWorkerName(APP_PROJECT_ID),
				options: { limits: DEFAULT_APP_WORKER_LIMITS },
			},
		]);
		expect(response.status).toBe(201);
		expect(await response.text()).toBe("app-body");
		expect(response.headers.get("x-app")).toBe("1");
		expect(response.headers.get("x-content-type-options")).toBe("nosniff");
		expect(response.headers.get("referrer-policy")).toBe(
			"strict-origin-when-cross-origin",
		);
	});

	it("passes the method, path, query, headers, and body to the user Worker as the visitor sent them", async () => {
		await seedApp("post-app.wandit.app", appPointer());
		let seen:
			| { method: string; url: string; visitor: string | null; body: string }
			| undefined;
		const { env: appEnv } = fakeDispatcher(async (request) => {
			seen = {
				method: request.method,
				url: request.url,
				visitor: request.headers.get("x-visitor"),
				body: await request.text(),
			};
			return new Response("created", { status: 201 });
		});

		const response = await dispatch(
			new Request("https://post-app.wandit.app/api/items?x=1", {
				method: "POST",
				headers: { "x-visitor": "yes" },
				body: "payload",
			}),
			appEnv,
		);

		expect(response.status).toBe(201);
		expect(seen).toEqual({
			method: "POST",
			url: "https://post-app.wandit.app/api/items?x=1",
			visitor: "yes",
			body: "payload",
		});
	});

	it("keeps the safety headers the app sets itself", async () => {
		await seedApp("headers-app.wandit.app", appPointer());
		const { env: appEnv } = fakeDispatcher(
			async () =>
				new Response("ok", { headers: { "referrer-policy": "no-referrer" } }),
		);

		const response = await dispatch(
			new Request("https://headers-app.wandit.app/"),
			appEnv,
		);

		expect(response.headers.get("referrer-policy")).toBe("no-referrer");
		expect(response.headers.get("x-content-type-options")).toBe("nosniff");
	});

	it("passes the limits of the pointer to the dispatcher", async () => {
		const limits = { cpuMs: 30, subRequests: 5 };
		await seedApp("limits-app.wandit.app", appPointer({ limits }));
		const { env: appEnv, calls } = fakeDispatcher(
			async () => new Response("ok"),
		);

		await dispatch(new Request("https://limits-app.wandit.app/"), appEnv);

		expect(calls[0]?.options).toEqual({ limits });
	});

	it("404s with the not-published page and no-store when no Worker has the app name", async () => {
		await seedApp("ghost-app.wandit.app", appPointer());

		const response = await dispatch(
			new Request("https://ghost-app.wandit.app/"),
			throwingDispatcher(new Error("Worker not found: app-x")),
		);

		expect(response.status).toBe(404);
		expect(response.headers.get("cache-control")).toBe("no-store");
		expect(await response.text()).toContain("hasn’t published");
	});

	it("500s with the branded error page on any other dispatch error", async () => {
		await seedApp("boom-app.wandit.app", appPointer());
		const { env: appEnv } = fakeDispatcher(() =>
			Promise.reject(new Error("CPU limit exceeded")),
		);

		const response = await dispatch(
			new Request("https://boom-app.wandit.app/"),
			appEnv,
		);

		expect(response.status).toBe(500);
		expect(await response.text()).toContain("Something went wrong");
	});

	it("451s an abuse_ suspended app with the code in the page and never dispatches", async () => {
		await seedApp(
			"phishing-app.wandit.app",
			appPointer({ status: "suspended", reasonCode: "abuse_phishing" }),
		);

		const response = await dispatch(
			new Request("https://phishing-app.wandit.app/"),
			throwingDispatcher(new Error("dispatcher must not be called")),
		);

		expect(response.status).toBe(451);
		expect(response.headers.get("cache-control")).toBe("no-store");
		expect(await response.text()).toContain("abuse_phishing");
	});

	it("410s a billing suspended app and never dispatches", async () => {
		await seedApp(
			"unpaid-app.wandit.app",
			appPointer({ status: "suspended", reasonCode: "billing" }),
		);

		const response = await dispatch(
			new Request("https://unpaid-app.wandit.app/"),
			throwingDispatcher(new Error("dispatcher must not be called")),
		);

		expect(response.status).toBe(410);
		expect(response.headers.get("cache-control")).toBe("no-store");
		expect(await response.text()).toContain("billing");
	});

	it("410s a suspended app without a reason code", async () => {
		await seedApp("silent-app.wandit.app", appPointer({ status: "suspended" }));

		const response = await dispatch(
			new Request("https://silent-app.wandit.app/"),
			throwingDispatcher(new Error("dispatcher must not be called")),
		);

		expect(response.status).toBe(410);
		expect(await response.text()).toContain("not given");
	});

	it("returns a 101 WebSocket answer of the user Worker untouched", async () => {
		await seedApp("socket-app.wandit.app", appPointer());
		const pair = new WebSocketPair();
		pair[1].accept();
		const { env: appEnv } = fakeDispatcher(
			async () => new Response(null, { status: 101, webSocket: pair[0] }),
		);

		const response = await dispatch(
			new Request("https://socket-app.wandit.app/live", {
				headers: { upgrade: "websocket" },
			}),
			appEnv,
		);

		expect(response.status).toBe(101);
		expect(response.webSocket).not.toBeNull();
	});

	it("serves a pointer from isolate memory for 10 s, then reads KV again", async () => {
		vi.useFakeTimers({ toFake: ["Date"] });
		try {
			await seedApp("memo-app.wandit.app", appPointer());
			const { env: appEnv } = fakeDispatcher(async () => new Response("ok"));
			const request = () => new Request("https://memo-app.wandit.app/");

			const first = await dispatch(request(), appEnv);
			await env.PTR.delete("domain:memo-app.wandit.app");
			const second = await dispatch(request(), appEnv);
			vi.advanceTimersByTime(10_001);
			const third = await dispatch(request(), appEnv);

			expect(first.status).toBe(200);
			expect(second.status).toBe(200);
			expect(third.status).toBe(404);
		} finally {
			vi.useRealTimers();
		}
	});

	it("keeps a KV miss in isolate memory for 10 s", async () => {
		const first = await dispatch(new Request("https://late-app.wandit.app/"));
		await seedApp("late-app.wandit.app", appPointer());
		const second = await dispatch(
			new Request("https://late-app.wandit.app/"),
			fakeDispatcher(async () => new Response("ok")).env,
		);

		expect(first.status).toBe(404);
		expect(second.status).toBe(404);
	});

	it("forgets every cached pointer once 1,000 hosts fill the isolate memory", async () => {
		const appEnv = fakeDispatcher(async () => new Response("ok")).env;
		const first = await dispatch(new Request("https://evict-0.wandit.app/"));
		// 1,000 more misses: the map reaches its ceiling and clears.
		for (let i = 1; i <= 1_000; i++) {
			await dispatch(new Request(`https://evict-${i}.wandit.app/`));
		}
		await seedApp("evict-0.wandit.app", appPointer());
		const second = await dispatch(
			new Request("https://evict-0.wandit.app/"),
			appEnv,
		);

		expect(first.status).toBe(404);
		expect(second.status).toBe(200);
	});
});
