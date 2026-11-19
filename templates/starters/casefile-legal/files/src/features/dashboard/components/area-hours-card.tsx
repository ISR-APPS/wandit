// The first card of the middle grid: the hours of the period by practice area, as a donut with a legend.
// DashboardPage renders it with the summary of the chosen period. It takes the place of the kit source donut.
// The donut file loads with React.lazy. "Export" downloads the hours of each slice as CSV.
import { DownloadSimpleIcon } from "@phosphor-icons/react";
import { lazy, Suspense } from "react";
import { downloadCsv, toCsv } from "~/features/practice";
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
import type { AreaSlice } from "../lib/dashboard";
import type { AreaDonutSlice } from "./area-donut";

// The chart file holds the chart library. A lazy import keeps it out of the first script of the app.
const AreaDonut = lazy(() =>
	import("./area-donut").then((module) => ({ default: module.AreaDonut })),
);

type AreaHoursCardProps = {
	/** The 3 largest areas of the period, then "other" when more areas have hours. */
	areas: AreaSlice[];
};

/** The legend names each slice and its hours, so the color is never the only mark. */
export function AreaHoursCard({ areas }: AreaHoursCardProps) {
	const { t, locale } = useT();
	const hours = new Intl.NumberFormat(locale, { maximumFractionDigits: 0 });
	const total = areas.reduce((sum, slice) => sum + slice.hours, 0);
	const slices: AreaDonutSlice[] = areas.map((slice, index) => ({
		key: slice.area,
		label: t(`areas.${slice.area}`),
		value: slice.hours,
		// The chart series 1 to 4 color the slices in their order, the largest first.
		color: `var(--chart-${index + 1})`,
	}));

	return (
		<Card>
			<CardHeader>
				<CardTitle>{t("dashboard.areasTitle")}</CardTitle>
				<CardDescription>{t("dashboard.areasDescription")}</CardDescription>
				<CardAction>
					<Button
						type="button"
						variant="outline"
						size="sm"
						onClick={() =>
							downloadCsv(
								"hours-by-practice-area.csv",
								toCsv(
									slices.map((slice) => ({ id: slice.key, ...slice })),
									[
										{ header: t("dashboard.area"), value: (row) => row.label },
										{
											header: t("dashboard.hoursCaption"),
											value: (row) => String(row.value),
										},
									],
								),
							)
						}
					>
						<DownloadSimpleIcon />
						{t("common.export")}
					</Button>
				</CardAction>
			</CardHeader>
			<CardContent className="grid gap-6">
				<Suspense
					fallback={<Skeleton className="mx-auto size-56 rounded-full" />}
				>
					<AreaDonut slices={slices} total={total} />
				</Suspense>
				<ul className="flex flex-wrap justify-around gap-x-4 gap-y-3">
					{slices.map((slice) => (
						<li key={slice.key} className="grid min-w-0 gap-1">
							<span className="flex items-center gap-1.5 text-muted-foreground text-xs">
								<span
									aria-hidden="true"
									className="size-2 shrink-0 rounded-full"
									style={{ backgroundColor: slice.color }}
								/>
								<span className="truncate">{slice.label}</span>
							</span>
							<span className="ms-3.5 font-numeric font-semibold text-lg tabular-nums">
								{hours.format(slice.value)}
							</span>
						</li>
					))}
				</ul>
			</CardContent>
		</Card>
	);
}
