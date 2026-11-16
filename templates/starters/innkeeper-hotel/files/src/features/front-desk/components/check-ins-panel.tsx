// The check-ins panel of the home: the 2 KPI meters, the heat calendar of check-ins per day with its facts,
// and the check-ins per booking channel.
// FrontDeskPage renders it in the bottom row. The period control changes only the query key of this panel.
import { TrendDownIcon, TrendUpIcon } from "@phosphor-icons/react";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { fillMessage } from "~/features/hotel";
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
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "~/shared/ui/select";
import { Separator } from "~/shared/ui/separator";
import { Skeleton } from "~/shared/ui/skeleton";
import { dailyCheckInsQueryOptions } from "../api/front-desk.queries";
import {
	type ChannelSlice,
	changeRatio,
	type DailyPoint,
	type KpiItem,
	PERIOD_DAYS,
} from "../lib/series";
import {
	HeatCalendar,
	HeatLegend,
	HeatSquare,
	HeatStrip,
	utcDate,
} from "./check-ins-heat";
import { KpiMeters, KpiMetersSkeleton } from "./kpi-meters";

/** The period of the first load. 90 days fill the calendar: 14 week columns. The route loader prefetches it. */
export const DEFAULT_DAYS = 90;
// A period under 30 days draws the strip: a week fills only one calendar column.
const CALENDAR_MIN_DAYS = 30;
// A change under 0.05 % shows "0%" with no arrow: one decimal rounds it to zero.
const FLAT_CHANGE = 0.0005;

type CheckInsPanelProps = {
	/** The 2 figures at the top of the content, from frontDeskKpisQueryOptions. */
	kpis: KpiItem[];
	/** The check-ins per booking channel, the largest first, from checkInsByChannelQueryOptions. */
	channels: ChannelSlice[];
};

/** A Card. It holds the period state, so a new period refetches only the calendar. */
export function CheckInsPanel({ kpis, channels }: CheckInsPanelProps) {
	const { t, locale } = useT();
	const [days, setDays] = useState<number>(DEFAULT_DAYS);
	const series = useQuery(dailyCheckInsQueryOptions(days));
	const dayUnit = new Intl.NumberFormat(locale, {
		style: "unit",
		unit: "day",
		unitDisplay: "long",
	});

	return (
		<Card className="@4xl/main:col-span-2">
			<CardHeader>
				<CardTitle>{t("chart.title")}</CardTitle>
				<CardDescription>{t("chart.description")}</CardDescription>
				<CardAction>
					<Select
						value={String(days)}
						onValueChange={(value) =>
							setDays(
								PERIOD_DAYS.find((option) => String(option) === value) ??
									DEFAULT_DAYS,
							)
						}
					>
						<SelectTrigger className="w-32" aria-label={t("chart.period")}>
							<SelectValue />
						</SelectTrigger>
						<SelectContent align="end">
							{PERIOD_DAYS.map((option) => (
								<SelectItem key={option} value={String(option)}>
									{dayUnit.format(option)}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</CardAction>
			</CardHeader>
			{/* The rail beside this panel changes its height during the day. content-between spreads the spare height between the parts. */}
			<CardContent className="grid flex-1 content-between gap-6">
				<KpiMeters items={kpis} className="@xl/main:grid-cols-2" />
				<Separator />
				{series.isPending ? (
					<Skeleton className="h-36 w-full" />
				) : series.isError ? (
					<div className="grid justify-items-start gap-3">
						<p role="alert" className="text-sm">
							{t("chart.loadError")}
						</p>
						<Button
							type="button"
							variant="outline"
							size="sm"
							onClick={() => series.refetch()}
						>
							{t("common.retry")}
						</Button>
					</div>
				) : (
					<CheckInsTrend points={series.data} days={days} />
				)}
				<Separator />
				<ChannelBreakdown slices={channels} />
			</CardContent>
		</Card>
	);
}

type CheckInsTrendProps = {
	/** One point per day of the period, oldest first. */
	points: DailyPoint[];
	/** The length of the period, in days. */
	days: number;
};

/** The calendar or the strip, with the total, the busiest day, and the daily average beside it. */
function CheckInsTrend({ points, days }: CheckInsTrendProps) {
	const { t, locale } = useT();
	const number = new Intl.NumberFormat(locale);
	// One decimal, also for a whole number: "4.0" reads as an average.
	const average = new Intl.NumberFormat(locale, {
		minimumFractionDigits: 1,
		maximumFractionDigits: 1,
	});
	const delta = new Intl.NumberFormat(locale, {
		style: "percent",
		maximumFractionDigits: 1,
		signDisplay: "exceptZero",
	});
	const longDate = new Intl.DateTimeFormat(locale, {
		weekday: "short",
		day: "numeric",
		month: "short",
		timeZone: "UTC",
	});
	const total = points.reduce((sum, point) => sum + point.current, 0);
	const previousTotal = points.reduce((sum, point) => sum + point.previous, 0);
	const change = changeRatio(total, previousTotal);
	const isFlat = change !== null && Math.abs(change) < FLAT_CHANGE;
	const busiest = points.reduce<DailyPoint | undefined>(
		(best, point) => (point.current > (best?.current ?? 0) ? point : best),
		undefined,
	);
	const cellTitle = (point: DailyPoint) =>
		`${longDate.format(utcDate(point.day))}: ${number.format(point.current)}`;
	const label = fillMessage(t("chart.label"), {
		days,
		total: number.format(total),
		busiest: busiest ? cellTitle(busiest) : t("chart.noBusiestDay"),
	});

	return (
		<div className="grid @2xl/main:grid-cols-[auto_minmax(0,1fr)] items-start @2xl/main:gap-10 gap-6">
			<div className="grid min-w-0 gap-3">
				{days < CALENDAR_MIN_DAYS ? (
					<HeatStrip points={points} label={label} cellTitle={cellTitle} />
				) : (
					<HeatCalendar points={points} label={label} cellTitle={cellTitle} />
				)}
				<HeatLegend />
				{total === 0 ? (
					<p className="text-muted-foreground text-sm">{t("chart.empty")}</p>
				) : null}
			</div>
			<dl className="grid content-start text-sm">
				<div className="flex items-center justify-between gap-3 border-b pb-3">
					<dt className="text-muted-foreground">{t("chart.total")}</dt>
					<dd className="flex flex-wrap items-center justify-end gap-2">
						{change !== null ? (
							<Badge
								variant={
									isFlat ? "secondary" : change > 0 ? "success" : "outline"
								}
								className={cn(
									!isFlat &&
										change < 0 &&
										"border-destructive/25 bg-destructive/10 text-destructive",
								)}
							>
								{/* A trend arrow mirrors in Arabic. A rotation would turn a rise into a fall. */}
								{isFlat ? null : change > 0 ? (
									<TrendUpIcon className="rtl:-scale-x-100" />
								) : (
									<TrendDownIcon className="rtl:-scale-x-100" />
								)}
								<bdi dir="ltr" className="tabular-nums">
									{delta.format(isFlat ? 0 : change)}
								</bdi>
								<span className="sr-only">
									{fillMessage(t("chart.vsPrevious"), { days })}
								</span>
							</Badge>
						) : null}
						<span className="font-numeric text-2xl tabular-nums leading-none">
							{number.format(total)}
						</span>
					</dd>
				</div>
				<div className="flex items-center justify-between gap-3 border-b py-3">
					<dt className="text-muted-foreground">{t("chart.dailyAverage")}</dt>
					<dd className="font-numeric text-2xl tabular-nums leading-none">
						{average.format(points.length > 0 ? total / points.length : 0)}
					</dd>
				</div>
				{busiest ? (
					<div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 pt-3">
						<dt className="text-muted-foreground">{t("chart.busiestDay")}</dt>
						<dd className="text-end">
							<span className="font-medium">
								{longDate.format(utcDate(busiest.day))}
							</span>
							<span className="text-muted-foreground tabular-nums">
								{` · ${fillMessage(t("chart.checkIns"), { count: number.format(busiest.current) })}`}
							</span>
						</dd>
					</div>
				) : null}
			</dl>
		</div>
	);
}

type ChannelBreakdownProps = {
	/** One slice per booking channel, the largest first. */
	slices: ChannelSlice[];
};

/** The breakdown part of the heat form: a ranked list with a step square, the channel, its count, and its share. */
function ChannelBreakdown({ slices }: ChannelBreakdownProps) {
	const { t, locale } = useT();
	const number = new Intl.NumberFormat(locale);
	const share = new Intl.NumberFormat(locale, {
		style: "percent",
		maximumFractionDigits: 0,
	});
	const total = slices.reduce((sum, slice) => sum + slice.value, 0);
	const max = Math.max(0, ...slices.map((slice) => slice.value));

	return (
		<div className="grid gap-3">
			<div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
				<h3 className="font-medium font-sans text-sm">
					{t("chart.byChannel")}
				</h3>
				<p className="text-muted-foreground text-xs">
					{t("chart.byChannelPeriod")}
				</p>
			</div>
			{total === 0 ? (
				<p className="text-muted-foreground text-sm">{t("chart.empty")}</p>
			) : (
				<ol className="grid @2xl/main:grid-cols-2 gap-x-10 gap-y-2 text-sm">
					{slices.map((slice) => (
						<li key={slice.channel} className="flex items-center gap-2">
							<HeatSquare value={slice.value} max={max} />
							<span className="min-w-0 flex-1 truncate">
								{t(`channels.${slice.channel}`)}
							</span>
							<span className="text-muted-foreground text-xs tabular-nums">
								<bdi dir="ltr">{share.format(slice.value / total)}</bdi>
							</span>
							<span className="w-8 text-end font-medium tabular-nums">
								{number.format(slice.value)}
							</span>
						</li>
					))}
				</ol>
			)}
		</div>
	);
}

/** Placeholder of the panel while the home loader runs: the header, the 2 figures, and the calendar. */
export function CheckInsPanelSkeleton() {
	return (
		<Card className="@4xl/main:col-span-2">
			<CardHeader>
				<Skeleton className="h-5 w-40" />
				<Skeleton className="h-4 w-56" />
			</CardHeader>
			<CardContent className="grid gap-6">
				<KpiMetersSkeleton count={2} className="@xl/main:grid-cols-2" />
				<Skeleton className="h-36 w-full" />
				<Skeleton className="h-16 w-full" />
			</CardContent>
		</Card>
	);
}
