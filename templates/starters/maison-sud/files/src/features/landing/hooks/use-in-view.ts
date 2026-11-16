// Tells a component whether its element is on screen. RoomWalk uses it to run the visit only in view.
// It wraps IntersectionObserver and keeps one boolean in state.
import { type RefObject, useEffect, useState } from "react";

/**
 * True while at least `threshold` of the element is in the viewport.
 * False on the server and before the first observer report.
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
