export const locales = ["en", "fr", "ar"] as const;

export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = "en";

export const rtlLocales = ["ar"] as const satisfies readonly Locale[];

export type Direction = "ltr" | "rtl";

export const localeMeta = {
	en: { label: "English", nativeLabel: "English", dir: "ltr" },
	fr: { label: "French", nativeLabel: "Français", dir: "ltr" },
	ar: { label: "Arabic", nativeLabel: "العربية", dir: "rtl" },
} as const satisfies Record<
	Locale,
	{ label: string; nativeLabel: string; dir: Direction }
>;

export function isLocale(value: unknown): value is Locale {
	return typeof value === "string" && locales.includes(value as Locale);
}

export function getDir(locale: Locale): Direction {
	return localeMeta[locale].dir;
}

export function matchLocale(candidates: readonly string[]): Locale {
	for (const candidate of candidates) {
		const normalized = candidate.toLowerCase().replace("_", "-");
		if (isLocale(normalized)) {
			return normalized;
		}

		const baseLocale = normalized.split("-")[0];
		if (isLocale(baseLocale)) {
			return baseLocale;
		}
	}

	return defaultLocale;
}
