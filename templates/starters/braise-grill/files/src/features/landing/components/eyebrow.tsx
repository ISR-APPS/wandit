// A small caps label with the ember square in front of it. Every section title of the page has one above it.
// The section components render it. The class string comes from lib/type-styles.ts.
import type { ReactNode } from "react";
import { cn } from "~/shared/lib/utils";
import { EYEBROW } from "../lib/type-styles";

/** The label. The world bans bare tracked labels, so the 6px ember square is not optional. */
export function Eyebrow({
	children,
	className,
}: {
	children: ReactNode;
	/** Extra classes, for example a bottom margin or a muted color. */
	className?: string;
}) {
	return (
		<p className={cn(EYEBROW, "flex items-baseline", className)}>
			<span
				aria-hidden="true"
				className="me-2.5 inline-block size-1.5 shrink-0 translate-y-[-1px] bg-primary"
			/>
			<span>{children}</span>
		</p>
	);
}
