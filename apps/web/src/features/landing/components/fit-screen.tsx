/**
 * Scales a screen with a fixed design size down (or up) to the width of its
 * container, and keeps the aspect ratio. The hero, how-it-works and languages
 * sections wrap a MiniApp in it, inside a DeviceFrame.
 */

import { type ReactNode, useLayoutEffect, useRef, useState } from "react";

type FitScreenProps = {
	/** Design width of the screen in CSS px, for example 360 for a phone. */
	width: number;
	/** Design height of the screen in CSS px, for example 780 for a phone. */
	height: number;
	children: ReactNode;
};

/** The container takes the full width of its parent and the height that the aspect ratio gives. */
export function FitScreen({ width, height, children }: FitScreenProps) {
	const containerRef = useRef<HTMLDivElement>(null);
	const [scale, setScale] = useState(1);

	useLayoutEffect(() => {
		const container = containerRef.current;
		if (!container) return;
		// Measure once before paint, so the first frame is not at the design size.
		setScale(container.clientWidth / width);
		const observer = new ResizeObserver(([entry]) => {
			if (entry) setScale(entry.contentRect.width / width);
		});
		observer.observe(container);
		return () => observer.disconnect();
	}, [width]);

	return (
		<div
			ref={containerRef}
			className="relative w-full overflow-hidden"
			style={{ aspectRatio: `${width} / ${height}` }}
		>
			{/* Centered on the x axis, so the same math works in LTR and RTL. */}
			<div
				className="absolute top-0 left-1/2 origin-top"
				style={{
					width,
					height,
					transform: `translateX(-50%) scale(${scale})`,
				}}
			>
				{children}
			</div>
		</div>
	);
}
