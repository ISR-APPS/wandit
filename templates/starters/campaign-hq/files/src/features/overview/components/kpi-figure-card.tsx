// One figure tile of the home bento: the label, the value, the change, and for the large tile a hint and a spark.
// OverviewPage renders the large tile (conversions) and two small tiles (cost per conversion, ROAS).
// It follows the KPI form "spark" of the app-dashboard skill. The large tile takes the secondary fill of the theme.
import { ChangeLine } from "~/features/marketing";
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import { Card, CardContent } from "~/shared/ui/card";
import { Skeleton } from "~/shared/ui/skeleton";
import type { OverviewKpi } from "../api/overview.queries";
import { formatKpiValue } from "../lib/kpi-value";
import { KpiSpark } from "./kpi-spark";

type KpiFigureCardProps = {
	/** One figure of overviewKpisQueryOptions. Its labelKey is translated here. */
	kpi: OverviewKpi;
	/** "large" adds the hint and the spark, and uses the large type size. */
	size: "large" | "small";
	/** One line under the value of the large tile, already translated. */
	hint?: string;
	/** The span classes of the bento slot. */
	className?: string;
};

/** The label is a message key of the kpi, translated here. */
export function KpiFigureCard({
	kpi,
	size,
	hint,
	className,
}: KpiFigureCardProps) {
	const { t, locale } = useT();
	const isLarge = size === "large";
	return (
		<Card
			className={cn(
				"gap-0",
				isLarge && "bg-secondary text-secondary-foreground",
				className,
			)}
		>
			<CardContent className="flex h-full min-w-0 flex-col gap-2">
				<p
					className={cn(
						"label-text text-sm",
						isLarge ? "text-secondary-foreground" : "text-muted-foreground",
					)}
				>
					{t(kpi.labelKey)}
				</p>
				<p
					className={cn(
						"font-numeric tabular-nums leading-none",
						// A small tile is 2 of 12 columns, so "$29.49" needs the smaller size until the page is wide.
						isLarge ? "text-5xl" : "@6xl/main:text-3xl text-2xl",
					)}
				>
					{formatKpiValue(kpi, locale)}
				</p>
				<ChangeLine change={kpi.change} goodWhen={kpi.goodWhen} />
				{isLarge && hint ? (
					<p className="text-secondary-foreground/80 text-sm">{hint}</p>
				) : null}
				{isLarge && kpi.series ? (
					<div className="mt-auto pt-3">
						<KpiSpark series={kpi.series} />
					</div>
				) : null}
			</CardContent>
		</Card>
	);
}

type KpiFigureCardSkeletonProps = {
	/** The size of the tile that the skeleton stands for. "large" adds the spark area. */
	size: "large" | "small";
	/** The span classes of the bento slot, the same as on the loaded tile. */
	className?: string;
};

/** The four parts of a figure in their final sizes. */
export function KpiFigureCardSkeleton({
	size,
	className,
}: KpiFigureCardSkeletonProps) {
	return (
		<Card className={cn("gap-0", className)}>
			<CardContent className="grid gap-3">
				<Skeleton className="h-4 w-28" />
				<Skeleton className={size === "large" ? "h-12 w-40" : "h-8 w-24"} />
				<Skeleton className="h-4 w-20" />
				{size === "large" ? <Skeleton className="mt-4 h-28 w-full" /> : null}
			</CardContent>
		</Card>
	);
}
