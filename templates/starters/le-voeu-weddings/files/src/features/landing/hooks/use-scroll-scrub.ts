// Scroll-linked motion of the home page. LandingPage calls this hook once with the page root.
// It writes the scroll progress of each [data-scrub] element, from 0 to 1, into its --voeu-scrub CSS variable.
// landing.css reads the variable: the petals drift, the evening photo settles, the reply card draws its frames.
import { type RefObject, useEffect } from "react";

/**
 * The progress of one element, from 0 to 1.
 * "pass": 0 when its top meets the bottom of the screen, 1 when its bottom leaves the top.
 * "card": 0 when its top is at 94% of the screen height, 1 when its top is at 24%. So the card is whole before it parks.
 * The hook keeps the highest "card" value, so the card assembles once. At the page end, "card" is 1.
 */
function scrubProgress(element: Element, viewportHeight: number): number {
	const box = element.getBoundingClientRect();
	const progress =
		element.getAttribute("data-scrub") === "card"
			? (viewportHeight * 0.94 - box.top) / (viewportHeight * 0.7)
			: (viewportHeight - box.top) / (viewportHeight + box.height);
	return Math.min(1, Math.max(0, progress));
}

/** Starts the scrub under `rootRef`. With no script or with reduced motion, the CSS fallbacks show a still page. */
export function useScrollScrub(rootRef: RefObject<HTMLElement | null>) {
	// effect: the scroll position is a browser value. One animation frame per scroll writes it into CSS variables.
	useEffect(() => {
		const root = rootRef.current;
		const prefersStill = window.matchMedia(
			"(prefers-reduced-motion: reduce)",
		).matches;
		if (root === null || prefersStill) {
			return;
		}
		const elements = Array.from(root.querySelectorAll("[data-scrub]"));
		// The highest progress of each "card" element. The reply card assembles once and never comes apart.
		const cardPeaks = new Map<Element, number>();
		let frame = 0;
		const update = () => {
			frame = 0;
			const viewportHeight = window.innerHeight;
			const pageHeight = document.documentElement.scrollHeight;
			for (const element of elements) {
				if (!(element instanceof HTMLElement)) {
					continue;
				}
				let progress = scrubProgress(element, viewportHeight);
				if (element.getAttribute("data-scrub") === "card") {
					// On a very tall screen the card cannot reach 24%. At the page end, the card is whole.
					if (window.scrollY + viewportHeight >= pageHeight - 1) {
						progress = 1;
					}
					progress = Math.max(progress, cardPeaks.get(element) ?? 0);
					cardPeaks.set(element, progress);
				}
				element.style.setProperty("--voeu-scrub", progress.toFixed(4));
			}
		};
		// Many scroll events can come in one frame. Only the first one asks for a frame.
		const schedule = () => {
			if (frame === 0) {
				frame = window.requestAnimationFrame(update);
			}
		};
		update();
		window.addEventListener("scroll", schedule, { passive: true });
		window.addEventListener("resize", schedule);
		return () => {
			window.removeEventListener("scroll", schedule);
			window.removeEventListener("resize", schedule);
			window.cancelAnimationFrame(frame);
		};
	}, [rootRef]);
}
