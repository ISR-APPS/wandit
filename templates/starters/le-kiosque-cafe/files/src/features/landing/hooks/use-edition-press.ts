// The press of the showpiece. PressSection calls this hook once with its section.
// It sets data-press="on" on the section, then drives the CSS variable --ks-p from 0 to 1.
// From 768px the scroll drives it. When the stage fits on the screen, data-pin="on" makes the section
// two screens tall and holds the stage, as the source pins it. Under 768px it plays once, by time, on entry.
// kiosque.css maps --ks-p to each block. With no script, or with reduced motion, neither attribute exists.
import { type RefObject, useEffect } from "react";

// The time of the phone play, in ms: brisk, as a press roll, and done before the reader reaches the plate.
const PHONE_PLAY_MS = 1600;
// Without the pin, the press starts when the top of the sheet reaches 85% of the screen height
// and ends when it reaches 8%. Then the whole sheet is on screen when the proof stamp fades.
const START_AT = 0.85;
const END_AT = 0.08;
// The pin holds the stage at 6vh (kiosque.css), so the stage fits when it is at most 88% of the screen.
const PIN_MAX_SHARE = 0.88;
// With the pin, the press starts when the section top is at 50% of the screen height. It ends when the
// section bottom is at 125%, about a quarter screen before the pin lets go, so the printed page holds.
const PIN_START_AT = 0.5;
const PIN_END_AT = 1.25;

/** Starts the press of `sectionRef`. The progress only grows: a printed edition stays printed. */
export function useEditionPress(sectionRef: RefObject<HTMLElement | null>) {
	// effect: scroll position, IntersectionObserver, and requestAnimationFrame are browser APIs.
	useEffect(() => {
		const section = sectionRef.current;
		const prefersStill = window.matchMedia(
			"(prefers-reduced-motion: reduce)",
		).matches;
		const sheet = section?.querySelector(".ks-mini");
		const stage = section?.querySelector(".ks-press-stage");
		if (!section || !sheet || !stage || prefersStill) {
			return;
		}
		let progress = 0;
		let frame = 0;
		const setProgress = (next: number) => {
			// Only forward: a scroll back up never takes ink off the page.
			progress = Math.min(1, Math.max(progress, next));
			section.style.setProperty("--ks-p", progress.toFixed(4));
		};
		setProgress(0);
		section.setAttribute("data-press", "on");

		const isWide = window.matchMedia("(min-width: 768px)").matches;
		let observer: IntersectionObserver | undefined;
		// A stage taller than the screen is not pinned: its foot would stay hidden while the sheet prints.
		const updatePin = () => {
			const fits =
				stage.getBoundingClientRect().height <=
				PIN_MAX_SHARE * window.innerHeight;
			section.toggleAttribute("data-pin", fits);
		};
		const readScroll = () => {
			frame = 0;
			const height = window.innerHeight;
			if (section.hasAttribute("data-pin")) {
				const box = section.getBoundingClientRect();
				setProgress(
					(PIN_START_AT * height - box.top) /
						(box.height - (PIN_END_AT - PIN_START_AT) * height),
				);
				return;
			}
			const top = sheet.getBoundingClientRect().top;
			setProgress((START_AT * height - top) / ((START_AT - END_AT) * height));
		};
		const onScroll = () => {
			if (frame === 0) {
				frame = window.requestAnimationFrame(readScroll);
			}
		};
		const onResize = () => {
			updatePin();
			onScroll();
		};
		const play = (startedAt: number) => {
			const step = (now: number) => {
				setProgress((now - startedAt) / PHONE_PLAY_MS);
				frame = progress < 1 ? window.requestAnimationFrame(step) : 0;
			};
			frame = window.requestAnimationFrame(step);
		};

		if (isWide) {
			updatePin();
			readScroll();
			window.addEventListener("scroll", onScroll, { passive: true });
			window.addEventListener("resize", onResize);
		} else {
			observer = new IntersectionObserver(
				(entries) => {
					if (entries.some((entry) => entry.isIntersecting)) {
						observer?.disconnect();
						play(performance.now());
					}
				},
				// The play starts when 15% of the sheet is on screen: the masthead row and the headline.
				{ threshold: 0.15 },
			);
			observer.observe(sheet);
		}

		return () => {
			window.removeEventListener("scroll", onScroll);
			window.removeEventListener("resize", onResize);
			observer?.disconnect();
			window.cancelAnimationFrame(frame);
			// Nothing drives the sheet after this point, so it shows printed again, at its normal height.
			section.removeAttribute("data-press");
			section.removeAttribute("data-pin");
			section.style.removeProperty("--ks-p");
		};
	}, [sectionRef]);
}
