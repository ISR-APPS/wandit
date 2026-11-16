// A small note with a 5px ember square in front of it: under a photo, a table, or prose.
// The hearth, menu, chef, and room sections render it.
import type { ReactNode } from "react";
import { cn } from "~/shared/lib/utils";
import { CAPTION } from "../lib/type-styles";

/** A figcaption when `asFigcaption` is true, else a paragraph. The text sits below the element it describes. */
export function PhotoCaption({
	children,
	asFigcaption = false,
	className,
}: {
	children: ReactNode;
	/** True inside a <figure>, so screen readers tie the caption to the photo. */
	asFigcaption?: boolean;
	className?: string;
}) {
	const Tag = asFigcaption ? "figcaption" : "p";
	return (
		<Tag className={cn(CAPTION, "flex items-baseline", className)}>
			<span
				aria-hidden="true"
				className="me-2 inline-block size-[5px] shrink-0 translate-y-[-1px] bg-primary"
			/>
			<span>{children}</span>
		</Tag>
	);
}
