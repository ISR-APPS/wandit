// The occupancy card of the home: a week Select and a CSV button in the head, a box with the booked and the
// available room nights, the occupancy rate against the week before, and a line chart of the 7 nights.
// FrontDeskPage renders it beside the reservations card, over two of the three columns.
// The week goes into the query key. The chart file loads with React.lazy.
import { CalendarBlankIcon, DownloadSimpleIcon } from "@phosphor-icons/react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { lazy, Suspense, useState } from "react";
import { dayToDate, downloadCsv, fillMessage, toCsv } from "~/features/hotel";
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import { Button } from "~/shared/ui/button";
import {
	Card,
	CardAction,
	CardContent,
	CardHeader,
	CardTitle,
} from "~/shared/ui/card";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "~/shared/ui/select";
import { Skeleton } from "~/shared/ui/skeleton";
import { occupancyQueryOptions } from "../api/front-desk.queries";
import {
	OCCUPANCY_WEEKS,
	type Occupancy,
	type OccupancyWeek,
} from "../lib/home-figures";

// The chart file holds the chart library. A lazy import keeps it out of the first script of the app.
const OccupancyChart = lazy(() =>
	import("./occupancy-chart").then((module) => ({
		default: module.OccupancyChart,
	})),
);

/** The message key of each week choice. */
const WEEK_LABEL = {
	"-1": "frontDesk.occupancy.weeks.last",
	"0": "frontDesk.occupancy.weeks.this",
	"1": "frontDesk.occupancy.weeks.next",
} as const satisfies Record<`${OccupancyWeek}`, string>;

type OccupancyCardProps = {
	/** Extra classes from the page grid, for example the column span. */
	className?: string;
};

/** The loader prefetches this week. Another week keeps the last figures on screen while it loads. */
export function OccupancyCard({ className }: OccupancyCardProps) {
	const { t, locale } = useT();
	const [week, setWeek] = useState<OccupancyWeek>(0);
	const occupancy = useQuery({
		...occupancyQueryOptions(week),
		placeholderData: keepPreviousData,
	});

	return (
		<Card className={className}>
			<CardHeader>
				<CardTitle>{t("frontDesk.occupancy.title")}</CardTitle>
				<CardAction className="flex gap-2">
					<Select
						value={String(week)}
						onValueChange={(value) =>
							setWeek(
								OCCUPANCY_WEEKS.find((option) => String(option) === value) ?? 0,
							)
						}
					>
						<SelectTrigger aria-label={t("frontDesk.occupancy.week")}>
							<CalendarBlankIcon />
							<span className="hidden lg:flex">
								<SelectValue />
							</span>
						</SelectTrigger>
						<SelectContent align="end">
							{OCCUPANCY_WEEKS.map((option) => (
								<SelectItem key={option} value={String(option)}>
									{t(WEEK_LABEL[`${option}`])}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
					<Button
						type="button"
						variant="outline"
						size="icon"
						aria-label={t("frontDesk.occupancy.export")}
						disabled={!occupancy.data}
						onClick={() => {
							if (occupancy.data) {
								downloadOccupancy(occupancy.data, t, locale);
							}
						}}
					>
						<DownloadSimpleIcon />
					</Button>
				</CardAction>
			</CardHeader>
			<CardContent>
				{occupancy.isError ? (
					<p role="alert" className="text-muted-foreground text-sm">
						{t("frontDesk.loadError")}
					</p>
				) : occupancy.data ? (
					<OccupancyBody occupancy={occupancy.data} />
				) : (
					<Skeleton className="h-72" />
				)}
			</CardContent>
		</Card>
	);
}

type OccupancyBodyProps = {
	/** The figures of the chosen week. */
	occupancy: Occupancy;
};

/** The totals box, the rate line, and the chart. */
function OccupancyBody({ occupancy }: OccupancyBodyProps) {
	const { t, locale } = useT();
	const number = new Intl.NumberFormat(locale);
	const percent = new Intl.NumberFormat(locale, {
		style: "percent",
		maximumFractionDigits: 0,
	});
	const points = new Intl.NumberFormat(locale, {
		maximumFractionDigits: 0,
		signDisplay: "exceptZero",
	});
	// The change is in percentage points: 0.78 against 0.72 is +6 points.
	const change =
		occupancy.rate === null || occupancy.previousRate === null
			? null
			: Math.round((occupancy.rate - occupancy.previousRate) * 100);
	const label = fillMessage(t("frontDesk.occupancy.label"), {
		booked: number.format(occupancy.booked),
		available: number.format(occupancy.available),
	});

	return (
		<div className="grid gap-4">
			<div className="grid @3xl/main:grid-cols-2 items-end @3xl/main:gap-6 gap-4">
				<div className="@3xl/main:order-1 order-2 grid grid-cols-2 divide-x rounded-md border rtl:divide-x-reverse">
					<div className="grid gap-1 p-4">
						<p className="text-muted-foreground text-sm">
							{t("frontDesk.occupancy.booked")}
						</p>
						<p className="font-numeric font-semibold text-2xl tabular-nums">
							{number.format(occupancy.booked)}
						</p>
					</div>
					<div className="grid gap-1 p-4">
						<p className="text-muted-foreground text-sm">
							{t("frontDesk.occupancy.available")}
						</p>
						<p className="font-numeric font-semibold text-2xl tabular-nums">
							{number.format(occupancy.available)}
						</p>
					</div>
				</div>
				<div className="@3xl/main:order-2 order-1 grid gap-1 @3xl/main:text-end">
					<p>
						{t("frontDesk.occupancy.rate")}{" "}
						<span className="font-numeric font-semibold tabular-nums">
							{occupancy.rate === null ? "" : percent.format(occupancy.rate)}
						</span>
					</p>
					<p className="text-sm">
						{change === null ? (
							<span className="text-muted-foreground">
								{t("frontDesk.kpi.noEarlierData")}
							</span>
						) : (
							<>
								{/* More sold rooms is good news. */}
								<bdi
									dir="ltr"
									className={cn(
										"font-medium",
										change >= 0 ? "text-success" : "text-destructive",
									)}
								>
									{fillMessage(t("frontDesk.occupancy.points"), {
										count: points.format(change),
									})}
								</bdi>{" "}
								<span className="text-muted-foreground">
									{t("frontDesk.occupancy.vsPrevious")}
								</span>
							</>
						)}
					</p>
				</div>
			</div>
			<Suspense fallback={<Skeleton className="h-52" />}>
				<OccupancyChart points={occupancy.points} label={label} />
			</Suspense>
		</div>
	);
}

/** Downloads the 7 nights of the week as CSV. It runs in the click handler. */
function downloadOccupancy(
	occupancy: Occupancy,
	t: ReturnType<typeof useT>["t"],
	locale: string,
) {
	const date = new Intl.DateTimeFormat(locale, { dateStyle: "medium" });
	downloadCsv(
		"occupancy.csv",
		toCsv(
			occupancy.points.map((point) => ({ id: point.day, ...point })),
			[
				{
					header: t("frontDesk.occupancy.night"),
					value: (row) => date.format(dayToDate(row.day)),
				},
				{
					header: t("frontDesk.occupancy.booked"),
					value: (row) => String(row.booked),
				},
				{
					header: t("frontDesk.occupancy.available"),
					value: (row) => String(row.available),
				},
			],
		),
	);
}
