// The plot of the ticket sales card: the chosen series per day, and the same days one period earlier.
// TicketSalesCard loads this file with React.lazy, so the chart library stays out of the first script of the app.
// It follows recipe 3.2 and the area form of the app-dashboard skill: monotone curve, soft gradient, compact Y ticks.
import { useId } from "react";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { BOX_OFFICE_CURRENCY } from "~/features/organiser";
import { useT } from "~/shared/i18n";
import {
	type ChartConfig,
	ChartContainer,
	ChartTooltip,
	ChartTooltipContent,
} from "~/shared/ui/chart";

/** One day of the plot. */
export type SalesChartPoint = {
	/** The local day, `YYYY-MM-DD`. */
	day: string;
	/** The value of the day: tickets, or revenue in whole euros. */
	current: number;
	/** The value of the same day one period earlier. */
	previous: number;
};

type TicketSalesChartProps = {
	points: SalesChartPoint[];
	/** "revenue" formats the values as money. */
	series: "tickets" | "revenue";
	/** The aria-label of the plot: the title, the last day, and its value. */
	label: string;
};

/** The current period is a filled area. The previous period is a plain line behind it. */
export function TicketSalesChart({
	points,
	series,
	label,
}: TicketSalesChartProps) {
	const { t, locale, dir } = useT();
	const fillId = useId();
	const isRtl = dir === "rtl";
	const valueFormat: Intl.NumberFormatOptions =
		series === "revenue"
			? {
					style: "currency",
					currency: BOX_OFFICE_CURRENCY,
					maximumFractionDigits: 0,
				}
			: {};
	const compact = new Intl.NumberFormat(locale, {
		...valueFormat,
		notation: "compact",
	});
	const dayLabel = new Intl.DateTimeFormat(locale, {
		day: "numeric",
		month: "short",
		timeZone: "UTC",
	});
	// `day` is YYYY-MM-DD with no time. Midnight UTC, shown in UTC, keeps the same calendar day.
	const formatDay = (day: string) =>
		dayLabel.format(new Date(`${day}T00:00:00Z`));
	const config = {
		current: { label: t("overview.thisPeriod"), color: "var(--chart-1)" },
		previous: { label: t("overview.periodBefore"), color: "var(--chart-2)" },
	} satisfies ChartConfig;
	const isEmpty = points.every(
		(point) => point.current === 0 && point.previous === 0,
	);

	return (
		<ChartContainer
			config={config}
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
				<YAxis
					hide={isEmpty}
					orientation={isRtl ? "right" : "left"}
					tick={{ textAnchor: "end" }}
					width="auto"
					tickLine={false}
					axisLine={false}
					tickMargin={8}
					tickFormatter={(value: number) => compact.format(value)}
				/>
				<ChartTooltip
					cursor={false}
					content={
						<ChartTooltipContent
							valueFormat={valueFormat}
							labelFormatter={(value) => formatDay(String(value))}
						/>
					}
				/>
				<Area
					dataKey="previous"
					type="monotone"
					stroke="var(--color-previous)"
					fill="none"
					isAnimationActive={false}
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
	);
}
