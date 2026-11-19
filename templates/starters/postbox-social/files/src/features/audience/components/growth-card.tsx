// The wide chart card of the audience page: the 7-day mean of net new followers in the period
// against the same days one period earlier, as two lines. "Export" downloads the daily values as CSV.
// AudiencePage renders it in 2 of 3 columns with the growth of the chosen period.
import { ExportIcon } from "@phosphor-icons/react";
import { lazy, Suspense } from "react";
import { downloadCsv, toCsv } from "~/features/social";
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
import type { AudienceGrowth } from "../api/audience.queries";

// The chart file holds the chart library. A lazy import keeps it out of the first script of the app.
const GrowthLines = lazy(() =>
	import("./audience-charts").then((module) => ({
		default: module.GrowthLines,
	})),
);

type GrowthCardProps = {
	growth: AudienceGrowth;
};

/** The legend under the chart names both lines with their color, so no line is a color alone. */
export function GrowthCard({ growth }: GrowthCardProps) {
	const { t } = useT();
	const rows = growth.gainPoints.map((point) => ({ id: point.day, ...point }));

	return (
		<Card className="h-full">
			<CardHeader>
				<CardTitle>{t("audience.growthTitle")}</CardTitle>
				<CardDescription>{t("audience.growthDescription")}</CardDescription>
				<CardAction>
					<Button
						type="button"
						variant="outline"
						onClick={() =>
							downloadCsv(
								"postbox-follower-growth.csv",
								toCsv(rows, [
									{ header: t("overview.csv.day"), value: (row) => row.id },
									{
										header: t("audience.thisPeriod"),
										value: (row) => String(row.current),
									},
									{
										header: t("audience.previousPeriod"),
										value: (row) => String(row.previous),
									},
								]),
							)
						}
					>
						<ExportIcon />
						{t("overview.export")}
					</Button>
				</CardAction>
			</CardHeader>
			<CardContent className="grid gap-4">
				<Suspense fallback={<Skeleton className="h-72 w-full" />}>
					<GrowthLines
						points={growth.gainTrend}
						currentLabel={t("audience.thisPeriod")}
						previousLabel={t("audience.previousPeriod")}
					/>
				</Suspense>
				<ul className="flex flex-wrap gap-4 text-muted-foreground text-xs">
					<li className="flex items-center gap-1.5">
						<span className="size-2 rounded-full bg-chart-1" />
						{t("audience.thisPeriod")}
					</li>
					<li className="flex items-center gap-1.5">
						<span className="size-2 rounded-full bg-chart-3" />
						{t("audience.previousPeriod")}
					</li>
				</ul>
			</CardContent>
		</Card>
	);
}
