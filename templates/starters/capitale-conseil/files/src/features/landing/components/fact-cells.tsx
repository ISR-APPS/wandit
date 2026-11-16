// A hairline row of three meta cells: a caps term over a value. The case study closes with it.
// ReferencesSection renders it. Vertical hairlines stand between the cells.
import { cn } from "~/shared/lib/utils";
import { SOFT, TERM } from "../lib/type-styles";

/** One cell: a term and its value, both already translated. */
export type FactCell = {
	term: string;
	value: string;
};

type FactCellsProps = {
	cells: readonly FactCell[];
	className?: string;
};

/** A definition list in three equal columns on a strong top rule. The values use tabular numerals. */
export function FactCells({ cells, className }: FactCellsProps) {
	return (
		<dl
			className={cn(
				"grid grid-cols-3 border-foreground/18 border-t pt-3.5",
				className,
			)}
		>
			{cells.map((cell, index) => (
				<div
					key={cell.term}
					className={cn(
						"pe-3",
						index > 0 &&
							"border-foreground/12 border-s ps-[clamp(0.8rem,1.6vw,1.4rem)]",
					)}
				>
					<dt className={TERM}>{cell.term}</dt>
					<dd className={cn(SOFT, "mt-1.5 text-sm tabular-nums leading-snug")}>
						{cell.value}
					</dd>
				</div>
			))}
		</dl>
	);
}
