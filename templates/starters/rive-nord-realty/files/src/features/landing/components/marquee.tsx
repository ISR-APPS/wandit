// An endless band that scrolls one line of items: the listing ticker of the hero and the slow word band.
// HeroSection and LandingPage render it. The loop and the pause on hover live in landing.css (.rn-marquee).
import type { ReactNode } from "react";
import { cn } from "~/shared/lib/utils";

type MarqueeProps = {
	/** One sequence of items. The band draws it two times, so the loop has no gap. */
	children: ReactNode;
	/** True runs the band at 80 s per loop instead of 34 s. */
	isSlow?: boolean;
	className?: string;
};

/** Decorative band, hidden from screen readers: the same facts are in the register below. */
export function Marquee({ children, isSlow = false, className }: MarqueeProps) {
	return (
		<div
			aria-hidden="true"
			className={cn("rn-marquee", isSlow && "rn-marquee-slow", className)}
		>
			<div className="rn-marquee-track">
				<div className="flex shrink-0 items-center whitespace-nowrap">
					{children}
				</div>
				<div className="flex shrink-0 items-center whitespace-nowrap">
					{children}
				</div>
			</div>
		</div>
	);
}
