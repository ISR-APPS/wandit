import { useRouter } from "@tanstack/react-router";
import {
	type Dictionary,
	defaultLocale,
	fallbackDictionary,
	getDictionary,
	getDir,
	I18nProvider,
	type Locale,
} from "@wandit/internationalization";
import {
	type ReactNode,
	useCallback,
	useEffect,
	useRef,
	useState,
} from "react";

import {
	getCurrentDictionary,
	getCurrentLocale,
	setCurrentDictionary,
	setCurrentLocale,
	subscribe,
} from "./locale-store";

export function AppI18nProvider({ children }: { children: ReactNode }) {
	const router = useRouter();
	const [requestedLocale, setRequestedLocale] = useState<Locale>(() =>
		getCurrentLocale(),
	);
	const [appliedLocale, setAppliedLocale] = useState<Locale>(() =>
		getCurrentLocale(),
	);
	const [dictionary, setDictionary] = useState<Dictionary>(() =>
		getCurrentDictionary(),
	);
	const appliedLocaleRef = useRef(appliedLocale);
	const dictionaryRef = useRef(dictionary);
	const setLocale = useCallback((nextLocale: Locale) => {
		setCurrentLocale(nextLocale);
	}, []);

	useEffect(() => subscribe(setRequestedLocale), []);

	useEffect(() => {
		const dir = getDir(appliedLocale);
		document.documentElement.lang = appliedLocale;
		document.documentElement.dir = dir;
	}, [appliedLocale]);

	useEffect(() => {
		let active = true;
		const previousLocale = appliedLocaleRef.current;

		function applyDictionary(nextLocale: Locale, nextDictionary: Dictionary) {
			if (!active) {
				return;
			}

			const dictionaryChanged = dictionaryRef.current !== nextDictionary;
			const localeChanged = appliedLocaleRef.current !== nextLocale;

			if (!dictionaryChanged && !localeChanged) {
				return;
			}

			setCurrentDictionary(nextDictionary);
			dictionaryRef.current = nextDictionary;
			appliedLocaleRef.current = nextLocale;
			setDictionary(nextDictionary);
			setAppliedLocale(nextLocale);

			if (dictionaryChanged) {
				void router.invalidate();
			}
		}

		if (
			requestedLocale === appliedLocaleRef.current &&
			((requestedLocale === defaultLocale &&
				dictionaryRef.current === fallbackDictionary) ||
				(requestedLocale !== defaultLocale &&
					dictionaryRef.current !== fallbackDictionary))
		) {
			return () => {
				active = false;
			};
		}

		if (requestedLocale === defaultLocale) {
			applyDictionary(defaultLocale, fallbackDictionary);

			return () => {
				active = false;
			};
		}

		getDictionary(requestedLocale)
			.then((nextDictionary) => {
				applyDictionary(requestedLocale, nextDictionary);
			})
			.catch((error: unknown) => {
				if (!active) {
					return;
				}

				console.error("Failed to load locale dictionary", error);
				setCurrentLocale(previousLocale);
			});

		return () => {
			active = false;
		};
	}, [requestedLocale, router]);

	return (
		<I18nProvider
			locale={appliedLocale}
			dictionary={dictionary}
			setLocale={setLocale}
		>
			{children}
		</I18nProvider>
	);
}
