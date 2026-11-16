// Scroll progress of the sticky exploded burger. ExplodedSection calls this hook with its section element.
// It finds each [data-scrub-track] with a sticky first child, and writes --sc-progress (0 to 1) on the section.
// landing.css reads the variable. With no script the variable keeps its CSS value, 1: the open stack.
import { type RefObject, useEffect } from "react";

const PROGRESS_VARIABLE = "--sc-progress";
/** Share of the remaining distance that one frame covers. It smooths the steps of a mouse wheel. */
const EASE_PER_FRAME = 0.2;
/** Share of the track (8%) where the burger stays closed after the field sticks. Then the opening starts. */
const CLOSED_SHARE = 0.08;

/** One scroll track and the facts that a frame needs from it. */
type Track = {
	element: HTMLElement;
	/** The `top` of the sticky child, in px from the viewport top. */
	stickyTop: number;
	/** How far the page scrolls while the child sticks, in px. */
	travel: number;
};

/**
 * Reads the track of `scene` whose first child sticks now, or null. A media query turns the sticking on and off.
 * At each width at most one track sticks: the whole field from 901px, the stack below.
 */
function activeTrackOf(scene: HTMLElement): Track | null {
	for (const element of scene.querySelectorAll<HTMLElement>(
		"[data-scrub-track]",
	)) {
		const pin = element.firstElementChild;
		if (!(pin instanceof HTMLElement)) {
			continue;
		}
		const pinStyle = window.getComputedStyle(pin);
		const travel = element.offsetHeight - pin.offsetHeight;
		if (pinStyle.position === "sticky" && travel > 1) {
			return {
				element,
				stickyTop: Number.parseFloat(pinStyle.top) || 0,
				travel,
			};
		}
	}
	return null;
}

/**
 * Keeps --sc-progress of `sceneRef` equal to the scroll through its sticky track: 0 at the start, 1 at the end.
 * A track that is more than one screen below the viewport keeps 1, the rest state.
 */
export function useStickyProgress(sceneRef: RefObject<HTMLElement | null>) {
	// effect: scroll, resize, and requestAnimationFrame are browser APIs. They are the only source of the progress.
	useEffect(() => {
		const scene = sceneRef.current;
		const prefersStill = window.matchMedia(
			"(prefers-reduced-motion: reduce)",
		).matches;
		if (scene === null || prefersStill) {
			return;
		}
		let track = activeTrackOf(scene);
		let shown = 1;
		let wasFar = true;
		let frame = 0;

		const paint = () => {
			frame = 0;
			if (track === null) {
				scene.style.removeProperty(PROGRESS_VARIABLE);
				return;
			}
			const scrolled =
				track.stickyTop - track.element.getBoundingClientRect().top;
			const isFar = scrolled < -window.innerHeight;
			// The burger stays closed briefly after it sticks, so no hairline gaps show.
			const goal = isFar
				? 1
				: Math.min(
						1,
						Math.max(
							0,
							(scrolled / track.travel - CLOSED_SHARE) / (1 - CLOSED_SHARE),
						),
					);
			// The change between the rest state and the closed burger happens off screen, so it has no motion.
			const isStep = isFar || wasFar || Math.abs(goal - shown) < 0.002;
			shown = isStep ? goal : shown + (goal - shown) * EASE_PER_FRAME;
			wasFar = isFar;
			scene.style.setProperty(PROGRESS_VARIABLE, shown.toFixed(4));
			if (shown !== goal) {
				frame = window.requestAnimationFrame(paint);
			}
		};
		const schedule = () => {
			if (frame === 0) {
				frame = window.requestAnimationFrame(paint);
			}
		};
		const measure = () => {
			track = activeTrackOf(scene);
			schedule();
		};

		window.addEventListener("scroll", schedule, { passive: true });
		window.addEventListener("resize", measure);
		schedule();
		return () => {
			window.removeEventListener("scroll", schedule);
			window.removeEventListener("resize", measure);
			window.cancelAnimationFrame(frame);
			scene.style.removeProperty(PROGRESS_VARIABLE);
		};
	}, [sceneRef]);
}
