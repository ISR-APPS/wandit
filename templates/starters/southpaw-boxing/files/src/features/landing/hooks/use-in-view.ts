// Reveal state of one element of the landing page.
// reveal.tsx, round-stamp.tsx, bout-row.tsx, round-strip.tsx, and stat-figure.tsx call it; landing.css reads the phase as data-reveal.
// It watches the element with an IntersectionObserver.
import { useEffect, useState } from "react";

/**
 * "static": the server HTML, or reduced motion; the element shows with no entrance.
 * "waiting": the element is below the fold, and landing.css hides it.
 * "entered": the element came into view, and its entrance animation runs once.
 */
export type RevealPhase = "static" | "waiting" | "entered";

/** The viewport share that counts as "on screen at load". Such an element never hides. */
const ON_SCREEN_SHARE = 0.92;

/**
 * Returns a callback ref for the element and its reveal phase.
 * The phase stays "static" when the visitor asks for reduced motion.
 */
export function useInView(): {
	ref: (node: HTMLElement | null) => void;
	phase: RevealPhase;
} {
	const [node, setNode] = useState<HTMLElement | null>(null);
	const [phase, setPhase] = useState<RevealPhase>("static");

	// effect: IntersectionObserver reports when the element enters the viewport
	useEffect(() => {
		if (
			node === null ||
			window.matchMedia("(prefers-reduced-motion: reduce)").matches
		) {
			return;
		}
		// An element that is on screen at load stays as the server drew it, so nothing flashes.
		if (
			node.getBoundingClientRect().top <
			window.innerHeight * ON_SCREEN_SHARE
		) {
			return;
		}
		setPhase("waiting");
		const observer = new IntersectionObserver(
			(entries) => {
				if (entries.some((entry) => entry.isIntersecting)) {
					setPhase("entered");
					observer.disconnect();
				}
			},
			// The entrance starts when the element is 8% of the viewport above the bottom edge.
			// The top margin extends the root far above the viewport: an element that a fast scroll
			// or a jump to an anchor already passed also counts, so it never stays hidden.
			{ rootMargin: "100000px 0px -8% 0px" },
		);
		observer.observe(node);
		return () => observer.disconnect();
	}, [node]);

	return { ref: setNode, phase };
}
