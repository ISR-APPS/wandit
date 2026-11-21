// The bar plot of the bookings card: the booked amount per day of one year, this year or last year.
// BookingsChartCard loads this file with React.lazy, so recharts stays out of the first script.
import { Bar, BarChart, CartesianGrid, XAxis } from "recharts";
import { MONEY_OPTIONS, moneyFormat } from "~/features/sales";
import { useT } from "~/shared/i18n";
import {
	type ChartConfig,
	ChartContainer,
	ChartTooltip,
	ChartTooltipContent,
} from "~/shared/ui/chart";
import type { YearPoint } from "../api/overview.queries";

/** The two series of the card. Labels: `overview.chart.<year>`. */
export type BookingsYear = "thisYear" | "lastYear";

type BookingsBarsProps = {
	points: YearPoint[];
	/** The series that the bars show. */
	year: BookingsYear;
	/** Bar corner in px, from the theme radius (BAR_RADIUS_PX). */
	barRadius: number;
};

/** One bar per day and no Y axis, so the bars fill the card. The tooltip gives the exact amount. */
export function BookingsBars({ points, year, barRadius }: BookingsBarsProps) {
	const { t, locale, dir } = useT();
	const money = moneyFormat(locale);
	const dayLabel = new Intl.DateTimeFormat(locale, {
		day: "numeric",
		month: "short",
		timeZone: "UTC",
	});
	const config = {
		thisYear: { label: t("overview.chart.thisYear"), color: "var(--chart-1)" },
		lastYear: { label: t("overview.chart.lastYear"), color: "var(--chart-2)" },
	} satisfies ChartConfig;
	const total = points.reduce((sum, point) => sum + point[year], 0);
	// The best day goes into the label, so a screen reader hears the total and the peak.
	const peak = points.reduce<YearPoint | undefined>(
		(best, point) => (point[year] > (best?.[year] ?? -1) ? point : best),
		undefined,
	);
	const ariaLabel = peak
		? `${config[year].label}: ${money.format(total)}. ${dayLabel.format(new Date(`${peak.day}T00:00:00Z`))}, ${money.format(peak[year])}`
		: config[year].label;

	return (
		<ChartContainer
			config={config}
			className="aspect-auto h-48 w-full"
			role="img"
			aria-label={ariaLabel}
		>
			<BarChart data={points} margin={{ top: 4, left: 0, right: 0 }}>
				<CartesianGrid vertical={false} />
				<XAxis
					dataKey="day"
					tickLine={false}
					axisLine={false}
					tickMargin={8}
					minTickGap={32}
					reversed={dir === "rtl"}
					tickFormatter={(value: string) =>
						dayLabel.format(new Date(`${value}T00:00:00Z`))
					}
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
					dataKey={year}
					fill={`var(--color-${year})`}
					radius={barRadius}
					isAnimationActive={false}
				/>
			</BarChart>
		</ChartContainer>
	);
}
