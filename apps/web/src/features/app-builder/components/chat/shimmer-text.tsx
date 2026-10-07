/**
 * Faint text with a band of full ink that runs across it: the mark of the
 * activity row that works now. The band is darker in light mode and brighter
 * in dark mode. Rendered by thought-row, step-row, and working-row. With
 * reduced motion it is plain text at the feed ink (night at 70 %).
 */

import { cn } from "@wandit/ui/lib/utils";
import type { ReactNode } from "react";

/** Faint text with a moving band of full ink. With reduced motion the band stops and the text is plain. */
export function ShimmerText({
	children,
	className,
}: {
	children: ReactNode;
	className?: string;
}) {
	return (
		<span
			className={cn(
				// The gradient is 225% wide: one loop of the shared shimmer keyframe
				// moves it by two full tiles, so the band never jumps. The reverse
				// direction runs the band with the reading direction. The light
				// stops are night (#0b1033) at 45 % and 95 %, the ink of the feed rows.
				"animate-shimmer bg-[length:225%_100%] bg-[linear-gradient(90deg,rgb(11_16_51/0.45)_35%,rgb(11_16_51/0.95)_50%,rgb(11_16_51/0.45)_65%)] bg-clip-text text-transparent [animation-direction:reverse] motion-reduce:animate-none motion-reduce:bg-none motion-reduce:text-night/70 dark:bg-[linear-gradient(90deg,var(--muted-foreground)_35%,var(--foreground)_50%,var(--muted-foreground)_65%)] dark:motion-reduce:text-foreground/70 rtl:[animation-direction:normal]",
				className,
			)}
		>
			{children}
		</span>
	);
}
