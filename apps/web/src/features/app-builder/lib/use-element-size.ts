/**
 * Measures the box of one element and keeps the size current. The phone
 * stage of phone-preview.tsx and the window stage of desktop-window.tsx call
 * it, then give the size to fitFrameScale of helpers.ts. Uses a ResizeObserver.
 */

import { type RefObject, useLayoutEffect, useState } from "react";

/** Width and height of an element or of a frame, in CSS px. */
export type ElementSize = { width: number; height: number };

/** Size of the element of `ref`. null before the first measure, and 0 x 0 while the element is not laid out. */
export function useElementSize(
	ref: RefObject<HTMLElement | null>,
): ElementSize | null {
	const [size, setSize] = useState<ElementSize | null>(null);
	useLayoutEffect(() => {
		const element = ref.current;
		if (!element) return;
		// Measure once before paint, so the first frame has the right layout.
		setSize({ width: element.clientWidth, height: element.clientHeight });
		const observer = new ResizeObserver(([entry]) => {
			if (entry) {
				setSize({
					width: entry.contentRect.width,
					height: entry.contentRect.height,
				});
			}
		});
		observer.observe(element);
		return () => observer.disconnect();
	}, [ref]);
	return size;
}
