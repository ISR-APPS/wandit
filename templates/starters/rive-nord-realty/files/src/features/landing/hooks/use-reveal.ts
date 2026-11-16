// Entrance of a group below the first screen. The sections call it and put the ref on the group.
// It writes data-reveal on the element: "waiting" while the group is below the screen, then "shown".
// landing.css draws both states. With no script, or with reduced motion, no state is written and all stays visible.
import { useEffect, useRef } from "react";

/** Returns the ref of the group. The group is revealed one time and then stays shown. */
export function useReveal<T extends HTMLElement>() {
	const ref = useRef<T>(null);

	// effect: IntersectionObserver is a browser API. It reports when the group enters the screen.
	useEffect(() => {
		const element = ref.current;
		if (element === null) {
			return;
		}
		const reduced = window.matchMedia(
			"(prefers-reduced-motion: reduce)",
		).matches;
		// A group that is already on the screen at hydration stays as the server drew it, so nothing jumps.
		const isBelowScreen =
			element.getBoundingClientRect().top > window.innerHeight * 0.92;
		if (reduced || !isBelowScreen) {
			return;
		}
		element.dataset.reveal = "waiting";
		const observer = new IntersectionObserver(
			(entries) => {
				if (entries.some((entry) => entry.isIntersecting)) {
					element.dataset.reveal = "shown";
					observer.disconnect();
				}
			},
			// The group starts when its top passes 8% above the bottom edge of the screen.
			{ rootMargin: "0px 0px -8% 0px" },
		);
		observer.observe(element);
		return () => observer.disconnect();
	}, []);

	return ref;
}
