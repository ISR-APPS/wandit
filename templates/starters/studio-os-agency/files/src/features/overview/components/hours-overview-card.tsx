// The wide chart card of the home: billable and studio hours per day, with its own window select.
// OverviewPage renders it at 2/3 of the second band. The chart file loads with React.lazy.
// The window is state of the card, as in the kit: it cuts the 90-day series and changes no query.
import { lazy, Suspense, useState } from "react";
import {
	fillMessage,
	isInLastDays,
	type PeriodDays,
	PeriodSelect,
	useFormatters,
} from "~/features/studio";
import { useT } from "~/shared/i18n";
import {
	Card,
	CardAction,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "~/shared/ui/card";
import { Skeleton } from "~/shared/ui/skeleton";
import type { HoursPoint } from "../lib/overview-data";

// The chart file holds the chart library. A lazy import keeps it out of the first script of the app.
const HoursAreaChart = lazy(() =>
	import("./hours-area-chart").then((module) => ({
		default: module.HoursAreaChart,
	})),
);

/** The card opens on the longest window, as the kit card does. */
const DEFAULT_WINDOW: PeriodDays = 90;

type HoursOverviewCardProps = {
	/** One point per workday of the last 90 complete days, oldest first. */
	points: HoursPoint[];
};

/** The description names the totals of the window, so the chart is never the only source of the numbers. */
export function HoursOverviewCard({ points }: HoursOverviewCardProps) {
	const { t } = useT();
	const { hours } = useFormatters();
	const [windowDays, setWindowDays] = useState<PeriodDays>(DEFAULT_WINDOW);
	// The series has no weekend points, so the window cuts by calendar day, not by point count.
	const shown = points.filter((point) => isInLastDays(point.day, windowDays));
	const billable = shown.reduce((sum, point) => sum + point.billable, 0);
	const studio = shown.reduce((sum, point) => sum + point.studio, 0);
	const summary = fillMessage(t("overview.hours.summary"), {
		billable: hours(billable),
		studio: hours(studio),
	});

	return (
		<Card className="h-full">
			<CardHeader>
				<CardTitle>{t("overview.hours.title")}</CardTitle>
				<CardDescription>{summary}</CardDescription>
				<CardAction>
					<PeriodSelect days={windowDays} onDaysChange={setWindowDays} />
				</CardAction>
			</CardHeader>
			<CardContent className="px-2 sm:px-6">
				<Suspense
					fallback={<Skeleton className="@4xl/main:h-64 h-52 w-full" />}
				>
					<HoursAreaChart
						points={shown}
						label={`${t("overview.hours.title")}: ${summary}`}
					/>
				</Suspense>
			</CardContent>
		</Card>
	);
}
