// The cells of a figure strip: one cell per figure, split by 1 px rules. It is the KPI form "strip" of the app-dashboard skill.
// The deliveries panel of the home and the fleet page render it inside a clipped box.
// The caller formats each value with Intl and gives the column classes.
import { cn } from "~/shared/lib/utils";
import { ChangeLine } from "./change-line";

/** One cell of the strip. */
export type StripFigure = {
	/** Stable id, also the React key. */
	id: string;
	/** Label, already translated. */
	label: string;
	/** The value, already formatted with Intl. */
	value: string;
	/** Ratio against the previous period. null shows "No earlier data". Leave it out for a figure with no period. */
	change?: number | null;
	/** "down" when a fall is good news. Read only with `change`. */
	goodWhen?: "up" | "down";
	/** One muted line under the value, for a figure with no period: "10 of 12 vehicles". */
	detail?: string;
};

type FigureStripProps = {
	figures: StripFigure[];
	/** The column classes of the grid, for example "grid-cols-2 @3xl/main:grid-cols-4". */
	className?: string;
};

/**
 * Each cell draws its top and start rule. The 1 px shift moves the outer rules out of the box.
 * The parent must clip (`overflow-hidden`), so the rules at its edge disappear at every wrap.
 */
export function FigureStrip({ figures, className }: FigureStripProps) {
	return (
		<div className={cn("-ms-px -mt-px grid", className)}>
			{figures.map((figure) => (
				<div
					key={figure.id}
					className="grid content-start gap-1 border-s border-t p-4"
				>
					<p className="label-text text-muted-foreground text-xs">
						{figure.label}
					</p>
					<p className="font-numeric font-semibold text-2xl tabular-nums leading-tight">
						{figure.value}
					</p>
					{figure.change !== undefined ? (
						<ChangeLine
							change={figure.change}
							goodWhen={figure.goodWhen ?? "up"}
						/>
					) : null}
					{figure.detail ? (
						<p className="text-muted-foreground text-xs">{figure.detail}</p>
					) : null}
				</div>
			))}
		</div>
	);
}
