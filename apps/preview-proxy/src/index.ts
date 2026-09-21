/**
 * wandit-preview-proxy — gates and forwards preview traffic on the preview
 * domain.
 *
 * Runs on `*.wanditpreview.app/*`. The host `r-<rid12>--p-<projectId>.<domain>`
 * names one project run; a signed token (`?wt=` once, then the
 * `__Host-wandit_preview` cookie) proves the user may see it. Verified
 * requests forward to the sandbox origin in the token claim `up`.
 * The API mints tokens at GET /api/v2/projects/:id/preview-token.
 */
import {
	PREVIEW_COOKIE_NAME,
	PREVIEW_TOKEN_QUERY,
	type PreviewTokenClaims,
	parsePreviewHost,
	rid12Of,
	verifyPreviewToken,
} from "@wandit/contracts";

import {
	applySecurityHeaders,
	securityHeaders,
	stripCookieValue,
} from "./headers";
import { notRunningPage, proxyErrorPage, tokenExpiredPage } from "./pages";
import { exchangeRedirect, readCookieValue } from "./token";

declare global {
	// Secret set with `wrangler secret put`; secrets never sit in wrangler.jsonc,
	// so the generated Env in worker-configuration.d.ts cannot hold it.
	interface Env {
		PREVIEW_TOKEN_SIGNING_KEY: string;
	}
}

/**
 * Buckets of the Analytics Engine data point; one value per request.
 * `error` means the proxy itself failed; `not_running` stays the
 * stopped-sandbox signal.
 */
type Outcome =
	| "forwarded"
	| "redirect"
	| "unauthorized"
	| "forbidden"
	| "not_running"
	| "rate_limited"
	| "not_found"
	| "error";

/** The response plus the fields the Analytics Engine data point needs. */
type HandlerResult = {
	response: Response;
	/** Project id from the host label; "" when the host is not a preview host. */
	pid: string;
	/** Run id prefix from the host label; "" when the host is not a preview host. */
	rid12: string;
	outcome: Outcome;
};

/** The non-null half of `parsePreviewHost`. */
type PreviewHost = { projectId: string; rid12: string };

/**
 * `pid` → unix ms of the last `preview:last-seen` write, per isolate.
 * LIMIT: per isolate. Upgrade: none needed, the sweep tolerates a late key.
 */
const lastSeenWriteMs = new Map<string, number>();
/** 60 s between two `preview:last-seen` writes of the same project. */
const LAST_SEEN_INTERVAL_MS = 60_000;

const handler = {
	async fetch(
		request: Request,
		env: Env,
		ctx: ExecutionContext,
	): Promise<Response> {
		const startedAt = Date.now();
		let pid = "";
		let rid12 = "";
		let outcome: Outcome = "not_found";
		let response: Response;
		try {
			({ response, pid, rid12, outcome } = await serve(request, env, ctx));
		} catch (error) {
			// An error must never leak a stack into the preview frame.
			console.error("preview-proxy request failed:", error);
			const headers = securityHeaders(env.FRAME_ANCESTORS);
			headers.set("content-type", "text/html; charset=utf-8");
			response = new Response(proxyErrorPage(), { status: 500, headers });
			// A proxy bug must not count as a stopped sandbox.
			outcome = "error";
		}
		writeDataPoint(
			env,
			pid,
			rid12,
			outcome,
			response.status,
			Date.now() - startedAt,
		);
		return response;
	},
} satisfies ExportedHandler<Env>;

export default handler;

async function serve(
	request: Request,
	env: Env,
	ctx: ExecutionContext,
): Promise<HandlerResult> {
	const url = new URL(request.url);

	// The host names the project and the run. A host that is not a preview
	// host gets 404.
	const host = parsePreviewHost(url.hostname, env.PREVIEW_DOMAIN);
	if (host === null) {
		return result(
			{ projectId: "", rid12: "" },
			"not_found",
			plain("Not found", 404, env),
		);
	}

	// The token arrives once as `?wt=`. Later requests carry it in the cookie.
	const queryToken = url.searchParams.get(PREVIEW_TOKEN_QUERY);
	const token =
		queryToken ??
		readCookieValue(request.headers.get("cookie"), PREVIEW_COOKIE_NAME);
	if (token === null || token === "") {
		return denied(request, env, host, "unauthorized");
	}

	const verified = await verifyPreviewToken(
		token,
		env.PREVIEW_TOKEN_SIGNING_KEY,
		// The token exp is in unix seconds.
		Math.floor(Date.now() / 1000),
	);
	if (!verified.ok) {
		return denied(request, env, host, "unauthorized");
	}
	const { claims } = verified;

	// The token is bound to one project and one run; the host must agree.
	if (claims.pid !== host.projectId || rid12Of(claims.rid) !== host.rid12) {
		return denied(request, env, host, "forbidden");
	}

	// One token id gets a fixed request budget per minute.
	const { success } = await env.PREVIEW_RATE.limit({ key: claims.jti });
	if (!success) {
		const response = plain("Too many requests", 429, env);
		response.headers.set("retry-after", "60");
		return result(host, "rate_limited", response);
	}

	if (queryToken !== null) {
		// Store the token in the cookie and drop it from the URL.
		return result(
			host,
			"redirect",
			exchangeRedirect(url, queryToken, env.FRAME_ANCESTORS),
		);
	}

	// A forwarded request means someone watches the preview.
	touchLastSeen(env, ctx, claims.pid);

	// Forward the request. A dead upstream answers 503.
	return forward(request, url, claims, env, host);
}

/** Builds a HandlerResult: the response plus the host ids for the metric. */
function result(
	host: PreviewHost,
	outcome: Outcome,
	response: Response,
): HandlerResult {
	return { response, pid: host.projectId, rid12: host.rid12, outcome };
}

/** 401 and 403 share the path; only the body differs. */
function denied(
	request: Request,
	env: Env,
	host: PreviewHost,
	outcome: "unauthorized" | "forbidden",
): HandlerResult {
	const response =
		outcome === "unauthorized"
			? unauthorized(request, env)
			: plain("Forbidden", 403, env);
	return result(host, outcome, response);
}

/** 401: HTML on a navigation request, plain text on an asset request. */
function unauthorized(request: Request, env: Env): Response {
	if (wantsHtmlPage(request)) {
		const headers = securityHeaders(env.FRAME_ANCESTORS);
		headers.set("content-type", "text/html; charset=utf-8");
		return new Response(tokenExpiredPage(), { status: 401, headers });
	}
	return plain("Preview token missing or expired", 401, env);
}

/** A navigation request asks for HTML it can show (or an iframe shows). */
function wantsHtmlPage(request: Request): boolean {
	return (
		request.headers.get("sec-fetch-mode") === "navigate" ||
		(request.headers.get("accept")?.includes("text/html") ?? false)
	);
}

/** 503 on a fetch failure or an upstream 502/503/504: the stopped page. */
function notRunning(env: Env, host: PreviewHost): HandlerResult {
	const headers = securityHeaders(env.FRAME_ANCESTORS);
	headers.set("retry-after", "5");
	headers.set("content-type", "text/html; charset=utf-8");
	return result(
		host,
		"not_running",
		new Response(notRunningPage(), { status: 503, headers }),
	);
}

async function forward(
	request: Request,
	url: URL,
	claims: PreviewTokenClaims,
	env: Env,
	host: PreviewHost,
): Promise<HandlerResult> {
	const upstreamUrl = new URL(url.toString());
	const origin = new URL(claims.up);
	upstreamUrl.protocol = origin.protocol;
	upstreamUrl.host = origin.host;

	// `new Request(url, request)` copies method, headers, and body.
	const upstreamRequest = new Request(upstreamUrl, request);
	// The upstream sees the sandbox host, not the preview host.
	upstreamRequest.headers.set("host", origin.host);
	const cookieHeader = upstreamRequest.headers.get("cookie");
	if (cookieHeader !== null) {
		const kept = stripCookieValue(cookieHeader, PREVIEW_COOKIE_NAME);
		if (kept === null) {
			upstreamRequest.headers.delete("cookie");
		} else {
			upstreamRequest.headers.set("cookie", kept);
		}
	}

	let upstream: Response;
	try {
		upstream = await fetch(upstreamRequest, { redirect: "manual" });
	} catch (error) {
		// LIMIT: a stopped sandbox is detected by the fetch failure only. Upgrade: a vendor status probe.
		console.error("preview-proxy upstream fetch failed:", error);
		return notRunning(env, host);
	}

	// A 101 answer is a live socket; it returns untouched, without the
	// security headers, or the upgrade breaks.
	if (upstream.webSocket !== null) {
		return result(host, "forwarded", upstream);
	}

	if (
		upstream.status === 502 ||
		upstream.status === 503 ||
		upstream.status === 504
	) {
		return notRunning(env, host);
	}

	// A fetch Response has immutable headers; copy before we set ours.
	const headers = new Headers(upstream.headers);
	// The app answers on the proxy origin, so its Set-Cookie could replace
	// the token cookie and lock the viewer out. Only the app's cookies pass.
	const appCookies = headers
		.getSetCookie()
		.filter((cookie) => !cookie.startsWith(`${PREVIEW_COOKIE_NAME}=`));
	headers.delete("set-cookie");
	for (const cookie of appCookies) {
		headers.append("set-cookie", cookie);
	}
	applySecurityHeaders(headers, env.FRAME_ANCESTORS);
	const response = new Response(upstream.body, {
		status: upstream.status,
		statusText: upstream.statusText,
		headers,
	});
	return result(host, "forwarded", response);
}

/**
 * Writes `preview:last-seen:<pid>` through `ctx.waitUntil`; the idle sweep
 * reads it to keep a watched sandbox up. At most one write per 60 s.
 */
function touchLastSeen(env: Env, ctx: ExecutionContext, pid: string): void {
	const now = Date.now();
	if (now - (lastSeenWriteMs.get(pid) ?? 0) < LAST_SEEN_INTERVAL_MS) {
		return;
	}
	lastSeenWriteMs.set(pid, now);
	ctx.waitUntil(
		env.PREVIEW_KV.put(
			`preview:last-seen:${pid}`,
			new Date(now).toISOString(),
		).catch((error: unknown) => {
			// A lost heartbeat must not fail a request that already succeeded.
			console.error("preview-proxy last-seen write failed:", error);
		}),
	);
}

/** One Analytics Engine data point per request; a failure only logs. */
function writeDataPoint(
	env: Env,
	pid: string,
	rid12: string,
	outcome: Outcome,
	status: number,
	durationMs: number,
): void {
	try {
		env.PREVIEW_ANALYTICS.writeDataPoint({
			blobs: [pid, rid12, outcome],
			doubles: [status, durationMs],
			indexes: [pid],
		});
	} catch (error) {
		// Metrics must never fail a request.
		console.error("preview-proxy analytics write failed:", error);
	}
}

/** A plain-text response with the five security headers. */
function plain(body: string, status: number, env: Env): Response {
	const headers = securityHeaders(env.FRAME_ANCESTORS);
	headers.set("content-type", "text/plain; charset=utf-8");
	return new Response(body, { status, headers });
}
