// Fade entrances of the home page. LandingPage calls this hook once with the page root.
// It marks each [data-reveal] block below the first screen as "waiting", then as "shown" when it enters the screen.
// landing.css draws the two states. With no script no state exists, and every block stays visible.
import { type RefObject, useEffect } from "react";

const REVEAL_STATE = "data-reveal";

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
		// A block starts when its top passes 88% of the screen height, so its first lines arrive in view.
		// The large top margin counts a block above the screen as entered. A fast jump past a block shows it too.
		const observer = new IntersectionObserver(
			(entries) => {
				for (const entry of entries) {
					if (entry.isIntersecting) {
						entry.target.setAttribute(REVEAL_STATE, "shown");
						observer.unobserve(entry.target);
					}
				}
			},
			{ rootMargin: "9999px 0px -12% 0px" },
		);
		for (const block of root.querySelectorAll<HTMLElement>(
			`[${REVEAL_STATE}]`,
		)) {
			// React drew the block visible. Only a block below the first screen can hide without a flash.
			if (block.getBoundingClientRect().top <= window.innerHeight) {
				continue;
			}
			// --nour-i is the place of a fade in its block. The CSS multiplies it by the stagger.
			block
				.querySelectorAll<HTMLElement>(".nour-fade")
				.forEach((fade, index) => {
					fade.style.setProperty("--nour-i", String(index));
				});
			block.setAttribute(REVEAL_STATE, "waiting");
			observer.observe(block);
		}
		return () => observer.disconnect();
	}, [rootRef]);
}
