// Server-side slug rules: the slug of a first publish, and the staging ending
// of a slug that the user chose. The output must satisfy deploymentSlugSchema
// (packages/contracts/src/v1/deployments.ts), the deployments_slug_dns_label_ck
// DB check, and the web's isValidSlug — one regex, three homes, kept in lockstep.
// Callers: SitesService (V1 pages) and the `publish-app` runtime (V2 apps).

import { isReservedSlug } from "@wandit/contracts";

import { SlugTakenError } from "./errors/site.errors";

const MAX_SLUG_LENGTH = 63;
// A name slug plus at most four random suffixes before a publish gives up.
const SLUG_SUFFIX_ATTEMPTS = 5;
const SLUG_FALLBACK = "site";
const SUFFIX_ALPHABET = "abcdefghijklmnopqrstuvwxyz0123456789";

/**
 * Ending of every staging slug, so a staging app lives on `<slug>-stg.wandit.app`.
 * The staging edge route `*-stg.wandit.app/*` catches these hosts (apps/edge/wrangler.jsonc).
 * The free certificate covers them, because the host is one level below `wandit.app`.
 */
export const STAGING_SLUG_SUFFIX = "-stg";

/** `env.SITES_SLUG_SUFFIX`: `"-stg"` on staging, `undefined` in production and locally. */
export type SlugSuffix = typeof STAGING_SLUG_SUFFIX | undefined;

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

/**
 * Collision suffix for generated slugs: `{base}-{4 random chars}{suffix}`.
 * The cut of a long base keeps room for the random part and the staging suffix.
 */
export function withRandomSuffix(base: string, suffix: SlugSuffix): string {
	let random = "";

	for (let i = 0; i < 4; i += 1) {
		random += SUFFIX_ALPHABET.charAt(
			Math.floor(Math.random() * SUFFIX_ALPHABET.length),
		);
	}

	const tail = suffix ?? "";
	const trimmed = base
		.slice(0, MAX_SLUG_LENGTH - 5 - tail.length)
		.replace(/-+$/g, "");

	return `${trimmed}-${random}${tail}`;
}

// The staging edge route takes every host that ends with "-stg". Outside
// staging, such a slug would reach the staging edge, not the live site.
function isStagingSlug(slug: string): boolean {
	return slug.endsWith(STAGING_SLUG_SUFFIX);
}

function withSlugSuffix(slug: string, suffix: SlugSuffix): string {
	if (suffix === undefined || slug.endsWith(suffix)) {
		return slug;
	}

	const trimmed = slug
		.slice(0, MAX_SLUG_LENGTH - suffix.length)
		.replace(/-+$/g, "");

	return `${trimmed}${suffix}`;
}

/**
 * The slug of a first publish: the name slug, or the name slug with a
 * random suffix when it is reserved or taken. `isTaken` checks one
 * candidate against the live sites of other projects. Throws
 * `SlugTakenError` after `SLUG_SUFFIX_ATTEMPTS` taken candidates.
 * With a `suffix` (staging), every candidate ends with it.
 */
export async function pickFreeSlug(
	name: string,
	isTaken: (slug: string) => Promise<boolean>,
	suffix: SlugSuffix,
): Promise<string> {
	const base = slugifyProjectName(name);
	const randomCandidate = () => withRandomSuffix(base, suffix);
	// Outside staging, a name slug that ends with "-stg" gets a random suffix,
	// so the staging edge route never catches a production site.
	let candidate =
		isReservedSlug(base) || (suffix === undefined && isStagingSlug(base))
			? randomCandidate()
			: withSlugSuffix(base, suffix);

	for (let attempt = 0; attempt < SLUG_SUFFIX_ATTEMPTS; attempt += 1) {
		if (!(await isTaken(candidate))) {
			return candidate;
		}

		candidate = randomCandidate();
	}

	throw new SlugTakenError(candidate);
}

/**
 * The slug to use for a slug that the user chose (V1 publish and the
 * availability check). On staging, it adds the suffix. Outside staging, it
 * returns null for a slug that ends with "-stg": the staging route would catch it.
 */
export function slugForRequest(
	slug: string,
	suffix: SlugSuffix,
): string | null {
	if (suffix === undefined) {
		return isStagingSlug(slug) ? null : slug;
	}

	return withSlugSuffix(slug, suffix);
}
