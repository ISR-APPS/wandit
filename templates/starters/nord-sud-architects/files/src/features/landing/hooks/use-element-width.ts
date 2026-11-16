// Width of one element in CSS pixels. MeasuredCote calls it to print the true length of a dimension line.
// A ResizeObserver keeps the value true when the window changes size.
import { type RefObject, useEffect, useState } from "react";

/** Returns the width of the element, or `fallback` before the first measure (the server render and hydration). */
export function useElementWidth(
	elementRef: RefObject<HTMLElement | null>,
	fallback: number,
) {
	const [width, setWidth] = useState(fallback);

	// effect: ResizeObserver is a browser API. It reports the rendered width of the element.
	useEffect(() => {
		const element = elementRef.current;
		if (element === null) {
			return;
		}
		const observer = new ResizeObserver((entries) => {
			for (const entry of entries) {
				setWidth(entry.contentRect.width);
			}
		});
		observer.observe(element);
		return () => observer.disconnect();
	}, [elementRef]);

	return width;
}
