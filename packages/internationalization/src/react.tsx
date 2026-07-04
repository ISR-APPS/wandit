import {
	createContext,
	type JSX,
	type ReactNode,
	useCallback,
	useContext,
	useMemo,
} from "react";

import { type Direction, getDir, type Locale } from "./config";
import type { Dictionary, TranslationKey } from "./dictionaries";
import { type TranslationParams, translate } from "./interpolate";

export interface I18nContextValue {
	locale: Locale;
	dir: Direction;
	dictionary: Dictionary;
	setLocale: (locale: Locale) => void;
	t: (key: TranslationKey, params?: TranslationParams) => string;
}

const I18nContext = createContext<I18nContextValue | undefined>(undefined);

export function I18nProvider(props: {
	locale: Locale;
	dictionary: Dictionary;
	setLocale: (locale: Locale) => void;
	children: ReactNode;
}): JSX.Element {
	const { locale, dictionary, setLocale, children } = props;
	const dir = getDir(locale);
	const t = useCallback(
		(key: TranslationKey, params?: TranslationParams) => {
			return translate(dictionary, key, params, locale);
		},
		[dictionary, locale],
	);
	const value = useMemo(
		() => ({ locale, dir, dictionary, setLocale, t }),
		[locale, dir, dictionary, setLocale, t],
	);

	return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
	const context = useContext(I18nContext);
	if (!context) {
		throw new Error("useI18n must be used within I18nProvider");
	}

	return context;
}

export function useTranslation(): {
	t: I18nContextValue["t"];
	locale: Locale;
	dir: Direction;
} {
	const { t, locale, dir } = useI18n();
	return { t, locale, dir };
}

export function useDictionary(): Dictionary {
	return useI18n().dictionary;
}
