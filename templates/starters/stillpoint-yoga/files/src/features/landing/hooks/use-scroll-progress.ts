// A scroll scrub: writes how far an element has travelled through the screen into one CSS variable, 0 to 1.
// HeroSection, ManifestoSection, and StudioRoom call it. landing.css reads the variable for the parallax,
// the phrase-by-phrase manifesto, and the light that creeps across the studio floor.
// With no script, or with reduced motion, the variable is absent and the CSS shows the still frame.
import { type RefObject, useEffect } from "react";

/** Where the travel of the element starts and ends, as shares of the screen height from the top. */
type ScrollTravel = {
	/** The progress is 0 when the top of the element is at this share of the screen. 1 is the screen bottom. */
	startAt: number;
	/** The progress is 1 when the bottom of the element is at this share of the screen. */
	endAt: number;
};

/** Clamps a value into 0 to 1. */
function unit(value: number): number {
	return Math.min(1, Math.max(0, value));
}

/**
 * Starts the scrub on `elementRef` and writes `variable` on it. It also sets `data-scrub`,
 * so landing.css applies a scrubbed state only while the script runs.
 */
export function useScrollProgress(
	elementRef: RefObject<HTMLElement | null>,
	variable: `--${string}`,
	{ startAt, endAt }: ScrollTravel,
) {
	// effect: the scroll position and matchMedia are browser values. One animation frame writes them into a CSS variable.
	useEffect(() => {
		const element = elementRef.current;
		if (
			element === null ||
			window.matchMedia("(prefers-reduced-motion: reduce)").matches
		) {
			return;
		}
		let frame = 0;
		const write = () => {
			frame = 0;
			const rect = element.getBoundingClientRect();
			const screen = window.innerHeight;
			const distance = rect.height + (startAt - endAt) * screen;
			const progress = unit((startAt * screen - rect.top) / distance);
			element.style.setProperty(variable, progress.toFixed(4));
		};
		// One write per frame at most, however many scroll events arrive.
		const schedule = () => {
			if (frame === 0) {
				frame = window.requestAnimationFrame(write);
			}
		};
		write();
		element.setAttribute("data-scrub", "");
		window.addEventListener("scroll", schedule, { passive: true });
		window.addEventListener("resize", schedule);
		return () => {
			window.removeEventListener("scroll", schedule);
			window.removeEventListener("resize", schedule);
			window.cancelAnimationFrame(frame);
			element.style.removeProperty(variable);
			element.removeAttribute("data-scrub");
		};
	}, [elementRef, variable, startAt, endAt]);
}
