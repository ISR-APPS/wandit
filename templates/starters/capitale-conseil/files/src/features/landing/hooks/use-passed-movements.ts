// How many movements of the page the visitor has reached. The header counter and the index spine call it.
// It reads the window scroll through useSyncExternalStore, so it needs no effect.
// The value comes from the measured position of each section, never from the order of scroll events.
import { useSyncExternalStore } from "react";
import { subscribeToScroll } from "../lib/scroll-store";

/** A movement is reached when its top edge passes 45% of the screen height. */
const REACH_LINE_SHARE = 0.45;

function readPassedMovements(): number {
	const line = window.innerHeight * REACH_LINE_SHARE;
	let passed = 0;
	for (const section of document.querySelectorAll("[data-movement]")) {
		if (section.getBoundingClientRect().top <= line) {
			passed += 1;
		}
	}
	return passed;
}

// The server page and the page with no script are at the top: no movement is reached.
function readServerPassedMovements(): number {
	return 0;
}

/**
 * The count of `[data-movement]` sections above the reach line, from 0 to 5.
 * The current movement is the last reached one. With a count of 0 it is the first.
 */
export function usePassedMovements(): number {
	return useSyncExternalStore(
		subscribeToScroll,
		readPassedMovements,
		readServerPassedMovements,
	);
}
