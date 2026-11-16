// The trend of the home: the check-ins per day as a line with a soft fill, over 7, 30, or 90 days.
// TodayPage renders it with the chosen period. It reads dailyCheckInsQueryOptions with useQuery,
// because a new period changes the query key after a click. It has its own loading and error states.
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useId } from "react";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
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
import { dailyCheckInsQueryOptions } from "../api/today.queries";
import { type DailyPoint, PERIOD_DAYS, type PeriodDays } from "../lib/series";

type CheckInsTrendCardProps = {
	/** The period of the plot, in days. TodayPage holds it. */
	days: PeriodDays;
	/** Called with the new period when the user picks one. */
	onDaysChange: (days: PeriodDays) => void;
	/** The grid span of the home page. */
	className?: string;
};

/** The panel keeps its header while a new period loads, so the control does not jump. */
export function CheckInsTrendCard({
	days,
	onDaysChange,
	className,
}: CheckInsTrendCardProps) {
	const { t, locale } = useT();
	const trend = useQuery(dailyCheckInsQueryOptions(days));
	const dayCount = new Intl.NumberFormat(locale, {
		style: "unit",
		unit: "day",
		unitDisplay: "long",
	});

	return (
		<Card className={className}>
			<CardHeader>
				<CardTitle>{t("chart.checkInsTitle")}</CardTitle>
				<CardDescription>{t("chart.checkInsDescription")}</CardDescription>
				<CardAction>
					<Select
						value={String(days)}
						onValueChange={(value) =>
							onDaysChange(
								PERIOD_DAYS.find((option) => String(option) === value) ?? days,
							)
						}
					>
						<SelectTrigger className="w-32" aria-label={t("chart.period")}>
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
			<CardContent>
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
					<CheckInsPlot points={trend.data} />
				)}
			</CardContent>
		</Card>
	);
}

type CheckInsPlotProps = {
	/** One point per day, oldest first. */
	points: DailyPoint[];
};

// The plot of one period. A period with no check-in keeps its height and its dates, and says so.
function CheckInsPlot({ points }: CheckInsPlotProps) {
	const { t, locale, dir } = useT();
	const fillId = useId();
	const chartConfig = {
		current: { label: t("chart.checkIns"), color: "var(--chart-1)" },
	} satisfies ChartConfig;
	const isEmpty = points.every(
		(point) => point.current === 0 && point.previous === 0,
	);
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
		? `${t("chart.checkInsTitle")}: ${formatDay(last.day)}, ${number.format(last.current)}${lastChange}`
		: t("chart.checkInsTitle");

	return (
		<div className="relative">
			<ChartContainer
				config={chartConfig}
				className="aspect-auto h-56 w-full"
				role="img"
				aria-label={label}
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
								labelFormatter={(value) => formatDay(String(value))}
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
					<Link
						to="/app/classes"
						className="font-medium text-sm hover:underline"
					>
						{t("chart.emptyAction")}
					</Link>
				</div>
			) : null}
		</div>
	);
}
