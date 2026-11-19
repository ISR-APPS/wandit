// The wide report card of the home: conversions of the last 7 days as bars, and the 3 channels with the most spend.
// OverviewPage renders it beside the content readiness card. The Export menu downloads the two lists as CSV.
// The bars load with React.lazy. The card reads weekReportQueryOptions, which the home loader prefetches.
import { DownloadSimpleIcon } from "@phosphor-icons/react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { lazy, Suspense } from "react";
import {
	CHANNEL_ICON,
	DeltaBadge,
	downloadCsv,
	moneyFormat,
	toCsv,
} from "~/features/marketing";
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
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "~/shared/ui/dropdown-menu";
import { Progress } from "~/shared/ui/progress";
import { Skeleton } from "~/shared/ui/skeleton";
import { weekReportQueryOptions } from "../api/overview.queries";

const ConversionsWeekBars = lazy(() =>
	import("./conversions-week-bars").then((module) => ({
		default: module.ConversionsWeekBars,
	})),
);

/** Left: the total, its delta, and the bars. Right: one boxed row per channel with its share of the spend. */
export function ConversionsReportCard() {
	const { t, locale } = useT();
	const { data: report } = useSuspenseQuery(weekReportQueryOptions());
	const number = new Intl.NumberFormat(locale);
	const money = moneyFormat(locale, "cents");
	const percent = new Intl.NumberFormat(locale, { style: "percent" });

	function exportDays() {
		downloadCsv(
			"conversions-last-7-days.csv",
			toCsv(
				report.days.map((day) => ({ id: day.day, ...day })),
				[
					{ header: t("overview.csvDay"), value: (row) => row.day },
					{
						header: t("metrics.conversions"),
						value: (row) => String(row.conversions),
					},
				],
			),
		);
	}

	function exportChannels() {
		downloadCsv(
			"spend-by-channel-last-7-days.csv",
			toCsv(
				report.channels.map((row) => ({ id: row.channel, ...row })),
				[
					{
						header: t("overview.csvChannel"),
						value: (row) => t(`channels.${row.channel}`),
					},
					{ header: t("metrics.spend"), value: (row) => row.spend.toFixed(2) },
					{
						header: t("overview.csvShare"),
						value: (row) => row.share.toFixed(4),
					},
				],
			),
		);
	}

	return (
		<Card className="@container/report h-full">
			<CardHeader>
				<CardTitle>{t("overview.reportTitle")}</CardTitle>
				<CardDescription>{t("overview.lastSevenDays")}</CardDescription>
				<CardAction>
					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<Button variant="outline" aria-label={t("common.export")}>
								<DownloadSimpleIcon />
								<span className="hidden lg:inline">{t("common.export")}</span>
							</Button>
						</DropdownMenuTrigger>
						<DropdownMenuContent align="end">
							<DropdownMenuItem onSelect={exportDays}>
								{t("overview.exportDays")}
							</DropdownMenuItem>
							<DropdownMenuItem onSelect={exportChannels}>
								{t("overview.exportChannels")}
							</DropdownMenuItem>
						</DropdownMenuContent>
					</DropdownMenu>
				</CardAction>
			</CardHeader>
			<CardContent className="grid @xl/report:grid-cols-2 gap-4">
				<div className="grid content-start gap-4">
					<div className="flex items-center gap-2">
						<p className="font-numeric font-semibold @4xl/main:text-3xl text-2xl tabular-nums">
							{number.format(report.conversions)}
						</p>
						<DeltaBadge
							change={report.change}
							goodWhen="up"
							srLabel={t("overview.vsWeekBefore")}
						/>
					</div>
					<Suspense fallback={<Skeleton className="h-60 w-full" />}>
						<ConversionsWeekBars days={report.days} />
					</Suspense>
				</div>
				<ul className="grid content-start gap-4">
					{report.channels.map((row) => {
						const Icon = CHANNEL_ICON[row.channel];
						return (
							<li
								key={row.channel}
								className="grid gap-4 rounded-md border bg-muted p-4"
							>
								<div className="flex items-center justify-between gap-4">
									<div className="flex min-w-0 items-center gap-4">
										<span className="flex size-8 shrink-0 items-center justify-center rounded-md border bg-background">
											<Icon className="size-4" />
										</span>
										<span className="truncate">
											{t(`channels.${row.channel}`)}
										</span>
									</div>
									<span className="font-semibold tabular-nums">
										{money.format(row.spend)}
									</span>
								</div>
								<Progress
									value={row.share * 100}
									className="h-1"
									aria-label={`${t(`channels.${row.channel}`)}: ${percent.format(row.share)} ${t("overview.ofSpend")}`}
								/>
							</li>
						);
					})}
				</ul>
			</CardContent>
		</Card>
	);
}
