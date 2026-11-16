// Tells a component whether its element is on screen. RoomTour uses it to run the tour clock only in view.
// It wraps IntersectionObserver and keeps one boolean in state.
import { type RefObject, useEffect, useState } from "react";

/**
 * True while at least `threshold` (0 to 1) of the element is in the viewport.
 * False on the server and before the first report of the observer.
 */
export function useInView(
	elementRef: RefObject<HTMLElement | null>,
	threshold: number,
): boolean {
	const [isInView, setIsInView] = useState(false);
	// effect: IntersectionObserver is a browser API. Its report is the only source of this state.
	useEffect(() => {
		const element = elementRef.current;
		if (element === null) {
			return;
		}
		const observer = new IntersectionObserver(
			(entries) => {
				for (const entry of entries) {
					setIsInView(entry.isIntersecting);
				}
			},
			{ threshold },
		);
		observer.observe(element);
		return () => observer.disconnect();
	}, [elementRef, threshold]);
	return isInView;
}
