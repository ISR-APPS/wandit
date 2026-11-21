// The activity card of the home: the lessons finished, the work turned in, and the new enrollments
// of the last 30 full days, as a donut with a legend of shares. DashboardPage renders it at the end of the middle band.
// The donut file loads with React.lazy.
import { lazy, Suspense } from "react";
import { dayCountFormat, fillMessage, shareFormat } from "~/features/school";
import { useT } from "~/shared/i18n";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "~/shared/ui/card";
import { Skeleton } from "~/shared/ui/skeleton";
import {
	type DashboardSummary,
	SUMMARY_WINDOW_DAYS,
} from "../api/dashboard.queries";
import type { ActivitySlice } from "./activity-donut";

// The chart file holds the chart library. A lazy import keeps it out of the first script of the app.
const ActivityDonut = lazy(() =>
	import("./activity-donut").then((module) => ({
		default: module.ActivityDonut,
	})),
);

type ActivityCardProps = {
	/** The event counts of the last 30 full days (to yesterday), from the summary query. */
	activity: DashboardSummary["activity"];
};

/** The legend names each slice and its share, so the color is never the only mark. */
export function ActivityCard({ activity }: ActivityCardProps) {
	const { t, locale } = useT();
	const share = shareFormat(locale);
	const slices: ActivitySlice[] = [
		{
			key: "lessons",
			label: t("dashboard.activityLessons"),
			value: activity.lessons,
			color: "var(--chart-1)",
		},
		{
			key: "submissions",
			label: t("dashboard.activitySubmissions"),
			value: activity.submissions,
			color: "var(--chart-2)",
		},
		{
			key: "enrollments",
			label: t("dashboard.activityEnrollments"),
			value: activity.enrollments,
			color: "var(--chart-3)",
		},
	];
	const total = slices.reduce((sum, slice) => sum + slice.value, 0);

	return (
		<Card>
			<CardHeader>
				<CardTitle>{t("dashboard.activityTitle")}</CardTitle>
				<CardDescription>
					{fillMessage(t("dashboard.lastPeriod"), {
						period: dayCountFormat(locale).format(SUMMARY_WINDOW_DAYS),
					})}
				</CardDescription>
			</CardHeader>
			<CardContent className="grid flex-1 content-between gap-6">
				<Suspense
					fallback={<Skeleton className="mx-auto size-56 rounded-full" />}
				>
					<ActivityDonut slices={slices} total={total} />
				</Suspense>
				<ul className="flex justify-around gap-2">
					{slices.map((slice) => (
						<li key={slice.key} className="grid min-w-0 gap-1">
							<span className="flex items-center gap-1.5 text-sm">
								<span
									aria-hidden="true"
									className="size-2 shrink-0 rounded-full"
									style={{ backgroundColor: slice.color }}
								/>
								<span className="truncate">{slice.label}</span>
							</span>
							<span className="text-center font-numeric font-semibold text-xl tabular-nums">
								{total === 0 ? "–" : share.format(slice.value / total)}
							</span>
						</li>
					))}
				</ul>
			</CardContent>
		</Card>
	);
}
