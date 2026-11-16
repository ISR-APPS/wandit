// The trend part of the "bars" chart form: one bar per day of finished lessons, or the running total.
// The lessons section of the home renders it. The page header holds the period, so this part has no period control.
// It reads the bar corner of the live theme with useAppTheme().
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, XAxis, YAxis } from "recharts";
import { type DailyPoint, dayToDate } from "~/features/school";
import { useT } from "~/shared/i18n";
import {
	type ChartConfig,
	ChartContainer,
	ChartTooltip,
	ChartTooltipContent,
} from "~/shared/ui/chart";
import { Tabs, TabsList, TabsTrigger } from "~/shared/ui/tabs";
import { useAppTheme } from "~/styles/theme";
import { BAR_RADIUS_PX, TODAY_FILL_OPACITY } from "../lib/bar-style";

type LessonsTrendChartProps = {
	/** One point per local day of the period, oldest first. */
	points: DailyPoint[];
};

/** Two views of the same lessons: the count of each day, and the sum since the first day of the period. */
export function LessonsTrendChart({ points }: LessonsTrendChartProps) {
	const { t, locale, dir } = useT();
	const [view, setView] = useState<"perDay" | "runningTotal">("perDay");
	const barRadius = BAR_RADIUS_PX[useAppTheme().selection.radius];

	const dayFormat = new Intl.DateTimeFormat(locale, {
		day: "numeric",
		month: "short",
		timeZone: "UTC",
	});
	const number = new Intl.NumberFormat(locale);
	const compact = new Intl.NumberFormat(locale, { notation: "compact" });
	const config = {
		value: { label: t("overview.lessonsTitle"), color: "var(--chart-1)" },
	} satisfies ChartConfig;

	let runningTotal = 0;
	const data = points.map((point) => {
		runningTotal += point.current;
		return {
			day: point.day,
			value: view === "perDay" ? point.current : runningTotal,
		};
	});
	const isEmpty = points.every(
		(point) => point.current === 0 && point.previous === 0,
	);
	const last = points.at(-1);
	const label = last
		? `${t("overview.lessonsChart")}: ${dayFormat.format(dayToDate(last.day))}, ${number.format(last.current)}`
		: t("overview.lessonsChart");

	return (
		<div className="grid gap-3">
			<Tabs
				value={view}
				onValueChange={(value) =>
					setView(value === "runningTotal" ? "runningTotal" : "perDay")
				}
			>
				{/* 44 px on a phone: the touch area of the brief. */}
				<TabsList
					aria-label={t("chart.views")}
					className="max-sm:group-data-[orientation=horizontal]/tabs:h-11"
				>
					<TabsTrigger value="perDay">{t("chart.perDay")}</TabsTrigger>
					<TabsTrigger value="runningTotal">
						{t("chart.runningTotal")}
					</TabsTrigger>
				</TabsList>
			</Tabs>
			<div className="relative">
				<ChartContainer
					config={config}
					className="aspect-auto h-56 w-full"
					role="img"
					aria-label={label}
				>
					<BarChart
						data={data}
						margin={{ top: 8, left: 4, right: 4, bottom: 0 }}
					>
						<CartesianGrid vertical={false} />
						<XAxis
							dataKey="day"
							tickLine={false}
							axisLine={false}
							tickMargin={8}
							minTickGap={24}
							reversed={dir === "rtl"}
							tickFormatter={(day: string) => dayFormat.format(dayToDate(day))}
						/>
						<YAxis
							hide={isEmpty}
							width="auto"
							tickLine={false}
							axisLine={false}
							tickMargin={8}
							orientation={dir === "rtl" ? "right" : "left"}
							tick={{ textAnchor: "end" }}
							tickFormatter={(value: number) => compact.format(value)}
						/>
						<ChartTooltip
							cursor={false}
							content={
								<ChartTooltipContent
									labelFormatter={(day) =>
										String(day) === last?.day
											? t("overview.todaySoFar")
											: dayFormat.format(dayToDate(String(day)))
									}
								/>
							}
						/>
						<Bar
							dataKey="value"
							fill="var(--color-value)"
							radius={[barRadius, barRadius, 0, 0]}
							isAnimationActive={false}
						>
							{data.map((point, index) => (
								<Cell
									key={point.day}
									fillOpacity={
										index === data.length - 1 ? TODAY_FILL_OPACITY : 1
									}
								/>
							))}
						</Bar>
					</BarChart>
				</ChartContainer>
				{isEmpty ? (
					<div className="absolute inset-0 grid place-content-center justify-items-center gap-2 text-center">
						<p className="text-muted-foreground text-sm">{t("chart.empty")}</p>
						<Link to="/app/courses" className="font-medium text-sm underline">
							{t("chart.emptyAction")}
						</Link>
					</div>
				) : null}
			</div>
		</div>
	);
}
