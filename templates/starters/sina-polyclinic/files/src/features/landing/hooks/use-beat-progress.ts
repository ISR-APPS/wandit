// Scroll progress of the counted band, from 0 to 1. FiguresSection calls it to draw the trace and count the facts.
// It reads the window scroll through useSyncExternalStore, so it needs no effect.
// The value only grows: a fact that the visitor can read never counts down again.
import {
	type RefObject,
	useCallback,
	useRef,
	useSyncExternalStore,
} from "react";

/** The band starts when its top edge passes 82% of the screen height. */
const START_SHARE = 0.82;
/** The band is complete when its bottom edge passes 92% of the screen height: all of it is then on screen. */
const END_SHARE = 0.92;
/** Steps of 0.5%: at most 200 renders for one pass of the band. */
const STEPS = 200;

function subscribe(onChange: () => void): () => void {
	window.addEventListener("scroll", onChange, { passive: true });
	window.addEventListener("resize", onChange);
	return () => {
		window.removeEventListener("scroll", onChange);
		window.removeEventListener("resize", onChange);
	};
}

// The server page and the page with no script show the band complete.
function getServerProgress(): number {
	return 1;
}

/**
 * The furthest share of the band that the visitor scrolled through, in steps of 0.005.
 * It is 1 on the server, 1 when the band is on screen at page load, and 1 when the visitor asks for reduced motion.
 */
export function useBeatProgress(
	bandRef: RefObject<HTMLElement | null>,
): number {
	// null until the first read in the browser.
	const furthestRef = useRef<number | null>(null);
	const getProgress = useCallback(() => {
		const band = bandRef.current;
		if (band === null) {
			return furthestRef.current ?? 0;
		}
		if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
			return 1;
		}
		const box = band.getBoundingClientRect();
		const screenHeight = window.innerHeight;
		// The scroll distance between the start line and the end line. 1px is the floor for a very short band.
		const distance = Math.max(
			1,
			box.height - (END_SHARE - START_SHARE) * screenHeight,
		);
		const share = (START_SHARE * screenHeight - box.top) / distance;
		const stepped = Math.round(Math.min(1, Math.max(0, share)) * STEPS) / STEPS;
		// A band that is on screen at the first read stays complete: the visitor saw the server page already.
		const furthest =
			furthestRef.current === null && stepped > 0
				? 1
				: Math.max(furthestRef.current ?? 0, stepped);
		furthestRef.current = furthest;
		return furthest;
	}, [bandRef]);
	return useSyncExternalStore(subscribe, getProgress, getServerProgress);
}
