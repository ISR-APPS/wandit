// The showpiece motion: the smoke line rises beside the menu while the page scrolls, and lights each slate.
// MenuSection calls this hook with its section element. It reads [data-smoke-path], [data-smoke-tip], and [data-slate].
// It draws the path, moves the tip, and writes --br-lit (0 to 1) on each slate. With no script all slates stay lit.
import { type RefObject, useEffect } from "react";

// The scrub runs from "section top at 55% of the screen" to "section bottom at 82% of the screen".
// A later start leaves the first screen of the section as dim text.
const START_AT = 0.55;
const END_AT = 0.82;
// The timeline of the source page, in its own units: slate i lights at 0.32 + i * 0.74, over 0.9, out of 5.
const TIMELINE = 5;
const SLATE_START = 0.32;
const SLATE_STEP = 0.74;
const SLATE_LIGHT = 0.9;
/** Share of the remaining distance that one frame covers. It smooths the steps of a mouse wheel. */
const EASE_PER_FRAME = 0.12;
// Under this progress the tip is still inside the ember base, so it stays hidden.
const TIP_MIN_PROGRESS = 0.012;

function clampUnit(value: number) {
	return Math.min(1, Math.max(0, value));
}

/**
 * Scrubs the smoke of `sectionRef` with the scroll. The progress only grows: a lit slate stays lit
 * when the visitor scrolls back up, so the menu never turns dim again.
 */
export function useSmokeScrub(sectionRef: RefObject<HTMLElement | null>) {
	// effect: scroll, resize, and requestAnimationFrame are browser APIs. They are the only source of the progress.
	useEffect(() => {
		const section = sectionRef.current;
		const prefersStill = window.matchMedia(
			"(prefers-reduced-motion: reduce)",
		).matches;
		if (section === null || prefersStill) {
			return;
		}
		const path = section.querySelector<SVGPathElement>("[data-smoke-path]");
		const tips = [
			...section.querySelectorAll<SVGCircleElement>("[data-smoke-tip]"),
		];
		const slates = [...section.querySelectorAll<HTMLElement>("[data-slate]")];
		if (path === null) {
			return;
		}
		const length = path.getTotalLength();
		path.style.strokeDasharray = `${length}`;

		const readProgress = () => {
			const rect = section.getBoundingClientRect();
			const screen = window.innerHeight;
			const travel = rect.height - (END_AT - START_AT) * screen;
			return clampUnit((START_AT * screen - rect.top) / Math.max(1, travel));
		};

		// The first frame jumps to the scroll position, so a reload in the middle of the menu shows no flash.
		let goal = readProgress();
		let shown = goal;
		let frame = 0;

		const draw = () => {
			path.style.strokeDashoffset = `${length * (1 - shown)}`;
			const point = path.getPointAtLength(Math.max(0.5, length * shown));
			const isTipVisible = shown > TIP_MIN_PROGRESS;
			for (const tip of tips) {
				tip.setAttribute("cx", point.x.toFixed(2));
				tip.setAttribute("cy", point.y.toFixed(2));
				tip.style.visibility = isTipVisible ? "visible" : "hidden";
			}
			slates.forEach((slate, index) => {
				const start = (SLATE_START + index * SLATE_STEP) / TIMELINE;
				const lit = clampUnit((shown - start) / (SLATE_LIGHT / TIMELINE));
				slate.style.setProperty("--br-lit", lit.toFixed(3));
			});
		};

		const paint = () => {
			frame = 0;
			goal = Math.max(goal, readProgress());
			shown += (goal - shown) * EASE_PER_FRAME;
			if (goal - shown < 0.001) {
				shown = goal;
			}
			draw();
			if (shown !== goal) {
				frame = window.requestAnimationFrame(paint);
			}
		};
		const schedule = () => {
			if (frame === 0) {
				frame = window.requestAnimationFrame(paint);
			}
		};

		draw();
		window.addEventListener("scroll", schedule, { passive: true });
		window.addEventListener("resize", schedule);
		return () => {
			window.removeEventListener("scroll", schedule);
			window.removeEventListener("resize", schedule);
			window.cancelAnimationFrame(frame);
			// Back to the still state: the path fully drawn and every slate lit.
			path.style.removeProperty("stroke-dasharray");
			path.style.removeProperty("stroke-dashoffset");
			for (const slate of slates) {
				slate.style.removeProperty("--br-lit");
			}
		};
	}, [sectionRef]);
}
