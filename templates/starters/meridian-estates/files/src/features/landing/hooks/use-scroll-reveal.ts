// Entrance reveals of the home page. LandingPage calls this hook once with the page root.
// It marks each [data-reveal] block off the first screen as "waiting", then "shown" when it enters the view.
// landing.css draws the states: a block rises, a plate opens from a clip, a wordmark rises out of its mask.
// With no script or with reduced motion no state exists, so every block stays visible.
import { type RefObject, useEffect } from "react";

const REVEAL_STATE = "data-reveal-state";
// The observed area starts far above the screen. A block that an anchor jump skips is then "in view" too,
// so no blank block stays above the screen. The bottom margin starts a block when it is 10% inside the view.
const OBSERVED_AREA = "1000000px 0px -10% 0px";

/** Starts the reveals under `rootRef`. A block that is visible at page load never hides, so nothing blinks. */
export function useScrollReveal(rootRef: RefObject<HTMLElement | null>) {
	// effect: IntersectionObserver is a browser API. It reports when a block enters the viewport.
	useEffect(() => {
		const root = rootRef.current;
		if (
			root === null ||
			window.matchMedia("(prefers-reduced-motion: reduce)").matches
		) {
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
			{ rootMargin: OBSERVED_AREA },
		);
		for (const block of root.querySelectorAll("[data-reveal]")) {
			const box = block.getBoundingClientRect();
			const isOnFirstScreen =
				box.top < window.innerHeight &&
				box.bottom > 0 &&
				box.left < window.innerWidth &&
				box.right > 0;
			if (isOnFirstScreen) {
				continue;
			}
			block.setAttribute(REVEAL_STATE, "waiting");
			observer.observe(block);
		}
		return () => observer.disconnect();
	}, [rootRef]);
}
