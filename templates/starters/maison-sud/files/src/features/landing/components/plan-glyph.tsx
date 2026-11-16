// Floor plan glyphs: the only icons of the public page. They are bullets of facts, steps, and materials.
// Each glyph is one 1px path on a 24 x 24 grid, drawn inline, in the current text color.
// The section components of this feature render it.
import { cn } from "~/shared/lib/utils";

// One path per glyph. A circle is two arcs, so each glyph stays a single path.
const GLYPH_PATHS = {
	room: "M3 4h18v16H3zM9 20v-6M9 14a6 6 0 0 1 6 6",
	corridor: "M6 3v18M18 3v18M18 8l-9 8 3 4",
	window: "M3 12h5M16 12h5M8 8v8M16 8v8M8 20h8",
	stair: "M3 21h5v-4h5v-4h5V9h3M3 21V9",
	kitchen:
		"M3 5h12v4H3zM3 9v10h6M7.4 7a1.6 1.6 0 1 0 3.2 0a1.6 1.6 0 1 0-3.2 0M15 5h6v14h-6",
	bath: "M4 12h16v5a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3zM7 12V6a2 2 0 0 1 4 0M9.8 8a1.2 1.2 0 1 0 2.4 0a1.2 1.2 0 1 0-2.4 0",
	plan: "M3 4h18v16H3zM14 4v9M14 13H3",
	wood: "M3 6h18M3 12h18M3 18h18M9 6v12M17 6v12",
	stone: "M4 15l4-8 5 3 4-5 3 10zM4 15h16",
	linen: "M4 5h16v14H4zM4 9h16M4 13h16M4 17h16",
	brass: "M5 12h9M14 12a3 3 0 1 0 6 0a3 3 0 1 0-6 0M5 9v6",
} as const;

/** The name of a glyph, for example "stair" for a site duration. */
export type PlanGlyphName = keyof typeof GLYPH_PATHS;

type PlanGlyphProps = {
	name: PlanGlyphName;
	/** Extra classes, for example a top margin that aligns the glyph with the first text line. */
	className?: string;
};

/** A 20px decorative glyph. Screen readers skip it: the text beside it carries the meaning. */
export function PlanGlyph({ name, className }: PlanGlyphProps) {
	return (
		<svg
			viewBox="0 0 24 24"
			aria-hidden="true"
			focusable="false"
			className={cn(
				"size-5 shrink-0 fill-none stroke-current text-foreground/45",
				className,
			)}
			strokeWidth={1}
		>
			<path d={GLYPH_PATHS[name]} vectorEffect="non-scaling-stroke" />
		</svg>
	);
}
