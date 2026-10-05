// shadcn-style progress bar on the Radix progress primitive (port of shadcn/ui, MIT).
// KPI meters and the rows of a breakdown card show a share of a target with it.
// The bar sets a width, not a translateX, so it fills from the start side in Arabic too.

import { Progress as ProgressPrimitive } from "radix-ui";
import type * as React from "react";
import { cn } from "~/shared/lib/utils";

/**
 * A filled bar that shows `value` of `max` (default 100), for example units made of a daily target.
 * A value below 0 shows empty, a value above `max` shows full.
 * A `max` of 0 or less, a NaN or infinite value, or no value shows an empty bar with no aria-valuenow.
 */
function Progress({
	className,
	value,
	max = 100,
	...props
}: React.ComponentProps<typeof ProgressPrimitive.Root>) {
	// Radix logs an error and drops a max of 0 or less, or a value outside 0 to max.
	// A KPI can pass its target or have a target of 0. The clamp keeps the bar and aria-valuenow equal.
	const hasTarget = max > 0;
	const shownValue =
		hasTarget && value != null && Number.isFinite(value)
			? Math.min(Math.max(value, 0), max)
			: null;
	return (
		<ProgressPrimitive.Root
			data-slot="progress"
			className={cn(
				"relative h-2 w-full overflow-hidden rounded-full bg-primary/20",
				className,
			)}
			value={shownValue}
			max={hasTarget ? max : undefined}
			{...props}
		>
			<ProgressPrimitive.Indicator
				data-slot="progress-indicator"
				className="h-full bg-primary transition-all"
				style={{
					width: `${shownValue === null ? 0 : (shownValue / max) * 100}%`,
				}}
			/>
		</ProgressPrimitive.Root>
	);
}

export { Progress };
