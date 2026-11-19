// The bars of the sales chart card: one bar per business day, for the sales or for the covers.
// SalesChartCard loads this file with React.lazy, so the chart library stays out of the first script of the app.
// It follows recipe 3.2 of the kit system: a grid with no vertical lines, a quiet day axis, and no value axis.
import { Bar, BarChart, CartesianGrid, XAxis } from "recharts";
import { BAR_RADIUS_PX, RESTAURANT_CURRENCY } from "~/features/restaurant";
import { useT } from "~/shared/i18n";
import {
	type ChartConfig,
	ChartContainer,
	ChartTooltip,
	ChartTooltipContent,
} from "~/shared/ui/chart";
import { useAppTheme } from "~/styles/theme";
import type { DayPoint } from "../lib/dashboard";

/** The two series of the totals box. */
export type SalesSeries = "sales" | "covers";

type SalesBarsProps = {
	points: DayPoint[];
	/** The series that the totals box picked. */
	series: SalesSeries;
	/** The text for screen readers: the series, the period, and its total. */
	label: string;
};

/** A day key YYYY-MM-DD read as a local date, so the label never shifts one day in a time zone west of UTC. */
function localDate(day: string): Date {
	const [year = 0, month = 1, date = 1] = day.split("-").map(Number);
	return new Date(year, month - 1, date);
}

/** h-48 high, as the kit revenue chart. A tooltip names the day and the value. */
export function SalesBars({ points, series, label }: SalesBarsProps) {
	const { t, locale, dir } = useT();
	const barRadius = BAR_RADIUS_PX[useAppTheme().selection.radius];
	const dayFormat = new Intl.DateTimeFormat(locale, {
		month: "short",
		day: "numeric",
	});
	// recharts plots whole currency units: the cents become euros here, for the tooltip.
	const data = points.map((point) => ({
		day: point.day,
		sales: point.salesCents / 100,
		covers: point.covers,
	}));
	const config = {
		sales: { label: t("dashboard.sales"), color: "var(--chart-1)" },
		covers: { label: t("dashboard.covers"), color: "var(--chart-2)" },
	} satisfies ChartConfig;

	return (
		<ChartContainer
			config={config}
			className="aspect-auto h-48 w-full"
			role="img"
			aria-label={label}
		>
			<BarChart data={data} margin={{ top: 4, left: 0, right: 0, bottom: 0 }}>
				<CartesianGrid vertical={false} />
				<XAxis
					dataKey="day"
					reversed={dir === "rtl"}
					tickLine={false}
					axisLine={false}
					tickMargin={8}
					minTickGap={32}
					tickFormatter={(value: string) => dayFormat.format(localDate(value))}
				/>
				<ChartTooltip
					cursor={false}
					content={
						<ChartTooltipContent
							labelFormatter={(value) =>
								dayFormat.format(localDate(String(value)))
							}
							valueFormat={
								series === "sales"
									? {
											style: "currency",
											currency: RESTAURANT_CURRENCY,
											maximumFractionDigits: 0,
										}
									: undefined
							}
						/>
					}
				/>
				<Bar
					dataKey={series}
					fill={`var(--color-${series})`}
					radius={[barRadius, barRadius, 0, 0]}
					isAnimationActive={false}
				/>
			</BarChart>
		</ChartContainer>
	);
}
