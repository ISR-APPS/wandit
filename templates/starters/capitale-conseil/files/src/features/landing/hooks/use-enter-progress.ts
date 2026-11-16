// The progress of one block through its entrance zone, from 0 to 1. FigureRow calls it to count its figure.
// It reads the window scroll through useSyncExternalStore, so it needs no effect.
// The value only grows: a figure that the visitor has read never counts down again.
import {
	type RefObject,
	useCallback,
	useRef,
	useSyncExternalStore,
} from "react";
import {
	clampShare,
	prefersReducedMotion,
	subscribeToScroll,
} from "../lib/scroll-store";

/** The entrance starts when the top edge of the block passes 96% of the screen height. */
const START_SHARE = 0.96;
/** The entrance ends when the top edge passes 52% of the screen height: the block is then mid-screen. */
const END_SHARE = 0.52;
/** Steps of 1%: at most 100 renders for one entrance. */
const STEPS = 100;

// The server page and the page with no script show the block complete.
function readServerProgress(): number {
	return 1;
}

/**
 * The furthest share of the entrance zone that `targetRef` has crossed, in steps of 0.01.
 * It is 1 on the server, 1 when the block is on screen at page load, and 1 for reduced motion.
 * Do not put a transform on the target itself: its measured position must not move with the progress.
 */
export function useEnterProgress(
	targetRef: RefObject<HTMLElement | null>,
): number {
	// null until the first read in the browser.
	const furthestRef = useRef<number | null>(null);
	const readProgress = useCallback(() => {
		const target = targetRef.current;
		if (target === null) {
			return furthestRef.current ?? 0;
		}
		if (prefersReducedMotion()) {
			return 1;
		}
		const screenHeight = window.innerHeight;
		const zone = (START_SHARE - END_SHARE) * screenHeight;
		const crossed =
			START_SHARE * screenHeight - target.getBoundingClientRect().top;
		const stepped = Math.round(clampShare(crossed / zone) * STEPS) / STEPS;
		// A block that is on screen at the first read stays complete: the visitor saw the server page already.
		const furthest =
			furthestRef.current === null && stepped > 0
				? 1
				: Math.max(furthestRef.current ?? 0, stepped);
		furthestRef.current = furthest;
		return furthest;
	}, [targetRef]);
	return useSyncExternalStore(
		subscribeToScroll,
		readProgress,
		readServerProgress,
	);
}
