// Draws the dotted path of the first visit while the section scrolls by, and walks a small tooth along it.
// VisitSection calls it with the stage, the dotted path, and the walker group. Active from 1024px with motion allowed.
// It writes --gd-visit (0 to 1) on the stage and a translate on the walker. landing.css reads --gd-visit.
import { type RefObject, useEffect } from "react";

/** The media query of the scrubbed path. Under it, the steps stack and the path is hidden. */
const PATH_MEDIA =
	"(min-width: 1024px) and (prefers-reduced-motion: no-preference)";

/** Links the drawn share of the path to the scroll position of the stage. Without it, the whole path shows. */
export function useVisitPath(
	stageRef: RefObject<HTMLElement | null>,
	pathRef: RefObject<SVGPathElement | null>,
	walkerRef: RefObject<SVGGElement | null>,
) {
	// effect: the scroll position and the media query are browser state. The path follows them each frame.
	useEffect(() => {
		const stage = stageRef.current;
		const path = pathRef.current;
		const walker = walkerRef.current;
		if (stage === null || path === null || walker === null) {
			return;
		}
		const media = window.matchMedia(PATH_MEDIA);
		const length = path.getTotalLength();
		let frame = 0;

		const draw = () => {
			frame = 0;
			if (!media.matches) {
				stage.style.removeProperty("--gd-visit");
				return;
			}
			const rect = stage.getBoundingClientRect();
			const viewport = window.innerHeight;
			// The draw starts when the stage top passes 78% of the screen
			// and ends when its bottom reaches the middle, as in the source scene.
			const start = viewport * 0.78;
			const end = viewport * 0.5 - rect.height;
			const progress = Math.min(
				1,
				Math.max(0, (start - rect.top) / (start - end)),
			);
			stage.style.setProperty("--gd-visit", progress.toFixed(4));
			const point = path.getPointAtLength(length * progress);
			walker.setAttribute("transform", `translate(${point.x} ${point.y})`);
		};
		const schedule = () => {
			if (frame === 0) {
				frame = requestAnimationFrame(draw);
			}
		};

		draw();
		window.addEventListener("scroll", schedule, { passive: true });
		window.addEventListener("resize", schedule);
		media.addEventListener("change", schedule);
		return () => {
			cancelAnimationFrame(frame);
			window.removeEventListener("scroll", schedule);
			window.removeEventListener("resize", schedule);
			media.removeEventListener("change", schedule);
		};
	}, [stageRef, pathRef, walkerRef]);
}
