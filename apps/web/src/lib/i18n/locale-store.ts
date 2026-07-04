import {
	type Dictionary,
	defaultLocale,
	fallbackDictionary,
	isLocale,
	type Locale,
	matchLocale,
} from "@wandit/internationalization";

const STORAGE_KEY = "wandit-locale";

type LocaleListener = (locale: Locale) => void;

const listeners = new Set<LocaleListener>();

let currentLocale = detectLocale();
let currentDictionary: Dictionary = fallbackDictionary;

export function getStoredLocale(): Locale | null {
	if (typeof window === "undefined") {
		return null;
	}

	try {
		const storedLocale = window.localStorage.getItem(STORAGE_KEY);
		return isLocale(storedLocale) ? storedLocale : null;
	} catch {
		return null;
	}
}

export function getCurrentLocale(): Locale {
	return currentLocale;
}

export function setCurrentLocale(locale: Locale) {
	writeStoredLocale(locale);

	if (locale === currentLocale) {
		return;
	}

	currentLocale = locale;
	emit(locale);
}

export function subscribe(listener: LocaleListener) {
	listeners.add(listener);
	return () => {
		listeners.delete(listener);
	};
}

export function getCurrentDictionary(): Dictionary {
	return currentDictionary;
}

export function setCurrentDictionary(dictionary: Dictionary) {
	currentDictionary = dictionary;
}

function detectLocale(): Locale {
	const storedLocale = getStoredLocale();

	if (storedLocale) {
		return storedLocale;
	}

	if (typeof navigator !== "undefined") {
		return matchLocale(navigator.languages);
	}

	return defaultLocale;
}

function writeStoredLocale(locale: Locale) {
	if (typeof window === "undefined") {
		return;
	}

	try {
		window.localStorage.setItem(STORAGE_KEY, locale);
	} catch {
		// Storage can be unavailable in private modes; keep the in-memory locale.
	}
}

function emit(locale: Locale) {
	for (const listener of listeners) {
		listener(locale);
	}
}
