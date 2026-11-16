// Scroll progress of the villa plan. PlanRail calls it with the stage of PlanSection.
// From 1024px it writes --plot on the stage in a requestAnimationFrame loop, and returns the progress in percent.
// The plan draws while its top moves from 92% to 12% of the screen height, so it is complete when it is in full view.
// The plotter never erases: the progress only grows, so a visitor who scrolls back sees the finished plan.
// On a phone, with less motion, or with no script, it returns 100 and the stage plots once (see use-scroll-reveal.ts).
import { type RefObject, useEffect, useState } from "react";
import { isScrubPlanScreen } from "../lib/motion";

// The two positions of the stage top, as parts of the screen height: the draw starts at the first and ends at the second.
const DRAW_START = 0.92;
const DRAW_END = 0.12;

/** Returns the plot progress of the plan, from 0 to 100. Before hydration it is 100: the plan shows complete. */
export function usePlanProgress(stageRef: RefObject<HTMLElement | null>) {
	const [percent, setPercent] = useState(100);

	// effect: the scroll position and requestAnimationFrame are browser APIs. They drive the drawing of the plan.
	useEffect(() => {
		const stage = stageRef.current;
		if (stage === null || !isScrubPlanScreen()) {
			return;
		}
		let highest = 0;
		let frame = 0;
		const measure = () => {
			frame = 0;
			const top = stage.getBoundingClientRect().top;
			const start = window.innerHeight * DRAW_START;
			const end = window.innerHeight * DRAW_END;
			const progress = Math.min(Math.max((start - top) / (start - end), 0), 1);
			highest = Math.max(highest, progress);
			stage.style.setProperty("--plot", highest.toFixed(4));
			setPercent(Math.round(highest * 100));
		};
		const schedule = () => {
			if (frame === 0) {
				frame = window.requestAnimationFrame(measure);
			}
		};
		stage.setAttribute("data-plan-mode", "scrub");
		measure();
		window.addEventListener("scroll", schedule, { passive: true });
		window.addEventListener("resize", schedule);
		return () => {
			window.removeEventListener("scroll", schedule);
			window.removeEventListener("resize", schedule);
			window.cancelAnimationFrame(frame);
			stage.removeAttribute("data-plan-mode");
			stage.style.removeProperty("--plot");
		};
	}, [stageRef]);

	return percent;
}
