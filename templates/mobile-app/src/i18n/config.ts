// Locale configuration for the app.
// The i18n provider and the language switch read this file.
// The template has en, fr, and ar (D7); the agent narrows `locales` to the project languages.

/** Every language with a dictionary file. The files stay even when `locales` is shorter. */
export type DictionaryLocale = "en" | "fr" | "ar";

/** The languages the app shows. The switch, the saved locale, and the device match read it. */
export const locales = [
	"en",
	"fr",
	"ar",
] as const satisfies readonly DictionaryLocale[];

/** The only locale codes this app renders. `ar` renders right to left. */
export type Locale = (typeof locales)[number];

/** The first code in `locales`. The app renders it when no saved or device locale matches. */
export const defaultLocale: Locale = locales[0];

/** Text direction of a locale. The root layout applies it to the whole app. */
export type Direction = "ltr" | "rtl";

/** Keyed by the dictionary files, so a shorter `locales` still compiles. The switch shows `nativeLabel`. */
export const localeMeta = {
	en: { nativeLabel: "English", dir: "ltr" },
	fr: { nativeLabel: "Français", dir: "ltr" },
	ar: { nativeLabel: "العربية", dir: "rtl" },
} as const satisfies Record<
	DictionaryLocale,
	{ nativeLabel: string; dir: Direction }
>;

/** Narrows a stored or device value to a supported locale code. */
export function isLocale(value: string | null): value is Locale {
	// SAFETY: includes() rejects any string outside the tuple, so the cast is sound.
	return value !== null && locales.includes(value as Locale);
}

/** Direction of a locale; `ar` is the only right-to-left one. */
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
