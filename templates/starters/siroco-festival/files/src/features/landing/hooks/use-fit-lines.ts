// The fit script of the poster page. LandingPage calls this hook with its root element.
// It finds each .sf-fit line and corrects its --sf-fit share, so the caps fill 100% of the box width.
// The CSS value is measured for Anton, so a correction matters only when the theme has another display face.
import { type RefObject, useEffect } from "react";

/** Keeps a line a hair inside its box, so a rounding error never crops the last letter. */
const FIT_MARGIN = 0.998;
/** Sub-pixel rounding of the computed font size, in px. A smaller gap is not a height cap. */
const CAP_TOLERANCE_PX = 0.5;
/** Skip a write that changes the size by less than about 0.5 px at 1440 px. */
const MIN_FIT_CHANGE = 0.0005;
/** Wait after the last resize before the lines refit, in ms. */
const RESIZE_DEBOUNCE_MS = 150;

/** Corrects the --sf-fit share of one line from its measured width. A line that its height cap limits keeps its share. */
function fitLine(line: HTMLElement) {
	const text = line.firstElementChild;
	const box = line.parentElement;
	if (!(text instanceof HTMLElement) || box === null) {
		return;
	}
	const share = Number.parseFloat(
		window.getComputedStyle(line).getPropertyValue("--sf-fit"),
	);
	const fontSize = Number.parseFloat(window.getComputedStyle(line).fontSize);
	const available = box.clientWidth;
	const width = text.getBoundingClientRect().width;
	// A hidden line (display: none at this width) measures 0. It refits when it shows.
	if (!(share > 0 && available > 0 && width > 0)) {
		return;
	}
	const isCapped = fontSize < share * available - CAP_TOLERANCE_PX;
	if (isCapped) {
		return;
	}
	const fitted = ((share * available) / width) * FIT_MARGIN;
	if (Math.abs(fitted - share) > MIN_FIT_CHANGE) {
		line.style.setProperty("--sf-fit", fitted.toFixed(4));
	}
}

/** Fits every .sf-fit line under `pageRef` after the fonts load, and again after a resize. */
export function useFitLines(pageRef: RefObject<HTMLElement | null>) {
	// effect: document.fonts and ResizeObserver are browser APIs. The text width exists only after layout.
	useEffect(() => {
		const page = pageRef.current;
		if (page === null) {
			return;
		}
		const lines = [...page.querySelectorAll<HTMLElement>(".sf-fit")];
		const fitAll = () => {
			for (const line of lines) {
				fitLine(line);
			}
		};
		let timer = 0;
		const observer = new ResizeObserver(() => {
			window.clearTimeout(timer);
			timer = window.setTimeout(fitAll, RESIZE_DEBOUNCE_MS);
		});
		for (const line of lines) {
			if (line.parentElement !== null) {
				observer.observe(line.parentElement);
			}
		}
		let isActive = true;
		document.fonts.ready.then(() => {
			if (isActive) {
				fitAll();
			}
		});
		return () => {
			isActive = false;
			window.clearTimeout(timer);
			observer.disconnect();
		};
	}, [pageRef]);
}
