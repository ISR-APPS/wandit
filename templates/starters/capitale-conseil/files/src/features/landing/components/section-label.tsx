// The small-caps label on a dash. Every section of the home page opens with one.
// The dash is 24px wide and takes the color of the text, so a label never floats alone on the ground.
import type { ComponentProps } from "react";
import { cn } from "~/shared/lib/utils";
import { LABEL } from "../lib/type-styles";

/**
 * A paragraph with a hairline dash before its caps text. It takes the props of a `p`, for example `data-reveal`.
 * The default color is the navy primary. The deep band passes its own pale color in `className`.
 */
export function SectionLabel({
	children,
	className,
	...props
}: ComponentProps<"p">) {
	return (
		<p
			className={cn(LABEL, "flex items-center gap-3 text-primary", className)}
			{...props}
		>
			<span aria-hidden="true" className="h-px w-6 shrink-0 bg-current" />
			<span>{children}</span>
		</p>
	);
}
