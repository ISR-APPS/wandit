// React context that carries the active locale and its dictionary.
// main.tsx wraps the app in I18nProvider; components call useT().
// The choice lives in localStorage. React reads it with useSyncExternalStore, so no effect.
import {
	createContext,
	type ReactNode,
	useContext,
	useMemo,
	useSyncExternalStore,
} from "react";
import {
	type Direction,
	getDir,
	isLocale,
	type Locale,
	matchLocale,
} from "./config";
import { getDictionary, type TranslationKey, translate } from "./translate";

const STORAGE_KEY = "wandit-locale";

interface I18nContextValue {
	locale: Locale;
	dir: Direction;
	t: (key: TranslationKey) => string;
}

const I18nContext = createContext<I18nContextValue | undefined>(undefined);

const listeners = new Set<() => void>();
// Private browsing can block localStorage, so the last choice also lives in memory.
let chosenLocale: Locale | null = null;

function readStoredLocale(): Locale | null {
	try {
		const stored = window.localStorage.getItem(STORAGE_KEY);
		return isLocale(stored) ? stored : null;
	} catch {
		// Storage is blocked; the caller falls back to memory and the browser languages.
		return null;
	}
}

function getBrowserLocale(): Locale {
	return readStoredLocale() ?? chosenLocale ?? matchLocale(navigator.languages);
}

function subscribe(onChange: () => void): () => void {
	listeners.add(onChange);
	// A language switch in another tab fires a storage event in this tab.
	window.addEventListener("storage", onChange);
	return () => {
		listeners.delete(onChange);
		window.removeEventListener("storage", onChange);
	};
}

/** Switches the app language and saves the choice. A language switcher calls it. */
export function setLocale(next: Locale) {
	chosenLocale = next;
	try {
		window.localStorage.setItem(STORAGE_KEY, next);
	} catch {
		// Storage is blocked; the in-memory choice still applies until a reload.
	}
	for (const listener of listeners) {
		listener();
	}
}

/** Provides the locale state: the saved choice, else the first browser language that the app renders. */
export function I18nProvider({ children }: { children: ReactNode }) {
	const locale = useSyncExternalStore(subscribe, getBrowserLocale);

	const value = useMemo<I18nContextValue>(() => {
		const dictionary = getDictionary(locale);
		return {
			locale,
			dir: getDir(locale),
			t: (key) => translate(dictionary, key, locale),
		};
	}, [locale]);

	return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

/** Returns `t(key)` plus the active locale and direction. Throws outside the provider. */
export function useT(): I18nContextValue {
	const context = useContext(I18nContext);
	if (!context) {
		throw new Error("useT must be used within I18nProvider");
	}
	return context;
}
