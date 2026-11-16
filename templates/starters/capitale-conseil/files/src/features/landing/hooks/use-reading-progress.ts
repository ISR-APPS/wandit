// The share of the page that the visitor has scrolled, from 0 to 1. ReadingProgress draws it under the header.
// It reads the window scroll through useSyncExternalStore, so it needs no effect.
import { useSyncExternalStore } from "react";
import { clampShare, subscribeToScroll } from "../lib/scroll-store";

/** Steps of 0.25%: one step is about 1px of the hairline on a phone. */
const STEPS = 400;

function readReadingProgress(): number {
	const page = document.documentElement;
	const distance = Math.max(page.scrollHeight - window.innerHeight, 0);
	// A page that fits the screen has nothing to scroll: it is read.
	const share = distance > 0 ? clampShare(window.scrollY / distance) : 1;
	return Math.round(share * STEPS) / STEPS;
}

function readServerReadingProgress(): number {
	return 0;
}

/** The scroll position over the scroll distance of the page, in steps of 0.0025. It is 0 on the server. */
export function useReadingProgress(): number {
	return useSyncExternalStore(
		subscribeToScroll,
		readReadingProgress,
		readServerReadingProgress,
	);
}
