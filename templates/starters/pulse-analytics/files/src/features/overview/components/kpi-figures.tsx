// The figure block of the home: four figures in a 2 x 2 grid, each with its delta pill.
// OverviewPage renders it and holds the period. The block reads the figures of that period itself.
// It follows the KPI form "delta" of the app-dashboard skill.
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { ChangePill, PanelError, type PeriodDays } from "~/features/tracking";
import { useT } from "~/shared/i18n";
import { Card, CardContent } from "~/shared/ui/card";
import { Skeleton } from "~/shared/ui/skeleton";
import { overviewKpisQueryOptions } from "../api/overview.queries";

/** How many figures the home shows. The skeleton draws the same count. */
const KPI_COUNT = 4;

// Placeholder cards of the skeleton. Fixed keys, because the cards never reorder.
const SKELETON_FIGURES = ["1", "2", "3", "4"];

/**
 * Two columns at every width: a phone shows two short figures in a row.
 * Only beside the trend panel (@4xl) do the rows share its height. Under it, each card takes its content height.
 */
const FIGURE_GRID = "grid @4xl/main:auto-rows-fr grid-cols-2 gap-4";

type KpiFiguresProps = {
	/** The period of the figures, in complete days. OverviewPage holds it. */
	days: PeriodDays;
};

/** Each figure: the label, the value with its pill, and one line that says what it counts. */
export function KpiFigures({ days }: KpiFiguresProps) {
	const { t, locale } = useT();
	const kpis = useQuery({
		...overviewKpisQueryOptions(days),
		placeholderData: keepPreviousData,
	});

	if (kpis.isError) {
		return (
			<Card>
				<CardContent className="flex flex-1">
					<PanelError
						message={t("overview.kpis.error")}
						onRetry={() => kpis.refetch()}
						className="min-h-72 flex-1"
					/>
				</CardContent>
			</Card>
		);
	}
	if (kpis.data === undefined) {
		return <KpiFiguresSkeleton />;
	}

	return (
		<div className={FIGURE_GRID}>
			{kpis.data.slice(0, KPI_COUNT).map((item) => (
				<Card key={item.id} className="justify-between gap-5">
					<CardContent className="grid gap-4">
						<p className="label-text text-muted-foreground text-sm">
							{t(item.labelKey)}
						</p>
						{/* The pill sits under the value at every width, so the four cards align. */}
						<div className="grid justify-items-start gap-2.5">
							<p className="font-numeric font-semibold @5xl/main:text-5xl @xl/main:text-4xl text-2xl tabular-nums leading-none">
								{new Intl.NumberFormat(locale, item.format).format(item.value)}
							</p>
							{item.change === null ? (
								<p className="text-muted-foreground text-sm">
									{t("kpi.noComparison")}
								</p>
							) : (
								<ChangePill change={item.change} goodWhen={item.goodWhen} />
							)}
						</div>
					</CardContent>
					<CardContent>
						{/* The rule sets the definition apart from the figure. */}
						<p className="border-t pt-4 text-muted-foreground text-xs leading-relaxed">
							{t(item.hintKey)}
						</p>
					</CardContent>
				</Card>
			))}
		</div>
	);
}

/** The figure block while its first read runs: the label, the value, and the pill in their final sizes. */
export function KpiFiguresSkeleton() {
	return (
		<div className={FIGURE_GRID}>
			{SKELETON_FIGURES.map((key) => (
				<Card key={key} className="justify-between gap-5">
					<CardContent className="grid gap-3">
						<Skeleton className="h-4 w-28" />
						<div className="grid gap-2.5">
							<Skeleton className="h-8 w-24" />
							<Skeleton className="h-5 w-16" />
						</div>
					</CardContent>
					<CardContent>
						<Skeleton className="h-4 w-full" />
					</CardContent>
				</Card>
			))}
		</div>
	);
}
