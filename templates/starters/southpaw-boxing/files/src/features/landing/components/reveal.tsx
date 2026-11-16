// Wrapper that slams its content in when it enters the viewport.
// The section components wrap cards, texts, and rows in it.
// It reads the phase from use-in-view.ts; landing.css draws each phase.
import type { ReactNode } from "react";
import { useInView } from "../hooks/use-in-view";

type RevealProps = {
	/** The HTML tag of the wrapper. A card list uses "article" or "li". */
	as?: "div" | "article" | "li" | "p";
	/** Wait before the entrance, in milliseconds. Cards of one row use steps of 90. */
	delayMs?: number;
	className?: string;
	children: ReactNode;
};

/** Shows its children at once in the server HTML. In the browser, content below the fold enters once. */
export function Reveal({
	as: Tag = "div",
	delayMs = 0,
	className,
	children,
}: RevealProps) {
	const { ref, phase } = useInView();
	return (
		<Tag
			ref={ref}
			data-reveal={phase}
			className={className}
			style={delayMs > 0 ? { animationDelay: `${delayMs}ms` } : undefined}
		>
			{children}
		</Tag>
	);
}
