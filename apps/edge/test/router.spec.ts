import {
	createExecutionContext,
	env,
	fetchMock,
	waitOnExecutionContext,
} from "cloudflare:test";
import { afterEach, beforeAll, describe, expect, it } from "vitest";

import worker from "../src/index";

const PROJECT_ID = "11111111-1111-4111-8111-111111111111";
const HTML = "<html><body>hello from wandit</body></html>";

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

async function seedSite(host: string, pointer: Record<string, unknown>) {
	await env.PTR.put(`domain:${host}`, JSON.stringify(pointer));
	await env.SITES.put(`published/${PROJECT_ID}/current.html`, HTML);
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
});
