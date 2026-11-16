// The figure block of the home: four figures in a 2 x 2 grid, each with its value and delta pill, the previous value, and a hint.
// OverviewPage renders it beside the trend. It reads the figures of the chosen period with useQuery.
// It follows the KPI form "delta" of the app-dashboard skill.
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { ChangePill, fillMessage } from "~/features/social";
import { useT } from "~/shared/i18n";
import { Card, CardContent } from "~/shared/ui/card";
import { Skeleton } from "~/shared/ui/skeleton";
import { overviewKpisQueryOptions } from "../api/overview.queries";
import { PanelError } from "./panel-error";

/** The 2 x 2 grid of the block. The trend beside it grows to its height. */
const FIGURE_GRID = "grid grid-cols-1 gap-4 @xl/main:grid-cols-2";

type KpiFiguresProps = {
	/** The period of the page, in days. */
	days: number;
};

/** The page header names the period. The figures never repeat it. */
export function KpiFigures({ days }: KpiFiguresProps) {
	const { t, locale } = useT();
	const query = useQuery({
		...overviewKpisQueryOptions(days),
		placeholderData: keepPreviousData,
	});
	if (query.isPending) {
		return <KpiFiguresSkeleton />;
	}
	if (query.isError) {
		return <PanelError message={t("overview.kpiError")} />;
	}
	return (
		<div className={FIGURE_GRID}>
			{query.data.map((item) => (
				<Card key={item.id} className="gap-3">
					<CardContent className="grid h-full content-between gap-4">
						<div className="grid gap-2">
							<span className="label-text truncate text-muted-foreground text-sm">
								{t(item.labelKey)}
							</span>
							{/* The pill sits at the end of the value line. A narrow card wraps it under the value. */}
							<div className="flex flex-wrap items-center gap-x-3 gap-y-1">
								<span className="font-numeric @5xl/main:text-4xl text-3xl tabular-nums">
									{new Intl.NumberFormat(locale, item.format).format(
										item.value,
									)}
								</span>
								{item.change === null ? null : (
									<ChangePill change={item.change} goodWhen={item.goodWhen} />
								)}
							</div>
							{item.change === null ? (
								<span className="text-muted-foreground text-sm">
									{t("kpi.noComparison")}
								</span>
							) : null}
							{item.previous === null ? null : (
								<span className="text-muted-foreground text-sm tabular-nums">
									{fillMessage(t("overview.previousValue"), {
										value: new Intl.NumberFormat(locale, item.format).format(
											item.previous,
										),
									})}
								</span>
							)}
						</div>
						<p className="border-border border-t pt-3 text-muted-foreground text-xs">
							{t(item.hintKey)}
						</p>
					</CardContent>
				</Card>
			))}
		</div>
	);
}

// Fixed keys of the four placeholder cards.
const SKELETON_FIGURES = ["1", "2", "3", "4"];

/** The placeholder of the block: four cards with a label, a value, and a pill in their final sizes. */
export function KpiFiguresSkeleton() {
	return (
		<div className={FIGURE_GRID}>
			{SKELETON_FIGURES.map((key) => (
				<Card key={key} className="gap-3">
					<CardContent className="grid gap-4">
						<Skeleton className="h-4 w-24" />
						<div className="flex items-center gap-3">
							<Skeleton className="h-9 w-28" />
							<Skeleton className="h-5 w-14" />
						</div>
						<Skeleton className="h-4 w-32" />
						<Skeleton className="h-3 w-40" />
					</CardContent>
				</Card>
			))}
		</div>
	);
}
