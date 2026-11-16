// One project drawn as a sheet: a head with the name and the folio, the figure, one line of text, and the mini title block.
// SheetsSection renders three of them. "stacked" puts the figure on top; "wide" puts it beside the text from 768px.
// The figure plots when the sheet scrolls into view (use-scroll-reveal.ts sets the state on the sheet).
import type { ReactNode } from "react";
import { cn } from "~/shared/lib/utils";
import { BODY, LABEL, SHEET } from "../lib/styles";
import { type CartoucheCell, MiniCartouche } from "./mini-cartouche";

type ProjectSheetProps = {
	/** The translated project name, for example "Villa Bologhine". */
	name: string;
	/** The translated sheet folio, for example "A·2025·14 — ground floor plan". */
	folio: string;
	/** One sentence about the project. */
	body: string;
	/** The four facts of the mini title block. */
	cells: readonly CartoucheCell[];
	/** The line drawing of the project. */
	figure: ReactNode;
	layout: "stacked" | "wide";
	className?: string;
};

/** An article with a 1.5px ink frame. Hover thickens the frame; nothing lifts or casts a shadow. */
export function ProjectSheet({
	name,
	folio,
	body,
	cells,
	figure,
	layout,
	className,
}: ProjectSheetProps) {
	const isWide = layout === "wide";
	const head = (
		<div
			className={cn(
				"flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1",
				!isWide && "border-foreground/20 border-b px-[18px] py-3.5",
			)}
		>
			<h3
				className={cn(
					"ns-title font-bold tracking-[-0.01em]",
					isWide ? "order-2 w-full text-[1.4rem]" : "text-[1.1rem]",
				)}
			>
				{name}
			</h3>
			<span
				className={`${LABEL} font-normal text-[0.625rem] text-foreground/70`}
			>
				{folio}
			</span>
		</div>
	);
	return (
		<article data-reveal className={cn("ns-figure min-w-0", SHEET, className)}>
			{isWide ? (
				<div className="grid md:grid-cols-[1.4fr_1fr]">
					<div className="border-foreground/20 border-b p-[clamp(1rem,2vw,1.5rem)] md:border-e md:border-b-0">
						{figure}
					</div>
					<div className="flex flex-col justify-center gap-4 p-[clamp(1.25rem,2.5vw,2rem)]">
						{head}
						<p className={`${BODY} max-w-[60ch] text-[0.95rem] leading-[1.6]`}>
							{body}
						</p>
						<MiniCartouche
							cells={cells}
							className="border-foreground/20 border-t"
						/>
					</div>
				</div>
			) : (
				<>
					{head}
					<div className="p-[clamp(1rem,2vw,1.5rem)]">{figure}</div>
					<p
						className={`${BODY} max-w-[60ch] px-[18px] pb-4 text-[0.95rem] leading-[1.6]`}
					>
						{body}
					</p>
					<MiniCartouche cells={cells} />
				</>
			)}
		</article>
	);
}
