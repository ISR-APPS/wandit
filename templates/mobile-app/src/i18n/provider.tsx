// The active locale: a small store, the I18nProvider, and the useT() hook.
// The root layout wraps the app in I18nProvider; screens call useT().
// The store loads the saved locale once, when this module loads, so no effect runs.
// The choice persists in AsyncStorage. The root layout mirrors the tree for
// Arabic at once; native views outside the tree follow after a reload.
import AsyncStorage from "@react-native-async-storage/async-storage";
import { reloadAppAsync } from "expo";
import { getLocales } from "expo-localization";
import {
	createContext,
	type ReactNode,
	useContext,
	useMemo,
	useSyncExternalStore,
} from "react";
import { I18nManager, Platform } from "react-native";
import {
	type Direction,
	defaultLocale,
	getDir,
	isLocale,
	type Locale,
	matchLocale,
} from "./config";
import {
	type TranslationKey,
	type TranslationParams,
	translate,
} from "./translate";

const STORAGE_KEY = "app-locale";

// null until the saved locale loads; the provider renders nothing until then.
let currentLocale: Locale | null = null;
const listeners = new Set<() => void>();

/** Stores the locale and renders every subscriber again. */
function publish(locale: Locale) {
	currentLocale = locale;
	if (Platform.OS === "web") {
		// Uniwind classes compile to CSS logical properties, which follow this attribute.
		document.documentElement.dir = getDir(locale);
		document.documentElement.lang = locale;
	}
	for (const listener of listeners) {
		listener();
	}
}

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

loadLocale()
	.then((loaded) => {
		publish(loaded);
		if (Platform.OS !== "web") {
			// No reload at start: a reload that cannot change isRTL loops forever.
			// Native views outside the tree follow on the next start of the app.
			setNativeDirection(loaded);
		}
	})
	.catch((error: unknown) => {
		// Without a locale the provider renders nothing, so the app starts in the default one.
		console.warn("[i18n] the locale did not load", error);
		publish(defaultLocale);
	});

/** Switches the app language. The language picker calls it. */
export function setLocale(next: Locale) {
	// The strings switch at once; the native direction follows after the save.
	publish(next);
	AsyncStorage.setItem(STORAGE_KEY, next).then(
		() => {
			// The reload runs only after the save, so the new start reads `next`.
			// reloadAppAsync works in Expo Go and in a release build (an installed APK).
			if (Platform.OS !== "web" && setNativeDirection(next)) {
				void reloadAppAsync("The layout direction changed");
			}
		},
		(error: unknown) => {
			// Without the saved locale a reload would start in the old language.
			console.warn("[i18n] could not save the locale", error);
		},
	);
}

function subscribe(listener: () => void) {
	listeners.add(listener);
	return () => {
		listeners.delete(listener);
	};
}

function getSnapshot() {
	return currentLocale;
}

interface I18nContextValue {
	locale: Locale;
	dir: Direction;
	t: (key: TranslationKey, params?: TranslationParams) => string;
}

const I18nContext = createContext<I18nContextValue | undefined>(undefined);

/** Provides the locale to the screens. Renders nothing until the saved locale loads. */
export function I18nProvider({ children }: { children: ReactNode }) {
	const locale = useSyncExternalStore(subscribe, getSnapshot);
	const value = useMemo<I18nContextValue | null>(
		() =>
			locale === null
				? null
				: {
						locale,
						dir: getDir(locale),
						t: (key, params) => translate(locale, key, params),
					},
		[locale],
	);

	if (value === null) {
		return null;
	}
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
