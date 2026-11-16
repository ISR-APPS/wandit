// The running head of a section, as in a printed monograph: a serif-italic folio, a capital label,
// a hairline that fills the row, and a factual aside at the end. ResidenceSection renders it.
// The label is the h2 of the section, so the section has a name in the heading outline.
import type { ReactNode } from "react";

type RunningHeadProps = {
	/** The folio number, for example "02". */
	index: string;
	label: ReactNode;
	/** The id of the label heading. The section points to it with aria-labelledby. */
	titleId: string;
	/** A short fact at the end of the row. It hides on a phone, where the row is too narrow. */
	aside: ReactNode;
};

/** A baseline-aligned row with a bottom hairline. It rises in when it scrolls into view. */
export function RunningHead({
	index,
	label,
	titleId,
	aside,
}: RunningHeadProps) {
	return (
		<div
			data-reveal
			className="mer-rise flex items-baseline gap-5 border-foreground/14 border-b pb-4"
		>
			<span className="font-display text-[0.8125rem] text-primary italic tracking-[0.08em]">
				{index}
			</span>
			<h2
				id={titleId}
				className="font-sans text-[0.6875rem] text-foreground/60 uppercase tracking-[0.22em]"
			>
				{label}
			</h2>
			<span aria-hidden="true" className="flex-1" />
			<span className="hidden text-[0.6875rem] text-foreground/55 uppercase tracking-[0.18em] sm:inline">
				{aside}
			</span>
		</div>
	);
}
