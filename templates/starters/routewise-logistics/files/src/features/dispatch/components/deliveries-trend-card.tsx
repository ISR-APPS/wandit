// The "Deliveries per day" panel of the home: four figures of the period, then one stacked bar per day by outcome.
// DispatchPage renders it. It holds the period (7, 30, or 90 days) and reads the delivery queries of the shipments feature.
// It follows the chart form "stacked" and the KPI form "strip" of the app-dashboard skill.
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import {
	type DELIVERY_OUTCOMES,
	dayCountFormat,
	dayToDate,
	FigureStrip,
	fillMessage,
	PERIOD_DAYS,
	type PeriodDays,
} from "~/features/logistics";
import {
	deliveryFiguresQueryOptions,
	deliveryOutcomesQueryOptions,
} from "~/features/shipments";
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import {
	Card,
	CardAction,
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
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "~/shared/ui/select";
import { Skeleton } from "~/shared/ui/skeleton";
import { type AppThemeFile, useAppTheme } from "~/styles/theme";

/** Bar corner in px for each radius of the theme. recharts takes a number, not a CSS variable. */
const BAR_RADIUS_PX = {
	none: 0,
	sm: 2,
	md: 2,
	lg: 4,
	xl: 4,
} satisfies Record<AppThemeFile["selection"]["radius"], number>;

/**
 * The series key, the bar color, and the legend mark of each outcome, in stack order. The keys are CSS-safe for ChartConfig.
 * Late is orange and failed is red, so the bad days stand out from the gold on-time bars.
 */
const SERIES = [
	{
		outcome: "on_time",
		key: "s0",
		color: "var(--chart-1)",
		markClass: "bg-chart-1",
	},
	{
		outcome: "late",
		key: "s1",
		color: "var(--chart-4)",
		markClass: "bg-chart-4",
	},
	{
		outcome: "failed",
		key: "s2",
		color: "var(--destructive)",
		markClass: "bg-destructive",
	},
] as const satisfies readonly {
	outcome: (typeof DELIVERY_OUTCOMES)[number];
	key: string;
	/** The CSS color of the bar. It is the same token as markClass. */
	color: string;
	markClass: string;
}[];

/** One bar: the day, then one count per series key. */
type StackRow = { day: string; s0: number; s1: number; s2: number };

type DeliveriesTrendCardProps = {
	/** The period of the first load, in days. The home loader prefetches the queries of this period. */
	defaultDays: PeriodDays;
};

/** The period control changes the query keys of this panel only. The old bars stay while the new ones load. */
export function DeliveriesTrendCard({ defaultDays }: DeliveriesTrendCardProps) {
	const { t, locale, dir } = useT();
	const [days, setDays] = useState<PeriodDays>(defaultDays);
	const barRadius = BAR_RADIUS_PX[useAppTheme().selection.radius];
	const outcomes = useQuery({
		...deliveryOutcomesQueryOptions(days),
		placeholderData: keepPreviousData,
	});
	const figures = useQuery({
		...deliveryFiguresQueryOptions(days),
		placeholderData: keepPreviousData,
	});

	const dayCount = dayCountFormat(locale);
	const number = new Intl.NumberFormat(locale);
	const compact = new Intl.NumberFormat(locale, { notation: "compact" });
	// The day keys are midnight UTC, so the UTC time zone keeps the same calendar day.
	const dayFormat = new Intl.DateTimeFormat(locale, {
		day: "numeric",
		month: "short",
		timeZone: "UTC",
	});

	const config = Object.fromEntries(
		SERIES.map((series) => [
			series.key,
			{
				label: t(`deliveryOutcome.${series.outcome}`),
				color: series.color,
			},
		]),
	) satisfies ChartConfig;

	// One row per day from the points: the points hold one row per day and outcome, oldest first.
	const rowsByDay = new Map<string, StackRow>();
	for (const point of outcomes.data ?? []) {
		const row = rowsByDay.get(point.day) ?? {
			day: point.day,
			s0: 0,
			s1: 0,
			s2: 0,
		};
		const series = SERIES.find((item) => item.outcome === point.category);
		if (series) {
			row[series.key] += point.value;
		}
		rowsByDay.set(point.day, row);
	}
	const rows = [...rowsByDay.values()];
	const lastRow = rows.at(-1);
	const isEmpty = rows.every((row) => row.s0 + row.s1 + row.s2 === 0);

	return (
		<Card className="@container/trend h-full gap-0 py-0">
			<CardHeader className="py-5">
				<CardTitle>{t("deliveries.title")}</CardTitle>
				<CardDescription>{t("deliveries.hint")}</CardDescription>
				<CardAction>
					<Select
						value={String(days)}
						onValueChange={(value) =>
							setDays(
								PERIOD_DAYS.find((option) => String(option) === value) ??
									defaultDays,
							)
						}
					>
						<SelectTrigger
							className="w-auto max-md:min-h-11"
							aria-label={t("chart.period")}
						>
							<SelectValue />
						</SelectTrigger>
						<SelectContent align="end">
							{PERIOD_DAYS.map((option) => (
								<SelectItem key={option} value={String(option)}>
									{fillMessage(t("chart.lastDays"), {
										days: dayCount.format(option),
									})}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</CardAction>
			</CardHeader>
			{outcomes.isError || figures.isError ? (
				<CardContent className="pb-6">
					<p className="text-destructive text-sm" role="alert">
						{t("deliveries.loadError")}
					</p>
				</CardContent>
			) : !outcomes.data || !figures.data ? (
				<CardContent className="grid gap-4 pb-6">
					<Skeleton className="h-20 w-full" />
					<Skeleton className="h-64 w-full" />
				</CardContent>
			) : (
				<>
					{/* The box clips the outer rules of the cells. Its own rules split the header and the plot. */}
					<div className="overflow-hidden border-y">
						<FigureStrip
							className="@lg/trend:grid-cols-4 grid-cols-2"
							figures={figures.data.map((figure) => ({
								id: figure.id,
								label: t(figure.labelKey),
								value: new Intl.NumberFormat(locale, figure.format).format(
									figure.value,
								),
								change: figure.change,
								goodWhen: figure.goodWhen,
							}))}
						/>
					</div>
					<CardContent className="grid flex-1 content-start gap-3 py-5">
						<ul className="flex flex-wrap gap-x-4 gap-y-1 text-muted-foreground text-xs">
							{SERIES.map((series) => (
								<li key={series.key} className="flex items-center gap-1.5">
									<span
										aria-hidden="true"
										className={cn("size-2.5 rounded-sm", series.markClass)}
									/>
									{t(`deliveryOutcome.${series.outcome}`)}
								</li>
							))}
						</ul>
						<div className="relative">
							<ChartContainer
								config={config}
								className="aspect-auto h-64 w-full"
								role="img"
								aria-label={
									lastRow
										? fillMessage(t("deliveries.chartLabel"), {
												day: dayFormat.format(dayToDate(lastRow.day)),
												onTime: number.format(lastRow.s0),
												late: number.format(lastRow.s1),
												failed: number.format(lastRow.s2),
											})
										: t("deliveries.title")
								}
							>
								<BarChart
									data={rows}
									margin={{ top: 4, right: 4, bottom: 0, left: 4 }}
								>
									<CartesianGrid vertical={false} />
									<XAxis
										dataKey="day"
										tickLine={false}
										axisLine={false}
										tickMargin={8}
										minTickGap={24}
										reversed={dir === "rtl"}
										tickFormatter={(day: string) =>
											dayFormat.format(dayToDate(day))
										}
									/>
									<YAxis
										hide={isEmpty}
										width="auto"
										tickLine={false}
										axisLine={false}
										tickMargin={8}
										allowDecimals={false}
										orientation={dir === "rtl" ? "right" : "left"}
										tick={dir === "rtl" ? { textAnchor: "end" } : undefined}
										tickFormatter={(value: number) => compact.format(value)}
									/>
									<ChartTooltip
										cursor={false}
										content={
											<ChartTooltipContent
												labelFormatter={(day) =>
													dayFormat.format(dayToDate(String(day)))
												}
											/>
										}
									/>
									{SERIES.map((series, index) => (
										<Bar
											key={series.key}
											dataKey={series.key}
											stackId="day"
											fill={`var(--color-${series.key})`}
											// Only the top segment has round top corners.
											radius={
												index === SERIES.length - 1
													? [barRadius, barRadius, 0, 0]
													: 0
											}
											isAnimationActive={false}
										/>
									))}
								</BarChart>
							</ChartContainer>
							{isEmpty ? (
								<p className="absolute inset-0 flex items-center justify-center text-muted-foreground text-sm">
									{t("chart.empty")}
								</p>
							) : null}
						</div>
					</CardContent>
				</>
			)}
		</Card>
	);
}
