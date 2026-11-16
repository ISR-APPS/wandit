// The scroll showpiece of the hero: the photo orbit turns one position while the hero scrolls away.
// HeroSection calls this hook with its <section>. It runs only on a screen of 1024px or wider, with motion allowed.
// It writes three CSS variables on the section. landing.css reads them to place the photos, the badges, and the capsule.
import { type RefObject, useEffect } from "react";

/** The screens that get the showpiece. Below 1024px the orbit is a still cluster with drift only. */
const SHOWPIECE_QUERY =
	"(min-width: 64rem) and (prefers-reduced-motion: no-preference)";

/**
 * Share of the hero height that the visitor scrolls for the whole turn. At 55% the claim and the capsule
 * are still on screen, so the visitor sees the badges bloom and the capsule warm.
 */
const TURN_SHARE = 0.55;

/** Share of the remaining distance that the shown progress covers in one frame. It gives the scrub a soft lag. */
const FOLLOW_RATE = 0.12;

/** A sine ease in and out on 0 to 1, as the photos stop softly at their middle stop. */
function easeSine(value: number): number {
	return (1 - Math.cos(Math.PI * value)) / 2;
}

/** Clamps a value into 0 to 1. */
function clampToUnit(value: number): number {
	return Math.min(1, Math.max(0, value));
}

/**
 * Starts the orbit scrub on `sectionRef`. Before the script runs, the CSS shows the first frame,
 * so the hero looks the same before and after hydration.
 */
export function useOrbitScrub(sectionRef: RefObject<HTMLElement | null>) {
	// effect: matchMedia and the scroll position are browser values. One animation frame writes them into CSS variables.
	useEffect(() => {
		const section = sectionRef.current;
		if (section === null) {
			return;
		}
		const media = window.matchMedia(SHOWPIECE_QUERY);
		let frame = 0;
		let shown = 0;

		const write = (progress: number) => {
			section.style.setProperty("--lumia-orbit", progress.toFixed(4));
			section.style.setProperty(
				"--lumia-orbit-a",
				easeSine(clampToUnit(progress * 2)).toFixed(4),
			);
			section.style.setProperty(
				"--lumia-orbit-b",
				easeSine(clampToUnit(progress * 2 - 1)).toFixed(4),
			);
		};

		// The target is the share of the turn distance that the hero has scrolled up.
		// No pin: a pinned stage leaves an empty band of page under the hero.
		const target = () => {
			const distance = section.offsetHeight * TURN_SHARE;
			if (distance <= 0) {
				return 0;
			}
			return clampToUnit(-section.getBoundingClientRect().top / distance);
		};

		// The shown value follows the target a little each frame, and stops when it is close.
		const step = () => {
			const goal = target();
			shown += (goal - shown) * FOLLOW_RATE;
			if (Math.abs(goal - shown) < 0.001) {
				shown = goal;
			}
			write(shown);
			frame = shown === goal ? 0 : window.requestAnimationFrame(step);
		};

		const schedule = () => {
			if (frame === 0) {
				frame = window.requestAnimationFrame(step);
			}
		};

		const start = () => {
			shown = target();
			write(shown);
			window.addEventListener("scroll", schedule, { passive: true });
			window.addEventListener("resize", schedule);
		};

		const stop = () => {
			window.removeEventListener("scroll", schedule);
			window.removeEventListener("resize", schedule);
			window.cancelAnimationFrame(frame);
			frame = 0;
			write(0);
		};

		// A window that grows past 1024px starts the showpiece. One that shrinks below stops it.
		const onMediaChange = () => {
			if (media.matches) {
				start();
			} else {
				stop();
			}
		};

		if (media.matches) {
			start();
		}
		media.addEventListener("change", onMediaChange);
		return () => {
			media.removeEventListener("change", onMediaChange);
			stop();
		};
	}, [sectionRef]);
}
