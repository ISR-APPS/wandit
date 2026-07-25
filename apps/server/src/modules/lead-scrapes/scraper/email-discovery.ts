/**
 * Best-effort contact-email discovery from a business website.
 *
 * Strategy: fetch the homepage, harvest mailto: links + inline email
 * patterns; when the homepage has none, follow up to two contact-ish links
 * (contact / about, FR + EN + the common Algerian French spellings) and
 * harvest those. Everything is capped — bytes, time, pages — because this
 * runs for up to ~200 sites per scrape inside one background task.
 *
 * Plain functions, NO NestJS (used by the Trigger.dev task).
 */
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import * as cheerio from "cheerio";

const FETCH_TIMEOUT_MS = 8_000;
// Enough for any real homepage; guards against multi-MB pages.
const MAX_HTML_BYTES = 400_000;
const MAX_CONTACT_PAGES = 2;
const MAX_REDIRECT_HOPS = 3;

const EMAIL_PATTERN = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;

// Substrings that mark an "email" as machinery, a placeholder, or an asset
// filename rather than a reachable inbox.
const JUNK_EMAIL_MARKERS = [
	"example.",
	"sentry",
	"wixpress",
	"godaddy",
	"no-reply",
	"noreply",
	"donotreply",
	".png",
	".jpg",
	".jpeg",
	".gif",
	".webp",
	".svg",
];

const CONTACT_LINK_PATTERN =
	/contact|kontakt|a-propos|apropos|about|nous-joindre|coordonnees/i;

/**
 * Returns the most plausible outreach email for the site, or null. Never
 * throws: an unreachable/broken site is an expected outcome, not an error.
 */
export async function discoverBusinessEmail(
	website: string,
	signal?: AbortSignal,
): Promise<string | null> {
	const baseUrl = normalizeWebsiteUrl(website);

	if (!baseUrl) {
		return null;
	}

	const homepage = await fetchHtml(baseUrl, signal);

	if (!homepage) {
		return null;
	}

	const found = extractEmails(homepage);

	if (found.length > 0) {
		return pickBestEmail(found, baseUrl);
	}

	// No email on the homepage — try its contact/about pages.
	for (const link of findContactLinks(homepage, baseUrl)) {
		if (signal?.aborted) {
			return null;
		}

		const html = await fetchHtml(link, signal);

		if (!html) {
			continue;
		}

		const emails = extractEmails(html);

		if (emails.length > 0) {
			return pickBestEmail(emails, baseUrl);
		}
	}

	return null;
}

function normalizeWebsiteUrl(website: string): URL | null {
	const candidate = /^https?:\/\//i.test(website)
		? website
		: `https://${website}`;

	try {
		const url = new URL(candidate);

		// Only crawl plain web hosts — no ports, credentials, or exotic schemes.
		if (
			(url.protocol !== "https:" && url.protocol !== "http:") ||
			url.username !== "" ||
			url.port !== ""
		) {
			return null;
		}

		return url;
	} catch {
		return null;
	}
}

/**
 * Fetch with SSRF guarding: website URLs come from an external provider, so
 * every host — including each redirect hop — is DNS-resolved and rejected
 * when it points at loopback/private/link-local/metadata ranges. Redirects
 * are followed manually for exactly that reason.
 */
async function fetchHtml(
	url: URL,
	signal?: AbortSignal,
): Promise<string | null> {
	const signals = [AbortSignal.timeout(FETCH_TIMEOUT_MS)];

	if (signal) {
		signals.push(signal);
	}

	const fetchSignal = AbortSignal.any(signals);
	let current = url;

	try {
		for (let hop = 0; hop <= MAX_REDIRECT_HOPS; hop += 1) {
			if (!(await resolvesToPublicAddress(current.hostname))) {
				return null;
			}

			const response = await fetch(current, {
				headers: {
					// A real UA: many SMB sites serve bot-blank pages to default agents.
					"User-Agent":
						"Mozilla/5.0 (compatible; WanditLeadFinder/1.0; +https://wandit.app)",
					Accept: "text/html,application/xhtml+xml",
				},
				redirect: "manual",
				signal: fetchSignal,
			});

			if (response.status >= 300 && response.status < 400) {
				const location = response.headers.get("location");

				if (!location) {
					return null;
				}

				const next = normalizeWebsiteUrl(new URL(location, current).href);

				if (!next) {
					return null;
				}

				current = next;
				continue;
			}

			if (!response.ok) {
				return null;
			}

			const contentType = response.headers.get("content-type") ?? "";

			if (!contentType.includes("html")) {
				return null;
			}

			const text = await response.text();

			return text.slice(0, MAX_HTML_BYTES);
		}

		return null;
	} catch {
		// Timeouts, DNS failures, TLS errors — all expected for SMB sites.
		return null;
	}
}

// Pre-connection guard (covers the practical SSRF cases; a DNS-rebinding
// race between this check and the fetch is accepted for v1).
async function resolvesToPublicAddress(hostname: string): Promise<boolean> {
	try {
		const addresses = isIP(hostname)
			? [{ address: hostname }]
			: await lookup(hostname, { all: true });

		return (
			addresses.length > 0 &&
			addresses.every((entry) => isPublicAddress(entry.address))
		);
	} catch {
		return false;
	}
}

function isPublicAddress(address: string): boolean {
	if (isIP(address) === 4) {
		const octets = address.split(".").map(Number);
		const [a, b] = octets;

		return !(
			a === 0 ||
			a === 10 ||
			a === 127 ||
			(a === 100 && b !== undefined && b >= 64 && b <= 127) ||
			(a === 169 && b === 254) ||
			(a === 172 && b !== undefined && b >= 16 && b <= 31) ||
			(a === 192 && b === 168)
		);
	}

	const lower = address.toLowerCase();

	if (lower.startsWith("::ffff:")) {
		return isPublicAddress(lower.slice("::ffff:".length));
	}

	return !(
		lower === "::" ||
		lower === "::1" ||
		lower.startsWith("fe80") ||
		lower.startsWith("fc") ||
		lower.startsWith("fd")
	);
}

function extractEmails(html: string): string[] {
	const emails = new Set<string>();
	const $ = cheerio.load(html);

	// mailto: links are the strongest signal — they were put there to be used.
	$("a[href^='mailto:']").each((_, element) => {
		const href = $(element).attr("href") ?? "";
		const address = href.replace(/^mailto:/i, "").split("?")[0];
		const match = address?.match(EMAIL_PATTERN);

		for (const email of match ?? []) {
			emails.add(email.toLowerCase());
		}
	});

	for (const email of html.match(EMAIL_PATTERN) ?? []) {
		emails.add(email.toLowerCase());
	}

	return [...emails].filter(
		(email) =>
			!JUNK_EMAIL_MARKERS.some((marker) => email.includes(marker)) &&
			email.length <= 254,
	);
}

function findContactLinks(html: string, baseUrl: URL): URL[] {
	const $ = cheerio.load(html);
	const links: URL[] = [];
	const seen = new Set<string>();

	$("a[href]").each((_, element) => {
		if (links.length >= MAX_CONTACT_PAGES) {
			return false;
		}

		const href = $(element).attr("href") ?? "";
		const text = $(element).text();

		if (!CONTACT_LINK_PATTERN.test(href) && !CONTACT_LINK_PATTERN.test(text)) {
			return;
		}

		try {
			const resolved = new URL(href, baseUrl);

			// Stay on the business's own site.
			if (resolved.host !== baseUrl.host) {
				return;
			}

			resolved.hash = "";

			if (seen.has(resolved.href)) {
				return;
			}

			seen.add(resolved.href);
			links.push(resolved);
		} catch {
			// Unparseable href — skip.
		}
	});

	return links;
}

/**
 * Ranking: an address on the business's own domain beats a generic
 * gmail/yahoo one, and conventional outreach prefixes beat personal-looking
 * addresses. Ties resolve to first-seen (document order).
 */
function pickBestEmail(emails: string[], baseUrl: URL): string {
	const siteDomain = baseUrl.hostname.replace(/^www\./, "");
	const preferredPrefixes = ["contact", "info", "hello", "bonjour", "sales"];

	const scored = emails.map((email, index) => {
		const [localPart = "", domain = ""] = email.split("@");
		let score = 0;

		if (domain === siteDomain || domain.endsWith(`.${siteDomain}`)) {
			score += 2;
		}

		if (preferredPrefixes.some((prefix) => localPart.startsWith(prefix))) {
			score += 1;
		}

		return { email, index, score };
	});

	scored.sort((a, b) => b.score - a.score || a.index - b.index);

	// scored is non-empty by contract (callers check emails.length > 0).
	return scored[0]?.email ?? emails[0] ?? "";
}
