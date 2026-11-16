// The scroll state of the fixed header. SiteHeader calls it.
// "top": transparent over the hero. "solid": a blurred band after 80 px. "hidden": out of view while the
// visitor scrolls down past 300 px. It comes back on the first scroll up.
import { useEffect, useState } from "react";

/** The three looks of the header. The server and the first client render use "top". */
export type HeaderState = "top" | "solid" | "hidden";

// The header turns solid after this scroll, in px: about its own height.
const SOLID_AFTER_PX = 80;
// Below this scroll, in px, the header never hides: the hero is still on screen.
const HIDE_AFTER_PX = 300;

/** Follows the window scroll. `isLocked` keeps the header in view, for example while the phone menu is open. */
export function useHeaderState(isLocked: boolean): HeaderState {
	const [state, setState] = useState<HeaderState>("top");
	// effect: the scroll position and its direction are browser values. The listener syncs them into state.
	useEffect(() => {
		let lastScroll = window.scrollY;
		let frameRequest = 0;
		const update = () => {
			frameRequest = 0;
			const scroll = window.scrollY;
			const isGoingDown = scroll > lastScroll;
			lastScroll = scroll;
			if (scroll <= SOLID_AFTER_PX) {
				setState("top");
			} else if (scroll > HIDE_AFTER_PX && isGoingDown && !isLocked) {
				setState("hidden");
			} else {
				setState("solid");
			}
		};
		const schedule = () => {
			if (frameRequest === 0) {
				frameRequest = window.requestAnimationFrame(update);
			}
		};
		update();
		window.addEventListener("scroll", schedule, { passive: true });
		return () => {
			window.removeEventListener("scroll", schedule);
			window.cancelAnimationFrame(frameRequest);
		};
	}, [isLocked]);
	return state;
}
