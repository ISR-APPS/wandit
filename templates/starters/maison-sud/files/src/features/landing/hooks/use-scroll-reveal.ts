// Entrance reveals of the landing page. LandingPage calls this hook once with the page root.
// It marks each [data-reveal] block below the first screen as "waiting", then as "shown" when it scrolls into view.
// landing.css draws the two states. With no script, no state exists, and every block stays visible.
import { type RefObject, useEffect } from "react";

const REVEAL_STATE = "data-reveal-state";

/** Starts the reveals under `rootRef`. A block that is in view at page load never hides. */
export function useScrollReveal(rootRef: RefObject<HTMLElement | null>) {
	// effect: IntersectionObserver is a browser API. It reports when a block enters the viewport.
	useEffect(() => {
		const root = rootRef.current;
		const prefersStill = window.matchMedia(
			"(prefers-reduced-motion: reduce)",
		).matches;
		if (root === null || prefersStill) {
			return;
		}
		// No root margin: a block starts as soon as its first pixel is on screen, so no block can stay hidden.
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
