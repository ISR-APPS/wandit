// Loads the display faces the taste cards need, on demand (native twin of
// the web world-fonts.ts). Every design world's preview.fontFamily is a bare
// Google Fonts family name. The css2 stylesheet is fetched with RN's default
// (non-browser) user agent, so Google serves ttf sources that expo-font can
// load directly. Families already requested are never requested again for
// the lifetime of the app session; a failed load resolves false and the card
// falls back to the neutral face — never a crash.

import * as Font from "expo-font";
import { useEffect, useState } from "react";

const loadedFamilies = new Set<string>();
const pendingFamilies = new Map<string, Promise<boolean>>();

function familySpec(family: string): string {
	return `family=${encodeURIComponent(family).replaceAll("%20", "+")}`;
}

async function loadWorldFont(family: string): Promise<boolean> {
	try {
		const response = await fetch(
			`https://fonts.googleapis.com/css2?${familySpec(family)}&display=swap`,
		);
		if (!response.ok) return false;
		const css = await response.text();
		const url = css.match(/url\((https:[^)]+\.(?:ttf|otf))\)/)?.[1];
		if (!url) return false;
		await Font.loadAsync({ [family]: { uri: url } });
		loadedFamilies.add(family);
		return true;
	} catch {
		return false;
	}
}

export function ensureWorldFontLoaded(family: string): Promise<boolean> {
	if (!family) return Promise.resolve(false);
	if (loadedFamilies.has(family)) return Promise.resolve(true);

	const pending = pendingFamilies.get(family);
	if (pending) return pending;

	const promise = loadWorldFont(family).finally(() => {
		pendingFamilies.delete(family);
	});
	pendingFamilies.set(family, promise);
	return promise;
}

/** True once the family is usable as a fontFamily — false while loading or
 * after a failed fetch (the caller renders its fallback face then). */
export function useWorldFont(family: string | undefined): boolean {
	const [ready, setReady] = useState(
		family !== undefined && loadedFamilies.has(family),
	);

	useEffect(() => {
		if (!family) return;
		if (loadedFamilies.has(family)) {
			setReady(true);
			return;
		}
		let cancelled = false;
		void ensureWorldFontLoaded(family).then((loaded) => {
			if (!cancelled && loaded) setReady(true);
		});
		return () => {
			cancelled = true;
		};
	}, [family]);

	return ready;
}
