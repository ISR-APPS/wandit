// The revenue trend card of the home: the revenue of the period with its change, an Export button, and the line chart.
// OverviewPage renders it in the second band, beside the "Revenue by month" card.
// Export downloads one CSV row per day. The chart file loads with React.lazy.
import { ExportIcon } from "@phosphor-icons/react";
import { lazy, Suspense } from "react";
import {
	ChangeBadge,
	type DailyPoint,
	dayCountFormat,
	dayToDate,
	downloadCsv,
	fillMessage,
	moneyFormat,
	type PeriodFigure,
	toCsv,
} from "~/features/shop";
import { useT } from "~/shared/i18n";
import { Button } from "~/shared/ui/button";
import {
	Card,
	CardAction,
	CardContent,
	CardDescription,
	CardHeader,
} from "~/shared/ui/card";
import { Skeleton } from "~/shared/ui/skeleton";

const RevenueTrendChart = lazy(() =>
	import("./revenue-trend-chart").then((module) => ({
		default: module.RevenueTrendChart,
	})),
);

type RevenueTrendCardProps = {
	/** One point per day of the period, oldest first. */
	points: DailyPoint[];
	/** The revenue of the period and its change against the period before. */
	revenue: PeriodFigure;
	className?: string;
};

/** The label leads, as in the kit: the value and its change badge sit under it. */
export function RevenueTrendCard({
	points,
	revenue,
	className,
}: RevenueTrendCardProps) {
	const { t, locale } = useT();
	const money = moneyFormat(locale, "whole");
	// The CSV keeps the plain amounts, so a spreadsheet can sum them.
	const isoDay = new Intl.DateTimeFormat("en-CA", { timeZone: "UTC" });

	function exportPoints() {
		downloadCsv(
			"revenue-per-day.csv",
			toCsv(
				points.map((point) => ({ ...point, id: point.day })),
				[
					{
						header: t("overview.trend.day"),
						value: (point) => isoDay.format(dayToDate(point.day)),
					},
					{
						header: t("overview.trend.current"),
						value: (point) => String(point.current),
					},
					{
						header: t("overview.trend.previous"),
						value: (point) => String(point.previous),
					},
				],
			),
		);
	}

	return (
		<Card className={className}>
			<CardHeader>
				<CardDescription>
					{fillMessage(t("overview.trend.label"), {
						period: dayCountFormat(locale).format(points.length),
					})}
				</CardDescription>
				<CardAction>
					<Button
						type="button"
						variant="outline"
						aria-label={t("common.export")}
						onClick={exportPoints}
					>
						<ExportIcon />
						<span className="hidden lg:inline">{t("common.export")}</span>
					</Button>
				</CardAction>
				<div className="flex flex-wrap items-center gap-2">
					<p className="font-numeric text-2xl tabular-nums">
						{money.format(revenue.value)}
					</p>
					<ChangeBadge change={revenue.change} goodWhen="up" look="badge" />
				</div>
			</CardHeader>
			<CardContent>
				<Suspense fallback={<Skeleton className="h-64 w-full" />}>
					<RevenueTrendChart points={points} />
				</Suspense>
			</CardContent>
		</Card>
	);
}
