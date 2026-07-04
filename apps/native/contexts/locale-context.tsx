import {
	type Dictionary,
	defaultLocale,
	fallbackDictionary,
	getDictionary,
	isLocale,
	type Locale,
} from "@wandit/internationalization";
import { I18nProvider } from "@wandit/internationalization/react";
import * as SecureStore from "expo-secure-store";
import type React from "react";
import {
	createContext,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";

type LocaleContextType = {
	locale: Locale;
	dictionary: Dictionary;
	setLocale: (locale: Locale) => void;
};

const LOCALE_STORAGE_KEY = "wandit-locale";

const LocaleContext = createContext<LocaleContextType | undefined>(undefined);

function loadDictionary(locale: Locale): Promise<Dictionary> {
	if (locale === defaultLocale) {
		return Promise.resolve(fallbackDictionary);
	}

	return getDictionary(locale);
}

export const LocaleProvider = ({ children }: { children: React.ReactNode }) => {
	const [locale, setLocaleState] = useState<Locale>(defaultLocale);
	const [dictionary, setDictionary] = useState<Dictionary>(fallbackDictionary);
	const requestIdRef = useRef(0);
	const mountedRef = useRef(true);

	useEffect(() => {
		mountedRef.current = true;

		return () => {
			mountedRef.current = false;
		};
	}, []);

	const applyLocale = useCallback(
		(nextLocale: Locale, options?: { persist?: boolean }) => {
			const requestId = requestIdRef.current + 1;
			requestIdRef.current = requestId;
			setLocaleState(nextLocale);

			if (options?.persist) {
				void SecureStore.setItemAsync(LOCALE_STORAGE_KEY, nextLocale).catch(
					() => undefined,
				);
			}

			void loadDictionary(nextLocale)
				.then((nextDictionary) => {
					if (mountedRef.current && requestIdRef.current === requestId) {
						setDictionary(nextDictionary);
					}
				})
				.catch(() => undefined);
		},
		[],
	);

	useEffect(() => {
		let isMounted = true;
		const initialRequestId = requestIdRef.current;

		void SecureStore.getItemAsync(LOCALE_STORAGE_KEY)
			.then((storedLocale) => {
				if (
					isMounted &&
					requestIdRef.current === initialRequestId &&
					isLocale(storedLocale)
				) {
					applyLocale(storedLocale);
				}
			})
			.catch(() => undefined);

		return () => {
			isMounted = false;
		};
	}, [applyLocale]);

	const setLocale = useCallback(
		(nextLocale: Locale) => {
			applyLocale(nextLocale, { persist: true });
		},
		[applyLocale],
	);

	const value = useMemo(
		() => ({
			locale,
			dictionary,
			setLocale,
		}),
		[locale, dictionary, setLocale],
	);

	return (
		<LocaleContext.Provider value={value}>
			<I18nProvider
				locale={locale}
				dictionary={dictionary}
				setLocale={setLocale}
			>
				{children}
			</I18nProvider>
		</LocaleContext.Provider>
	);
};

export function useLocale() {
	const context = useContext(LocaleContext);
	if (!context) {
		throw new Error("useLocale must be used within LocaleProvider");
	}

	return context;
}
