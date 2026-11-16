// The head of a content section: an arch tag and a serif title on the start side, the intro on the end side.
// MaterialsSection, ProjectsSection, and MethodSection render it. On a phone the three parts stack.
import type { ReactNode } from "react";
import { cn } from "~/shared/lib/utils";
import { ArchTag } from "./arch-tag";

/**
 * One section head. `titleId` is the id that the section's aria-labelledby points to.
 * `title` is text, or text with a block span when a line break must fall between two sentences.
 */
export function SectionHead({
	tag,
	title,
	titleId,
	intro,
	className,
}: {
	tag: string;
	title: ReactNode;
	titleId: string;
	intro: string;
	className?: string;
}) {
	return (
		<div
			data-reveal
			className={cn(
				"grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] lg:items-end lg:gap-16",
				className,
			)}
		>
			<div>
				<ArchTag>{tag}</ArchTag>
				<h2
					id={titleId}
					className="mt-4 max-w-[15em] font-display font-normal text-[clamp(2.1rem,4.4vw,3.5rem)] leading-[1.08]"
				>
					{title}
				</h2>
			</div>
			<p className="max-w-[44ch] text-[1.1rem] leading-relaxed lg:pb-2">
				{intro}
			</p>
		</div>
	);
}
