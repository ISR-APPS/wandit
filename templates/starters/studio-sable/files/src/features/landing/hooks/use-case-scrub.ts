// Scroll progress of the case study. CaseSection calls this hook with its stage element.
// It writes the CSS variable --sable-case on the stage: 0 is the closed row, 1 is the open band.
// landing.css reads the variable from 1200px. With no script the variable is absent and the band is open.
import { type RefObject, useEffect } from "react";

// The row starts to open when its top is at 80% of the screen height. It is open at 25%.
const START_SHARE = 0.8;
const END_SHARE = 0.25;
// Each frame closes 16% of the gap to the scroll position, so the opening lags a little behind the wheel.
const LAG = 0.16;
const WIDE_MOTION_QUERY =
	"(min-width: 1200px) and (prefers-reduced-motion: no-preference)";

/** Links the opening of the stage to the scroll. The row stays open after its first full opening. */
export function useCaseScrub(stageRef: RefObject<HTMLElement | null>) {
	// effect: scroll, resize, matchMedia, and requestAnimationFrame are browser APIs. They drive --sable-case.
	useEffect(() => {
		const stage = stageRef.current;
		if (stage === null) {
			return;
		}
		const media = window.matchMedia(WIDE_MOTION_QUERY);
		let frame = 0;
		// `reached` is the farthest progress of the scroll. `shown` follows it with the lag.
		let reached = 0;
		let shown = 0;

		const measure = () => {
			const viewportHeight = window.innerHeight;
			const travelled =
				viewportHeight * START_SHARE - stage.getBoundingClientRect().top;
			const distance = viewportHeight * (START_SHARE - END_SHARE);
			return Math.min(Math.max(travelled / distance, 0), 1);
		};
		const draw = () => {
			frame = 0;
			if (!media.matches) {
				// A narrow screen or reduced motion: the CSS shows the open band.
				stage.style.removeProperty("--sable-case");
				return;
			}
			reached = Math.max(reached, measure());
			shown += (reached - shown) * LAG;
			// 0.002 is below one pixel of the band. The loop stops there.
			if (reached - shown < 0.002) {
				shown = reached;
			}
			// Four decimals: one step is below one pixel of the band.
			stage.style.setProperty("--sable-case", shown.toFixed(4));
			if (shown !== reached) {
				frame = window.requestAnimationFrame(draw);
			}
		};
		const schedule = () => {
			if (frame === 0) {
				frame = window.requestAnimationFrame(draw);
			}
		};

		// The first value has no lag: a page that loads below the case study shows the open band at once.
		reached = media.matches ? measure() : 0;
		shown = reached;
		draw();
		window.addEventListener("scroll", schedule, { passive: true });
		window.addEventListener("resize", schedule);
		media.addEventListener("change", schedule);
		return () => {
			window.cancelAnimationFrame(frame);
			window.removeEventListener("scroll", schedule);
			window.removeEventListener("resize", schedule);
			media.removeEventListener("change", schedule);
			stage.style.removeProperty("--sable-case");
		};
	}, [stageRef]);
}
