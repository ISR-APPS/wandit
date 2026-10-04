// Dictionary types and the translate() lookup for dotted keys.
// The locale store calls translate(); each extra dictionary imports the Dictionary type.
// A missing key logs a warning and falls back to the source dictionary, then to the key.
import { defaultLocale, type Locale } from "./config";
import { messages } from "./messages";

type DeepStrings<T> = T extends string
	? string
	: { [K in keyof T]: DeepStrings<T[K]> };

/** The dictionary shape. Every other language file must satisfy it, so trees stay identical. */
export type Dictionary = DeepStrings<typeof messages>;

type NestedKeys<T> = {
	[K in keyof T & string]: T[K] extends string ? K : `${K}.${NestedKeys<T[K]>}`;
}[keyof T & string];

/** Union of every dotted key, for example `"home.title"`. */
export type TranslationKey = NestedKeys<typeof messages>;

/** One node of a dictionary tree: a message string or a nested group. */
type DictionaryNode = string | { [key: string]: DictionaryNode };

// One entry per code in `locales`. The compiler refuses a locale without a dictionary.
// The key of `messages` is the default locale: the language it is written in.
const dictionaries: Record<Locale, Dictionary> = { en: messages };

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

/** Values for the `{name}` parameters of a message. */
export type TranslationParams = Record<string, string | number>;

/**
 * Resolves a dotted key in the given locale and fills its `{name}` parameters.
 * Falls back to the default locale, then to the key.
 */
export function translate(
	locale: Locale,
	key: TranslationKey,
	params?: TranslationParams,
): string {
	const message =
		lookup(dictionaries[locale], key) ??
		lookup(dictionaries[defaultLocale], key);
	if (message === undefined) {
		// A missing key means a dictionary drifted. Keep the key visible in dev.
		console.warn(`[i18n] missing key "${key}" for locale "${locale}"`);
		return key;
	}
	if (params === undefined) {
		return message;
	}
	// A parameter without a value stays as `{name}`, so the gap is visible.
	return message.replace(/\{(\w+)\}/g, (placeholder, name: string) =>
		Object.hasOwn(params, name) ? String(params[name]) : placeholder,
	);
}
