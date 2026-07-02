"use client";

import { cn } from "@my-better-t-app/ui/lib/utils";
import { Progress as ProgressPrimitive } from "radix-ui";
import type * as React from "react";

function Progress({
	className,
	indicatorColor,
	value,
	...props
}: React.ComponentProps<typeof ProgressPrimitive.Root> & {
	indicatorColor?: string;
}) {
	return (
		<ProgressPrimitive.Root
			data-slot="progress"
			className={cn(
				"relative h-2 w-full overflow-hidden rounded-full bg-primary/20",
				className,
			)}
			{...props}
		>
			<ProgressPrimitive.Indicator
				data-slot="progress-indicator"
				className={cn(
					"h-full w-full flex-1 bg-primary transition-all",
					indicatorColor,
				)}
				style={{ transform: `translateX(-${100 - (value || 0)}%)` }}
			/>
		</ProgressPrimitive.Root>
	);
}

export { Progress };
