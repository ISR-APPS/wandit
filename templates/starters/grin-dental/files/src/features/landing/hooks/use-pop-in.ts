// Scroll entrances of the home page. LandingPage calls this hook once with the page root.
// It marks each [data-pop] element below the first screen "waiting", then "shown" when it scrolls into view.
// landing.css draws the two states. With no script, no state exists, and every element stays visible.
import { type RefObject, useEffect } from "react";

const POP_STATE = "data-pop-state";

/** Starts the entrances under `rootRef`. An element that is in view at page load never hides. */
export function usePopIn(rootRef: RefObject<HTMLElement | null>) {
	// effect: IntersectionObserver is a browser API. It reports when an element enters the viewport.
	useEffect(() => {
		const root = rootRef.current;
		const prefersStill = window.matchMedia(
			"(prefers-reduced-motion: reduce)",
		).matches;
		if (root === null || prefersStill) {
			return;
		}
		// 12% of the element in view starts it, so the pop happens where the visitor looks.
		const observer = new IntersectionObserver(
			(entries) => {
				for (const entry of entries) {
					if (entry.isIntersecting) {
						entry.target.setAttribute(POP_STATE, "shown");
						observer.unobserve(entry.target);
					}
				}
			},
			{ threshold: 0.12 },
		);
		for (const element of root.querySelectorAll("[data-pop]")) {
			// React drew the element visible. Only an element below the first screen can hide without a flash.
			if (element.getBoundingClientRect().top > window.innerHeight) {
				element.setAttribute(POP_STATE, "waiting");
				observer.observe(element);
			}
		}
		return () => observer.disconnect();
	}, [rootRef]);
}
