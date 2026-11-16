// Entrance reveals of the home page. LandingPage calls this hook once with the page root.
// On the first scroll, it marks each [data-reveal] block below the screen "waiting", then "shown" when it enters.
// landing.css draws the states: a rise of 30px and a fade, the line drawings, and the schedule dots.
// With no script, with reduced motion, or before the first scroll, every block stays visible.
import { type RefObject, useEffect } from "react";

/** The attribute that landing.css reads: "waiting" or "shown". */
const REVEAL_STATE = "data-reveal-state";

/** Starts the reveals under `rootRef`. A block that is on screen or above it never hides. */
export function useScrollReveal(rootRef: RefObject<HTMLElement | null>) {
	// effect: IntersectionObserver, scroll, and matchMedia are browser APIs. The observer reports when a block enters the viewport.
	useEffect(() => {
		const root = rootRef.current;
		const prefersStill = window.matchMedia(
			"(prefers-reduced-motion: reduce)",
		).matches;
		if (root === null || prefersStill) {
			return;
		}
		// A block starts when its top passes 88% of the screen height.
		// The big top margin shows a block that a fast scroll jumped past.
		const observer = new IntersectionObserver(
			(entries) => {
				for (const entry of entries) {
					if (entry.isIntersecting) {
						entry.target.setAttribute(REVEAL_STATE, "shown");
						observer.unobserve(entry.target);
					}
				}
			},
			{ rootMargin: "100000px 0px -12% 0px" },
		);
		// The blocks hide only at the first scroll: a page that loads late, or that nobody scrolls, stays complete.
		const armOnce = () => {
			for (const block of root.querySelectorAll("[data-reveal]")) {
				if (block.getBoundingClientRect().top > window.innerHeight) {
					block.setAttribute(REVEAL_STATE, "waiting");
					observer.observe(block);
				}
			}
		};
		window.addEventListener("scroll", armOnce, { once: true, passive: true });
		return () => {
			window.removeEventListener("scroll", armOnce);
			observer.disconnect();
			// A block that still waits has no observer after this. Show it, so a re-run cannot leave it hidden.
			for (const block of root.querySelectorAll(
				`[${REVEAL_STATE}="waiting"]`,
			)) {
				block.removeAttribute(REVEAL_STATE);
			}
		};
	}, [rootRef]);
}
