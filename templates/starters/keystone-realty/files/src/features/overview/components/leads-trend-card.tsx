// The trend panel of the home: the new leads per day as an area chart, with a period control.
// OverviewPage renders it and holds the period. The panel reads dailyLeadsQueryOptions(days) itself,
// because a click on the period changes the query key. So it has its own loading and error state.
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useId } from "react";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { fillMessage } from "~/features/agency";
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
	type ChartConfig,
	ChartContainer,
	ChartTooltip,
	ChartTooltipContent,
} from "~/shared/ui/chart";
import { Skeleton } from "~/shared/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "~/shared/ui/tabs";
import { dailyLeadsQueryOptions } from "../api/overview.queries";
import {
	changeRatio,
	type DailyPoint,
	PERIOD_DAYS,
	type PeriodDays,
} from "../lib/series";
import { ChangeLine } from "./change-line";

type LeadsTrendCardProps = {
	/** The period of the chart, in days. OverviewPage holds it. */
	days: PeriodDays;
	/** Called with the new period when the user picks one. */
	onDaysChange: (days: PeriodDays) => void;
};

/** The header keeps its place while a new period loads. Only the body changes. */
export function LeadsTrendCard({ days, onDaysChange }: LeadsTrendCardProps) {
	const { t, locale } = useT();
	const {
		data: points,
		isError,
		refetch,
	} = useQuery(dailyLeadsQueryOptions(days));
	const dayCount = (value: number, unitDisplay: "long" | "narrow") =>
		new Intl.NumberFormat(locale, {
			style: "unit",
			unit: "day",
			unitDisplay,
		}).format(value);

	return (
		<Card>
			<CardHeader>
				<CardTitle>{t("overview.trendTitle")}</CardTitle>
				<CardDescription>{t("overview.trendDescription")}</CardDescription>
				<CardAction>
					<Tabs
						value={String(days)}
						onValueChange={(value) =>
							onDaysChange(
								PERIOD_DAYS.find((option) => String(option) === value) ?? days,
							)
						}
					>
						<TabsList aria-label={t("chart.period")}>
							{PERIOD_DAYS.map((option) => (
								<TabsTrigger
									key={option}
									value={String(option)}
									aria-label={dayCount(option, "long")}
									className="px-2.5 tabular-nums"
								>
									{dayCount(option, "narrow")}
								</TabsTrigger>
							))}
						</TabsList>
					</Tabs>
				</CardAction>
			</CardHeader>
			<CardContent>
				{isError ? (
					<div className="grid h-80 place-content-center justify-items-center gap-3 text-center">
						<p className="text-sm" role="alert">
							{t("overview.trendError")}
						</p>
						<Button type="button" variant="outline" onClick={() => refetch()}>
							{t("common.retry")}
						</Button>
					</div>
				) : points ? (
					<LeadsTrend points={points} periodLabel={dayCount(days, "long")} />
				) : (
					<LeadsTrendSkeleton />
				)}
			</CardContent>
		</Card>
	);
}

type LeadsTrendProps = {
	/** One point per day, oldest first. */
	points: DailyPoint[];
	/** The period in words, for example "30 days". It names the total above the plot. */
	periodLabel: string;
};

/** The total of the period with its change, then the plot. */
function LeadsTrend({ points, periodLabel }: LeadsTrendProps) {
	const { t, locale, dir } = useT();
	const fillId = useId();
	const isRtl = dir === "rtl";
	const total = points.reduce((sum, point) => sum + point.current, 0);
	const previousTotal = points.reduce((sum, point) => sum + point.previous, 0);
	const isEmpty = total === 0 && previousTotal === 0;

	const number = new Intl.NumberFormat(locale);
	const compact = new Intl.NumberFormat(locale, { notation: "compact" });
	const dayFormat = new Intl.DateTimeFormat(locale, {
		day: "numeric",
		month: "short",
		timeZone: "UTC",
	});
	// `day` is YYYY-MM-DD. Midnight UTC, shown in UTC, keeps the same calendar day.
	const formatDay = (day: string) =>
		dayFormat.format(new Date(`${day}T00:00:00Z`));
	const config = {
		current: { label: t("overview.trendSeries"), color: "var(--chart-1)" },
	} satisfies ChartConfig;

	const lastPoint = points.at(-1);
	const lastChange =
		lastPoint && lastPoint.previous > 0
			? changeRatio(lastPoint.current, lastPoint.previous)
			: null;
	const percent = new Intl.NumberFormat(locale, {
		style: "percent",
		signDisplay: "exceptZero",
		maximumFractionDigits: 1,
	});
	const ariaLabel = lastPoint
		? [
				t("overview.trendTitle"),
				`${formatDay(lastPoint.day)}: ${number.format(lastPoint.current)}`,
				lastChange === null
					? null
					: `${percent.format(lastChange)} ${t("chart.vsPrevious")}`,
			]
				.filter((part) => part !== null)
				.join(", ")
		: t("overview.trendTitle");

	return (
		<div className="grid gap-4">
			<div className="flex flex-wrap items-end gap-x-3 gap-y-1">
				<p className="font-numeric text-4xl tabular-nums leading-none">
					{number.format(total)}
				</p>
				<div className="grid gap-0.5">
					<ChangeLine
						change={changeRatio(total, previousTotal)}
						goodWhen="up"
					/>
					<p className="text-muted-foreground text-xs">
						{fillMessage(t("overview.trendTotal"), { period: periodLabel })}
					</p>
				</div>
			</div>
			<div className="relative">
				<ChartContainer
					config={config}
					className="aspect-auto h-64 w-full"
					role="img"
					aria-label={ariaLabel}
				>
					<AreaChart data={points} margin={{ top: 8, left: 0, right: 0 }}>
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
						{/* A horizontal grid, and axes with no tick line and no axis line. */}
						<CartesianGrid vertical={false} />
						{/* Time runs from right to left in Arabic, so the values move to the right side. */}
						<XAxis
							dataKey="day"
							reversed={isRtl}
							tickLine={false}
							axisLine={false}
							tickMargin={8}
							minTickGap={24}
							tickFormatter={formatDay}
						/>
						{/* SVG anchors follow the page direction. "end" puts the text end at the plot side in LTR and RTL. */}
						<YAxis
							hide={isEmpty}
							orientation={isRtl ? "right" : "left"}
							tick={{ textAnchor: "end" }}
							width="auto"
							allowDecimals={false}
							tickLine={false}
							axisLine={false}
							tickMargin={8}
							tickFormatter={(value: number) => compact.format(value)}
						/>
						<ChartTooltip
							cursor={false}
							content={
								<ChartTooltipContent
									labelFormatter={(label) => formatDay(String(label))}
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
					</AreaChart>
				</ChartContainer>
				{isEmpty ? (
					<div className="absolute inset-0 grid place-content-center justify-items-center gap-2 text-center">
						<p className="text-muted-foreground text-sm">{t("chart.empty")}</p>
						<Button asChild variant="link" size="sm">
							<Link to="/app/leads">{t("chart.emptyAction")}</Link>
						</Button>
					</div>
				) : null}
			</div>
		</div>
	);
}

/** Placeholder of the total and the plot, in their final sizes. */
function LeadsTrendSkeleton() {
	return (
		<div className="grid gap-4">
			<div className="flex items-end gap-3">
				<Skeleton className="h-9 w-16" />
				<Skeleton className="h-8 w-40" />
			</div>
			<Skeleton className="h-64 w-full" />
		</div>
	);
}

/** Placeholder of the whole trend panel. The home skeleton renders it. */
export function LeadsTrendCardSkeleton() {
	return (
		<Card>
			<CardHeader>
				<Skeleton className="h-4 w-24" />
				<Skeleton className="h-4 w-56 max-w-full" />
			</CardHeader>
			<CardContent>
				<LeadsTrendSkeleton />
			</CardContent>
		</Card>
	);
}
