// The one scrubbed effect of the page: the parallax of the photo band.
// BreathSection calls it with its section. It writes --lume-progress on the section, read by landing.css.
// It does not run with prefers-reduced-motion: then the variable stays unset and the photo stays still.
import { type RefObject, useEffect } from "react";

/** Writes --lume-progress on `sectionRef`: -1 when the band enters at the bottom, 1 when it leaves at the top. */
export function useScrollProgress(sectionRef: RefObject<HTMLElement | null>) {
	// effect: scroll and requestAnimationFrame are browser APIs. The effect writes one style variable per frame.
	useEffect(() => {
		const section = sectionRef.current;
		const prefersStill = window.matchMedia(
			"(prefers-reduced-motion: reduce)",
		).matches;
		if (section === null || prefersStill) {
			return;
		}
		let frame = 0;
		const write = () => {
			frame = 0;
			const box = section.getBoundingClientRect();
			// The band travels from the bottom edge (top = innerHeight) to above the top edge (bottom = 0).
			const travel = window.innerHeight + box.height;
			const passed = window.innerHeight - box.top;
			const progress = Math.min(1, Math.max(0, passed / travel)) * 2 - 1;
			section.style.setProperty("--lume-progress", progress.toFixed(3));
		};
		// One write per frame at most, however many scroll events the browser sends.
		const schedule = () => {
			if (frame === 0) {
				frame = requestAnimationFrame(write);
			}
		};
		write();
		window.addEventListener("scroll", schedule, { passive: true });
		window.addEventListener("resize", schedule);
		return () => {
			cancelAnimationFrame(frame);
			window.removeEventListener("scroll", schedule);
			window.removeEventListener("resize", schedule);
		};
	}, [sectionRef]);
}
