// The "Work completed" card of the home: the tasks done per working day as stacked areas, with its own period Select.
// OverviewPage renders it in the 2/3 column of the middle row. The chart file loads lazily.
// The card holds its period, as the kit chart does, so it does not follow the period of the page header.
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { lazy, Suspense, useState } from "react";
import {
	dayCountFormat,
	fillMessage,
	type PeriodDays,
	PeriodSelect,
} from "~/features/tracker";
import { useT } from "~/shared/i18n";
import { Button } from "~/shared/ui/button";
import {
	Card,
	CardAction,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "~/shared/ui/card";
import { Skeleton } from "~/shared/ui/skeleton";
import {
	WORK_CHART_DEFAULT_DAYS,
	workSeriesQueryOptions,
} from "../api/overview.queries";

const WorkAreaChart = lazy(() =>
	import("./work-area-chart").then((module) => ({
		default: module.WorkAreaChart,
	})),
);

/** Loading and error states stay inside the card, so the rest of the home keeps its layout. */
export function WorkChartCard() {
	const { t, locale } = useT();
	const [days, setDays] = useState<PeriodDays>(WORK_CHART_DEFAULT_DAYS);
	// The old series stays on screen while another period loads.
	const series = useQuery({
		...workSeriesQueryOptions(days),
		placeholderData: keepPreviousData,
	});
	const number = new Intl.NumberFormat(locale);
	const points = series.data ?? [];
	const features = points.reduce((sum, point) => sum + point.features, 0);
	const fixes = points.reduce((sum, point) => sum + point.fixes, 0);
	const period = dayCountFormat(locale).format(days);

	return (
		<Card className="h-full">
			<CardHeader>
				<CardTitle>{t("overview.workTitle")}</CardTitle>
				<CardDescription>
					{fillMessage(t("overview.workDescription"), {
						count: number.format(features + fixes),
						period,
					})}
				</CardDescription>
				<CardAction>
					<PeriodSelect days={days} onDaysChange={setDays} />
				</CardAction>
			</CardHeader>
			<CardContent className="px-2 sm:px-6">
				{series.isError ? (
					<div className="grid h-56 place-content-center justify-items-center gap-3 text-center">
						<p className="text-muted-foreground text-sm" role="alert">
							{t("overview.chartError")}
						</p>
						<Button
							type="button"
							variant="outline"
							size="sm"
							onClick={() => series.refetch()}
						>
							{t("common.retry")}
						</Button>
					</div>
				) : series.data === undefined ? (
					<Skeleton className="@4xl/main:h-64 h-56 w-full" />
				) : features + fixes === 0 ? (
					<p className="grid h-56 place-content-center text-center text-muted-foreground text-sm">
						{t("overview.workEmpty")}
					</p>
				) : (
					<Suspense
						fallback={<Skeleton className="@4xl/main:h-64 h-56 w-full" />}
					>
						<WorkAreaChart
							points={points}
							label={fillMessage(t("overview.workSummary"), {
								period,
								features: number.format(features),
								fixes: number.format(fixes),
							})}
						/>
					</Suspense>
				)}
			</CardContent>
		</Card>
	);
}
