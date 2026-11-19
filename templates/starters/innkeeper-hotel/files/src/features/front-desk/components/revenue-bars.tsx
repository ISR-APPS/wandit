// The bar chart of the revenue card: the room revenue at the bottom and the extras on top, per day or per week.
// RevenueCard loads this file with React.lazy, so the chart library stays out of the first script of the app.
// The extras part has a stripe pattern, so the two parts differ by more than the color.
import { useId } from "react";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { dayToDate, fillMessage, moneyFormat } from "~/features/hotel";
import { useT } from "~/shared/i18n";
import {
	type ChartConfig,
	ChartContainer,
	ChartTooltip,
	ChartTooltipContent,
} from "~/shared/ui/chart";
import type { RevenueBar, RevenuePeriod } from "../lib/home-figures";

type RevenueBarsProps = {
	bars: RevenueBar[];
	/** "week": one bar per day. "month": one bar per week. */
	period: RevenuePeriod;
	/** The text of the chart for a screen reader: the period and its sum. */
	label: string;
};

/** Stacked bars with a compact money axis. Arabic mirrors the axes. */
export function RevenueBars({ bars, period, label }: RevenueBarsProps) {
	const { t, locale, dir } = useT();
	const patternId = `extras-${useId().replaceAll(":", "")}`;
	const money = moneyFormat(locale);
	const compactMoney = new Intl.NumberFormat(locale, { notation: "compact" });
	const dayName = new Intl.DateTimeFormat(locale, { weekday: "short" });
	const shortDate = new Intl.DateTimeFormat(locale, {
		day: "numeric",
		month: "short",
	});
	const barLabel = (fromDay: string) =>
		period === "week"
			? dayName.format(dayToDate(fromDay))
			: fillMessage(t("frontDesk.revenue.weekOf"), {
					date: shortDate.format(dayToDate(fromDay)),
				});
	const chartConfig = {
		rooms: { label: t("frontDesk.revenue.rooms"), color: "var(--chart-1)" },
		extras: { label: t("frontDesk.revenue.extras"), color: "var(--chart-3)" },
	} satisfies ChartConfig;
	const isRtl = dir === "rtl";

	return (
		<ChartContainer
			config={chartConfig}
			className="aspect-auto h-60 w-full"
			role="img"
			aria-label={label}
		>
			<BarChart data={bars} margin={{ top: 8, right: 0, bottom: 0, left: 0 }}>
				<defs>
					{/* Stripes at 45 degrees: 3 px of the series color, 3 px of the card. */}
					<pattern
						id={patternId}
						patternUnits="userSpaceOnUse"
						width="6"
						height="6"
						patternTransform="rotate(45)"
					>
						<rect width="6" height="6" fill="var(--card)" />
						<rect width="3" height="6" fill="var(--color-extras)" />
					</pattern>
				</defs>
				<CartesianGrid vertical={false} />
				<XAxis
					dataKey="fromDay"
					tickLine={false}
					axisLine={false}
					tickMargin={8}
					reversed={isRtl}
					tickFormatter={barLabel}
				/>
				<YAxis
					tickLine={false}
					axisLine={false}
					width={36}
					orientation={isRtl ? "right" : "left"}
					tickFormatter={(value: number) => compactMoney.format(value)}
				/>
				<ChartTooltip
					cursor={false}
					content={
						<ChartTooltipContent
							labelFormatter={(day) =>
								typeof day === "string" ? barLabel(day) : day
							}
							// The series names come from chartConfig. The values use the hotel currency.
							valueFormat={money.resolvedOptions()}
						/>
					}
				/>
				<Bar
					dataKey="rooms"
					stackId="revenue"
					fill="var(--color-rooms)"
					radius={[0, 0, 4, 4]}
					isAnimationActive={false}
				/>
				<Bar
					dataKey="extras"
					stackId="revenue"
					fill={`url(#${patternId})`}
					stroke="var(--color-extras)"
					radius={[4, 4, 0, 0]}
					isAnimationActive={false}
				/>
			</BarChart>
		</ChartContainer>
	);
}
