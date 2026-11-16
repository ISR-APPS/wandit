// Scrubs the interlude sun. InterludeSection calls this hook with its section element.
// On each scroll it writes one CSS variable, 0 to 1, in a requestAnimationFrame. landing.css moves the sun with it.
import { type RefObject, useEffect } from "react";

/** The CSS variable that this hook writes on the element. landing.css reads it in `.louz-sun`. */
const PROGRESS_VARIABLE = "--louz-sun-progress";

/**
 * Writes the scroll progress through `sectionRef` into a CSS variable of that element.
 * 0 when the section top enters the bottom tenth of the screen, 1 when its bottom reaches the middle.
 * With reduced motion it writes nothing, and the CSS default (the composed frame) stays.
 */
export function useScrollProgress(sectionRef: RefObject<HTMLElement | null>) {
	// effect: the scroll position is a browser value. The hook mirrors it into a style variable, with no React state.
	useEffect(() => {
		const section = sectionRef.current;
		const prefersStill = window.matchMedia(
			"(prefers-reduced-motion: reduce)",
		).matches;
		if (section === null || prefersStill) {
			return;
		}
		let frame = 0;
		const update = () => {
			frame = 0;
			const box = section.getBoundingClientRect();
			// Start: the top at 90% of the screen height. End: the bottom at 50%. The same window as the source scrub.
			const start = window.innerHeight * 0.9;
			const end = window.innerHeight * 0.5 - box.height;
			const progress = (start - box.top) / (start - end);
			section.style.setProperty(
				PROGRESS_VARIABLE,
				Math.min(1, Math.max(0, progress)).toFixed(3),
			);
		};
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
	}, [sectionRef]);
}
