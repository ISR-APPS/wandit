// Makes the pupils of Chompy follow the mouse. ChompyStage calls it with its SVG element.
// It writes --gd-look-x and --gd-look-y (in SVG units, at most 5.5) on the SVG; the pupils read them in a translate.
// Only a fine pointer (a mouse) and allowed motion turn it on. On a touch screen the eyes stay centered.
import { type RefObject, useEffect } from "react";

/** The largest move of a pupil from the center of its eye, in SVG units of the 240-wide drawing. */
const MAX_LOOK = 5.5;

/** Follows the pointer with the eyes of the drawing in `svgRef`. */
export function usePupilFollow(svgRef: RefObject<SVGSVGElement | null>) {
	// effect: the pointer position is a browser event outside React. The eyes follow it each frame.
	useEffect(() => {
		const svg = svgRef.current;
		const canFollow = window.matchMedia(
			"(pointer: fine) and (prefers-reduced-motion: no-preference)",
		).matches;
		if (svg === null || !canFollow) {
			return;
		}
		let frame = 0;
		let pointerX = 0;
		let pointerY = 0;
		const look = () => {
			frame = 0;
			const rect = svg.getBoundingClientRect();
			// The eyes sit at 40% of the drawing height.
			const deltaX = pointerX - (rect.left + rect.width / 2);
			const deltaY = pointerY - (rect.top + rect.height * 0.4);
			const distance = Math.hypot(deltaX, deltaY) || 1;
			// Near the face the pupils move less, so they do not cross the eye.
			const reach = Math.min(distance / 40, 1) * MAX_LOOK;
			svg.style.setProperty(
				"--gd-look-x",
				`${((deltaX / distance) * reach).toFixed(2)}px`,
			);
			svg.style.setProperty(
				"--gd-look-y",
				`${((deltaY / distance) * reach).toFixed(2)}px`,
			);
		};
		const onMove = (event: PointerEvent) => {
			pointerX = event.clientX;
			pointerY = event.clientY;
			if (frame === 0) {
				frame = requestAnimationFrame(look);
			}
		};
		window.addEventListener("pointermove", onMove, { passive: true });
		return () => {
			cancelAnimationFrame(frame);
			window.removeEventListener("pointermove", onMove);
		};
	}, [svgRef]);
}
