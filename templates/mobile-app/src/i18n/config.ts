// Locale configuration of the app. The locale store, the translate lookup,
// and the language picker read this file.
// The app starts with one language. CLAUDE.md, "Languages", tells how to add one.

/** Text direction of a locale. The root layout applies it to the whole app. */
export type Direction = "ltr" | "rtl";

/**
 * Every language this app can show: its name in its own language and its
 * direction. Add a language here before you add its code to `locales`.
 */
export const localeMeta = {
	en: { nativeLabel: "English", dir: "ltr" },
	fr: { nativeLabel: "Français", dir: "ltr" },
	ar: { nativeLabel: "العربية", dir: "rtl" },
} as const satisfies Record<string, { nativeLabel: string; dir: Direction }>;

/** The languages the app shows. The first code is the default and the source dictionary. */
export const locales = [
	"en",
] as const satisfies readonly (keyof typeof localeMeta)[];

/** The locale codes this app renders. */
export type Locale = (typeof locales)[number];

/** The first code in `locales`. The app renders it when no saved or device locale matches. */
export const defaultLocale: Locale = locales[0];

/** Narrows a stored or device value to a locale of `locales`. */
export function isLocale(value: string | null): value is Locale {
	return locales.some((locale) => locale === value);
}

/** Direction of a locale. */
export function getDir(locale: Locale): Direction {
	return localeMeta[locale].dir;
}

/** Picks the first supported locale from device tags like `fr-DZ`, else `defaultLocale`. */
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
