// The scroll scrub of the ritual showpiece. RitualSection calls this hook with its <section>.
// It reads the scroll position in an animation frame, asks ritualFrameAt for the frame, and writes CSS variables.
// landing.css reads the variables. Without the script, with reduced motion, or below 1024 px, the CSS shows the still frame.
// Below 1024 px the stage and the rail stack, so the section progress does not match the step that is on screen.
import { type RefObject, useEffect } from "react";
import { type RitualFrame, ritualFrameAt } from "../lib/ritual-timeline";

/** Share of the remaining distance that the shown progress covers in one frame. It gives the scrub a soft lag. */
const FOLLOW_RATE = 0.16;

/**
 * The scrub runs while the section travels: from its top at 85% of the screen to its foot at 45%.
 * Stage 02 then holds while the whole section is on screen, and stage 03 arrives as it leaves.
 * No pin: a pinned stage leaves two screens of empty ground in the page, and crops a tall section on a phone.
 */
const TRAVEL_START = 0.85;
const TRAVEL_END = 0.45;

/** Clamps a value into 0 to 1. */
function unit(value: number): number {
	return Math.min(1, Math.max(0, value));
}

/** Writes one frame into the CSS variables that landing.css reads on the section. */
function writeFrame(section: HTMLElement, frame: RitualFrame) {
	section.style.setProperty("--ritual-line", frame.line.toFixed(4));
	section.style.setProperty("--ritual-steam", frame.steam.toFixed(4));
	section.style.setProperty("--ritual-steam-room", frame.steamRoom.toFixed(4));
	section.style.setProperty("--ritual-cold-pool", frame.coldPool.toFixed(4));
	frame.stages.forEach((value, index) => {
		section.style.setProperty(`--ritual-stage-${index + 1}`, value.toFixed(4));
	});
}

/**
 * Starts the scrub on `sectionRef` at 1024 px and wider, where the stage sits beside the rail.
 * It stops and goes back to the still frame when reduced motion turns on or the screen gets narrower.
 */
export function useRitualScrub(sectionRef: RefObject<HTMLElement | null>) {
	// effect: the scroll position and matchMedia are browser values. One animation frame writes them into CSS variables.
	useEffect(() => {
		const section = sectionRef.current;
		if (section === null) {
			return;
		}
		const still = window.matchMedia("(prefers-reduced-motion: reduce)");
		// The lg breakpoint of RitualSection: below it, the stage and the rail stack.
		const wide = window.matchMedia("(min-width: 1024px)");
		const shouldRun = () => wide.matches && !still.matches;
		let running = false;
		let frame = 0;
		let shown = 0;

		// The target progress of the scroll position, 0 to 1.
		const target = () => {
			const rect = section.getBoundingClientRect();
			const screen = window.innerHeight;
			const distance = (TRAVEL_START - TRAVEL_END) * screen + rect.height;
			return unit((TRAVEL_START * screen - rect.top) / distance);
		};

		// The shown value follows the target a little each frame, and stops when it is close.
		const step = () => {
			const goal = target();
			shown += (goal - shown) * FOLLOW_RATE;
			if (Math.abs(goal - shown) < 0.0005) {
				shown = goal;
			}
			writeFrame(section, ritualFrameAt(shown));
			frame = shown === goal ? 0 : window.requestAnimationFrame(step);
		};

		const schedule = () => {
			if (frame === 0) {
				frame = window.requestAnimationFrame(step);
			}
		};

		const start = () => {
			running = true;
			shown = target();
			writeFrame(section, ritualFrameAt(shown));
			window.addEventListener("scroll", schedule, { passive: true });
			window.addEventListener("resize", schedule);
		};

		const stop = () => {
			running = false;
			window.removeEventListener("scroll", schedule);
			window.removeEventListener("resize", schedule);
			window.cancelAnimationFrame(frame);
			frame = 0;
			section.removeAttribute("style");
		};

		// A visitor who turns on reduced motion, or a screen that gets narrow, gets the still frame at once.
		const onQueryChange = () => {
			if (shouldRun() && !running) {
				start();
			} else if (!shouldRun() && running) {
				stop();
			}
		};

		onQueryChange();
		still.addEventListener("change", onQueryChange);
		wide.addEventListener("change", onQueryChange);
		return () => {
			still.removeEventListener("change", onQueryChange);
			wide.removeEventListener("change", onQueryChange);
			stop();
		};
	}, [sectionRef]);
}
