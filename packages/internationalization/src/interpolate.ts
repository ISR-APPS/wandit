import { defaultLocale, type Locale } from "./config";
import type { Dictionary, TranslationKey } from "./dictionaries";

export type TranslationParams = Record<string, string | number>;

type PluralMessage = Partial<Record<Intl.LDMLPluralRule, string>>;

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isPluralMessage(value: unknown): value is PluralMessage {
	if (!isRecord(value)) {
		return false;
	}

	return Object.values(value).every((item) => typeof item === "string");
}

function getPathValue(dictionary: Dictionary, key: TranslationKey): unknown {
	return key.split(".").reduce<unknown>((currentValue, pathPart) => {
		if (!isRecord(currentValue)) {
			return undefined;
		}

		return currentValue[pathPart];
	}, dictionary);
}

function selectPluralCategory(
	locale: Locale,
	count: number,
): Intl.LDMLPluralRule {
	if (typeof Intl === "undefined" || typeof Intl.PluralRules === "undefined") {
		// Hermes (Expo Go) ships without Intl.PluralRules. English/French only
		// need the one/other split, but the Arabic dictionaries carry all six
		// CLDR forms — inline the (simple) Arabic cardinal rules so the dual
		// and paucal forms still resolve without Intl.
		if (locale === "ar") {
			if (count === 0) return "zero";
			if (count === 1) return "one";
			if (count === 2) return "two";
			const mod = count % 100;
			if (mod >= 3 && mod <= 10) return "few";
			if (mod >= 11 && mod <= 99) return "many";
			return "other";
		}
		return count === 1 ? "one" : "other";
	}

	try {
		return new Intl.PluralRules(locale).select(count);
	} catch {
		return "other";
	}
}

export function interpolate(
	message: string,
	params?: TranslationParams,
): string {
	if (!params) {
		return message;
	}

	return message.replace(/\{([^{}]+)\}/g, (match, key: string) => {
		const value = params[key];
		return value === undefined ? match : String(value);
	});
}

// Pricing v4 renders fractional credit counts. Plural selection needs the
// numeric `count`, but raw floats must never reach the screen — callers pass
// the locale-formatted string as `countDisplay` and it replaces `{count}` at
// interpolation time.
function withCountDisplay(
	params?: TranslationParams,
): TranslationParams | undefined {
	if (!params || params.countDisplay === undefined) {
		return params;
	}

	return { ...params, count: params.countDisplay };
}

export function translate(
	dictionary: Dictionary,
	key: TranslationKey,
	params?: TranslationParams,
	locale: Locale = defaultLocale,
): string {
	const message = getPathValue(dictionary, key);

	if (typeof message === "string") {
		return interpolate(message, withCountDisplay(params));
	}

	if (isPluralMessage(message)) {
		const count = Number(params?.count);
		if (!Number.isFinite(count)) {
			return key;
		}

		const category = selectPluralCategory(locale, count);
		const selectedMessage = message[category] ?? message.other;
		if (selectedMessage) {
			return interpolate(selectedMessage, withCountDisplay(params));
		}
	}

	return key;
}
