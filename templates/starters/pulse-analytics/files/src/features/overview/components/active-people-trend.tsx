// The trend panel of the home: the active people of each day, with the average day and the busiest day above the plot.
// OverviewPage renders it and holds the period. The panel reads the daily series of that period itself,
// because the period changes after a click. The plot is DailyAreaChart of the tracking feature.
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import {
	DailyAreaChart,
	dayToDate,
	PanelError,
	type PeriodDays,
} from "~/features/tracking";
import { useT } from "~/shared/i18n";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "~/shared/ui/card";
import { Skeleton } from "~/shared/ui/skeleton";
import { dailyActivePeopleQueryOptions } from "../api/overview.queries";

type ActivePeopleTrendProps = {
	/** The period of the plot, in complete days. OverviewPage holds it. */
	days: PeriodDays;
};

/** While a new period loads, the panel keeps the line of the last period, so the plot does not jump. */
export function ActivePeopleTrend({ days }: ActivePeopleTrendProps) {
	const { t, locale } = useT();
	const trend = useQuery({
		...dailyActivePeopleQueryOptions(days),
		placeholderData: keepPreviousData,
	});

	const number = new Intl.NumberFormat(locale);
	const dayFormat = new Intl.DateTimeFormat(locale, {
		weekday: "short",
		day: "numeric",
		month: "short",
		timeZone: "UTC",
	});
	const points = trend.data ?? [];
	const total = points.reduce((sum, point) => sum + point.current, 0);
	const average = points.length === 0 ? 0 : Math.round(total / points.length);
	const busiest = points.reduce(
		(best, point) => (point.current > best.current ? point : best),
		{ day: "", current: 0, previous: 0 },
	);

	return (
		<Card className="gap-5">
			<CardHeader>
				<CardTitle>{t("overview.trend.title")}</CardTitle>
				<CardDescription>{t("overview.trend.description")}</CardDescription>
			</CardHeader>
			<CardContent className="flex flex-1 flex-col gap-5">
				{trend.isError ? (
					<PanelError
						message={t("overview.trend.error")}
						onRetry={() => trend.refetch()}
						className="min-h-72 flex-1"
					/>
				) : trend.data === undefined ? (
					<Skeleton className="min-h-72 w-full flex-1" />
				) : (
					<>
						<dl className="flex flex-wrap gap-x-10 gap-y-3">
							<div className="grid gap-1">
								<dt className="label-text text-muted-foreground text-xs">
									{t("overview.trend.average")}
								</dt>
								<dd className="font-numeric font-semibold text-2xl tabular-nums leading-none">
									{number.format(average)}
								</dd>
							</div>
							<div className="grid gap-1">
								<dt className="label-text text-muted-foreground text-xs">
									{t("overview.trend.busiest")}
								</dt>
								<dd className="flex items-baseline gap-2">
									<span className="font-numeric font-semibold text-2xl tabular-nums leading-none">
										{number.format(busiest.current)}
									</span>
									{busiest.day === "" ? null : (
										<span className="text-muted-foreground text-sm">
											{dayFormat.format(dayToDate(busiest.day))}
										</span>
									)}
								</dd>
							</div>
						</dl>
						<DailyAreaChart
							points={points}
							seriesLabel={t("overview.trend.series")}
							className="min-h-60 flex-1"
						/>
					</>
				)}
			</CardContent>
		</Card>
	);
}
