// The source card of the home: the new deals of the period by source, as a donut with a legend.
// DashboardPage renders it in the middle grid with the summary of the chosen period.
// The donut file loads with React.lazy. "Export" downloads the counts of every source as CSV.
import { DownloadSimpleIcon } from "@phosphor-icons/react";
import { lazy, Suspense } from "react";
import {
	type BreakdownSlice,
	type DealSource,
	downloadCsv,
	toCsv,
} from "~/features/crm";
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
import type { SourceSlice } from "./source-donut";

// The chart file holds the chart library. A lazy import keeps it out of the first script of the app.
const SourceDonut = lazy(() =>
	import("./source-donut").then((module) => ({ default: module.SourceDonut })),
);

// The donut shows the 3 largest sources and one "Other" slice, so the legend fits one row of 4.
const SHOWN_SOURCES = 3;

type SourceCardProps = {
	/** The new deals of the period per source, largest first. One entry per source, also at 0. */
	sources: BreakdownSlice<DealSource>[];
};

/** The legend names each slice and its count, so the color is never the only mark. */
export function SourceCard({ sources }: SourceCardProps) {
	const { t, locale } = useT();
	const number = new Intl.NumberFormat(locale);
	const total = sources.reduce((sum, source) => sum + source.value, 0);
	const otherCount = sources
		.slice(SHOWN_SOURCES)
		.reduce((sum, source) => sum + source.value, 0);
	const slices: SourceSlice[] = [
		...sources.slice(0, SHOWN_SOURCES).map((source, index) => ({
			key: source.label,
			label: t(`deals.sources.${source.label}`),
			value: source.value,
			// The chart series 1 to 3 color the largest sources, series 4 colors "Other".
			color: `var(--chart-${index + 1})`,
		})),
		{
			key: "other",
			label: t("dashboard.otherSources"),
			value: otherCount,
			color: `var(--chart-${SHOWN_SOURCES + 1})`,
		},
	];

	return (
		<Card>
			<CardHeader>
				<CardTitle>{t("dashboard.sourcesTitle")}</CardTitle>
				<CardDescription>{t("dashboard.sourcesDescription")}</CardDescription>
				<CardAction>
					<Button
						type="button"
						variant="outline"
						size="sm"
						onClick={() =>
							downloadCsv(
								"deal-sources.csv",
								toCsv(
									sources.map((source) => ({ id: source.label, ...source })),
									[
										{
											header: t("deals.source"),
											value: (row) => t(`deals.sources.${row.label}`),
										},
										{
											header: t("dashboard.newDeals"),
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
					<SourceDonut slices={slices} total={total} />
				</Suspense>
				<ul className="flex justify-around gap-2">
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
								{number.format(slice.value)}
							</span>
						</li>
					))}
				</ul>
			</CardContent>
		</Card>
	);
}
