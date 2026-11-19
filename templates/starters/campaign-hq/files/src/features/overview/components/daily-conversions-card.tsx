// The daily conversions card of the home: the average per day of the period, a trend arrow, and an area chart.
// OverviewPage renders it in the second row and passes the period data. The chart loads with React.lazy.
// The chart touches the bottom and the sides of the card, as the kit "average daily" card.
import { lazy, Suspense } from "react";
import { useT } from "~/shared/i18n";
import { Card, CardDescription, CardHeader } from "~/shared/ui/card";
import { Skeleton } from "~/shared/ui/skeleton";
import type { Overview } from "../api/overview.queries";
import { TrendMark } from "./trend-mark";

const DailyConversionsArea = lazy(() =>
	import("./daily-conversions-area").then((module) => ({
		default: module.DailyConversionsArea,
	})),
);

type DailyConversionsCardProps = {
	/** The data of the chosen period. */
	overview: Overview;
};

/** The value is the mean of the daily conversions. The arrow compares the period with the one before it. */
export function DailyConversionsCard({ overview }: DailyConversionsCardProps) {
	const { t, locale } = useT();
	const { value, change } = overview.averageConversions;
	const number = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 });

	return (
		<Card className="h-full overflow-hidden pb-0">
			<CardHeader>
				<CardDescription>{t("overview.dailyTitle")}</CardDescription>
				<p className="mb-4 font-numeric font-semibold @4xl/main:text-3xl text-2xl tabular-nums">
					{number.format(value)}
				</p>
				<TrendMark change={change} />
			</CardHeader>
			<div className="mt-auto">
				<Suspense fallback={<Skeleton className="h-28 w-full" />}>
					<DailyConversionsArea daily={overview.daily} />
				</Suspense>
			</div>
		</Card>
	);
}
