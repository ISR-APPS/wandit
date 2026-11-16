// The one count-up of the page: the reserved count of the edition meter.
// EditionMeter calls it. The server and a visitor with reduced motion get the final number at once.
// In the browser, a meter below the first screen starts at 0 and counts up when it comes into view.
import { type RefObject, useEffect, useState } from "react";
import { ENTRANCE_MARGIN } from "./use-reveal";

// 1.4 s: the band of a data reveal in the atelier motion bands.
const COUNT_DURATION_MS = 1400;

/** The number to show now. It equals `target` on the server and at the end of the count. */
export function useCountUp(
	elementRef: RefObject<HTMLElement | null>,
	target: number,
) {
	const [shown, setShown] = useState(target);
	// effect: IntersectionObserver and requestAnimationFrame are browser APIs. They time the count to the scroll.
	useEffect(() => {
		const element = elementRef.current;
		const prefersStill = window.matchMedia(
			"(prefers-reduced-motion: reduce)",
		).matches;
		// A meter that is already on screen keeps its number: a jump to 0 would flash.
		if (
			element === null ||
			prefersStill ||
			element.getBoundingClientRect().top <= window.innerHeight
		) {
			return;
		}
		setShown(0);
		let frame = 0;
		const observer = new IntersectionObserver(
			([entry]) => {
				if (!entry?.isIntersecting) {
					return;
				}
				observer.disconnect();
				const start = performance.now();
				const tick = (now: number) => {
					const elapsed = Math.min(1, (now - start) / COUNT_DURATION_MS);
					// Ease out (power 2): fast at first, slow near the target.
					const eased = 1 - (1 - elapsed) ** 2;
					setShown(Math.round(eased * target));
					if (elapsed < 1) {
						frame = requestAnimationFrame(tick);
					}
				};
				frame = requestAnimationFrame(tick);
			},
			{ rootMargin: ENTRANCE_MARGIN },
		);
		observer.observe(element);
		return () => {
			observer.disconnect();
			cancelAnimationFrame(frame);
			// A stopped count must not stay at 0 or halfway: it ends on the real number.
			setShown(target);
		};
	}, [elementRef, target]);
	return shown;
}
