// One side column of the poster bill, next to the boxer: a kicker, three lines, and an optional stamp.
// hero-poster.tsx renders two of them. Desktop only.
import { cn } from "~/shared/lib/utils";
import { Star } from "./star";

type BillColumnProps = {
	kicker: string;
	/** Three lines. `outlinedIndex` picks the one in outline type. */
	lines: readonly [string, string, string];
	outlinedIndex: 0 | 1 | 2;
	/** The "Admit one" stamp under the last line. Only the end column has it. */
	stamp?: string;
};

/** The outlined line gives the column one focal point. Both columns start at the same height, so their kickers share one line. */
export function BillColumn({
	kicker,
	lines,
	outlinedIndex,
	stamp,
}: BillColumnProps) {
	return (
		<div className="hidden flex-col items-center gap-2.5 pt-10 text-center lg:flex">
			<p className="sp-faint sp-line mb-1.5 w-full border-b pb-2.5 font-bold text-[0.62rem] uppercase tracking-[0.3em]">
				{kicker}
			</p>
			<ul className="flex flex-col items-center gap-2.5">
				{lines.map((line, index) => (
					<li key={line} className="flex flex-col items-center gap-2.5">
						{index > 0 && <Star className="text-primary text-xs" />}
						<span
							className={cn(
								"font-display font-extrabold text-[clamp(1.3rem,1.9vw,1.85rem)] uppercase leading-none tracking-[0.05em]",
								index === outlinedIndex ? "sp-stroke" : "text-muted-foreground",
							)}
						>
							{line}
						</span>
					</li>
				))}
			</ul>
			{stamp !== undefined && (
				<a
					href="#book"
					className="sp-admit mt-4 inline-block px-4 pt-2 pb-1.5 font-display font-extrabold text-lg uppercase leading-tight tracking-[0.1em]"
				>
					{stamp}
				</a>
			)}
		</div>
	);
}
