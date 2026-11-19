// The two chart cards of the second band of the day report, as the kit revenue and returning-rate cards.
// HourSalesCard: kitchen and bar bars per hour with a totals box. HourGuestsCard: covers and checks lines with Export.
// ReportPage renders them side by side. The charts load with React.lazy from report-charts.tsx.
import { ExportIcon } from "@phosphor-icons/react";
import { lazy, Suspense } from "react";
import {
	changeFormat,
	downloadCsv,
	formatCents,
	isGoodChange,
	toCsv,
	wholeMoneyFormat,
} from "~/features/restaurant";
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import { Badge } from "~/shared/ui/badge";
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
import type { HourPoint } from "../lib/day-report";

// The chart file holds the chart library. A lazy import keeps it out of the first script of the app.
const HourBars = lazy(() =>
	import("./report-charts").then((module) => ({ default: module.HourBars })),
);
const HourLines = lazy(() =>
	import("./report-charts").then((module) => ({ default: module.HourLines })),
);

type HourSalesCardProps = {
	/** One point per clock hour, oldest first. */
	hours: HourPoint[];
};

/** The totals box sits in the top end corner from the @3xl/main width, as in the kit revenue card. */
export function HourSalesCard({ hours }: HourSalesCardProps) {
	const { t, locale } = useT();
	const wholeMoney = wholeMoneyFormat(locale);
	const totals = [
		{
			id: "kitchen",
			value: formatCents(
				wholeMoney,
				hours.reduce((sum, point) => sum + point.kitchenCents, 0),
			),
		},
		{
			id: "bar",
			value: formatCents(
				wholeMoney,
				hours.reduce((sum, point) => sum + point.barCents, 0),
			),
		},
	] as const;

	return (
		<Card className="relative h-full">
			<CardHeader>
				<CardTitle>{t("report.salesByHour")}</CardTitle>
				{/* Column 1 always: below @3xl the action moves to row 3, and the grid would put this line beside the title. */}
				<CardDescription className="col-start-1">
					{t("report.salesByHourDescription")}
				</CardDescription>
				<CardAction className="@3xl/main:col-start-2 col-start-1 @3xl/main:row-start-1 row-start-3 justify-self-start @3xl/main:justify-self-end">
					<dl className="@3xl/main:absolute @3xl/main:end-6 @3xl/main:top-6 @3xl/main:mt-0 mt-2 flex gap-8 rounded-md border p-4">
						{totals.map((total) => (
							<div key={total.id} className="flex flex-col gap-2">
								<dt className="text-muted-foreground text-xs">
									{t(`stations.${total.id}`)}
								</dt>
								<dd className="font-numeric @xl/main:text-2xl text-lg tabular-nums leading-none">
									{total.value}
								</dd>
							</div>
						))}
					</dl>
				</CardAction>
			</CardHeader>
			<CardContent>
				<div className="@3xl/main:mt-10">
					<Suspense fallback={<Skeleton className="aspect-21/9 w-full" />}>
						<HourBars
							hours={hours}
							label={`${t("report.salesByHour")}: ${totals
								.map((total) => `${t(`stations.${total.id}`)} ${total.value}`)
								.join(", ")}`}
						/>
					</Suspense>
				</div>
			</CardContent>
		</Card>
	);
}

type HourGuestsCardProps = {
	hours: HourPoint[];
	/** Covers of the day so far. */
	covers: number;
	/** Covers against the same weekday last week at this time, as a ratio. null hides the badge. */
	coversChange: number | null;
};

/** The header shows the covers of the day with its delta badge. Export downloads the hours as CSV. */
export function HourGuestsCard({
	hours,
	covers,
	coversChange,
}: HourGuestsCardProps) {
	const { t, locale } = useT();
	const number = new Intl.NumberFormat(locale);
	const hourFormat = new Intl.DateTimeFormat(locale, {
		hour: "numeric",
		minute: "2-digit",
	});

	function exportHours() {
		downloadCsv(
			"hours-today.csv",
			toCsv(
				hours.map((point) => ({ id: point.hourStart, ...point })),
				[
					{
						header: t("report.hour"),
						value: (row) => hourFormat.format(new Date(row.hourStart)),
					},
					// A plain number with a dot, so every spreadsheet reads it as a number. Cents become euros here.
					{
						header: t("stations.kitchen"),
						value: (row) => (row.kitchenCents / 100).toFixed(2),
					},
					{
						header: t("stations.bar"),
						value: (row) => (row.barCents / 100).toFixed(2),
					},
					{ header: t("report.checks"), value: (row) => String(row.checks) },
					{ header: t("report.covers"), value: (row) => String(row.covers) },
				],
			),
		);
	}

	return (
		<Card className="h-full">
			<CardHeader>
				<CardDescription>{t("report.coversByHour")}</CardDescription>
				<CardAction>
					<Button
						type="button"
						variant="outline"
						aria-label={t("common.export")}
						onClick={exportHours}
					>
						<ExportIcon />
						<span className="hidden lg:inline">{t("common.export")}</span>
					</Button>
				</CardAction>
				<div className="flex items-center gap-2">
					<span className="font-numeric text-2xl tabular-nums">
						{number.format(covers)}
					</span>
					{coversChange === null ? null : (
						<Badge
							variant="outline"
							className={cn(
								isGoodChange(coversChange, "up")
									? "text-success"
									: "text-destructive",
							)}
						>
							{/* dir="ltr" keeps "+3.6%" in this order in an Arabic page. */}
							<bdi dir="ltr">{changeFormat(locale).format(coversChange)}</bdi>
						</Badge>
					)}
				</div>
			</CardHeader>
			<CardContent>
				<Suspense fallback={<Skeleton className="aspect-21/9 w-full" />}>
					<HourLines
						hours={hours}
						label={`${t("report.coversByHour")}: ${number.format(covers)}`}
					/>
				</Suspense>
			</CardContent>
		</Card>
	);
}
