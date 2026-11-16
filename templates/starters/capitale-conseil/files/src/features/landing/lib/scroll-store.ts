// The window scroll as an external store. The scroll hooks of this feature pass `subscribeToScroll` to useSyncExternalStore.
// Each hook reads its own value from the page in its snapshot function. No hook needs an effect.

/** Calls `onChange` on each scroll and each resize of the window. Returns the function that stops the calls. */
export function subscribeToScroll(onChange: () => void): () => void {
	window.addEventListener("scroll", onChange, { passive: true });
	window.addEventListener("resize", onChange);
	return () => {
		window.removeEventListener("scroll", onChange);
		window.removeEventListener("resize", onChange);
	};
}

/** True when the visitor asks the system for less motion. Call it in the browser only. */
export function prefersReducedMotion(): boolean {
	return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** Keeps `value` between 0 and 1. */
export function clampShare(value: number): number {
	return Math.min(1, Math.max(0, value));
}
