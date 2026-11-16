// The scroll progress of the admission rail. AdmissionSection calls it with its section element.
// It writes --cn-rail (0 to 1) on the section and adds .is-on to each [data-at] step that the fill reached.
// landing.css reads both, but only under .cn-live. Without script the rail is full.
import { type RefObject, useEffect } from "react";

/**
 * Fills the rail while the section crosses the screen. The progress only grows,
 * so a visitor who scrolls back up keeps the steps that the rail reached.
 */
export function useRailProgress(sectionRef: RefObject<HTMLElement | null>) {
	// effect: the progress follows the scroll position, a browser value. One rAF per frame at most.
	useEffect(() => {
		const section = sectionRef.current;
		if (
			section === null ||
			window.matchMedia("(prefers-reduced-motion: reduce)").matches
		) {
			return;
		}
		const steps = [...section.querySelectorAll<HTMLElement>("[data-at]")];
		let reached = 0;
		let frame = 0;
		const update = () => {
			frame = 0;
			const box = section.getBoundingClientRect();
			// 0 when the section top is at 85% of the screen, 1 when its bottom reaches 80%.
			const start = window.innerHeight * 0.85;
			const span = Math.max(1, box.height - window.innerHeight * 0.05);
			const progress = Math.min(1, Math.max(0, (start - box.top) / span));
			if (progress <= reached) {
				return;
			}
			reached = progress;
			section.style.setProperty("--cn-rail", reached.toFixed(3));
			for (const step of steps) {
				step.classList.toggle("is-on", reached >= Number(step.dataset.at));
			}
		};
		const schedule = () => {
			if (frame === 0) {
				frame = requestAnimationFrame(update);
			}
		};
		update();
		window.addEventListener("scroll", schedule, { passive: true });
		window.addEventListener("resize", schedule);
		return () => {
			window.removeEventListener("scroll", schedule);
			window.removeEventListener("resize", schedule);
			cancelAnimationFrame(frame);
		};
	}, [sectionRef]);
}
