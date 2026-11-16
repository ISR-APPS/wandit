// The strip form of the desk figures: one band of cells split by 1 px rules, inside the Solved panel.
// SolvedCard renders it under its header. Each cell is a DeskFigureCell.
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import { Skeleton } from "~/shared/ui/skeleton";
import type { DeskFigure } from "../api/desk.queries";
import { DeskFigureCell } from "./desk-figure-cell";

type DeskFiguresStripProps = {
	figures: DeskFigure[];
	/** The grid columns of the cells, for example "grid-cols-2 @5xl/main:grid-cols-4". */
	className: string;
};

/** The band clips the grid, so the rules at the band edge disappear at every wrap. */
export function DeskFiguresStrip({
	figures,
	className,
}: DeskFiguresStripProps) {
	const { t } = useT();
	return (
		<div className="overflow-hidden border-y">
			{/* -ms-px and -mt-px move the grid by the rule width. They are in px: the theme scale must not change them. */}
			<div className={cn("-ms-px -mt-px grid", className)}>
				{figures.map((figure) => (
					<DeskFigureCell
						key={figure.id}
						figure={figure}
						label={t(figure.labelKey)}
					/>
				))}
			</div>
		</div>
	);
}

/** The strip in its final size while the figures of a new period load. */
export function DeskFiguresStripSkeleton({
	className,
}: Pick<DeskFiguresStripProps, "className">) {
	return (
		<div className="overflow-hidden border-y">
			<div className={cn("-ms-px -mt-px grid", className)}>
				{["a", "b", "c", "d"].map((key) => (
					<div key={key} className="grid gap-2 border-s border-t px-4 py-3.5">
						<Skeleton className="h-3 w-20" />
						<Skeleton className="h-6 w-16" />
						<Skeleton className="h-3 w-24" />
					</div>
				))}
			</div>
		</div>
	);
}
