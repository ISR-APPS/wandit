// Entrance reveals of the home page. LandingPage calls this hook once with the page root.
// It marks each [data-reveal] block below the first screen as "waiting", then "shown" when it scrolls into view.
// landing.css draws the two states: a rise of 22px and a fade over 1s. With no script, every block stays visible.
import { type RefObject, useEffect } from "react";

/** The attribute that landing.css reads: "waiting" or "shown". */
const REVEAL_STATE = "data-reveal-state";

/** Starts the reveals under `rootRef`. A block that is on screen at page load never hides. */
export function useScrollReveal(rootRef: RefObject<HTMLElement | null>) {
	// effect: IntersectionObserver and matchMedia are browser APIs. The observer reports when a block enters the viewport.
	useEffect(() => {
		const root = rootRef.current;
		const prefersStill = window.matchMedia(
			"(prefers-reduced-motion: reduce)",
		).matches;
		if (root === null || prefersStill) {
			return;
		}
		// A block starts when its top passes 92% of the screen height, as the "top 92%" trigger of the world.
		const observer = new IntersectionObserver(
			(entries) => {
				for (const entry of entries) {
					if (entry.isIntersecting) {
						entry.target.setAttribute(REVEAL_STATE, "shown");
						observer.unobserve(entry.target);
					}
				}
			},
			{ rootMargin: "0px 0px -8% 0px" },
		);
		for (const block of root.querySelectorAll("[data-reveal]")) {
			// React drew the block visible. Only a block below the first screen can hide without a flash.
			if (block.getBoundingClientRect().top > window.innerHeight) {
				block.setAttribute(REVEAL_STATE, "waiting");
				observer.observe(block);
			}
		}
		return () => {
			observer.disconnect();
			// A block that still waits has no observer after this. Show it, so a re-run (Fast Refresh) cannot leave it hidden.
			for (const block of root.querySelectorAll(
				`[${REVEAL_STATE}="waiting"]`,
			)) {
				block.removeAttribute(REVEAL_STATE);
			}
		};
	}, [rootRef]);
}
