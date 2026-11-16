// Entrance reveals of the home page. LandingPage calls this hook once with the page root.
// It marks each [data-reveal] block below the first screen as "waiting", then as "shown" when it scrolls into view.
// landing.css draws the states: a text block rises, a rule draws across, a figure plots its strokes.
// With no script no state exists, and every block stays visible and fully drawn.
import { type RefObject, useEffect } from "react";
import { prefersReducedMotion } from "../lib/motion";

const REVEAL_STATE = "data-reveal-state";
// The observed area starts far above the screen. A block that a jump scrolls past is then also "in view",
// so a link to a section never leaves a blank figure above the screen.
// The bottom margin starts a block when it is 8% inside the screen, so a figure plots where the eye is.
const OBSERVED_AREA = "1000000px 0px -8% 0px";

/** Starts the reveals under `rootRef`. A block that is on the first screen at page load never hides. */
export function useScrollReveal(rootRef: RefObject<HTMLElement | null>) {
	// effect: IntersectionObserver is a browser API. It reports when a block enters the viewport.
	useEffect(() => {
		const root = rootRef.current;
		if (root === null || prefersReducedMotion()) {
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
			// React drew the block visible. Only a block below the first screen can hide without a flash.
			if (block.getBoundingClientRect().top > window.innerHeight) {
				block.setAttribute(REVEAL_STATE, "waiting");
				observer.observe(block);
			}
		}
		return () => {
			observer.disconnect();
			// No observer watches a waiting block after this point, so each one shows again.
			for (const block of root.querySelectorAll(
				`[${REVEAL_STATE}="waiting"]`,
			)) {
				block.removeAttribute(REVEAL_STATE);
			}
		};
	}, [rootRef]);
}
