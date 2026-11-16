// The main chart of the home: uploads per day as stacked bars, one segment per file category.
// OverviewPage renders it with the translated points of dailyUploadsQueryOptions and the period control.
// It follows the stacked form of the app-dashboard skill: legend in the header, no Y axis on an empty period.
import { Link } from "@tanstack/react-router";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { useT } from "~/shared/i18n";
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
import { PERIOD_DAYS, type PeriodDays } from "../lib/series";

/** Bar corner in px for each radius of the theme. recharts takes a number, not a CSS variable. */
const BAR_RADIUS_PX = { none: 0, sm: 2, md: 2, lg: 4, xl: 4 } satisfies Record<
	AppThemeFile["selection"]["radius"],
	number
>;

/** One bar: the day, then one value per series key s0 to s4 (CSS-safe keys for ChartConfig). */
type StackRow = { day: string; [series: `s${number}`]: number };

/** One translated point: the category is a label now. */
type TrendPoint = { day: string; category: string; value: number };

type UploadsTrendCardProps = {
	title: string;
	description: string;
	/** One row per day and category, oldest first, categories in stack order. */
	points: TrendPoint[];
	days: PeriodDays;
	onDaysChange: (days: PeriodDays) => void;
};

/** The stacked bars. The first category sits at the bottom of each bar; only the top segment has round corners. */
export function UploadsTrendCard({
	title,
	description,
	points,
	days,
	onDaysChange,
}: UploadsTrendCardProps) {
	const { t, locale, dir } = useT();
	const isRtl = dir === "rtl";
	const barRadius = BAR_RADIUS_PX[useAppTheme().selection.radius];
	const dayFormat = new Intl.DateTimeFormat(locale, {
		day: "numeric",
		month: "short",
		timeZone: "UTC",
	});
	const compact = new Intl.NumberFormat(locale, { notation: "compact" });
	const number = new Intl.NumberFormat(locale);
	const dayUnit = new Intl.NumberFormat(locale, {
		style: "unit",
		unit: "day",
		unitDisplay: "long",
	});
	const formatDay = (day: string | number) =>
		dayFormat.format(new Date(`${day}T00:00:00Z`));

	// The categories keep the order of the rows. There are 5, the most series the chart allows.
	const labels = [...new Set(points.map((point) => point.category))];
	const rowsByDay = new Map<string, StackRow>();
	for (const point of points) {
		const row = rowsByDay.get(point.day) ?? { day: point.day };
		const key = `s${labels.indexOf(point.category)}` as const;
		row[key] = (row[key] ?? 0) + point.value;
		rowsByDay.set(point.day, row);
	}
	const rows = [...rowsByDay.values()];
	const config = Object.fromEntries(
		labels.map((label, index) => [
			`s${index}`,
			{ label, color: `var(--chart-${index + 1})` },
		]),
	) satisfies ChartConfig;
	const total = points.reduce((sum, point) => sum + point.value, 0);
	const lastRow = rows[rows.length - 1];
	const ariaLabel = lastRow
		? `${title}. ${formatDay(lastRow.day)}: ${labels
				.map(
					(label, index) =>
						`${label} ${number.format(lastRow[`s${index}`] ?? 0)}`,
				)
				.join(", ")}`
		: title;

	return (
		<Card className="h-full">
			<CardHeader>
				<CardTitle>{title}</CardTitle>
				<CardDescription>{description}</CardDescription>
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
									{dayUnit.format(option)}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</CardAction>
				<ul className="col-span-full flex flex-wrap gap-x-4 gap-y-1 pt-2 text-muted-foreground text-xs">
					{labels.map((label, index) => (
						<li key={label} className="flex items-center gap-1.5">
							<span
								aria-hidden
								className="size-2.5 shrink-0 rounded-sm"
								style={{ backgroundColor: `var(--chart-${index + 1})` }}
							/>
							{label}
						</li>
					))}
				</ul>
			</CardHeader>
			<CardContent className="relative">
				<ChartContainer
					config={config}
					className="aspect-auto @5xl/main:h-72 h-64 w-full"
					role="img"
					aria-label={ariaLabel}
				>
					<BarChart
						data={rows}
						margin={isRtl ? { left: 0, right: 8 } : { left: 0, right: 0 }}
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
						{total > 0 ? (
							<YAxis
								width="auto"
								tickLine={false}
								axisLine={false}
								tickMargin={8}
								allowDecimals={false}
								orientation={isRtl ? "right" : "left"}
								tick={{ textAnchor: "end" }}
								tickFormatter={(value: number) => compact.format(value)}
							/>
						) : null}
						<ChartTooltip
							cursor={false}
							content={<ChartTooltipContent labelFormatter={formatDay} />}
						/>
						{labels.map((label, index) => (
							<Bar
								key={label}
								dataKey={`s${index}`}
								stackId="day"
								fill={`var(--color-s${index})`}
								radius={
									index === labels.length - 1 ? [barRadius, barRadius, 0, 0] : 0
								}
								isAnimationActive={false}
							/>
						))}
					</BarChart>
				</ChartContainer>
				{total === 0 ? (
					<div className="absolute inset-x-6 top-1/3 grid justify-items-center gap-2 text-center text-sm">
						<p className="text-muted-foreground">{t("chart.empty")}</p>
						<Link
							to="/app/files"
							className="font-medium underline decoration-ring underline-offset-4"
						>
							{t("chart.emptyAction")}
						</Link>
					</div>
				) : null}
			</CardContent>
		</Card>
	);
}

/** Placeholder of the trend panel: the header, the legend, and the plot at the final height. */
export function UploadsTrendCardSkeleton() {
	return (
		<Card className="h-full">
			<CardHeader>
				<Skeleton className="h-5 w-40" />
				<Skeleton className="h-4 w-56" />
				<Skeleton className="mt-2 h-3 w-72" />
			</CardHeader>
			<CardContent>
				<Skeleton className="@5xl/main:h-72 h-64 w-full" />
			</CardContent>
		</Card>
	);
}
