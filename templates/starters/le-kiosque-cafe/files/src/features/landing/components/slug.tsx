// The rubric slug of the gazette world: a small brick square and a caps label in the caption face.
// The briefs, the menu categories, the service box, and the letter box render it above their content.
import type { ReactNode } from "react";
import { cn } from "~/shared/lib/utils";

/** Brick caps label. `as` picks the tag, so a slug can be a heading of its block. */
export function Slug({
	children,
	as: Tag = "p",
	className,
}: {
	children: ReactNode;
	/** The tag of the label: a plain line, or the heading of a list. */
	as?: "p" | "h3";
	className?: string;
}) {
	return (
		<Tag
			className={cn(
				"flex items-center gap-2 font-bold font-sans text-[0.74rem] text-primary uppercase leading-snug tracking-[0.12em]",
				className,
			)}
		>
			<span aria-hidden="true" className="size-2.25 shrink-0 bg-primary" />
			{children}
		</Tag>
	);
}
