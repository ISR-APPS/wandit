// Tells if the screen is wide enough for every column of a table.
// The tables of the Events, Accounts, account, and Reports pages read it. Under that width they show fewer columns.
// It reads one CSS media query with useSyncExternalStore, so a resize or a rotation updates the tables.
import { useSyncExternalStore } from "react";

// 64rem is 1024 px. Under it, a phone or the open sidebar leaves too little room for the full tables.
const WIDE_SCREEN_QUERY = "(min-width: 64rem)";

function subscribe(onChange: () => void): () => void {
	const query = window.matchMedia(WIDE_SCREEN_QUERY);
	query.addEventListener("change", onChange);
	return () => query.removeEventListener("change", onChange);
}

function isWideNow(): boolean {
	return window.matchMedia(WIDE_SCREEN_QUERY).matches;
}

// The app area renders only in the browser (ssr: false), so React never shows this server value.
function isWideOnServer(): boolean {
	return true;
}

/** true from 1024 px wide. A table passes its short column set under that width. */
export function useIsWideScreen(): boolean {
	return useSyncExternalStore(subscribe, isWideNow, isWideOnServer);
}
