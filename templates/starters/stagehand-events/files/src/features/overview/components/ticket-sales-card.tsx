// The ticket sales card of the home: series tabs, a CSV download, a box with the two period totals,
// the change, and the daily plot. OverviewPage renders it on 2 of 3 columns beside the ticket type card.
// It follows the kit "campaign overview" card and recipe 3.2 (area chart card with tabs and a totals box).
import { DownloadSimpleIcon } from "@phosphor-icons/react";
import { lazy, Suspense, useState } from "react";
import {
	ChangeLine,
	type CsvColumn,
	downloadCsv,
	fillMessage,
	moneyFormat,
	toCsv,
} from "~/features/organiser";
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
import { Tabs, TabsList, TabsTrigger } from "~/shared/ui/tabs";
import type { SalesDay } from "../lib/overview-math";
import { changeRatio } from "../lib/series";
import { dayCountFormat } from "./period-select";

// The chart library loads with the card, not with the first script of the app.
const TicketSalesChart = lazy(() =>
	import("./ticket-sales-chart").then((module) => ({
		default: module.TicketSalesChart,
	})),
);

/** The two series of the tabs. */
type Series = "tickets" | "revenue";

function isSeries(value: string): value is Series {
	return value === "tickets" || value === "revenue";
}

type TicketSalesCardProps = {
	/** One row per full day of the period, oldest first, from the home summary. */
	daily: SalesDay[];
	/** The period of the page, in days. */
	days: number;
};

/** The tab changes the series of the plot and of the totals. The download holds both series. */
export function TicketSalesCard({ daily, days }: TicketSalesCardProps) {
	const { t, locale } = useT();
	const [series, setSeries] = useState<Series>("tickets");
	const number = new Intl.NumberFormat(locale);
	const money = moneyFormat(locale);
	const format = (value: number) =>
		series === "revenue" ? money.format(value) : number.format(value);
	const points = daily.map((row) => ({
		day: row.day,
		current: series === "revenue" ? row.revenue : row.tickets,
		previous: series === "revenue" ? row.previousRevenue : row.previousTickets,
	}));
	const total = points.reduce((sum, point) => sum + point.current, 0);
	const previousTotal = points.reduce((sum, point) => sum + point.previous, 0);
	const last = points.at(-1);
	const period = dayCountFormat(locale).format(days);
	const csvColumns: CsvColumn<SalesDay & { id: string }>[] = [
		{ header: t("overview.day"), value: (row) => row.day },
		{ header: t("overview.tickets"), value: (row) => String(row.tickets) },
		{ header: t("overview.revenue"), value: (row) => String(row.revenue) },
	];

	return (
		<Card className="@4xl/main:col-span-2">
			<CardHeader>
				<CardTitle>{t("overview.ticketSales")}</CardTitle>
				<CardDescription>{t("overview.ticketSalesHint")}</CardDescription>
				<CardAction className="flex items-center gap-2">
					<Tabs
						value={series}
						onValueChange={(value) => {
							if (isSeries(value)) {
								setSeries(value);
							}
						}}
					>
						<TabsList>
							<TabsTrigger value="tickets">{t("overview.tickets")}</TabsTrigger>
							<TabsTrigger value="revenue">{t("overview.revenue")}</TabsTrigger>
						</TabsList>
					</Tabs>
					<Button
						type="button"
						variant="outline"
						size="icon"
						aria-label={t("common.exportCsv")}
						onClick={() =>
							downloadCsv(
								`ticket-sales-${days}-days.csv`,
								toCsv(
									daily.map((row) => ({ ...row, id: row.day })),
									csvColumns,
								),
							)
						}
					>
						<DownloadSimpleIcon />
					</Button>
				</CardAction>
			</CardHeader>
			<CardContent className="grid gap-4">
				<div className="grid @xl/main:grid-cols-2 items-end gap-4">
					<div className="grid grid-cols-2 divide-x rounded-md border rtl:divide-x-reverse">
						<div className="grid gap-1 p-4">
							<p className="text-muted-foreground text-sm">
								{t("overview.thisPeriod")}
							</p>
							<p className="font-numeric font-semibold text-xl tabular-nums">
								{format(total)}
							</p>
						</div>
						<div className="grid gap-1 p-4">
							<p className="text-muted-foreground text-sm">
								{t("overview.periodBefore")}
							</p>
							<p className="font-numeric font-semibold text-xl tabular-nums">
								{format(previousTotal)}
							</p>
						</div>
					</div>
					<div className="grid @xl/main:justify-items-end gap-1">
						<p className="font-medium">{t("overview.performance")}</p>
						<p className="text-muted-foreground text-sm">
							<ChangeLine
								change={changeRatio(total, previousTotal)}
								goodWhen="up"
							/>
							{previousTotal === 0
								? null
								: ` ${fillMessage(t("overview.vsBefore"), { period })}`}
						</p>
					</div>
				</div>
				<Suspense fallback={<Skeleton className="h-56 w-full" />}>
					<TicketSalesChart
						points={points}
						series={series}
						label={fillMessage(t("overview.salesChartLabel"), {
							day: last?.day ?? "",
							value: format(last?.current ?? 0),
						})}
					/>
				</Suspense>
			</CardContent>
		</Card>
	);
}
