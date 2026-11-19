// The average daily events card of the home: the events of an average day, a trend arrow,
// and an area chart of every day of the period at the bottom edge. OverviewPage renders it in the row of three.
// The chart file loads with React.lazy.
import { lazy, Suspense } from "react";
import { changeRatio, type DailyPoint } from "~/features/tracking";
import { useT } from "~/shared/i18n";
import {
	Card,
	CardAction,
	CardDescription,
	CardHeader,
} from "~/shared/ui/card";
import { Skeleton } from "~/shared/ui/skeleton";
import { TrendMark } from "./trend-mark";

// The chart file holds the chart library. A lazy import keeps it out of the first script of the app.
const DailyEventsSpark = lazy(() =>
	import("./daily-events-spark").then((module) => ({
		default: module.DailyEventsSpark,
	})),
);

type DailyEventsCardProps = {
	/** All events per day of the period, oldest first. */
	points: DailyPoint[];
};

/** The chart touches the card edges, so the card has no bottom padding. */
export function DailyEventsCard({ points }: DailyEventsCardProps) {
	const { t, locale } = useT();
	const number = new Intl.NumberFormat(locale, { maximumFractionDigits: 0 });
	const days = Math.max(1, points.length);
	const current = points.reduce((sum, point) => sum + point.current, 0) / days;
	const previous =
		points.reduce((sum, point) => sum + point.previous, 0) / days;

	return (
		<Card className="h-full gap-0 overflow-hidden pb-0">
			<CardHeader>
				<CardDescription>{t("overview.dailyEvents.title")}</CardDescription>
				<p className="mb-4 font-numeric font-semibold @4xl/main:text-3xl text-2xl tabular-nums">
					{number.format(current)}
				</p>
				<CardAction>
					<TrendMark change={changeRatio(current, previous)} />
				</CardAction>
			</CardHeader>
			<div className="mt-auto">
				<Suspense fallback={<Skeleton className="mx-6 mb-6 h-18" />}>
					<DailyEventsSpark points={points} />
				</Suspense>
			</div>
		</Card>
	);
}
