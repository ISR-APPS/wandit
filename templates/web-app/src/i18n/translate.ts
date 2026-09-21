// Dictionary types and the translate() lookup for dotted keys.
// The provider calls translate(); dictionaries import the Dictionary type.
// Missing keys log a warning and fall back to English, then to the key.
import { ar } from "./ar";
import type { Locale } from "./config";
import { defaultLocale } from "./config";
import { en } from "./en";
import { fr } from "./fr";

type DeepStrings<T> = T extends string
	? string
	: { [K in keyof T]: DeepStrings<T[K]> };

/** The dictionary shape. `fr` and `ar` must satisfy it, so trees stay identical. */
export type Dictionary = DeepStrings<typeof en>;

type NestedKeys<T> = {
	[K in keyof T & string]: T[K] extends string ? K : `${K}.${NestedKeys<T[K]>}`;
}[keyof T & string];

/** Union of every dotted key, for example `"lead.title"`. */
export type TranslationKey = NestedKeys<typeof en>;

/** One node of a dictionary tree: a message string or a nested group. */
type DictionaryNode = string | { [key: string]: DictionaryNode };

const dictionaries: Record<Locale, Dictionary> = { en, fr, ar };

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

/** Resolves a dotted key in the given locale. Falls back to English, then the key. */
export function translate(
	dictionary: Dictionary,
	key: TranslationKey,
	locale: Locale = defaultLocale,
): string {
	const message = lookup(dictionary, key) ?? lookup(dictionaries.en, key);
	if (message === undefined) {
		// A missing key means a dictionary drifted. Keep the key visible in dev.
		console.warn(`[i18n] missing key "${key}" for locale "${locale}"`);
		return key;
	}
	return message;
}
