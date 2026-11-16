// Entrance reveals of the Braise page. LandingPage calls this hook once with the page root.
// It marks each [data-reveal] block below the first screen as "waiting", then "shown" when it scrolls into view.
// landing.css draws the two states. With no script, or with reduced motion, no state exists and every block shows.
import { type RefObject, useEffect } from "react";

const REVEAL_STATE = "data-reveal-state";
// The observed area starts far above the screen. A block that a jump to an anchor skips is also "in view",
// so a section link never leaves a hidden block above the screen.
// No bottom margin: a block starts when its first pixel is on screen, so the last block cannot stay hidden.
const AREA_ABOVE_SCREEN = "1000000px 0px 0px 0px";

/** Starts the reveals under `rootRef`. A block that is on the first screen at load never hides. */
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
		const observer = new IntersectionObserver(
			(entries) => {
				for (const entry of entries) {
					if (entry.isIntersecting) {
						entry.target.setAttribute(REVEAL_STATE, "shown");
						observer.unobserve(entry.target);
					}
				}
			},
			{ rootMargin: AREA_ABOVE_SCREEN },
		);
		for (const block of root.querySelectorAll("[data-reveal]")) {
			// The server drew the block visible. Only a block below the first screen can hide without a flash.
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
