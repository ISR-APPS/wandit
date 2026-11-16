// Tells a list page the width class of the window: phone, medium, or wide. Each class shows other table columns.
// The Holdings, Markets, and Activity pages call it, so no table column is cut on a phone or beside the open sidebar.
// It reads two media queries with useSyncExternalStore, so it needs no effect.
import { useSyncExternalStore } from "react";

// 80rem and 40rem are the "xl" and "sm" widths of Tailwind. CSS classes such as max-sm:hidden change at the same widths.
const WIDE_QUERY = "(min-width: 80rem)";
const PHONE_QUERY = "(max-width: 39.99rem)";

/** "phone" under 40rem, "wide" from 80rem, "medium" between them. */
export type ScreenSize = "phone" | "medium" | "wide";

function subscribe(onChange: () => void): () => void {
	const queries = [WIDE_QUERY, PHONE_QUERY].map((query) =>
		window.matchMedia(query),
	);
	for (const media of queries) {
		media.addEventListener("change", onChange);
	}
	return () => {
		for (const media of queries) {
			media.removeEventListener("change", onChange);
		}
	};
}

function readScreenSize(): ScreenSize {
	if (window.matchMedia(WIDE_QUERY).matches) {
		return "wide";
	}
	return window.matchMedia(PHONE_QUERY).matches ? "phone" : "medium";
}

/** The width class of the window. The pages behind login render in the browser only; a server render answers "wide". */
export function useScreenSize(): ScreenSize {
	return useSyncExternalStore(subscribe, readScreenSize, () => "wide");
}
