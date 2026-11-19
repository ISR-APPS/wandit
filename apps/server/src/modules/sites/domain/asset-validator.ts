/**
 * Publish-time asset preflight. The edge worker serves the published HTML for
 * EVERY path on the site's host, so a relative or root-relative asset URL can
 * never resolve to bytes — those are structural failures, and so are URLs
 * pointing at private or local addresses, which no visitor can reach. Public
 * absolute http(s) URLs are probed; only responses proving the asset is gone
 * (404/410) block the publish. Everything else — timeout, network error, 5xx,
 * 403 (hotlink/bot protection routinely 403s datacenter IPs while serving
 * browsers fine), hosts resolving to non-public addresses, and probes left
 * over when the total time budget runs out — must never block an emergency
 * publish, so it only warns.
 */
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { load } from "cheerio";
import { isPublicAddress } from "../../../infrastructure/http/public-fetch";

export type AssetCheckResult = {
	broken: string[];
	warnings: string[];
};

const REQUEST_TIMEOUT_MS = 5_000;
const TOTAL_BUDGET_MS = 15_000;
const PROBE_CONCURRENCY = 6;
const GONE_STATUSES = new Set([404, 410]);

export function collectAssetUrls(html: string): string[] {
	const $ = load(html);
	const urls = new Set<string>();
	const add = (value: string | undefined) => {
		const url = value?.trim();

		if (url) {
			urls.add(url);
		}
	};

	$("img[src], source[src], video[src]").each((_, element) => {
		add($(element).attr("src"));
	});
	$("video[poster]").each((_, element) => {
		add($(element).attr("poster"));
	});
	$("img[srcset], source[srcset]").each((_, element) => {
		for (const url of parseSrcset($(element).attr("srcset"))) {
			urls.add(url);
		}
	});
	$("link[href]").each((_, element) => {
		const rel = ($(element).attr("rel") ?? "").toLowerCase();
		const as = ($(element).attr("as") ?? "").trim().toLowerCase();

		if (/\bpreload\b/.test(rel) && as === "image") {
			add($(element).attr("href"));
		}
	});
	$("style").each((_, element) => {
		for (const url of parseCssUrls($(element).text())) {
			urls.add(url);
		}
	});
	$("[style]").each((_, element) => {
		for (const url of parseCssUrls($(element).attr("style"))) {
			urls.add(url);
		}
	});

	return [...urls];
}

// url(...) tokens in CSS — background images, masks, fonts. Quoted or bare,
// with CSS whitespace stripped. Bare data: URIs survive because base64 uses
// no parentheses or whitespace; anything collected here flows through the
// same classification as markup URLs (data: passes, relative fails, absolute
// is probed). The lookbehind keeps -url( custom-ish functions out while
// letters before url( (curl(, blur() already fail the literal match.
const CSS_URL_PATTERN =
	/(?<![\w-])url\(\s*(?:"([^"]*)"|'([^']*)'|([^"'()\s]+))\s*\)/gi;

export function parseCssUrls(css: string | undefined): string[] {
	if (!css) {
		return [];
	}

	const urls: string[] = [];

	for (const match of css.matchAll(CSS_URL_PATTERN)) {
		const url = ((match[1] ?? match[2] ?? match[3]) as string).trim();

		if (url) {
			urls.push(url);
		}
	}

	return urls;
}

// WHATWG-shaped srcset parsing: candidates are "<url> [descriptor]" separated
// by commas, a URL token runs to whitespace, and trailing commas glued to the
// URL separate candidates. Data URIs keep their inner commas because they
// contain no whitespace.
export function parseSrcset(value: string | undefined): string[] {
	if (!value) {
		return [];
	}

	const urls: string[] = [];
	let rest = value;

	while (rest.length > 0) {
		rest = rest.replace(/^[\s,]+/, "");

		const urlMatch = /^\S+/.exec(rest);

		if (!urlMatch) {
			break;
		}

		let url = urlMatch[0];
		rest = rest.slice(url.length);

		if (url.endsWith(",")) {
			url = url.replace(/,+$/, "");

			if (url) {
				urls.push(url);
			}

			continue;
		}

		urls.push(url);

		// Skip the descriptor up to the next candidate separator.
		const comma = rest.indexOf(",");
		rest = comma === -1 ? "" : rest.slice(comma + 1);
	}

	return urls;
}

export async function verifyAssetUrls(
	urls: string[],
	options: { budgetMs?: number } = {},
): Promise<AssetCheckResult> {
	const deadline = Date.now() + (options.budgetMs ?? TOTAL_BUDGET_MS);
	const broken: string[] = [];
	const warnings: string[] = [];
	const probes: { probeUrl: string; url: string }[] = [];

	for (const url of urls) {
		const target = probeTarget(url);

		if (target === "pass") {
			continue;
		}

		if (target === "invalid") {
			broken.push(url);
			continue;
		}

		probes.push({ probeUrl: target, url });
	}

	let next = 0;
	const workers = Array.from(
		{ length: Math.min(PROBE_CONCURRENCY, probes.length) },
		async () => {
			while (next < probes.length) {
				const probe = probes[next];
				next += 1;

				if (!probe) {
					break;
				}

				const remainingMs = deadline - Date.now();

				if (remainingMs <= 0) {
					warnings.push(probe.url);
					continue;
				}

				const outcome = await probeUrl(
					probe.probeUrl,
					Math.min(REQUEST_TIMEOUT_MS, remainingMs),
				);

				if (outcome === "gone") {
					broken.push(probe.url);
				} else if (outcome === "unknown") {
					warnings.push(probe.url);
				}
			}
		},
	);
	await Promise.all(workers);

	return { broken, warnings };
}

// data: URIs are self-contained; protocol-relative URLs inherit https on the
// published host; anything that does not parse as absolute http(s), or that
// names a local/private address no visitor could ever reach, can never
// resolve behind the edge worker.
function probeTarget(url: string): string | "invalid" | "pass" {
	if (url.startsWith("data:")) {
		return "pass";
	}

	const absolute = url.startsWith("//") ? `https:${url}` : url;

	let parsed: URL;

	try {
		parsed = new URL(absolute);
	} catch {
		return "invalid";
	}

	if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
		return "invalid";
	}

	const hostname = stripBrackets(parsed.hostname.toLowerCase());

	if (
		hostname === "localhost" ||
		hostname.endsWith(".localhost") ||
		hostname.endsWith(".local") ||
		(isIP(hostname) !== 0 && !isPublicAddress(hostname))
	) {
		return "invalid";
	}

	return absolute;
}

async function probeUrl(
	url: string,
	timeoutMs: number,
): Promise<"gone" | "ok" | "unknown"> {
	// SSRF guard: never let the backend fetch a name that resolves to a
	// private, loopback, or link-local address (cloud metadata endpoints,
	// internal services). Redirects are not followed for the same reason.
	if (await resolvesToPrivateAddress(new URL(url).hostname)) {
		return "unknown";
	}

	try {
		let response = await fetchWithTimeout(url, "HEAD", timeoutMs);

		// Some hosts reject HEAD outright; the GET result is authoritative.
		if (response.status === 405 || response.status === 501) {
			response = await fetchWithTimeout(url, "GET", timeoutMs);
		}

		if (GONE_STATUSES.has(response.status)) {
			return "gone";
		}

		// A redirect proves the host answers; the target is not chased.
		if (response.ok || (response.status >= 300 && response.status < 400)) {
			return "ok";
		}

		return "unknown";
	} catch {
		return "unknown";
	}
}

// Blocks only on a POSITIVE resolution to a non-public address: a failed
// lookup falls through to the fetch, which fails the same way and warns.
async function resolvesToPrivateAddress(hostname: string): Promise<boolean> {
	const host = stripBrackets(hostname.toLowerCase());

	if (isIP(host) !== 0) {
		return !isPublicAddress(host);
	}

	try {
		const addresses = await lookup(host, { all: true });

		return addresses.some((entry) => !isPublicAddress(entry.address));
	} catch {
		return false;
	}
}

function stripBrackets(hostname: string): string {
	return hostname.startsWith("[") && hostname.endsWith("]")
		? hostname.slice(1, -1)
		: hostname;
}

function fetchWithTimeout(
	url: string,
	method: "GET" | "HEAD",
	timeoutMs: number,
) {
	return fetch(url, {
		method,
		redirect: "manual",
		signal: AbortSignal.timeout(timeoutMs),
	});
}
