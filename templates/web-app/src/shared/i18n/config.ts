// Languages of the app. The provider, the root route, and the switcher read this file.
// The app ships one language until the user asks for more (CLAUDE.md "Languages").
// To add a language: add its code to `locales`, then add its messages file.

/** Text direction of a language, applied to `<html dir>`. */
export type Direction = "ltr" | "rtl";

/** Name and direction of each language that the app can add. Add a row for a new code. */
export const localeMeta = {
	en: { nativeLabel: "English", dir: "ltr" },
	fr: { nativeLabel: "Français", dir: "ltr" },
	ar: { nativeLabel: "العربية", dir: "rtl" },
} as const satisfies Record<string, { nativeLabel: string; dir: Direction }>;

/** A language code that has a row in `localeMeta`. */
type KnownLocale = keyof typeof localeMeta;

/**
 * The languages that the app renders. The first one is the default language,
 * and `messages.ts` is written in it.
 */
export const locales = ["en"] as const satisfies readonly KnownLocale[];

/** A language code that the app renders. */
export type Locale = (typeof locales)[number];

/** SSR, the prerender, and the first client render use this language. */
export const defaultLocale: Locale = locales[0];

/** Narrows a stored or negotiated value to a rendered language code. */
export function isLocale(value: string | null): value is Locale {
	// SAFETY: includes() rejects any string outside the tuple, so the cast is sound.
	return value !== null && locales.includes(value as Locale);
}

/** Gives `<html dir>` its value: `rtl` for Arabic, else `ltr`. */
export function getDir(locale: Locale): Direction {
	return localeMeta[locale].dir;
}

/** Picks the first rendered language from `navigator.languages`, else the default. */
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
