// React context that carries the active locale and its dictionary.
// The root route wraps the app in I18nProvider; components call useT().
// The choice persists in localStorage; the root document renders lang/dir.
import {
	createContext,
	type ReactNode,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useState,
} from "react";
import {
	type Direction,
	defaultLocale,
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
	setLocale: (locale: Locale) => void;
	t: (key: TranslationKey) => string;
}

const I18nContext = createContext<I18nContextValue | undefined>(undefined);

function detectLocale(): Locale {
	if (typeof window === "undefined") {
		return defaultLocale;
	}
	try {
		const stored = window.localStorage.getItem(STORAGE_KEY);
		if (isLocale(stored)) {
			return stored;
		}
	} catch {
		// Private browsing can block storage; the in-memory locale still works.
	}
	return matchLocale(navigator.languages);
}

/** Provides the locale state. The saved or browser locale applies after hydration. */
export function I18nProvider({ children }: { children: ReactNode }) {
	// SSR, the prerender, and hydration all render the default locale first.
	// LIMIT: the first paint is English. Upgrade: read a locale cookie in SSR.
	const [locale, setLocaleState] = useState<Locale>(defaultLocale);
	const dir = getDir(locale);
	const dictionary = getDictionary(locale);

	useEffect(() => {
		// Detection waits for hydration so the client matches the prerendered HTML.
		setLocaleState(detectLocale());
	}, []);

	const setLocale = useCallback((next: Locale) => {
		setLocaleState(next);
		try {
			window.localStorage.setItem(STORAGE_KEY, next);
		} catch {
			// Storage can be unavailable in private modes; keep the in-memory locale.
		}
	}, []);

	const value = useMemo<I18nContextValue>(
		() => ({
			locale,
			dir,
			setLocale,
			t: (key) => translate(dictionary, key, locale),
		}),
		[locale, dir, dictionary, setLocale],
	);

	return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

function useI18n(): I18nContextValue {
	const context = useContext(I18nContext);
	if (!context) {
		throw new Error("useI18n must be used within I18nProvider");
	}
	return context;
}

/** Returns `t(key)` plus the active locale and direction. Throws outside the provider. */
export function useT() {
	const { t, locale, dir } = useI18n();
	return { t, locale, dir };
}

/** Returns the locale setter for a language switcher. */
export function useSetLocale() {
	return useI18n().setLocale;
}
