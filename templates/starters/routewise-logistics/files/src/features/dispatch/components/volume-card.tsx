// The volume card of the home: closed shipments per day, with a totals box that picks the series.
// DispatchPage renders it in the first band, beside the four KPI cards. It gets the daily outcomes of the period.
// The totals box sits in the top end corner of the card. Each cell is a toggle button: Delivered or Failed.
import { lazy, Suspense, useState } from "react";
import {
	type CategoryPoint,
	type DeliveryOutcome,
	dayCountFormat,
	fillMessage,
} from "~/features/logistics";
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

// The chart file holds the chart library. A lazy import keeps it out of the first script of the app.
const VolumeBarChart = lazy(() =>
	import("./volume-bar-chart").then((module) => ({
		default: module.VolumeBarChart,
	})),
);

/** The two series of the card. Delivered adds the on-time and the late deliveries. */
export const VOLUME_SERIES = ["delivered", "failed"] as const;

/** One series of the card. Its label is the message key `volume.<series>`. */
export type VolumeSeries = (typeof VOLUME_SERIES)[number];

/** One day of the chart: YYYY-MM-DD and the count of each series. */
export type VolumePoint = { day: string } & Record<VolumeSeries, number>;

// Folds the three outcomes of each day into the two series of the card.
function toVolumePoints(
	outcomes: CategoryPoint<DeliveryOutcome>[],
): VolumePoint[] {
	const byDay = new Map<string, VolumePoint>();
	for (const point of outcomes) {
		const day = byDay.get(point.day) ?? {
			day: point.day,
			delivered: 0,
			failed: 0,
		};
		if (point.category === "failed") {
			day.failed += point.value;
		} else {
			day.delivered += point.value;
		}
		byDay.set(point.day, day);
	}
	return [...byDay.values()];
}

type VolumeCardProps = {
	/** Closed shipments per day and outcome, oldest day first, from deliveryOutcomesQueryOptions. */
	outcomes: CategoryPoint<DeliveryOutcome>[];
	/** The period of the page header, in days. The description names it. */
	days: number;
};

/** The totals of the box are the sums of the plotted days, so they equal the bars. */
export function VolumeCard({ outcomes, days }: VolumeCardProps) {
	const { t, locale } = useT();
	const [series, setSeries] = useState<VolumeSeries>("delivered");
	const points = toVolumePoints(outcomes);
	const number = new Intl.NumberFormat(locale);
	const dayCount = dayCountFormat(locale);

	return (
		// relative and overflow-hidden: the totals box sits flush in the top end corner from the xl width.
		<Card className="relative h-full overflow-hidden">
			<CardHeader>
				<CardTitle>{t("volume.title")}</CardTitle>
				{/* col-start-1: the totals box moves under the description on a phone, so the end column is empty. */}
				<CardDescription className="col-start-1">
					{fillMessage(t("period.last"), { period: dayCount.format(days) })}
				</CardDescription>
				<CardAction className="@xl/main:col-start-2 col-start-1 @xl/main:row-start-1 row-start-3 justify-self-start @xl/main:justify-self-end">
					<div className="@xl/main:absolute @xl/main:end-0 @xl/main:top-0 flex divide-x @max-xl/main:rounded-md rounded-es-md @max-xl/main:border border-s border-b rtl:divide-x-reverse">
						{VOLUME_SERIES.map((key) => (
							<button
								key={key}
								type="button"
								aria-pressed={series === key}
								onClick={() => setSeries(key)}
								className="flex flex-1 flex-col justify-center gap-1 px-6 py-4 text-start outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-pressed:bg-muted"
							>
								<span className="text-muted-foreground text-xs">
									{t(`volume.${key}`)}
								</span>
								<span className="font-numeric text-lg tabular-nums leading-none sm:text-2xl">
									{number.format(
										points.reduce((sum, point) => sum + point[key], 0),
									)}
								</span>
							</button>
						))}
					</div>
				</CardAction>
			</CardHeader>
			<CardContent>
				<Suspense fallback={<Skeleton className="h-48" />}>
					<VolumeBarChart points={points} series={series} />
				</Suspense>
			</CardContent>
		</Card>
	);
}
