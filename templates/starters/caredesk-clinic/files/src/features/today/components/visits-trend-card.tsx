// The trend of the home page: the visits done per day as bars, or as a running total.
// TodayPage renders it with the chosen period. It reads dailyVisitsQueryOptions with useQuery,
// because a new period changes the query key after a click. It has its own loading and error states.
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
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
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "~/shared/ui/select";
import { Skeleton } from "~/shared/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "~/shared/ui/tabs";
import { type AppThemeFile, useAppTheme } from "~/styles/theme";
import { dailyVisitsQueryOptions } from "../api/today.queries";
import { type DailyPoint, PERIOD_DAYS, type PeriodDays } from "../lib/series";

type VisitsTrendCardProps = {
	/** The period of the bars, in days. TodayPage holds it. */
	days: PeriodDays;
	/** Called with the new period when the user picks one. */
	onDaysChange: (days: PeriodDays) => void;
	/** The grid span of the home page. */
	className?: string;
};

/** Bar corner in px for each radius of the theme. recharts takes a number, not a CSS variable. */
const BAR_RADIUS_PX = {
	none: 0,
	sm: 2,
	md: 2,
	lg: 4,
	xl: 4,
} satisfies Record<AppThemeFile["selection"]["radius"], number>;

// The two views show the same visits: the count of each day, or the sum since the first day.
type TrendView = "perDay" | "runningTotal";

/** The panel keeps its header while a new period loads, so the controls do not jump. */
export function VisitsTrendCard({
	days,
	onDaysChange,
	className,
}: VisitsTrendCardProps) {
	const { t, locale } = useT();
	const [view, setView] = useState<TrendView>("perDay");
	const trend = useQuery(dailyVisitsQueryOptions(days));
	const dayCount = new Intl.NumberFormat(locale, {
		style: "unit",
		unit: "day",
		unitDisplay: "long",
	});

	return (
		<Card className={className}>
			<CardHeader>
				<CardTitle>{t("chart.visitsPerDay")}</CardTitle>
				<CardDescription>{t("chart.visitsDescription")}</CardDescription>
				<CardAction>
					<Select
						value={String(days)}
						onValueChange={(value) =>
							onDaysChange(
								PERIOD_DAYS.find((option) => String(option) === value) ?? days,
							)
						}
					>
						<SelectTrigger
							className="w-32 max-md:h-11"
							aria-label={t("chart.period")}
						>
							<SelectValue />
						</SelectTrigger>
						<SelectContent align="end">
							{PERIOD_DAYS.map((option) => (
								<SelectItem key={option} value={String(option)}>
									{dayCount.format(option)}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</CardAction>
			</CardHeader>
			<CardContent className="grid gap-4">
				<Tabs
					value={view}
					onValueChange={(value) =>
						setView(value === "runningTotal" ? "runningTotal" : "perDay")
					}
				>
					{/* The kit strip is 36 px high. A phone gets a 44 px touch area. */}
					<TabsList className="max-md:group-data-[orientation=horizontal]/tabs:h-11">
						<TabsTrigger value="perDay">{t("chart.perDay")}</TabsTrigger>
						<TabsTrigger value="runningTotal">
							{t("chart.runningTotal")}
						</TabsTrigger>
					</TabsList>
				</Tabs>
				{trend.isPending ? (
					<Skeleton className="h-56 w-full" />
				) : trend.isError ? (
					<div className="grid h-56 place-content-center justify-items-center gap-3">
						<p className="text-muted-foreground text-sm" role="alert">
							{t("chart.loadError")}
						</p>
						<Button
							type="button"
							variant="outline"
							size="sm"
							onClick={() => trend.refetch()}
						>
							{t("common.retry")}
						</Button>
					</div>
				) : (
					<VisitsPlot points={trend.data} view={view} />
				)}
			</CardContent>
		</Card>
	);
}

type VisitsPlotProps = {
	/** One point per day, oldest first. */
	points: DailyPoint[];
	view: TrendView;
};

// The bars of one period. A period with no visit keeps its height and its dates, and says so.
function VisitsPlot({ points, view }: VisitsPlotProps) {
	const { t, locale, dir } = useT();
	const barRadius = BAR_RADIUS_PX[useAppTheme().selection.radius];
	const chartConfig = {
		visits: { label: t("chart.visits"), color: "var(--chart-1)" },
	} satisfies ChartConfig;

	let total = 0;
	const data = points.map((point) => {
		total += point.current;
		return {
			day: point.day,
			visits: view === "perDay" ? point.current : total,
		};
	});
	const isEmpty = total === 0;
	const isRtl = dir === "rtl";

	// `day` has no time. Midnight UTC, shown in UTC, keeps the same calendar day.
	const dayFormat = new Intl.DateTimeFormat(locale, {
		day: "numeric",
		month: "short",
		timeZone: "UTC",
	});
	const formatDay = (day: string | number) =>
		dayFormat.format(new Date(`${day}T00:00:00Z`));
	const compact = new Intl.NumberFormat(locale, { notation: "compact" });
	const number = new Intl.NumberFormat(locale);
	const percent = new Intl.NumberFormat(locale, {
		style: "percent",
		signDisplay: "exceptZero",
		maximumFractionDigits: 1,
	});

	const last = points.at(-1);
	// The change compares with the same day one period earlier, only when that value is above 0.
	const lastChange =
		last && last.previous > 0
			? `, ${percent.format((last.current - last.previous) / last.previous)} ${t("chart.vsPrevious")}`
			: "";
	const label = last
		? `${t("chart.visitsPerDay")}: ${formatDay(last.day)}, ${number.format(last.current)}${lastChange}`
		: t("chart.visitsPerDay");

	return (
		<div className="relative">
			<ChartContainer
				config={chartConfig}
				className="aspect-auto h-56 w-full"
				role="img"
				aria-label={label}
			>
				<BarChart
					data={data}
					margin={{ top: 4, right: isRtl ? 0 : 8, left: isRtl ? 8 : 0 }}
				>
					<CartesianGrid vertical={false} />
					<XAxis
						dataKey="day"
						tickLine={false}
						axisLine={false}
						tickMargin={8}
						minTickGap={24}
						reversed={isRtl}
						tickFormatter={formatDay}
					/>
					<YAxis
						hide={isEmpty}
						width="auto"
						tickLine={false}
						axisLine={false}
						tickMargin={8}
						allowDecimals={false}
						orientation={isRtl ? "right" : "left"}
						tick={isRtl ? { textAnchor: "end" } : undefined}
						tickFormatter={(value: number) => compact.format(value)}
					/>
					<ChartTooltip
						cursor={false}
						content={<ChartTooltipContent labelFormatter={formatDay} />}
					/>
					<Bar
						dataKey="visits"
						fill="var(--color-visits)"
						radius={[barRadius, barRadius, 0, 0]}
						isAnimationActive={false}
					/>
				</BarChart>
			</ChartContainer>
			{isEmpty ? (
				<p className="absolute inset-0 grid place-content-center text-muted-foreground text-sm">
					{t("chart.empty")}
				</p>
			) : null}
		</div>
	);
}
