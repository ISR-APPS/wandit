// Count-up of one figure of the distance section.
// stat-figure.tsx calls it when the figure enters the viewport.
// It drives the number with requestAnimationFrame.
import { useEffect, useState } from "react";

/** 0.9 s: long enough to read as a count, short enough to end before the visitor scrolls on. */
const COUNT_MS = 900;

/**
 * Returns the number to show. It is `target` until `isRunning` turns true.
 * Then it counts from 0 to `target` one time.
 */
export function useCountUp(target: number, isRunning: boolean): number {
	const [value, setValue] = useState(target);

	// effect: requestAnimationFrame counts from 0 to the target while the figure enters the viewport
	useEffect(() => {
		if (!isRunning) {
			return;
		}
		const startedAt = performance.now();
		let frame = 0;
		const tick = (now: number) => {
			const progress = Math.min(1, (now - startedAt) / COUNT_MS);
			// Ease in and out: slow start, slow landing.
			const eased = 0.5 - Math.cos(Math.PI * progress) / 2;
			setValue(Math.round(target * eased));
			if (progress < 1) {
				frame = requestAnimationFrame(tick);
			}
		};
		frame = requestAnimationFrame(tick);
		return () => cancelAnimationFrame(frame);
	}, [isRunning, target]);

	return value;
}
