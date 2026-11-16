// Entrance state of one group of the home page.
// cut-group.tsx calls it; landing.css reads the phase as data-cut and shows the items of the group one frame apart.
// It watches the group with an IntersectionObserver.
import { useEffect, useState } from "react";

/**
 * "static": the server HTML, or reduced motion. The group shows with no entrance.
 * "waiting": the group is below the fold, and landing.css hides its items.
 * "entered": the group came into view, and its items cut in once.
 */
type CutPhase = "static" | "waiting" | "entered";

/** The share of the viewport height that counts as "on screen at load". Such a group never hides. */
const ON_SCREEN_SHARE = 0.92;

/**
 * Returns a callback ref for the group and its phase.
 * The phase stays "static" when the visitor asks for reduced motion.
 */
export function useCutPhase(): {
	ref: (node: HTMLElement | null) => void;
	phase: CutPhase;
} {
	const [node, setNode] = useState<HTMLElement | null>(null);
	const [phase, setPhase] = useState<CutPhase>("static");

	// effect: IntersectionObserver reports when the group enters the viewport
	useEffect(() => {
		if (
			node === null ||
			window.matchMedia("(prefers-reduced-motion: reduce)").matches
		) {
			return;
		}
		// A group that is on screen at load stays as the server drew it, so nothing flashes.
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
			// The cut starts when the group is 16% of the viewport above the bottom edge.
			// The top margin extends the root far above the viewport: a group that a jump
			// to an anchor already passed also counts, so it never stays hidden.
			{ rootMargin: "100000px 0px -16% 0px" },
		);
		observer.observe(node);
		return () => observer.disconnect();
	}, [node]);

	return { ref: setNode, phase };
}
