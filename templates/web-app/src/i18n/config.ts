// Locale configuration for the app.
// The provider and the root route read this file.
// Supported locales come from decision D7: en, fr, ar.
export const locales = ["en", "fr", "ar"] as const;

/** The only locale codes this app renders. `ar` renders right to left. */
export type Locale = (typeof locales)[number];

/** SSR and the prerender render this locale. The browser may switch after hydration. */
export const defaultLocale: Locale = "en";

/** Text direction of a locale, applied to `<html dir>`. */
export type Direction = "ltr" | "rtl";

export const localeMeta = {
	en: { label: "English", nativeLabel: "English", dir: "ltr" },
	fr: { label: "French", nativeLabel: "Français", dir: "ltr" },
	ar: { label: "Arabic", nativeLabel: "العربية", dir: "rtl" },
} as const satisfies Record<
	Locale,
	{ label: string; nativeLabel: string; dir: Direction }
>;

/** Narrows a stored or negotiated value to a supported locale code. */
export function isLocale(value: string | null): value is Locale {
	// SAFETY: includes() rejects any string outside the tuple, so the cast is sound.
	return value !== null && locales.includes(value as Locale);
}

export function getDir(locale: Locale): Direction {
	return localeMeta[locale].dir;
}

/** Picks the first supported locale from `navigator.languages`, else `en`. */
export function matchLocale(candidates: readonly string[]): Locale {
	for (const candidate of candidates) {
		const normalized = candidate.toLowerCase().replace("_", "-");
		if (isLocale(normalized)) {
			return normalized;
		}

		// split() always returns one element; the fallback only satisfies the index type.
		const baseLocale = normalized.split("-")[0] ?? "";
		if (isLocale(baseLocale)) {
			return baseLocale;
		}
	}

	return defaultLocale;
}
