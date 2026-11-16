// Entrance reveals of the home page. LandingPage calls this hook once with the page root.
// It marks each [data-reveal] block below the first screen as "waiting", then as "shown" when it scrolls into view.
// landing.css draws the two states: a bloom from 0.96 and a fade. With no script, every block stays visible.
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
		// No root margin: a block starts when its first pixel is on screen.
		// A jump of one screen height then never passes over a block, so no block can stay hidden.
		const observer = new IntersectionObserver((entries) => {
			for (const entry of entries) {
				if (entry.isIntersecting) {
					entry.target.setAttribute(REVEAL_STATE, "shown");
					observer.unobserve(entry.target);
				}
			}
		});
		for (const block of root.querySelectorAll("[data-reveal]")) {
			// React drew the block visible. Only a block below the first screen can hide without a flash.
			if (block.getBoundingClientRect().top > window.innerHeight) {
				block.setAttribute(REVEAL_STATE, "waiting");
				observer.observe(block);
			}
		}
		return () => observer.disconnect();
	}, [rootRef]);
}
