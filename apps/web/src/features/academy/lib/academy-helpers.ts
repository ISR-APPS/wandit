import type {
	AcademyGuideCategory,
	AcademyGuideListItem,
} from "@wandit/contracts";

import type { TranslationKey } from "@/lib/i18n";

const ACADEMY_CATEGORY_TRANSLATION_KEYS = {
	"getting-started": "academy.categories.gettingStarted",
	websites: "academy.categories.websites",
	"landing-pages": "academy.categories.landingPages",
	ads: "academy.categories.ads",
	leads: "academy.categories.leads",
	marketing: "academy.categories.marketing",
	domains: "academy.categories.domains",
	apps: "academy.categories.apps",
} as const satisfies Record<AcademyGuideCategory, TranslationKey>;

/** Return the translation key for a canonical category slug. */
export function academyCategoryTranslationKey(
	category: string,
): TranslationKey | null {
	if (!Object.hasOwn(ACADEMY_CATEGORY_TRANSLATION_KEYS, category)) {
		return null;
	}

	return ACADEMY_CATEGORY_TRANSLATION_KEYS[category as AcademyGuideCategory];
}

/** Localize a canonical category slug and preserve unknown legacy values. */
export function academyCategoryLabel(
	category: string,
	translate: (key: TranslationKey) => string,
): string {
	const key = academyCategoryTranslationKey(category);
	return key === null ? category : translate(key);
}

function normalizedCategory(category: string): string {
	return category.trim().toLowerCase();
}

/** Return whether sanitized guide HTML contains visible text or an image. */
export function hasAcademyGuideBodyContent(bodyHtml: string): boolean {
	if (/<img(?:\s|\/?>)/iu.test(bodyHtml)) {
		return true;
	}

	const text = bodyHtml
		.replace(/<[^>]*>/gu, "")
		.replace(/&(?:nbsp|#160|#x0*a0);/giu, "");

	return (
		text.replace(
			/[\s\u00a0\u2000-\u200d\u2028\u2029\u202f\u205f\u2060\ufeff]/gu,
			"",
		) !== ""
	);
}

/** Return display-ready categories, preserving the first published casing. */
export function deriveCategories(
	guides: readonly AcademyGuideListItem[],
): string[] {
	const categories = new Map<string, string>();

	for (const guide of guides) {
		const category = guide.category?.trim();

		if (!category) {
			continue;
		}

		const normalized = normalizedCategory(category);
		if (!categories.has(normalized)) {
			categories.set(normalized, category);
		}
	}

	return [...categories.values()].sort((left, right) =>
		left.localeCompare(right, undefined, { sensitivity: "base" }),
	);
}

/** Filter by a display category; null represents the unfiltered "All" view. */
export function filterGuidesByCategory(
	guides: readonly AcademyGuideListItem[],
	category: string | null,
): AcademyGuideListItem[] {
	if (category === null) {
		return [...guides];
	}

	const selectedCategory = normalizedCategory(category);

	return guides.filter(
		(guide) =>
			guide.category !== null &&
			normalizedCategory(guide.category) === selectedCategory,
	);
}

const GRADIENT_ANGLES = [125, 140, 155, 170] as const;
const GRADIENT_STOPS = [62, 68, 74, 80] as const;

function hashString(value: string): number {
	let hash = 2166136261;

	for (let index = 0; index < value.length; index += 1) {
		hash ^= value.charCodeAt(index);
		hash = Math.imul(hash, 16777619);
	}

	return hash >>> 0;
}

/** Build a deterministic, theme-aware neutral placeholder for a guide card. */
export function guideGradient(id: string): string {
	const hash = hashString(id);
	const angle = GRADIENT_ANGLES[hash % GRADIENT_ANGLES.length];
	const stop = GRADIENT_STOPS[(hash >>> 3) % GRADIENT_STOPS.length];

	return `linear-gradient(${angle}deg, var(--secondary) 0%, var(--muted) ${stop}%, var(--accent) 100%)`;
}
