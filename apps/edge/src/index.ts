/**
 * wandit-edge — serves every published customer site.
 *
 * One Worker on the `*\/*` route of the wandit.app zone answers:
 *   {slug}.wandit.app        — subdomain sites
 *   www.{customer-domain}    — purchased/BYO domains (Cloudflare for SaaS;
 *                              their requests arrive with the CUSTOMER's Host,
 *                              which is why the route must be `*\/*`)
 *
 * Resolution: Host → KV pointer `domain:{host}` → one of two paths.
 *   V1 page: R2 object `published/{projectId}/current.html` → stream.
 *   V2 app (`pointer.kind === "app"`): the user Worker `app-{projectId}` in
 *   the dispatch namespace answers the request as it is.
 *
 * POINTER CONTRACT (do not tighten): `projectId` is the ONLY required field.
 * The domains pipeline writes `{projectId, source:"domain"}` and publishing
 * writes `{projectId, source:"slug", slug}` — every field except projectId is
 * optional and readers must tolerate unknown extras. The fields live in
 * `packages/contracts/src/v2/publish.ts`. Key format is owned by
 * apps/server/src/modules/domains/infrastructure/cloudflare/domain-routing.service.ts.
 *
 * R2 key format is owned by apps/server/src/infrastructure/storage/r2.ts
 * (publishedCurrentKey) — keep the two literal builders below in lockstep.
 */
import {
	appWorkerName,
	DEFAULT_APP_WORKER_LIMITS,
	type HostPointer,
} from "@wandit/contracts/v2/publish";
import { edgeSentryOptions, Sentry } from "@wandit/observability/cloudflare";

import {
	errorPage,
	healthPage,
	notFoundPage,
	notPublishedPage,
	suspendedAppPage,
	suspendedPage,
} from "./pages";

export interface Env {
	PTR: KVNamespace;
	SITES: R2Bucket;
	/** Workers for Platforms namespace of the user Workers. WANDIT-200 adds the binding. */
	DISPATCHER: DispatchNamespace;
	// Unset locally → Sentry disabled. Set via wrangler vars/secrets in prod.
	SENTRY_DSN?: string;
	SENTRY_ENVIRONMENT?: string;
	// Provided by the version_metadata binding; the SDK derives the release.
	CF_VERSION_METADATA?: { id: string; tag: string };
}

// The zone all subdomain sites live on. The app hostnames below are also
// covered by dashboard route exclusions; this in-Worker list is the
// belt-and-braces layer (see docs/features/edge-serving.md).
const SITES_ZONE = "wandit.app";
const PASSTHROUGH_HOSTS = new Set([
	SITES_ZONE,
	`www.${SITES_ZONE}`,
	`api.${SITES_ZONE}`,
]);
// The Cloudflare-for-SaaS fallback origin. A real first-level subdomain of
// the zone, so `*/*` catches it; it must answer 200 and never resolve as a
// customer slug.
const FALLBACK_ORIGIN_HOST = `customers.${SITES_ZONE}`;

// Mirrors publishedCurrentKey in apps/server/src/infrastructure/storage/r2.ts.
function publishedCurrentKey(projectId: string): string {
	return `published/${projectId}/current.html`;
}

// Mirrors the key prefix in domain-routing.service.ts.
function pointerKey(host: string): string {
	return `domain:${host}`;
}

/** 10 s: a publish, a suspend, or an unpublish reaches every isolate within this time. */
const POINTER_CACHE_TTL_MS = 10_000;
/** Past this many hosts the isolate forgets all of them instead of growing. */
const POINTER_CACHE_MAX_HOSTS = 1_000;

type PointerCacheEntry = {
	/** The KV value, or null when KV has no key for the host (a miss). */
	pointer: HostPointer | null;
	/** Unix ms after which the entry is stale. */
	expiresAt: number;
};

// LIMIT: one map per isolate, at most 1,000 hosts. Upgrade: an LRU map.
const pointerCache = new Map<string, PointerCacheEntry>();

/** Reads `domain:{host}` from KV. A hit and a miss both stay in isolate memory for 10 s. */
async function readPointer(
	env: Env,
	host: string,
): Promise<HostPointer | null> {
	const now = Date.now();
	const cached = pointerCache.get(host);
	if (cached !== undefined && cached.expiresAt > now) {
		return cached.pointer;
	}
	const pointer = await env.PTR.get<HostPointer>(pointerKey(host), {
		cacheTtl: 60,
		type: "json",
	});
	if (pointerCache.size >= POINTER_CACHE_MAX_HOSTS) {
		pointerCache.clear();
	}
	pointerCache.set(host, { pointer, expiresAt: now + POINTER_CACHE_TTL_MS });
	return pointer;
}

function isLocalProbeHost(host: string): boolean {
	return (
		host === "localhost" || host === "127.0.0.1" || /^[0-9.:[\]]+$/.test(host)
	);
}

function htmlResponse(
	body: string,
	status: number,
	cacheControl = "no-store",
): Response {
	return new Response(body, {
		headers: {
			"cache-control": cacheControl,
			"content-type": "text/html; charset=utf-8",
		},
		status,
	});
}

const handler = {
	async fetch(
		request: Request,
		env: Env,
		ctx: ExecutionContext,
	): Promise<Response> {
		try {
			return await serve(request, env, ctx);
		} catch (error) {
			// Workers Logs must always get the error — it's the only record
			// when the DSN is unset or Sentry delivery fails.
			console.error("wandit-edge request failed:", error);
			// withSentry only auto-captures THROWN errors. We answer with a
			// branded page instead of Cloudflare's 1101 error screen, so the
			// capture has to be explicit before returning.
			Sentry.captureException(error);
			return htmlResponse(errorPage(), 500);
		}
	},
} satisfies ExportedHandler<Env>;

export default Sentry.withSentry((env: Env) => edgeSentryOptions(env), handler);

async function serve(
	request: Request,
	env: Env,
	ctx: ExecutionContext,
): Promise<Response> {
	const url = new URL(request.url);
	const host = url.hostname.toLowerCase();

	// App surfaces are not ours to answer — hand the request to the origin.
	if (PASSTHROUGH_HOSTS.has(host)) {
		return fetch(request);
	}

	// SaaS fallback origin (and bare local-dev probes): static health body.
	if (host === FALLBACK_ORIGIN_HOST || isLocalProbeHost(host)) {
		return new Response(healthPage(), {
			headers: {
				"cache-control": "no-store",
				"content-type": "text/plain; charset=utf-8",
			},
			status: 200,
		});
	}

	// Apex custom domains redirect to www BEFORE any KV lookup — no apex
	// pointer key ever exists (registrar-side forwarding does the same for
	// purchased domains; this covers customers who point the apex at us).
	if (!host.endsWith(`.${SITES_ZONE}`) && !host.startsWith("www.")) {
		return Response.redirect(
			`https://www.${host}${url.pathname}${url.search}`,
			301,
		);
	}

	const pointer = await readPointer(env, host);

	if (!pointer?.projectId) {
		return htmlResponse(notFoundPage(), 404);
	}

	// A V2 app owns its methods, paths, and cache headers: no 405 and no
	// caches.default on this path. A pointer without `kind` is a V1 page.
	if (pointer.kind === "app") {
		return serveV2App(request, env, pointer);
	}

	return serveV1Page(request, env, ctx, pointer);
}

/** The V1 path: one HTML object per project from R2, cached 60 s at the edge. */
async function serveV1Page(
	request: Request,
	env: Env,
	ctx: ExecutionContext,
	pointer: HostPointer,
): Promise<Response> {
	// Published sites are static documents; nothing else is served here.
	if (request.method !== "GET" && request.method !== "HEAD") {
		return new Response("Method Not Allowed", {
			headers: { allow: "GET, HEAD" },
			status: 405,
		});
	}

	/*
	 * Legacy Cache API on purpose — it keys on the full URL INCLUDING host.
	 * The newer `ctx.cache` is host-blind (one entry per path shared across
	 * every customer domain), which here would serve customer A's page on
	 * customer B's domain. Never switch without the ctx.props two-entrypoint
	 * isolation described in docs/features/edge-serving.md.
	 */
	const cache = caches.default;
	const cached = await cache.match(request);

	if (cached) {
		return cached;
	}

	if (pointer.status === "suspended") {
		return htmlResponse(suspendedPage(), 403);
	}

	const object = await env.SITES.get(publishedCurrentKey(pointer.projectId));

	if (!object) {
		return htmlResponse(notPublishedPage(), 404);
	}

	if (request.headers.get("if-none-match") === object.httpEtag) {
		return new Response(null, {
			headers: {
				"cache-control": "public, max-age=60",
				etag: object.httpEtag,
			},
			status: 304,
		});
	}

	const response = new Response(object.body, {
		headers: {
			"cache-control": "public, max-age=60",
			"content-type": "text/html; charset=utf-8",
			etag: object.httpEtag,
		},
		status: 200,
	});

	// waitUntil work runs after the handler's try/catch — a rejection here
	// would otherwise vanish (the visitor already has their page; only the
	// cache write is lost).
	ctx.waitUntil(
		cache.put(request, response.clone()).catch((error: unknown) => {
			console.error("wandit-edge cache.put failed:", error);
			Sentry.captureException(error);
		}),
	);

	return response;
}

/**
 * The V2 path: the user Worker of the app answers the request as the
 * visitor sent it. Its answer streams back with its own status, body, and
 * headers; only two safety headers fill in when the app sets none.
 */
async function serveV2App(
	request: Request,
	env: Env,
	pointer: HostPointer,
): Promise<Response> {
	// A suspended app never runs: the answer comes before any dispatch.
	if (pointer.status === "suspended") {
		// 451 is the legal-block code, for abuse and legal reasons. Every
		// other reason, for example billing or no code, is 410 (gone).
		const code = pointer.reasonCode ?? "";
		const isLegalBlock = code.startsWith("abuse_") || code.startsWith("legal_");
		return htmlResponse(
			suspendedAppPage(pointer.reasonCode),
			isLegalBlock ? 451 : 410,
		);
	}

	let upstream: Response;
	try {
		const userWorker = env.DISPATCHER.get(
			appWorkerName(pointer.projectId),
			{},
			{ limits: pointer.limits ?? DEFAULT_APP_WORKER_LIMITS },
		);
		upstream = await userWorker.fetch(request);
	} catch (error) {
		// The namespace throws "Worker not found" when no script has the name:
		// the app was never published or is unpublished. Every other failure
		// rethrows: the handler logs it, captures it, and answers the 500 page.
		if (
			error instanceof Error &&
			error.message.startsWith("Worker not found")
		) {
			return htmlResponse(notPublishedPage(), 404);
		}
		throw error;
	}

	// A 101 answer is a live socket; it returns untouched, or the upgrade breaks.
	if (upstream.webSocket !== null) {
		return upstream;
	}

	// The app owns its headers, including CSP. A fetch Response has immutable
	// headers, so copy them before the two safety headers fill in.
	const headers = new Headers(upstream.headers);
	if (!headers.has("x-content-type-options")) {
		headers.set("x-content-type-options", "nosniff");
	}
	if (!headers.has("referrer-policy")) {
		headers.set("referrer-policy", "strict-origin-when-cross-origin");
	}
	return new Response(upstream.body, {
		status: upstream.status,
		statusText: upstream.statusText,
		headers,
	});
}
