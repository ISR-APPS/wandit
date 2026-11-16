// Scroll progress of the wall of prints, written as the CSS variable --yr-drift on its window.
// gallery-section.tsx calls it; landing.css moves the three columns from that one variable.
// A scroll or a resize starts a requestAnimationFrame loop. The loop stops when the value settles.
// An IntersectionObserver gates the loop: it runs only while the window is on screen.
import { useEffect, useState } from "react";

/** Share of the remaining distance that the value covers in each frame. It gives the drift a short tail. */
const EASE_PER_FRAME = 0.14;

/** Below this distance the value snaps to its target, so the loop stops. */
const SETTLE_DISTANCE = 0.0005;

/**
 * Returns a callback ref for the window of the wall.
 * The variable goes from 0, when the window enters at the bottom of the viewport, to 1, when it leaves at the top.
 * With reduced motion, or with no script, the variable is absent and the columns keep their start position.
 */
export function useDriftProgress(): (node: HTMLElement | null) => void {
	const [node, setNode] = useState<HTMLElement | null>(null);

	// effect: scroll and resize start a requestAnimationFrame loop that writes the wall progress into a CSS variable
	useEffect(() => {
		if (
			node === null ||
			window.matchMedia("(prefers-reduced-motion: reduce)").matches
		) {
			return;
		}
		// 0 means that no frame is queued.
		let frameId = 0;
		let isOnScreen = false;
		let current: number | null = null;
		let written = "";

		const tick = () => {
			frameId = 0;
			const rect = node.getBoundingClientRect();
			const travel = window.innerHeight + rect.height;
			const target = Math.min(
				1,
				Math.max(0, (window.innerHeight - rect.top) / travel),
			);
			// The first frame takes the target at once: a page that opens at this section does not glide in.
			const next =
				current === null
					? target
					: current + (target - current) * EASE_PER_FRAME;
			current = Math.abs(target - next) < SETTLE_DISTANCE ? target : next;
			const text = current.toFixed(4);
			if (text !== written) {
				written = text;
				node.style.setProperty("--yr-drift", text);
			}
			// A settled value needs no next frame. The next scroll or resize starts the loop again.
			if (current !== target) {
				frameId = requestAnimationFrame(tick);
			}
		};

		const start = () => {
			if (isOnScreen && frameId === 0) {
				frameId = requestAnimationFrame(tick);
			}
		};

		const observer = new IntersectionObserver((entries) => {
			// One target: the last entry of the batch is its latest state.
			isOnScreen = entries.at(-1)?.isIntersecting === true;
			if (isOnScreen) {
				start();
			} else {
				cancelAnimationFrame(frameId);
				frameId = 0;
			}
		});
		observer.observe(node);
		window.addEventListener("scroll", start, { passive: true });
		window.addEventListener("resize", start, { passive: true });
		return () => {
			observer.disconnect();
			window.removeEventListener("scroll", start);
			window.removeEventListener("resize", start);
			cancelAnimationFrame(frameId);
		};
	}, [node]);

	return setNode;
}
