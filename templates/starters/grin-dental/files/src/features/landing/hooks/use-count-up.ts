// Counts a stat number up from 0 to its value when it scrolls into view. StatSticker calls it.
// The server HTML already holds the final text, so the number is right with no script and with reduced motion.
// For 0.9 s it writes the value into the text node that React renders, then leaves the final text in place.
import { type RefObject, useEffect } from "react";

/** The length of the count. Long enough to read, short enough to finish before the visitor scrolls on. */
const COUNT_MS = 900;

/** Runs the count once. `format` turns a value into the shown text, the same function the render uses. */
export function useCountUp(
	numberRef: RefObject<HTMLElement | null>,
	target: number,
	format: (value: number) => string,
) {
	// effect: IntersectionObserver and requestAnimationFrame are browser APIs. The count starts on view.
	useEffect(() => {
		const element = numberRef.current;
		// Change the text node of React, not `textContent`. A new node is unknown to React, so a re-render misses it.
		const textNode = element?.firstChild;
		const prefersStill = window.matchMedia(
			"(prefers-reduced-motion: reduce)",
		).matches;
		// A number already on screen at load stays as it is: a count there reads as a flicker.
		if (
			element === null ||
			!(textNode instanceof Text) ||
			prefersStill ||
			element.getBoundingClientRect().top < window.innerHeight
		) {
			return;
		}
		let frame = 0;
		const observer = new IntersectionObserver((entries) => {
			if (!entries.some((entry) => entry.isIntersecting)) {
				return;
			}
			observer.disconnect();
			const startedAt = performance.now();
			const step = (now: number) => {
				const share = Math.min(1, (now - startedAt) / COUNT_MS);
				// Ease out: fast at first, slow at the end, like a counter that settles.
				const eased = 1 - (1 - share) ** 3;
				textNode.nodeValue = format(target * eased);
				if (share < 1) {
					frame = requestAnimationFrame(step);
				}
			};
			frame = requestAnimationFrame(step);
		});
		observer.observe(element);
		return () => {
			observer.disconnect();
			cancelAnimationFrame(frame);
			textNode.nodeValue = format(target);
		};
	}, [numberRef, target, format]);
}
