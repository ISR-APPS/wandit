// Dictionary types and the translate() lookup for dotted keys.
// The provider calls translate(); a second language file imports the Dictionary type.
// A missing key logs a warning and falls back to the default language, then to the key.
import type { Locale } from "./config";
import { defaultLocale } from "./config";
import { messages } from "./messages";

type DeepStrings<T> = T extends string
	? string
	: { [K in keyof T]: DeepStrings<T[K]> };

/** The dictionary shape. Every language file must satisfy it, so the trees stay identical. */
export type Dictionary = DeepStrings<typeof messages>;

type NestedKeys<T> = {
	[K in keyof T & string]: T[K] extends string ? K : `${K}.${NestedKeys<T[K]>}`;
}[keyof T & string];

/** Union of every dotted key, for example `"landing.heroTitle"`. */
export type TranslationKey = NestedKeys<typeof messages>;

/** One node of a dictionary tree: a message string or a nested group. */
type DictionaryNode = string | { [key: string]: DictionaryNode };

// One entry per code in `locales`. The type fails until a new language has its file.
const dictionaries: Record<Locale, Dictionary> = { en: messages };

/** Returns the dictionary object for a locale. */
export function getDictionary(locale: Locale): Dictionary {
	return dictionaries[locale];
}

function lookup(dictionary: Dictionary, key: string): string | undefined {
	let node: DictionaryNode | undefined = dictionary;
	for (const part of key.split(".")) {
		if (typeof node !== "object") {
			return undefined;
		}
		node = node[part];
	}
	return typeof node === "string" ? node : undefined;
}

/** Resolves a dotted key in the given locale. Falls back to the default language, then the key. */
export function translate(
	dictionary: Dictionary,
	key: TranslationKey,
	locale: Locale = defaultLocale,
): string {
	const message =
		lookup(dictionary, key) ?? lookup(dictionaries[defaultLocale], key);
	if (message === undefined) {
		// A missing key means a dictionary drifted. Keep the key visible in dev.
		console.warn(`[i18n] missing key "${key}" for locale "${locale}"`);
		return key;
	}
	return message;
}
