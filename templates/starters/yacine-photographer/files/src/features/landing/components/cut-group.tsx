// A group of elements that cut in, one frame apart, when the group scrolls into view.
// The section components wrap a head, a grid, or a foot in it, and mark each item with the class "yr-cut".
// It reads the phase from use-cut-phase.ts; landing.css draws each phase.
import type { ReactNode } from "react";
import { useCutPhase } from "../hooks/use-cut-phase";

type CutGroupProps = {
	/** The HTML tag of the group. A line of facts uses "p". */
	as?: "div" | "p";
	className?: string;
	/** The items carry the class "yr-cut". The class "[--cut:2]" sets the place of an item in the order. */
	children: ReactNode;
};

/** Shows its items at once in the server HTML. In the browser, a group below the fold enters once. */
export function CutGroup({
	as: Tag = "div",
	className,
	children,
}: CutGroupProps) {
	const { ref, phase } = useCutPhase();
	return (
		<Tag ref={ref} data-cut={phase} className={className}>
			{children}
		</Tag>
	);
}
