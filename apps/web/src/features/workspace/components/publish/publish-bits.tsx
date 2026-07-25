// Shared pieces of the publish surfaces. The mock publish panel this file
// once served was deleted; only the pieces live surfaces use remain.

import { cn } from "@wandit/ui/lib/utils";
import type * as React from "react";

/** 30px circular hairline icon button (dialog header close, URL row actions). */
export const roundIconClass =
	"grid size-[30px] shrink-0 place-items-center rounded-full border border-border bg-background text-foreground outline-none transition-colors hover:bg-secondary focus-visible:ring-2 focus-visible:ring-ring/50";

export function RoundIconButton({
	className,
	...props
}: React.ComponentProps<"button">) {
	return (
		<button
			type="button"
			className={cn(roundIconClass, className)}
			{...props}
		/>
	);
}
