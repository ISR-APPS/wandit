/**
 * Business discovery via Serper.dev's Google Maps endpoint.
 *
 * Plain functions, NO NestJS on purpose: the Trigger.dev scrape task runs
 * outside the Nest app (same rule as r2.ts). Serper is a paid SERP API — one
 * POST per result page, ~20 places per page — chosen over the official
 * Places API because a single call already includes phone + website, which
 * is exactly what a prospect list needs.
 *
 * SERPER_API_KEY is optional env; callers MUST check isLeadSearchConfigured()
 * before searching (same contract as isR2Configured()).
 */
import { env } from "@wandit/env/server";

import type { LeadRecord } from "../domain/lead-scrape-spec";

export function isLeadSearchConfigured(): boolean {
	return Boolean(env.SERPER_API_KEY);
}

const SERPER_MAPS_URL = "https://google.serper.dev/maps";
// Serper returns ~20 places per page; 10 pages covers the 200-record cap.
const MAX_PAGES = 10;
const PAGE_TIMEOUT_MS = 15_000;

// The subset of a Serper "place" this pipeline reads. Parsed defensively —
// a provider payload change must degrade fields, not throw.
type SerperPlace = {
	address?: unknown;
	cid?: unknown;
	phoneNumber?: unknown;
	title?: unknown;
	website?: unknown;
};

export type GoogleMapsSearchOptions = {
	query: string;
	// City/region appended to the query ("gyms in Alger").
	location?: string | null;
	// ISO alpha-2 country ("dz") — Serper's `gl` bias.
	countryCode?: string | null;
	limit: number;
	signal?: AbortSignal;
	// Called after each page with the running total, so the task can persist
	// live foundCount for the progress card.
	onProgress?: (found: number) => Promise<void> | void;
};

/**
 * Page through the Maps results until `limit` unique businesses are
 * collected or Google runs dry. Dedupes by Google place id (cid) and by
 * normalized name+address so paging overlaps cannot double-count.
 */
export async function searchGoogleMapsBusinesses(
	options: GoogleMapsSearchOptions,
): Promise<LeadRecord[]> {
	const apiKey = env.SERPER_API_KEY;

	if (!apiKey) {
		throw new Error("SERPER_API_KEY is not configured");
	}

	const query = buildSearchQuery(
		options.query,
		options.location ?? null,
		options.countryCode ?? null,
	);
	const collected: LeadRecord[] = [];
	const seen = new Set<string>();
	// Serper resolves the query to a map center on page 1 and echoes it as
	// `ll`; pages 2+ REQUIRE that value (HTTP 400 without it).
	let mapCenter: string | null = null;

	for (let page = 1; page <= MAX_PAGES; page += 1) {
		options.signal?.throwIfAborted();

		const { ll, places } = await fetchMapsPage({
			apiKey,
			countryCode: options.countryCode ?? null,
			ll: mapCenter,
			page,
			query,
			signal: options.signal,
		});

		mapCenter = ll ?? mapCenter;

		let pageAddedNew = false;

		for (const place of places) {
			const record = toLeadRecord(place);

			if (!record) {
				continue;
			}

			const key = dedupeKey(place, record);

			if (seen.has(key)) {
				continue;
			}

			seen.add(key);
			collected.push(record);
			pageAddedNew = true;

			if (collected.length >= options.limit) {
				break;
			}
		}

		await options.onProgress?.(collected.length);

		// Stop when satisfied, when Google ran dry, or when a page brought
		// nothing new (Serper repeats results past the end).
		if (
			collected.length >= options.limit ||
			places.length === 0 ||
			!pageAddedNew
		) {
			break;
		}
	}

	return collected;
}

/**
 * The query TEXT is the only reliable geo signal: Serper's `gl` bias alone
 * still resolves ambiguous city names to their US namesakes ("Algiers" →
 * Algiers, Louisiana). Spell the country out — "gyms in Algiers, Algeria" —
 * unless the location already names it.
 */
function buildSearchQuery(
	niche: string,
	location: string | null,
	countryCode: string | null,
): string {
	const countryName = countryNameOf(countryCode);
	const placeParts = [location];

	if (
		countryName &&
		!location?.toLowerCase().includes(countryName.toLowerCase())
	) {
		placeParts.push(countryName);
	}

	const place = placeParts.filter(Boolean).join(", ");

	return place ? `${niche} in ${place}` : niche;
}

// "dz" → "Algeria". Built-in ICU data, no dependency; unknown codes echo
// back as-is, which is harmless in a search string.
function countryNameOf(countryCode: string | null): string | null {
	if (!countryCode) {
		return null;
	}

	try {
		return (
			new Intl.DisplayNames(["en"], { type: "region" }).of(
				countryCode.toUpperCase(),
			) ?? null
		);
	} catch {
		return null;
	}
}

async function fetchMapsPage(input: {
	apiKey: string;
	countryCode: string | null;
	// Map center from the previous page's response, required for page > 1.
	ll: string | null;
	page: number;
	query: string;
	signal?: AbortSignal;
}): Promise<{ ll: string | null; places: SerperPlace[] }> {
	// Both limits apply: the caller's abort (task cancelled) and a per-page
	// timeout so one hung request cannot eat the whole task budget.
	const signals = [AbortSignal.timeout(PAGE_TIMEOUT_MS)];

	if (input.signal) {
		signals.push(input.signal);
	}

	const response = await fetch(SERPER_MAPS_URL, {
		body: JSON.stringify({
			page: input.page,
			q: input.query,
			...(input.countryCode ? { gl: input.countryCode.toLowerCase() } : {}),
			...(input.ll ? { ll: input.ll } : {}),
		}),
		headers: {
			"Content-Type": "application/json",
			"X-API-KEY": input.apiKey,
		},
		method: "POST",
		signal: AbortSignal.any(signals),
	});

	if (!response.ok) {
		// Surface Serper's own message (quota, bad param…) — the task records
		// it on the attempt row, where the chat card shows it.
		const detail = (await response.text().catch(() => "")).slice(0, 200);

		throw new Error(
			`Business search failed (HTTP ${response.status})${detail ? ` — ${detail}` : ""}`,
		);
	}

	const payload = (await response.json()) as { ll?: unknown; places?: unknown };

	return {
		ll: typeof payload.ll === "string" && payload.ll ? payload.ll : null,
		places: Array.isArray(payload.places)
			? (payload.places as SerperPlace[])
			: [],
	};
}

function toLeadRecord(place: SerperPlace): LeadRecord | null {
	const name = asTrimmedString(place.title);

	// A prospect row without a business name is useless — skip it.
	if (!name) {
		return null;
	}

	return {
		address: asTrimmedString(place.address),
		email: null,
		emailVerified: false,
		name,
		phone: asTrimmedString(place.phoneNumber),
		source: "google-maps",
		website: asTrimmedString(place.website),
	};
}

function dedupeKey(place: SerperPlace, record: LeadRecord): string {
	const cid = asTrimmedString(place.cid);

	if (cid) {
		return `cid:${cid}`;
	}

	return `name:${record.name.toLowerCase()}|${(record.address ?? "").toLowerCase()}`;
}

function asTrimmedString(value: unknown): string | null {
	if (typeof value !== "string") {
		return null;
	}

	const trimmed = value.trim();

	return trimmed.length > 0 ? trimmed : null;
}
