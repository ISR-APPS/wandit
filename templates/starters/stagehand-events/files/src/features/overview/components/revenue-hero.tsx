// The hero of the home: the ticket revenue of the period at the largest size, its change, and a large sparkline.
// OverviewPage renders it with the points of dailyRevenueQueryOptions(days) and the period control.
// The figure is the sum of the points, so the figure, the delta, and the chart always show the same days.
import { useId } from "react";
import { Area, AreaChart, ReferenceDot, XAxis, YAxis } from "recharts";
import {
	BOX_OFFICE_CURRENCY,
	countLabel,
	fillMessage,
	moneyFormat,
} from "~/features/organiser";
import { useT } from "~/shared/i18n";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "~/shared/ui/card";
import {
	type ChartConfig,
	ChartContainer,
	ChartTooltip,
	ChartTooltipContent,
} from "~/shared/ui/chart";
import { Skeleton } from "~/shared/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "~/shared/ui/tabs";
import {
	changeRatio,
	type DailyPoint,
	PERIOD_DAYS,
	type PeriodDays,
} from "../lib/series";
import { KpiDelta } from "./kpi-delta";

type RevenueHeroProps = {
	/** One point per day of the period, oldest first. */
	points: DailyPoint[];
	/** The period of the points, in days. */
	days: PeriodDays;
	/** Sets the period of OverviewPage. Only the hero query refetches. */
	onDaysChange: (days: PeriodDays) => void;
	/** The sales of today until now. Today is not a point: its open total would read as a drop. */
	today: { revenue: number; orders: number };
};

/** From 56rem the figure sits at the start and the chart fills the end. Below, the chart goes under the figure. */
export function RevenueHero({
	points,
	days,
	onDaysChange,
	today,
}: RevenueHeroProps) {
	const { t, locale, dir } = useT();
	const config = {
		current: { label: t("overview.revenue"), color: "var(--chart-1)" },
	} satisfies ChartConfig;
	const fillId = useId();
	const money = moneyFormat(locale);
	const dayCount = new Intl.NumberFormat(locale, {
		style: "unit",
		unit: "day",
		unitDisplay: "long",
	});
	const dayLabel = new Intl.DateTimeFormat(locale, {
		weekday: "short",
		day: "numeric",
		month: "short",
		timeZone: "UTC",
	});
	// `day` is YYYY-MM-DD with no time. Midnight UTC, shown in UTC, keeps the same calendar day.
	const formatDay = (day: string) =>
		dayLabel.format(new Date(`${day}T00:00:00Z`));

	// The hero is a flow: the total of the period, against the same days one period earlier.
	const total = points.reduce((sum, point) => sum + point.current, 0);
	const previousTotal = points.reduce((sum, point) => sum + point.previous, 0);
	const change = changeRatio(total, previousTotal);
	const last = points.at(-1);
	const bestDay = points.reduce<DailyPoint | null>(
		(best, point) =>
			best === null || point.current > best.current ? point : best,
		null,
	);
	const comparison = fillMessage(t("overview.vsPreviousDays"), {
		days: dayCount.format(days),
	});

	return (
		<Card>
			{/* From 36rem the period control sits at the end of the title row. Below, it goes under the description. */}
			<CardHeader className="@xl/main:grid-cols-[1fr_auto] gap-y-3">
				<CardTitle>{t("overview.revenue")}</CardTitle>
				<CardDescription className="@xl/main:row-start-2">
					{t("overview.revenueHint")}
				</CardDescription>
				<div className="@xl/main:col-start-2 @xl/main:row-span-2 @xl/main:row-start-1 @xl/main:justify-self-end">
					<Tabs
						value={String(days)}
						onValueChange={(value) => {
							const next = PERIOD_DAYS.find(
								(option) => String(option) === value,
							);
							if (next) {
								onDaysChange(next);
							}
						}}
					>
						<TabsList aria-label={t("chart.period")}>
							{PERIOD_DAYS.map((option) => (
								<TabsTrigger
									key={option}
									value={String(option)}
									className="tabular-nums"
								>
									{fillMessage(t("overview.periodShort"), { days: option })}
								</TabsTrigger>
							))}
						</TabsList>
					</Tabs>
				</div>
			</CardHeader>
			<CardContent className="grid @4xl/main:grid-cols-[minmax(0,auto)_minmax(0,1fr)] items-end gap-8">
				<div className="grid gap-3">
					<p className="font-numeric @4xl/main:text-7xl text-5xl tabular-nums leading-none">
						{money.format(total)}
					</p>
					<KpiDelta
						change={change}
						goodWhen="up"
						comparison={comparison}
						className="text-sm"
					/>
					<div className="grid gap-1 pt-1 text-sm">
						{bestDay && bestDay.current > 0 ? (
							<p className="text-muted-foreground">
								{fillMessage(t("overview.bestDay"), {
									day: formatDay(bestDay.day),
									amount: money.format(bestDay.current),
								})}
							</p>
						) : null}
						<p className="flex items-center gap-2">
							<span
								aria-hidden="true"
								className="size-1.5 rounded-full bg-primary motion-safe:animate-pulse"
							/>
							{fillMessage(t("overview.todaySoFar"), {
								amount: money.format(today.revenue),
								orders: countLabel(
									today.orders,
									t("attendees.orderOne"),
									t("attendees.orderOther"),
									locale,
								),
							})}
						</p>
					</div>
				</div>
				<ChartContainer
					config={config}
					className="aspect-auto @4xl/main:h-40 h-28 w-full"
					role="img"
					aria-label={
						last
							? fillMessage(t("overview.revenueChartLabel"), {
									day: formatDay(last.day),
									amount: money.format(last.current),
								})
							: t("overview.revenue")
					}
				>
					<AreaChart
						data={points}
						margin={{ top: 8, right: 8, bottom: 4, left: 8 }}
					>
						<defs>
							<linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
								<stop
									offset="0%"
									stopColor="var(--color-current)"
									stopOpacity={0.3}
								/>
								<stop
									offset="100%"
									stopColor="var(--color-current)"
									stopOpacity={0}
								/>
							</linearGradient>
						</defs>
						{/* Time runs from right to left in Arabic. */}
						<XAxis dataKey="day" hide reversed={dir === "rtl"} />
						<YAxis hide domain={[0, "auto"]} />
						<ChartTooltip
							cursor={false}
							content={
								<ChartTooltipContent
									labelFormatter={(label) => formatDay(String(label))}
									valueFormat={{
										style: "currency",
										currency: BOX_OFFICE_CURRENCY,
										maximumFractionDigits: 0,
									}}
								/>
							}
						/>
						<Area
							dataKey="current"
							type="monotone"
							stroke="var(--color-current)"
							fill={`url(#${fillId})`}
							isAnimationActive={false}
						/>
						{/* The last point is yesterday, the last full day: a dot marks where the period ends. */}
						{last ? (
							<ReferenceDot
								x={last.day}
								y={last.current}
								r={4}
								fill="var(--color-current)"
								stroke="var(--card)"
								strokeWidth={2}
							/>
						) : null}
					</AreaChart>
				</ChartContainer>
			</CardContent>
		</Card>
	);
}

/** The hero while its data loads: the header, the figure, and the chart at their final sizes. */
export function RevenueHeroSkeleton() {
	return (
		<Card>
			<CardHeader>
				<Skeleton className="h-5 w-36" />
				<Skeleton className="h-4 w-56" />
			</CardHeader>
			<CardContent className="grid @4xl/main:grid-cols-[minmax(0,auto)_minmax(0,1fr)] items-end gap-8">
				<div className="grid gap-3">
					<Skeleton className="@4xl/main:h-18 h-12 w-64" />
					<Skeleton className="h-4 w-48" />
				</div>
				<Skeleton className="@4xl/main:h-40 h-28 w-full" />
			</CardContent>
		</Card>
	);
}
