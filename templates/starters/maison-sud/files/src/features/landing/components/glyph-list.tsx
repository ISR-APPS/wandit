// A short list of facts, each with a floor plan glyph as its bullet.
// The project articles render it for the commune, the surface, the mission, and the delivery date.
import { cn } from "~/shared/lib/utils";
import { PlanGlyph, type PlanGlyphName } from "./plan-glyph";

/** One fact line of a project. */
export type GlyphFact = {
	glyph: PlanGlyphName;
	/** Translated text of the line. */
	text: string;
};

type GlyphListProps = {
	facts: readonly GlyphFact[];
	className?: string;
};

/** The facts of one project, one per line. The items arrive one after the other on scroll. */
export function GlyphList({ facts, className }: GlyphListProps) {
	return (
		<ul data-reveal="stagger" className={cn("grid gap-2.5", className)}>
			{facts.map((fact) => (
				<li
					key={fact.text}
					className="flex items-start gap-2.5 text-[0.94rem] text-foreground/70 leading-normal"
				>
					<PlanGlyph name={fact.glyph} className="mt-px" />
					<span>{fact.text}</span>
				</li>
			))}
		</ul>
	);
}
