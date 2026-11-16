// Writes the scroll progress of one element into a CSS variable. landing.css reads the variable.
// HeroSection uses it for the drift of the two satellite cards. PathSection uses it to draw the lit path.
// It listens to scroll and resize, and writes at most one time per animation frame.
// With reduced motion it writes nothing, so the CSS default of the variable stays.
import { type RefObject, useEffect } from "react";

/**
 * The progress of an element from its box and the viewport height, both in px.
 * The hook clamps the result to the range 0 to 1.
 */
export type ScrollProgressOf = (
	rect: DOMRect,
	viewportHeight: number,
) => number;

/**
 * Sets `variableName` on the element to a number from 0 to 1 while the page scrolls.
 * `progressOf` must be a module-level function: a new function on each render restarts the listeners.
 */
export function useScrollProgress(
	elementRef: RefObject<HTMLElement | null>,
	variableName: `--fw-${string}`,
	progressOf: ScrollProgressOf,
	{
		keepsHighest,
	}: {
		/** True: the value never goes down, so a drawn path stays drawn after a scroll up. */
		keepsHighest: boolean;
	},
) {
	// effect: the scroll position is browser state. requestAnimationFrame limits the writes to one per frame.
	useEffect(() => {
		const element = elementRef.current;
		const prefersStill = window.matchMedia(
			"(prefers-reduced-motion: reduce)",
		).matches;
		if (element === null || prefersStill) {
			return;
		}
		let frame = 0;
		let highest = 0;
		const write = () => {
			frame = 0;
			const rect = element.getBoundingClientRect();
			// A hidden element has no box. The diagram is hidden on a phone.
			if (rect.height === 0) {
				return;
			}
			const progress = Math.min(
				1,
				Math.max(0, progressOf(rect, window.innerHeight)),
			);
			highest = Math.max(highest, progress);
			element.style.setProperty(
				variableName,
				(keepsHighest ? highest : progress).toFixed(4),
			);
		};
		const schedule = () => {
			if (frame === 0) {
				frame = requestAnimationFrame(write);
			}
		};
		write();
		window.addEventListener("scroll", schedule, { passive: true });
		window.addEventListener("resize", schedule);
		return () => {
			window.removeEventListener("scroll", schedule);
			window.removeEventListener("resize", schedule);
			cancelAnimationFrame(frame);
			element.style.removeProperty(variableName);
		};
	}, [elementRef, variableName, progressOf, keepsHighest]);
}
