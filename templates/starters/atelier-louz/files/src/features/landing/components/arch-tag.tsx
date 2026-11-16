// The arch-topped label pill of the world. Each section head, the hero, and the cabinet start with one.
// The pill shape and its hairline come from `.louz-tag` in landing.css.
import type { ReactNode } from "react";
import { cn } from "~/shared/lib/utils";

/** A small capital label inside an arch outline. `tone="light"` is for the green interlude. */
export function ArchTag({
	children,
	tone = "ink",
	className,
}: {
	children: ReactNode;
	tone?: "ink" | "light";
	className?: string;
}) {
	return (
		<span
			className={cn(
				"louz-tag inline-block font-bold text-[0.72rem] uppercase leading-none tracking-[0.07em]",
				tone === "light" && "louz-tag-light",
				className,
			)}
		>
			{children}
		</span>
	);
}
