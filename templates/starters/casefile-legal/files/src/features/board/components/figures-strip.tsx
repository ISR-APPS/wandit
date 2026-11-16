// The figure strip of the board: one panel with one cell per figure, split by 1 px rules.
// BoardPage renders it between the page header and the stage columns.
// It follows the KPI form "strip" of the app-dashboard skill.
import { ChangeLine, type KpiItem } from "~/features/practice";
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import { Card } from "~/shared/ui/card";
import { Skeleton } from "~/shared/ui/skeleton";

type FiguresStripProps = {
	/** The figures, already translated, the most important first. */
	items: KpiItem[];
	/** The column classes of the cell grid, for example "grid-cols-2 @4xl/main:grid-cols-4". */
	className: string;
};

/** Calm and dense: the value is one step smaller than a figure card, so four cells fit beside the sidebar. */
export function FiguresStrip({ items, className }: FiguresStripProps) {
	const { t, locale } = useT();
	return (
		// py-0 and gap-0 replace the py-6 and gap-6 of the kit Card, so the grid touches the panel edges.
		<Card
			className="gap-0 overflow-hidden py-0"
			role="group"
			aria-label={t("board.figuresLabel")}
		>
			{/* Each cell draws its top and start rule. The 1 px shift and the panel clip hide the rules at the panel edge. */}
			<div className={cn("-ms-px -mt-px grid", className)}>
				{items.map((item) => (
					<div
						key={item.id}
						className="grid content-start gap-1.5 border-s border-t px-5 py-4"
					>
						<p className="label-text text-muted-foreground text-sm">
							{item.label}
						</p>
						<p className="font-numeric font-semibold text-2xl tabular-nums leading-tight">
							{new Intl.NumberFormat(locale, item.format).format(item.value)}
						</p>
						<ChangeLine change={item.change} goodWhen={item.goodWhen} />
					</div>
				))}
			</div>
		</Card>
	);
}

type FiguresStripSkeletonProps = {
	/** How many cells the final strip has. */
	count: number;
	/** The same column classes as the final strip. */
	className: string;
};

/** The strip and its cells in their final sizes. */
export function FiguresStripSkeleton({
	count,
	className,
}: FiguresStripSkeletonProps) {
	return (
		<Card className="gap-0 overflow-hidden py-0">
			<div className={cn("-ms-px -mt-px grid", className)}>
				{Array.from({ length: count }, (_, index) => (
					// The cells never reorder, so the index is a stable key.
					// biome-ignore lint/suspicious/noArrayIndexKey: fixed placeholder cells.
					<div key={index} className="grid gap-2 border-s border-t px-5 py-4">
						<Skeleton className="h-4 w-28" />
						<Skeleton className="h-7 w-20" />
						<Skeleton className="h-3.5 w-16" />
					</div>
				))}
			</div>
		</Card>
	);
}
