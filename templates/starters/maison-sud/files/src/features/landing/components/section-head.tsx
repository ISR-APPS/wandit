// The head of a wide section: a label on a rule and a two-line title at 7 of 12.
// A short note sits at the end side. ProjectsSection and RoomsSection render it.
import { cn } from "~/shared/lib/utils";
import { GRID, RULE_LABEL, SECTION_TITLE } from "../lib/type-styles";

type SectionHeadProps = {
	/** Micro-cap label above the title. */
	label: string;
	/** The two hand-broken lines of the title. */
	titleLines: readonly [string, string];
	/** One or two sentences, set beside the title from 768px. */
	note: string;
};

/** Title block of a section. The column between the title and the note stays empty on purpose. */
export function SectionHead({ label, titleLines, note }: SectionHeadProps) {
	return (
		<div
			className={cn(GRID, "mb-[clamp(2.6rem,5vw,4.4rem)] items-end gap-y-5")}
		>
			<div className="md:col-span-7">
				<p data-reveal="lift" className={RULE_LABEL}>
					{label}
				</p>
				<h2 data-reveal="lift" className={cn(SECTION_TITLE, "mt-[1.1rem]")}>
					<span className="block">{titleLines[0]}</span>
					<span className="block">{titleLines[1]}</span>
				</h2>
			</div>
			<p
				data-reveal="lift"
				className="text-[0.98rem] text-foreground/70 leading-[1.72] md:col-span-4 md:col-start-9"
			>
				{note}
			</p>
		</div>
	);
}
