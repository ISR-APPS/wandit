// The picks card of the home: the units picked in the period with their change, and a line of grouped days
// against the same days one period earlier (the faint line). It takes the place of the kit "returning rate" card.
// OverviewPage renders it. "Export" downloads the daily points as CSV. The chart file loads with React.lazy.
import { DownloadSimpleIcon } from "@phosphor-icons/react";
import { lazy, Suspense } from "react";
import { type DailyPoint, Delta, downloadCsv, toCsv } from "~/features/stock";
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
import type { Figure } from "../api/overview.queries";

// The chart file holds the chart library. A lazy import keeps it out of the first script of the app.
const PicksLines = lazy(() =>
	import("./picks-lines").then((module) => ({ default: module.PicksLines })),
);

type PicksCardProps = {
	/** One point per full day of the period, oldest first. */
	points: DailyPoint[];
	/** The units picked in the period and their change against the period before. */
	unitsPicked: Figure;
};

/** The head shows the total and its change, as the kit card shows its rate and badge. */
export function PicksCard({ points, unitsPicked }: PicksCardProps) {
	const { t, locale } = useT();
	const number = new Intl.NumberFormat(locale);

	return (
		<Card>
			<CardHeader>
				<CardDescription>{t("overview.picksTitle")}</CardDescription>
				<CardAction>
					<Button
						type="button"
						variant="outline"
						aria-label={t("common.export")}
						onClick={() =>
							downloadCsv(
								"units-picked-per-day.csv",
								toCsv(
									points.map((point) => ({ id: point.day, ...point })),
									[
										{ header: t("overview.day"), value: (row) => row.day },
										{
											header: t("overview.picksTitle"),
											value: (row) => String(row.current),
										},
										{
											header: t("overview.periodBefore"),
											value: (row) => String(row.previous),
										},
									],
								),
							)
						}
					>
						<DownloadSimpleIcon />
						<span className="hidden lg:inline">{t("common.export")}</span>
					</Button>
				</CardAction>
				<div className="flex flex-wrap items-center gap-2">
					<p className="font-numeric font-semibold text-2xl tabular-nums">
						{number.format(unitsPicked.value)}
					</p>
					<Delta change={unitsPicked.change} goodWhen="up" variant="badge" />
				</div>
			</CardHeader>
			<CardContent className="mt-auto">
				<Suspense fallback={<Skeleton className="h-64 w-full" />}>
					<PicksLines points={points} />
				</Suspense>
			</CardContent>
		</Card>
	);
}
