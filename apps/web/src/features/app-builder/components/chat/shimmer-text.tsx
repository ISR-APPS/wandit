/**
 * Text with a light band that runs across it: the mark of the activity row
 * that works now ("Thinking", "Editing"). Rendered by thought-row.tsx and
 * step-row.tsx. With reduced motion it is plain muted text.
 */

import { cn } from "@wandit/ui/lib/utils";
import type { ReactNode } from "react";

/** Muted text with a moving light band; with reduced motion the band stops. */
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
				// direction runs the band with the reading direction.
				"animate-shimmer bg-[length:225%_100%] bg-[linear-gradient(90deg,var(--muted-foreground)_35%,var(--foreground)_50%,var(--muted-foreground)_65%)] bg-clip-text text-transparent [animation-direction:reverse] motion-reduce:animate-none motion-reduce:bg-none motion-reduce:text-muted-foreground rtl:[animation-direction:normal]",
				className,
			)}
		>
			{children}
		</span>
	);
}
