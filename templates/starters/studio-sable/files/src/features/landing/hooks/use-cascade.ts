// Entrance cascade of the home page. LandingPage calls this hook once with the page root.
// It marks each [data-cascade] section below the first screen as "waiting", then as "shown" when it enters the screen.
// landing.css draws the two states. With no script no state exists, and every block stays visible.
import { type RefObject, useEffect } from "react";

const CASCADE_STATE = "data-cascade";
// The three kinds of block. Each kind has its own stagger in landing.css, so each kind has its own count.
const BLOCK_SELECTORS = [".sable-fade", ".sable-row", ".sable-rule"];

/** Starts the cascade under `rootRef`. A section that is on screen at page load never hides. */
export function useCascade(rootRef: RefObject<HTMLElement | null>) {
	// effect: IntersectionObserver is a browser API. It reports when a section enters the viewport.
	useEffect(() => {
		const root = rootRef.current;
		const prefersStill = window.matchMedia(
			"(prefers-reduced-motion: reduce)",
		).matches;
		if (root === null || prefersStill) {
			return;
		}
		// A section starts when its top passes 92% of the screen height, so its first blocks arrive in view.
		const observer = new IntersectionObserver(
			(entries) => {
				for (const entry of entries) {
					if (entry.isIntersecting) {
						entry.target.setAttribute(CASCADE_STATE, "shown");
						observer.unobserve(entry.target);
					}
				}
			},
			{ rootMargin: "0px 0px -8% 0px" },
		);
		for (const section of root.querySelectorAll<HTMLElement>(
			`[${CASCADE_STATE}]`,
		)) {
			// React drew the section visible. Only a section below the first screen can hide without a flash.
			if (section.getBoundingClientRect().top <= window.innerHeight) {
				continue;
			}
			for (const selector of BLOCK_SELECTORS) {
				// --sable-i is the place of a block among the blocks of its kind. The CSS multiplies it by the stagger.
				section
					.querySelectorAll<HTMLElement>(selector)
					.forEach((block, index) => {
						block.style.setProperty("--sable-i", String(index));
					});
			}
			section.setAttribute(CASCADE_STATE, "waiting");
			observer.observe(section);
		}
		return () => observer.disconnect();
	}, [rootRef]);
}
