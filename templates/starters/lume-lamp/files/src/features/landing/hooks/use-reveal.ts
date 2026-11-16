// Scroll entrances of the product page. LandingPage calls this hook once with the page root.
// It marks each [data-reveal] block below the first screen as "waiting", then as "shown" when it enters the screen.
// landing.css draws the two states. With no script no state exists, and every block stays visible.
import { type RefObject, useEffect } from "react";

const REVEAL_STATE = "data-reveal";

/** The value that React writes for a bare `data-reveal` prop. It means "visible, no entrance yet". */
const REVEAL_IDLE = "true";

/**
 * Observer margin of the page entrances, also used by useCountUp.
 * The huge top margin counts a block above the screen as in view, so a fast jump past a block still shows it.
 * The -10% bottom starts a block when its top passes 90% of the screen height, as in the source page.
 */
export const ENTRANCE_MARGIN = "100000px 0px -10% 0px";

/** Starts the entrances under `rootRef`. A block that is on screen at page load never hides. */
export function useReveal(rootRef: RefObject<HTMLElement | null>) {
	// effect: IntersectionObserver is a browser API. It reports when a block enters the viewport.
	useEffect(() => {
		const root = rootRef.current;
		const prefersStill = window.matchMedia(
			"(prefers-reduced-motion: reduce)",
		).matches;
		if (root === null || prefersStill) {
			return;
		}
		const observer = new IntersectionObserver(
			(entries) => {
				for (const entry of entries) {
					if (entry.isIntersecting) {
						entry.target.setAttribute(REVEAL_STATE, "shown");
						observer.unobserve(entry.target);
					}
				}
			},
			{ rootMargin: ENTRANCE_MARGIN },
		);
		for (const block of root.querySelectorAll<HTMLElement>(
			`[${REVEAL_STATE}="${REVEAL_IDLE}"]`,
		)) {
			// React drew the block visible. Only a block below the first screen can hide without a flash.
			if (block.getBoundingClientRect().top <= window.innerHeight) {
				continue;
			}
			block.setAttribute(REVEAL_STATE, "waiting");
			observer.observe(block);
		}
		return () => {
			observer.disconnect();
			// No observer watches a waiting block any more, so it goes back to visible. A new run can start it again.
			for (const block of root.querySelectorAll(
				`[${REVEAL_STATE}="waiting"]`,
			)) {
				block.setAttribute(REVEAL_STATE, REVEAL_IDLE);
			}
		};
	}, [rootRef]);
}
