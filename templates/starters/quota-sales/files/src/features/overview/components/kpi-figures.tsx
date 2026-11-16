// The band of KPI figures at the top of the home: one Card per figure, with its label, value, and delta pill.
// OverviewPage passes the first KPI_COUNT items and the grid class of the band.
import type { KpiItem } from "~/features/sales";
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import { Card } from "~/shared/ui/card";
import { Skeleton } from "~/shared/ui/skeleton";
import { ChangePill } from "./change-pill";

type KpiFiguresProps = {
	/** The figures, already translated, in the order of the band. */
	items: KpiItem[];
	/** The grid class of the band, from the home. */
	className?: string;
};

/** One figure per Card. A null change shows "No earlier data" in place of the pill. */
export function KpiFigures({ items, className }: KpiFiguresProps) {
	const { t, locale } = useT();
	return (
		<div className={cn("grid gap-4", className)}>
			{items.map((item) => (
				<Card key={item.id} className="gap-3 px-5 @3xl/main:py-5 py-4">
					<p className="label-text text-muted-foreground">{item.label}</p>
					<div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
						<p className="font-numeric font-semibold text-3xl tabular-nums leading-none">
							{new Intl.NumberFormat(locale, item.format).format(item.value)}
						</p>
						{item.change === null ? null : (
							<ChangePill
								change={item.change}
								changeKind={item.changeKind}
								goodWhen={item.goodWhen}
							/>
						)}
					</div>
					{item.change === null ? (
						<p className="text-muted-foreground text-xs">
							{t("kpi.noComparison")}
						</p>
					) : null}
				</Card>
			))}
		</div>
	);
}

// Fixed keys, because the placeholders never reorder.
const SKELETON_KEYS = ["1", "2", "3", "4", "5"];

type KpiFiguresSkeletonProps = {
	/** How many figures the band shows. */
	count: number;
	/** The same grid class as KpiFigures. */
	className?: string;
};

/** The band while the loader runs: the label, the value, and the pill in their final sizes. */
export function KpiFiguresSkeleton({
	count,
	className,
}: KpiFiguresSkeletonProps) {
	return (
		<div className={cn("grid gap-4", className)}>
			{SKELETON_KEYS.slice(0, count).map((key) => (
				<Card key={key} className="gap-3 px-5 @3xl/main:py-5 py-4">
					<Skeleton className="h-4 w-24" />
					<div className="flex items-center justify-between gap-3">
						<Skeleton className="h-8 w-32" />
						<Skeleton className="h-5 w-14" />
					</div>
				</Card>
			))}
		</div>
	);
}
