// The press-roll reveals of the Le Kiosque page. LandingPage calls this hook once with the page root.
// Each [data-roll-group] section below the first screen waits, then rolls when it scrolls into view:
// its rules wipe, then its [data-roll] blocks rise and its [data-stamp] tags stamp in, in reading order.
// kiosque.css draws the states. With no script, or with reduced motion, no state exists and every block shows.
import { type RefObject, useEffect } from "react";

const ROLL_STATE = "data-roll-state";
// The rules wipe first. The first block starts 300 ms later, then one block every 130 ms in DOM order.
const FIRST_BLOCK_DELAY_MS = 300;
const BLOCK_STAGGER_MS = 130;
// The observed area starts far above the screen. A section that a jump to an anchor skips is also "in view",
// so a rubric link never leaves a hidden section above the screen.
const AREA_ABOVE_SCREEN = "1000000px 0px -8% 0px";

/** Starts the reveals under `rootRef`. A section that is on the first screen at load never hides. */
export function usePressRoll(rootRef: RefObject<HTMLElement | null>) {
	// effect: IntersectionObserver is a browser API. It reports when a section enters the viewport.
	useEffect(() => {
		const root = rootRef.current;
		const prefersStill = window.matchMedia(
			"(prefers-reduced-motion: reduce)",
		).matches;
		if (!root || prefersStill) {
			return;
		}
		const observer = new IntersectionObserver(
			(entries) => {
				for (const entry of entries) {
					if (entry.isIntersecting) {
						entry.target.setAttribute(ROLL_STATE, "shown");
						observer.unobserve(entry.target);
					}
				}
			},
			{ rootMargin: AREA_ABOVE_SCREEN },
		);
		for (const group of root.querySelectorAll<HTMLElement>(
			"[data-roll-group]",
		)) {
			// The server drew the section visible. Only a section below the first screen can hide without a flash.
			if (group.getBoundingClientRect().top <= window.innerHeight) {
				continue;
			}
			const blocks = group.querySelectorAll<HTMLElement>(
				"[data-roll], [data-stamp]",
			);
			blocks.forEach((block, index) => {
				block.style.setProperty(
					"--ks-roll-delay",
					`${FIRST_BLOCK_DELAY_MS + index * BLOCK_STAGGER_MS}ms`,
				);
			});
			group.setAttribute(ROLL_STATE, "waiting");
			observer.observe(group);
		}
		return () => {
			observer.disconnect();
			// No observer watches a waiting section after this point, so each one shows again.
			for (const group of root.querySelectorAll(`[${ROLL_STATE}="waiting"]`)) {
				group.removeAttribute(ROLL_STATE);
			}
		};
	}, [rootRef]);
}
