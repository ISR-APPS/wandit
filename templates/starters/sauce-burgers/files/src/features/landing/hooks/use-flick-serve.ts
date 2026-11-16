// Entrances of the landing page. LandingPage calls this hook once with the page root.
// It marks each [data-flick] group below the first screen as "waiting", then as "served" when it scrolls into view.
// landing.css draws the two states. With no script, no state exists, and every group stays visible.
import { type RefObject, useEffect } from "react";

const FLICK_STATE = "data-flick-state";

/** Starts the entrances under `rootRef`. A group that is in view at page load never hides. */
export function useFlickServe(rootRef: RefObject<HTMLElement | null>) {
	// effect: IntersectionObserver is a browser API. It reports when a group enters the viewport.
	useEffect(() => {
		const root = rootRef.current;
		const prefersStill = window.matchMedia(
			"(prefers-reduced-motion: reduce)",
		).matches;
		if (root === null || prefersStill) {
			return;
		}
		// No root margin: a group starts when its first pixel is on screen, so no group can stay hidden.
		const observer = new IntersectionObserver((entries) => {
			for (const entry of entries) {
				if (entry.isIntersecting) {
					entry.target.setAttribute(FLICK_STATE, "served");
					observer.unobserve(entry.target);
				}
			}
		});
		for (const group of root.querySelectorAll("[data-flick]")) {
			// React drew the group visible. Only a group below the first screen can hide without a flash.
			if (group.getBoundingClientRect().top > window.innerHeight) {
				group.setAttribute(FLICK_STATE, "waiting");
				observer.observe(group);
			}
		}
		return () => observer.disconnect();
	}, [rootRef]);
}
