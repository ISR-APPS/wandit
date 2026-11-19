// The 3 charts of the day report: kitchen and bar bars per hour, checks and covers lines per hour, and the payments donut.
// The report cards load this file with React.lazy, so the chart library stays out of the first script of the app.
// Each chart reads the parts of the day report that its card passes. It writes nothing.
import {
	Bar,
	BarChart,
	CartesianGrid,
	Label,
	Line,
	LineChart,
	Pie,
	PieChart,
	XAxis,
} from "recharts";
import { BAR_RADIUS_PX, RESTAURANT_CURRENCY } from "~/features/restaurant";
import { useT } from "~/shared/i18n";
import {
	type ChartConfig,
	ChartContainer,
	ChartLegend,
	ChartLegendContent,
	ChartTooltip,
	ChartTooltipContent,
} from "~/shared/ui/chart";
import { useAppTheme } from "~/styles/theme";
import type { HourPoint, PaymentRow } from "../lib/day-report";

type HourChartProps = {
	/** One point per clock hour, oldest first. */
	hours: HourPoint[];
	/** The text for screen readers: the chart name and its totals. */
	label: string;
};

/** Two bars per hour, kitchen then bar, at the 21:9 ratio of the kit revenue chart. No value axis. */
export function HourBars({ hours, label }: HourChartProps) {
	const { t, locale, dir } = useT();
	const barRadius = BAR_RADIUS_PX[useAppTheme().selection.radius];
	const hourFormat = new Intl.DateTimeFormat(locale, { hour: "numeric" });
	// recharts plots whole currency units: the cents become euros here, for the tooltip.
	const data = hours.map((point) => ({
		hourStart: point.hourStart,
		kitchen: point.kitchenCents / 100,
		bar: point.barCents / 100,
	}));
	const config = {
		kitchen: { label: t("stations.kitchen"), color: "var(--chart-1)" },
		bar: { label: t("stations.bar"), color: "var(--chart-2)" },
	} satisfies ChartConfig;

	return (
		<ChartContainer
			config={config}
			className="aspect-21/9 w-full"
			role="img"
			aria-label={label}
		>
			<BarChart data={data} margin={{ top: 4, left: 0, right: 0, bottom: 0 }}>
				<XAxis
					dataKey="hourStart"
					reversed={dir === "rtl"}
					tickLine={false}
					axisLine={false}
					tickMargin={10}
					minTickGap={16}
					tickFormatter={(value: string) => hourFormat.format(new Date(value))}
				/>
				<ChartTooltip
					cursor={false}
					content={
						<ChartTooltipContent
							indicator="dashed"
							labelFormatter={(value) =>
								hourFormat.format(new Date(String(value)))
							}
							valueFormat={{
								style: "currency",
								currency: RESTAURANT_CURRENCY,
								maximumFractionDigits: 0,
							}}
						/>
					}
				/>
				<Bar
					dataKey="kitchen"
					fill="var(--color-kitchen)"
					radius={barRadius}
					isAnimationActive={false}
				/>
				<Bar
					dataKey="bar"
					fill="var(--color-bar)"
					radius={barRadius}
					isAnimationActive={false}
				/>
			</BarChart>
		</ChartContainer>
	);
}

/** Covers as the main line, checks as the quiet second line, as the kit returning-rate chart. */
export function HourLines({ hours, label }: HourChartProps) {
	const { t, locale, dir } = useT();
	const hourFormat = new Intl.DateTimeFormat(locale, { hour: "numeric" });
	const config = {
		covers: { label: t("report.covers"), color: "var(--chart-1)" },
		checks: { label: t("report.checks"), color: "var(--chart-2)" },
	} satisfies ChartConfig;

	return (
		<ChartContainer
			config={config}
			className="@3xl/main:mt-6 aspect-21/9 w-full"
			role="img"
			aria-label={label}
		>
			<LineChart data={hours} margin={{ left: 12, right: 12 }}>
				<CartesianGrid vertical={false} />
				<XAxis
					dataKey="hourStart"
					reversed={dir === "rtl"}
					tickLine={false}
					axisLine={false}
					tickMargin={8}
					minTickGap={16}
					// 20 px inside each end, so the first and last hour labels are not cut at the card edge.
					padding={{ left: 20, right: 20 }}
					tickFormatter={(value: string) => hourFormat.format(new Date(value))}
				/>
				<ChartTooltip
					cursor={false}
					content={
						<ChartTooltipContent
							labelFormatter={(value) =>
								hourFormat.format(new Date(String(value)))
							}
						/>
					}
				/>
				<Line
					dataKey="covers"
					stroke="var(--color-covers)"
					strokeWidth={2}
					dot={false}
					isAnimationActive={false}
				/>
				{/* The second series stays faint, so the eye reads the covers first. */}
				<Line
					dataKey="checks"
					stroke="var(--color-checks)"
					strokeOpacity={0.35}
					strokeWidth={2}
					dot={false}
					isAnimationActive={false}
				/>
			</LineChart>
		</ChartContainer>
	);
}

type PaymentsDonutProps = {
	/** Card, cash, and the open checks, in this order. */
	rows: PaymentRow[];
	/** The text for screen readers: the chart name and each slice. */
	label: string;
};

// One chart color per slice. The legend under the ring names each color.
const SLICE_COLOR = {
	card: "var(--chart-1)",
	cash: "var(--chart-2)",
	open: "var(--chart-3)",
} satisfies Record<PaymentRow["method"], string>;

/** A ring of the checks per payment, with the number of checks in the middle and a legend under it. */
export function PaymentsDonut({ rows, label }: PaymentsDonutProps) {
	const { t, locale } = useT();
	const number = new Intl.NumberFormat(locale);
	const total = rows.reduce((sum, row) => sum + row.checks, 0);
	const config = Object.fromEntries(
		rows.map((row) => [
			row.method,
			{
				label:
					row.method === "open"
						? t("report.openChecks")
						: t(`payments.${row.method}`),
				color: SLICE_COLOR[row.method],
			},
		]),
	) satisfies ChartConfig;
	const data = rows.map((row) => ({
		method: row.method,
		checks: row.checks,
		fill: `var(--color-${row.method})`,
	}));

	return (
		<ChartContainer
			config={config}
			className="mx-auto aspect-square max-h-80 w-full"
			role="img"
			aria-label={label}
		>
			<PieChart>
				<ChartTooltip
					cursor={false}
					content={<ChartTooltipContent hideLabel />}
				/>
				<Pie
					data={data}
					dataKey="checks"
					nameKey="method"
					innerRadius={60}
					stroke="var(--card)"
					strokeWidth={5}
					isAnimationActive={false}
				>
					<Label
						content={({ viewBox }) =>
							viewBox && "cx" in viewBox && "cy" in viewBox ? (
								<text
									x={viewBox.cx}
									y={viewBox.cy}
									textAnchor="middle"
									dominantBaseline="middle"
								>
									<tspan
										x={viewBox.cx}
										y={viewBox.cy}
										className="fill-foreground font-numeric font-semibold text-3xl"
									>
										{number.format(total)}
									</tspan>
									{/* 24 px under the total, as in the kit donut. */}
									<tspan
										x={viewBox.cx}
										y={(viewBox.cy ?? 0) + 24}
										className="fill-muted-foreground"
									>
										{t("report.checks")}
									</tspan>
								</text>
							) : null
						}
					/>
				</Pie>
				<ChartLegend content={<ChartLegendContent className="flex-wrap" />} />
			</PieChart>
		</ChartContainer>
	);
}
