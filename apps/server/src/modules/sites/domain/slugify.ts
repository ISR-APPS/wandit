// Server-side slug derivation for first publishes. The output must satisfy
// deploymentSlugSchema (packages/contracts/src/v1/deployments.ts), the
// deployments_slug_dns_label_ck DB check, and the web's isValidSlug — one
// regex, three homes, kept in lockstep.
// Callers: SitesService (V1 pages) and the `publish-app` runtime (V2 apps).

import { isReservedSlug } from "@wandit/contracts";

import { SlugTakenError } from "./errors/site.errors";

const MAX_SLUG_LENGTH = 63;
// A name slug plus at most four random suffixes before a publish gives up.
const SLUG_SUFFIX_ATTEMPTS = 5;
const SLUG_FALLBACK = "site";
const SUFFIX_ALPHABET = "abcdefghijklmnopqrstuvwxyz0123456789";

export function slugifyProjectName(name: string): string {
	const slug = name
		// Split accented characters into base + combining marks…
		.normalize("NFKD")
		// …then drop the marks (é → e).
		.replace(/[̀-ͯ]/g, "")
		.toLowerCase()
		// Anything that is not a DNS-label character becomes a hyphen.
		.replace(/[^a-z0-9]+/g, "-")
		// No leading/trailing/doubled hyphens.
		.replace(/-{2,}/g, "-")
		.replace(/^-+|-+$/g, "")
		.slice(0, MAX_SLUG_LENGTH)
		// A trailing hyphen can reappear after the length cut.
		.replace(/-+$/g, "");

	return slug.length > 0 ? slug : SLUG_FALLBACK;
}

// Collision suffix for generated slugs: `{base}-{4 random chars}`.
export function withRandomSuffix(base: string): string {
	let suffix = "";

	for (let i = 0; i < 4; i += 1) {
		suffix += SUFFIX_ALPHABET.charAt(
			Math.floor(Math.random() * SUFFIX_ALPHABET.length),
		);
	}

	const trimmed = base.slice(0, MAX_SLUG_LENGTH - 5).replace(/-+$/g, "");

	return `${trimmed}-${suffix}`;
}

/**
 * The slug of a first publish: the name slug, or the name slug with a
 * random suffix when it is reserved or taken. `isTaken` checks one
 * candidate against the live sites of other projects. Throws
 * `SlugTakenError` after `SLUG_SUFFIX_ATTEMPTS` taken candidates.
 */
export async function pickFreeSlug(
	name: string,
	isTaken: (slug: string) => Promise<boolean>,
): Promise<string> {
	let candidate = slugifyProjectName(name);

	if (isReservedSlug(candidate)) {
		candidate = withRandomSuffix(candidate);
	}

	for (let attempt = 0; attempt < SLUG_SUFFIX_ATTEMPTS; attempt += 1) {
		if (!(await isTaken(candidate))) {
			return candidate;
		}

		candidate = withRandomSuffix(slugifyProjectName(name));
	}

	throw new SlugTakenError(candidate);
}
