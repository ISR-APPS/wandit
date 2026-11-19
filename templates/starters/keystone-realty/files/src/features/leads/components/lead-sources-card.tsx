// The source card of the leads page, in a donut layout: an export button,
// a donut with the total, and a 2 x 2 legend of 4 parts. LeadsPage renders it with the summary of the period.
// The donut file loads with React.lazy. The export writes one CSV line per part.
import { DownloadSimpleIcon } from "@phosphor-icons/react";
import { lazy, Suspense } from "react";
import { downloadCsv, toCsv } from "~/features/agency";
import { useT } from "~/shared/i18n";
import { Button } from "~/shared/ui/button";
import {
	Card,
	CardAction,
	CardContent,
	CardHeader,
	CardTitle,
} from "~/shared/ui/card";
import type { DonutSlice } from "~/shared/ui/donut-chart";
import { Skeleton } from "~/shared/ui/skeleton";
import type { SourceSlice } from "../lib/lead-stats";

// The chart file holds the chart library. A lazy import keeps it out of the first script of the app.
const DonutChart = lazy(() =>
	import("~/shared/ui/donut-chart").then((module) => ({
		default: module.DonutChart,
	})),
);

type LeadSourcesCardProps = {
	/** The 3 largest sources of the period and "other". */
	sources: SourceSlice[];
	/** The period in days, for the name of the CSV file. */
	days: number;
};

/** The legend names each part and its count, so the color is never the only mark. */
export function LeadSourcesCard({ sources, days }: LeadSourcesCardProps) {
	const { t, locale } = useT();
	const number = new Intl.NumberFormat(locale);
	const slices: DonutSlice[] = sources.map((part, index) => ({
		key: part.source,
		label:
			part.source === "other"
				? t("leads.sources.other")
				: t(`agency.leadSources.${part.source}`),
		value: part.value,
		// The chart series 1 to 4 color the parts, largest first.
		color: `var(--chart-${index + 1})`,
	}));
	const total = slices.reduce((sum, slice) => sum + slice.value, 0);

	return (
		<Card>
			<CardHeader>
				<CardTitle>{t("leads.sources.title")}</CardTitle>
				<CardAction>
					<Button
						type="button"
						variant="outline"
						size="sm"
						onClick={() =>
							downloadCsv(
								`lead-sources-${days}-days.csv`,
								toCsv(
									slices.map((slice) => ({ ...slice, id: slice.key })),
									[
										{
											header: t("leads.source"),
											value: (slice) => slice.label,
										},
										{
											header: t("leads.sources.caption"),
											value: (slice) => String(slice.value),
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
			<CardContent className="grid content-between gap-8">
				<Suspense
					fallback={<Skeleton className="mx-auto size-48 rounded-full" />}
				>
					<DonutChart
						slices={slices}
						total={total}
						caption={t("leads.sources.caption")}
						title={t("leads.sources.title")}
					/>
				</Suspense>
				<ul className="grid grid-cols-2 gap-4">
					{slices.map((slice) => (
						<li
							key={slice.key}
							className="grid min-w-0 justify-items-center gap-1"
						>
							<span className="flex max-w-full items-center gap-1.5 text-muted-foreground text-xs">
								<span
									aria-hidden="true"
									className="size-2 shrink-0 rounded-full"
									style={{ backgroundColor: slice.color }}
								/>
								<span className="truncate">{slice.label}</span>
							</span>
							<span className="font-numeric font-semibold text-xl tabular-nums">
								{number.format(slice.value)}
							</span>
						</li>
					))}
				</ul>
			</CardContent>
		</Card>
	);
}
