/**
 * wandit-preview-proxy — gates and forwards preview traffic on the preview
 * domain.
 *
 * Runs on `*.wanditpreview.app/*`. The host `r-<rid12>--p-<projectId>.<domain>`
 * names one project run; a signed token (`?wt=` once, then the
 * `__Host-wandit_preview` cookie) proves the user may see it. The host
 * `m-<phoneId>--p-<projectId>.<domain>` is a phone link for Expo Go; its
 * `PREVIEW_KV` row holds the claims. Verified requests forward to the
 * sandbox origin in the claim `up`. The API mints tokens at
 * GET /api/v2/projects/:id/preview-token; this Worker mints phone links.
 */
import {
	PHONE_LINK_PATH,
	PHONE_LINK_TTL_SECONDS,
	type PhonePreviewLinkResponse,
	PREVIEW_COOKIE_NAME,
	PREVIEW_TOKEN_QUERY,
	type PreviewHost,
	type PreviewTokenClaims,
	packagerHostFor,
	parsePreviewHost,
	phonePreviewHostFor,
	previewTokenClaimsSchema,
	rid12Of,
	verifyPreviewToken,
} from "@wandit/contracts";

import {
	applySecurityHeaders,
	securityHeaders,
	stripCookieValue,
} from "./headers";
import {
	isManifestContentType,
	isManifestPath,
	type ManifestRewrite,
	rewriteManifestBody,
} from "./manifest";
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
	| "phone_link"
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

/** Project id and run id prefix of one request, for the checks and the metric. */
type HostIds = { projectId: string; rid12: string };

/** A parsed `r-` host. */
type RunHost = Extract<PreviewHost, { kind: "run" }>;

/** A parsed `m-` host. */
type PhoneHost = Extract<PreviewHost, { kind: "phone" }>;

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

	// The host names the project and the run or the phone link. A host that
	// is not a preview host gets 404.
	const host = parsePreviewHost(url.hostname, env.PREVIEW_DOMAIN);
	if (host === null) {
		return result(
			{ projectId: "", rid12: "" },
			"not_found",
			plain("Not found", 404, env),
		);
	}
	if (host.kind === "phone") {
		return servePhone(request, url, env, ctx, host);
	}
	// The mint route belongs to the Worker; the sandbox never sees it.
	if (url.pathname === PHONE_LINK_PATH && request.method === "POST") {
		return mintPhoneLink(request, env, host);
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
		nowSeconds(),
	);
	if (!verified.ok) {
		return denied(request, env, host, "unauthorized");
	}
	const { claims } = verified;

	// The token is bound to one project and one run; the host must agree.
	if (!isRunHostOf(claims, host)) {
		return denied(request, env, host, "forbidden");
	}

	// One token id gets a fixed request budget per minute.
	const { success } = await env.PREVIEW_RATE.limit({ key: claims.jti });
	if (!success) {
		return result(host, "rate_limited", tooManyRequests(env));
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
	return forward(request, url, claims, env, host, undefined);
}

/**
 * `POST <run host>/__wandit/phone-link` with a phone preview token as the
 * plain-text body. Writes the `phone:<id>` row to `PREVIEW_KV` and answers
 * the `exps://` URL of the new phone host. The builder page and the API
 * call it; a new link per call keeps a leaked link short-lived.
 */
async function mintPhoneLink(
	request: Request,
	env: Env,
	host: RunHost,
): Promise<HandlerResult> {
	const verified = await verifyPreviewToken(
		(await request.text()).trim(),
		env.PREVIEW_TOKEN_SIGNING_KEY,
		nowSeconds(),
	);
	if (!verified.ok) {
		return result(
			host,
			"unauthorized",
			withAnyOrigin(plain("Preview token missing or expired", 401, env)),
		);
	}
	const { claims } = verified;
	// The token is bound to one project and one run; the host must agree.
	if (!isRunHostOf(claims, host)) {
		return result(
			host,
			"forbidden",
			withAnyOrigin(plain("Forbidden", 403, env)),
		);
	}
	// Minting spends the request budget of the token id.
	const { success } = await env.PREVIEW_RATE.limit({ key: claims.jti });
	if (!success) {
		return result(host, "rate_limited", withAnyOrigin(tooManyRequests(env)));
	}

	const phoneId = newPhoneId();
	const exp = nowSeconds() + PHONE_LINK_TTL_SECONDS;
	// A new jti gives the phone link its own rate budget.
	const row: PreviewTokenClaims = { ...claims, exp, jti: crypto.randomUUID() };
	await env.PREVIEW_KV.put(phoneLinkKey(phoneId), JSON.stringify(row), {
		expirationTtl: PHONE_LINK_TTL_SECONDS,
	});
	const link: PhonePreviewLinkResponse = {
		expoUrl: `exps://${phonePreviewHostFor(host.projectId, phoneId, env.PREVIEW_DOMAIN)}`,
		expiresAt: new Date(exp * 1000).toISOString(),
	};
	const headers = securityHeaders(env.FRAME_ANCESTORS);
	headers.set("content-type", "application/json; charset=utf-8");
	return result(
		host,
		"phone_link",
		withAnyOrigin(new Response(JSON.stringify(link), { status: 200, headers })),
	);
}

/**
 * Serves one request on a phone host. Expo Go sends no cookie, so the
 * `PREVIEW_KV` row of the phone id holds the claims. A missing, broken,
 * or expired row answers a plain 401, and nothing reaches the sandbox.
 */
async function servePhone(
	request: Request,
	url: URL,
	env: Env,
	ctx: ExecutionContext,
	host: PhoneHost,
): Promise<HandlerResult> {
	const row = await readPhoneLink(env, host.phoneId);
	// KV deletes an expired row late; the exp check is exact.
	if (row === null || row.exp <= nowSeconds()) {
		return result(
			// No row, so no run id for the metric.
			{ projectId: host.projectId, rid12: "" },
			"unauthorized",
			plain("Phone link missing or expired", 401, env),
		);
	}
	const ids: HostIds = { projectId: host.projectId, rid12: rid12Of(row.rid) };
	// The row is bound to one project; the host must agree.
	if (row.pid !== host.projectId) {
		return result(ids, "forbidden", plain("Forbidden", 403, env));
	}
	// One phone link gets a fixed request budget per minute.
	const { success } = await env.PREVIEW_RATE.limit({ key: row.jti });
	if (!success) {
		return result(ids, "rate_limited", tooManyRequests(env));
	}
	// A phone on the app counts as a watcher, like the iframe.
	touchLastSeen(env, ctx, row.pid);
	return forward(request, url, row, env, ids, {
		packagerHost: packagerHostFor(host.projectId, env.PREVIEW_DOMAIN),
		phoneHost: url.hostname,
		expoUsername: row.expoUsername,
	});
}

/**
 * Reads and parses the `phone:<id>` row. Returns null when the row is
 * absent or does not parse. The Worker wrote it, so a parse failure logs.
 */
async function readPhoneLink(
	env: Env,
	phoneId: string,
): Promise<PreviewTokenClaims | null> {
	const stored = await env.PREVIEW_KV.get(phoneLinkKey(phoneId));
	if (stored === null) {
		return null;
	}
	let raw: unknown;
	try {
		raw = JSON.parse(stored);
	} catch (error) {
		console.error("preview-proxy phone link row is not JSON:", error);
		return null;
	}
	const row = previewTokenClaimsSchema.safeParse(raw);
	if (!row.success) {
		console.error("preview-proxy phone link row has bad claims:", row.error);
		return null;
	}
	return row.data;
}

/** KV key of one phone link. The row expires with the link. */
function phoneLinkKey(phoneId: string): string {
	return `phone:${phoneId}`;
}

/** RFC 4648 base32 in lower case, the alphabet of the `m-<phoneId>` label. */
const BASE32_ALPHABET = "abcdefghijklmnopqrstuvwxyz234567";

/**
 * 13 random bytes (104 bits) as 21 base32 characters. Hex would need 26
 * characters and push the host label over the DNS limit of 63.
 */
function newPhoneId(): string {
	const bytes = crypto.getRandomValues(new Uint8Array(13));
	let pending = 0;
	let pendingBits = 0;
	let id = "";
	for (const byte of bytes) {
		pending = (pending << 8) | byte;
		pendingBits += 8;
		// One base32 character holds 5 bits.
		while (pendingBits >= 5) {
			pendingBits -= 5;
			id += BASE32_ALPHABET.charAt((pending >> pendingBits) & 31);
		}
		// Keep only the bits not yet written, so the number stays small.
		pending &= (1 << pendingBits) - 1;
	}
	// The last 4 bits fill the high end of character 21.
	if (pendingBits > 0) {
		id += BASE32_ALPHABET.charAt((pending << (5 - pendingBits)) & 31);
	}
	return id;
}

/** True when the claims name the project and the run of the `r-` host. */
function isRunHostOf(claims: PreviewTokenClaims, host: RunHost): boolean {
	return claims.pid === host.projectId && rid12Of(claims.rid) === host.rid12;
}

/** Unix seconds: the unit of the claim `exp`. */
function nowSeconds(): number {
	return Math.floor(Date.now() / 1000);
}

/**
 * Lets any origin read a mint answer. The body token is the only
 * credential and no cookie rides on the route, so no origin gains access.
 */
function withAnyOrigin(response: Response): Response {
	response.headers.set("access-control-allow-origin", "*");
	return response;
}

/** Builds a HandlerResult: the response plus the host ids for the metric. */
function result(
	host: HostIds,
	outcome: Outcome,
	response: Response,
): HandlerResult {
	return { response, pid: host.projectId, rid12: host.rid12, outcome };
}

/** 401 and 403 share the path; only the body differs. */
function denied(
	request: Request,
	env: Env,
	host: HostIds,
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
function notRunning(env: Env, host: HostIds): HandlerResult {
	const headers = securityHeaders(env.FRAME_ANCESTORS);
	headers.set("retry-after", "5");
	headers.set("content-type", "text/html; charset=utf-8");
	return result(
		host,
		"not_running",
		new Response(notRunningPage(), { status: 503, headers }),
	);
}

/**
 * Forwards one verified request to the sandbox origin in `claims.up`.
 * `manifestRewrite` is set on a phone host only: the manifest body then
 * names the phone host and the Expo Go username.
 */
async function forward(
	request: Request,
	url: URL,
	claims: PreviewTokenClaims,
	env: Env,
	host: HostIds,
	manifestRewrite: ManifestRewrite | undefined,
): Promise<HandlerResult> {
	const upstreamUrl = new URL(url.toString());
	const origin = new URL(claims.up);
	upstreamUrl.protocol = origin.protocol;
	upstreamUrl.host = origin.host;

	// `new Request(url, request)` copies method, headers, and body.
	const upstreamRequest = new Request(upstreamUrl, request);
	// The upstream sees the sandbox host, not the preview host.
	upstreamRequest.headers.set("host", origin.host);
	// Metro builds the bundle and source map URLs from these two headers.
	// So the vendor host never reaches the phone or the browser.
	upstreamRequest.headers.set("x-forwarded-host", url.host);
	upstreamRequest.headers.set("x-forwarded-proto", url.protocol.slice(0, -1));
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
	const contentType = headers.get("content-type") ?? "";
	let body: ReadableStream | string | null = upstream.body;
	if (
		manifestRewrite !== undefined &&
		isManifestPath(url.pathname) &&
		isManifestContentType(contentType)
	) {
		body = rewriteManifestBody(
			await upstream.text(),
			contentType,
			manifestRewrite,
		);
		// The rewrite changes the length; the runtime sets the new one.
		headers.delete("content-length");
	}
	const response = new Response(body, {
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

/** 429 with `Retry-After: 60`: the rate limit window is one minute. */
function tooManyRequests(env: Env): Response {
	const response = plain("Too many requests", 429, env);
	response.headers.set("retry-after", "60");
	return response;
}

/** A plain-text response with the five security headers. */
function plain(body: string, status: number, env: Env): Response {
	const headers = securityHeaders(env.FRAME_ANCESTORS);
	headers.set("content-type", "text/plain; charset=utf-8");
	return new Response(body, { status, headers });
}
