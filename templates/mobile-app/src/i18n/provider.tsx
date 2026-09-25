// React context that carries the active locale and its dictionary.
// The root layout wraps the app in I18nProvider; screens call useT().
// The choice persists in AsyncStorage. The root layout mirrors the tree and the
// stack from `dir` at once. Native views outside the tree follow I18nManager
// after a reload; the web also follows <html dir>.
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getLocales } from "expo-localization";
import {
	createContext,
	type ReactNode,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useState,
} from "react";
import { DevSettings, I18nManager, Platform } from "react-native";
import {
	type Direction,
	getDir,
	isLocale,
	type Locale,
	matchLocale,
} from "./config";
import { type TranslationKey, translate } from "./translate";

const STORAGE_KEY = "app-locale";

interface I18nContextValue {
	locale: Locale;
	dir: Direction;
	setLocale: (locale: Locale) => void;
	t: (key: TranslationKey) => string;
}

const I18nContext = createContext<I18nContextValue | undefined>(undefined);

/** Reads the saved locale, else the first device locale the app supports. */
async function loadLocale(): Promise<Locale> {
	try {
		const stored = await AsyncStorage.getItem(STORAGE_KEY);
		if (isLocale(stored)) {
			return stored;
		}
	} catch (error) {
		// A storage error must not block the app; the device locale still works.
		console.warn("[i18n] could not read the saved locale", error);
	}
	return matchLocale(getLocales().map((device) => device.languageTag));
}

/**
 * Saves the native layout direction for a locale. Native views outside the
 * React tree read it only at start, so they change after a reload. Expo Go
 * resets it on each project open; there the root layout mirrors alone.
 * Returns true when the running app started with the other direction.
 */
function setNativeDirection(locale: Locale): boolean {
	const isRtl = getDir(locale) === "rtl";
	// allowRTL(false) stops an Arabic device from mirroring an LTR choice.
	I18nManager.allowRTL(isRtl);
	// Always write the flag: isRTL holds the start value, not a value saved since.
	I18nManager.forceRTL(isRtl);
	return I18nManager.isRTL !== isRtl;
}

/** Provides the locale state. Renders nothing until the saved locale loads. */
export function I18nProvider({ children }: { children: ReactNode }) {
	const [locale, setLocaleState] = useState<Locale | null>(null);

	useEffect(() => {
		let mounted = true;
		void loadLocale().then((loaded) => {
			if (!mounted) {
				return;
			}
			setLocaleState(loaded);
			if (Platform.OS !== "web") {
				// No reload at start: a reload that cannot change isRTL loops forever.
				// Native views outside the tree follow on the next start of the app.
				setNativeDirection(loaded);
			}
		});
		return () => {
			mounted = false;
		};
	}, []);

	useEffect(() => {
		if (Platform.OS === "web" && locale !== null) {
			// Uniwind classes compile to CSS logical properties, which follow this attribute.
			document.documentElement.dir = getDir(locale);
			document.documentElement.lang = locale;
		}
	}, [locale]);

	const setLocale = useCallback((next: Locale) => {
		// The strings switch at once; the direction follows after the save.
		setLocaleState(next);
		AsyncStorage.setItem(STORAGE_KEY, next).then(
			() => {
				// The reload runs only after the save, so the new start reads `next`.
				// DevSettings.reload works in development (Expo Go). A release build
				// ignores it; there native views outside the tree follow on the next start.
				if (Platform.OS !== "web" && setNativeDirection(next)) {
					DevSettings.reload();
				}
			},
			(error: unknown) => {
				// Without the saved locale a reload would start in the old language.
				console.warn("[i18n] could not save the locale", error);
			},
		);
	}, []);

	const value = useMemo<I18nContextValue | null>(
		() =>
			locale === null
				? null
				: {
						locale,
						dir: getDir(locale),
						setLocale,
						t: (key) => translate(locale, key),
					},
		[locale, setLocale],
	);

	if (value === null) {
		return null;
	}
	return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

function useI18n(): I18nContextValue {
	const context = useContext(I18nContext);
	if (!context) {
		throw new Error("useT and useSetLocale must be used within I18nProvider");
	}
	return context;
}

/** Returns `t(key)` plus the active locale and direction. Throws outside the provider. */
export function useT() {
	const { t, locale, dir } = useI18n();
	return { t, locale, dir };
}

/** Returns the locale setter for a language switch. */
export function useSetLocale() {
	return useI18n().setLocale;
}
