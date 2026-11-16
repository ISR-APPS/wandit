// The opening of the drawer index, from 0 (five tabs in one stack) to 1 (tabs fanned out). PracticesSection calls it.
// It reads the window scroll through useSyncExternalStore, so it needs no effect.
// The value only grows: a drawer that the visitor has seen open never closes again.
import {
	type RefObject,
	useCallback,
	useRef,
	useSyncExternalStore,
} from "react";
import { prefersReducedMotion, subscribeToScroll } from "../lib/scroll-store";

/** The fan starts when the top of the drawer passes 92% of the screen height. */
const START_SHARE = 0.92;
/** The fan ends when the top of the drawer passes 50% of the screen height. */
const END_SHARE = 0.5;
/** Steps of 5%: at most 20 renders for one opening. */
const STEPS = 20;

// The server page and the page with no script show the drawer open.
function readServerProgress(): number {
	return 1;
}

/** The furthest share of the opening zone that `drawerRef` has crossed. 1 on the server, at load on screen, and for reduced motion. */
export function useFanProgress(
	drawerRef: RefObject<HTMLElement | null>,
): number {
	// null until the first read in the browser.
	const furthestRef = useRef<number | null>(null);
	const readProgress = useCallback(() => {
		const drawer = drawerRef.current;
		if (drawer === null) {
			return furthestRef.current ?? 1;
		}
		if (prefersReducedMotion()) {
			return 1;
		}
		const screenHeight = window.innerHeight;
		const zone = (START_SHARE - END_SHARE) * screenHeight;
		const crossed =
			START_SHARE * screenHeight - drawer.getBoundingClientRect().top;
		const share = Math.min(1, Math.max(0, crossed / zone));
		const stepped = Math.round(share * STEPS) / STEPS;
		// A drawer that is on screen at the first read stays open: the visitor saw the server page already.
		const furthest =
			furthestRef.current === null && stepped > 0
				? 1
				: Math.max(furthestRef.current ?? 0, stepped);
		furthestRef.current = furthest;
		return furthest;
	}, [drawerRef]);
	return useSyncExternalStore(
		subscribeToScroll,
		readProgress,
		readServerProgress,
	);
}
