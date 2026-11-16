// The mini title block at the foot of a project sheet: one row of four mono cells (place, area, year, status).
// ProjectSheet renders it. On a phone the row folds into two rows of two cells.
import { cn } from "~/shared/lib/utils";
import { CELL_KEY } from "../lib/styles";

/** One cell of the strip. Both texts are translated and formatted by the caller. */
export type CartoucheCell = {
	/** The small key above the value, for example "Area". */
	label: string;
	/** The value, for example "240 m²". */
	value: string;
};

type MiniCartoucheProps = {
	cells: readonly CartoucheCell[];
	className?: string;
};

/** A strip of four facts. The top rule is the ink of the sheet frame. */
export function MiniCartouche({ cells, className }: MiniCartoucheProps) {
	return (
		<dl
			className={cn(
				"grid grid-cols-2 border-foreground border-t-[1.5px] sm:grid-cols-4",
				className,
			)}
		>
			{cells.map((cell, index) => (
				<div
					key={cell.label}
					className={cn(
						"min-w-0 border-foreground/20 px-3.5 py-2.5",
						// The cell borders draw the inner rules: 2 columns on a phone, 4 in one row from 640px.
						index % 2 === 0 && "border-e",
						index < 2 && "border-b sm:border-b-0",
						index === 1 && "sm:border-e",
					)}
				>
					<dt className={CELL_KEY}>{cell.label}</dt>
					<dd className="mt-0.5 truncate font-display text-[0.71875rem] tracking-[0.03em]">
						{cell.value}
					</dd>
				</div>
			))}
		</dl>
	);
}
