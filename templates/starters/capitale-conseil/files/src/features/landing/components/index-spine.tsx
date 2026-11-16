// The index spine: five numerals on a fixed rail at the start edge, from 1180px.
// LandingPage renders it. A track fills when its movement is reached, and the current numeral takes copper.
// Over the deep band the rail takes the pale band ink, else it is not visible there.
import { useRef } from "react";
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import { useIsOverDeepBand } from "../hooks/use-is-over-deep-band";
import { usePassedMovements } from "../hooks/use-passed-movements";
import { MOVEMENTS } from "../lib/content";

/** The color class of one numeral. Copper use 1 of 2 of the page: the numeral of the current movement. */
function numeralToneOf(
	isCurrent: boolean,
	isReached: boolean,
	isInverse: boolean,
): string {
	if (isCurrent) {
		return isInverse ? "text-(--cap-copper-lift)" : "text-warning";
	}
	if (isReached) {
		return isInverse ? "text-background" : "text-foreground";
	}
	// 60% is the SOFT level of the page: the lowest ink that keeps small text readable on the paper.
	return isInverse ? "text-(--cap-band-soft)" : "text-foreground/60";
}

/** The rail of the five movements. Each entry is a link to its section. */
export function IndexSpine() {
	const { t } = useT();
	const railRef = useRef<HTMLElement>(null);
	const passedCount = usePassedMovements();
	const isInverse = useIsOverDeepBand(railRef);
	// Before the first movement, the first numeral is the current one.
	const currentIndex = Math.max(passedCount, 1) - 1;
	return (
		<nav
			ref={railRef}
			aria-label={t("site.spineLabel")}
			className="fixed start-8 top-1/2 z-30 hidden -translate-y-1/2 flex-col gap-[1.05rem] min-[73.75rem]:flex"
		>
			{MOVEMENTS.map((movement, index) => {
				const isReached = index < passedCount;
				const isCurrent = index === currentIndex;
				return (
					<a
						key={movement.href}
						href={movement.href}
						aria-label={t(movement.label)}
						aria-current={isCurrent ? "step" : undefined}
						className="flex flex-col items-start gap-1.5"
					>
						<span
							className={cn(
								"font-semibold text-[0.6875rem] tabular-nums tracking-[0.1em] transition-colors duration-[250ms] ease-linear",
								numeralToneOf(isCurrent, isReached, isInverse),
							)}
						>
							{movement.numeral}
						</span>
						<span
							className={cn(
								"relative h-11 w-px transition-colors duration-[250ms] ease-linear",
								isInverse ? "bg-background/20" : "bg-foreground/18",
							)}
						>
							<span
								className={cn(
									"absolute inset-0 origin-top transition-[transform,background-color] duration-500 ease-out",
									isInverse ? "bg-(--cap-band-soft)" : "bg-primary",
									isReached ? "scale-y-100" : "scale-y-0",
								)}
							/>
						</span>
					</a>
				);
			})}
		</nav>
	);
}
