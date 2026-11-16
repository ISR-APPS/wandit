// The plot of the home trend: booked amount per day as bars, "Per day" or "Running total".
// A dashed line shows the team target for the same days, so the bars read against the plan.
// BookingsTrendCard renders it with the points of its query. Empty points show a sentence and a link.
import { Link } from "@tanstack/react-router";
import {
	Bar,
	BarChart,
	CartesianGrid,
	ReferenceLine,
	XAxis,
	YAxis,
} from "recharts";
import {
	DAY_MS,
	type DailyPoint,
	MONEY_OPTIONS,
	moneyFormat,
	niceCeiling,
	sellingDaysBetween,
} from "~/features/sales";
import { useT } from "~/shared/i18n";
import {
	type ChartConfig,
	ChartContainer,
	ChartTooltip,
	ChartTooltipContent,
} from "~/shared/ui/chart";

/** The two drawings of the same bookings. */
export type BookingsView = "perDay" | "runningTotal";

// The height of the plot. The home sets the main trend to h-72.
const PLOT_CLASS = "aspect-auto h-72 w-full";

type BookingsPlotProps = {
	points: DailyPoint[];
	view: BookingsView;
	/** Bar corner in px, from the theme radius. */
	barRadius: number;
};

/** The bars of one view and the target line. The plot is h-72, the main height of the home. */
export function BookingsPlot({ points, view, barRadius }: BookingsPlotProps) {
	const { t, locale, dir } = useT();
	const isRtl = dir === "rtl";
	const money = moneyFormat(locale);
	const compactMoney = moneyFormat(locale, { compact: true });
	const dayLabel = new Intl.DateTimeFormat(locale, {
		day: "numeric",
		month: "short",
		timeZone: "UTC",
	});
	const percent = new Intl.NumberFormat(locale, {
		style: "percent",
		signDisplay: "exceptZero",
		maximumFractionDigits: 1,
	});

	const periodTarget = points.reduce((sum, point) => sum + point.target, 0);
	// The points are consecutive days. The daily target counts selling days only: weekends book almost nothing.
	const firstDay = points[0]
		? Date.parse(`${points[0].day}T00:00:00Z`) / DAY_MS
		: 0;
	const sellingDays = sellingDaysBetween(firstDay, firstDay + points.length);
	let runningTotal = 0;
	const data = points.map((point) => {
		runningTotal += point.current;
		return {
			day: point.day,
			value: view === "perDay" ? point.current : runningTotal,
		};
	});
	// Per day, the line is the target of one selling day. In the running total, it is the target of the whole period.
	const targetLine =
		view === "perDay"
			? sellingDays > 0
				? periodTarget / sellingDays
				: 0
			: periodTarget;
	const isEmpty = points.every((point) => point.current === 0);
	const config = {
		value: { label: t("chart.booked"), color: "var(--chart-1)" },
	} satisfies ChartConfig;

	const last = points[points.length - 1];
	const lastChange =
		last && last.previous > 0
			? `, ${percent.format((last.current - last.previous) / last.previous)} ${t("chart.vsPrevious")}`
			: "";
	const ariaLabel = last
		? `${t("overview.trendTitle")}: ${dayLabel.format(new Date(`${last.day}T00:00:00Z`))}, ${money.format(last.current)}${lastChange}`
		: t("overview.trendTitle");

	return (
		<div className="relative grid gap-2">
			{isEmpty || targetLine === 0 ? null : (
				// The legend of the dashed line. A label on the line itself sits on the bars.
				<p className="flex items-center justify-end gap-2 text-muted-foreground text-xs">
					<span className="w-5 border-muted-foreground border-t border-dashed" />
					{t(view === "perDay" ? "chart.targetPerDay" : "chart.targetPeriod")}
					<span className="font-medium text-foreground tabular-nums">
						{compactMoney.format(targetLine)}
					</span>
				</p>
			)}
			<ChartContainer
				config={config}
				className={PLOT_CLASS}
				role="img"
				aria-label={ariaLabel}
			>
				<BarChart data={data} margin={{ top: 8, left: 4, right: 4 }}>
					<CartesianGrid vertical={false} />
					<XAxis
						dataKey="day"
						tickLine={false}
						axisLine={false}
						tickMargin={8}
						minTickGap={24}
						reversed={isRtl}
						tickFormatter={(value: string) =>
							dayLabel.format(new Date(`${value}T00:00:00Z`))
						}
					/>
					<YAxis
						hide={isEmpty}
						width="auto"
						tickLine={false}
						axisLine={false}
						tickMargin={8}
						orientation={isRtl ? "right" : "left"}
						tick={{ textAnchor: "end" }}
						domain={[
							0,
							// A round top keeps round ticks. 4 % headroom keeps the tallest bar off the top line.
							(dataMax: number) =>
								niceCeiling(Math.max(dataMax, targetLine) * 1.04),
						]}
						tickFormatter={(value: number) => compactMoney.format(value)}
					/>
					<ChartTooltip
						cursor={false}
						content={
							<ChartTooltipContent
								valueFormat={MONEY_OPTIONS}
								labelFormatter={(value) =>
									dayLabel.format(new Date(`${value}T00:00:00Z`))
								}
							/>
						}
					/>
					<Bar
						dataKey="value"
						fill="var(--color-value)"
						radius={[barRadius, barRadius, 0, 0]}
						isAnimationActive={false}
					/>
					{isEmpty || targetLine === 0 ? null : (
						<ReferenceLine
							y={targetLine}
							stroke="var(--foreground)"
							strokeOpacity={0.6}
							strokeDasharray="5 5"
							ifOverflow="extendDomain"
						/>
					)}
				</BarChart>
			</ChartContainer>
			{isEmpty ? (
				<div className="absolute inset-0 grid place-content-center justify-items-center gap-2 text-center">
					<p className="text-muted-foreground text-sm">{t("chart.empty")}</p>
					<Link to="/app/orders" className="font-medium text-sm underline">
						{t("chart.emptyAction")}
					</Link>
				</div>
			) : null}
		</div>
	);
}
