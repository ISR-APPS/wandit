// Scroll parallax of one full-bleed photo. HeroSection and ResidenceSection call it with their frame.
// One requestAnimationFrame per scroll writes --mer-parallax on the frame: 0 when the frame enters
// at the bottom of the view, 0.5 when it is centred, 1 when it leaves at the top. landing.css moves the photo.
import { type RefObject, useEffect } from "react";

/** Writes the scroll position of `frameRef` into --mer-parallax. Reduced motion keeps the CSS default of 0.5. */
export function useParallax(frameRef: RefObject<HTMLElement | null>) {
	// effect: the scroll position is a browser value. The listener syncs it into a CSS variable.
	useEffect(() => {
		const frame = frameRef.current;
		if (
			frame === null ||
			window.matchMedia("(prefers-reduced-motion: reduce)").matches
		) {
			return;
		}
		let frameRequest = 0;
		const update = () => {
			frameRequest = 0;
			const box = frame.getBoundingClientRect();
			const progress =
				(window.innerHeight - box.top) / (window.innerHeight + box.height);
			const clamped = Math.min(1, Math.max(0, progress));
			frame.style.setProperty("--mer-parallax", clamped.toFixed(4));
		};
		const schedule = () => {
			if (frameRequest === 0) {
				frameRequest = window.requestAnimationFrame(update);
			}
		};
		update();
		window.addEventListener("scroll", schedule, { passive: true });
		window.addEventListener("resize", schedule);
		return () => {
			window.removeEventListener("scroll", schedule);
			window.removeEventListener("resize", schedule);
			window.cancelAnimationFrame(frameRequest);
		};
	}, [frameRef]);
}
