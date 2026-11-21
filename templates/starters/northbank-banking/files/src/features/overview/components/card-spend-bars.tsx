// The mini bars at the foot of the card spend KPI: one bar per day of the period, with a tooltip.
// KpiTileCard holds it; OverviewPage loads this file with React.lazy, so the chart library stays out of the first script.
// The KPI value gives the total, so the bars are a picture of the rhythm and are hidden from screen readers.
import { Bar, BarChart, XAxis } from "recharts";
import {
	BANK_CURRENCY,
	BAR_RADIUS_PX,
	centsToUnits,
	dayFormat,
	dayToDate,
} from "~/features/bank";
import { useT } from "~/shared/i18n";
import {
	type ChartConfig,
	ChartContainer,
	ChartTooltip,
	ChartTooltipContent,
} from "~/shared/ui/chart";
import { useAppTheme } from "~/styles/theme";

type CardSpendBarsProps = {
	/** Card spend per day, oldest first, in positive cents. */
	points: { day: string; cents: number }[];
};

/** h-14 and flush with the card foot, as the finance mini bars of the kit. */
export function CardSpendBars({ points }: CardSpendBarsProps) {
	const { t, locale, dir } = useT();
	const barRadius = BAR_RADIUS_PX[useAppTheme().selection.radius];
	const longDay = dayFormat(locale, "long");
	const chartConfig = {
		spend: { label: t("overview.kpis.cardSpend"), color: "var(--chart-1)" },
	} satisfies ChartConfig;
	const data = points.map((point) => ({
		day: point.day,
		spend: centsToUnits(point.cents),
	}));
	return (
		<ChartContainer
			config={chartConfig}
			aria-hidden="true"
			className="aspect-auto h-14 w-full"
		>
			<BarChart data={data} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
				<XAxis dataKey="day" hide reversed={dir === "rtl"} />
				<ChartTooltip
					cursor={false}
					content={
						<ChartTooltipContent
							labelFormatter={(day) => longDay.format(dayToDate(String(day)))}
							valueFormat={{
								style: "currency",
								currency: BANK_CURRENCY,
								maximumFractionDigits: 0,
							}}
						/>
					}
				/>
				<Bar
					dataKey="spend"
					fill="var(--color-spend)"
					radius={[barRadius, barRadius, 0, 0]}
					isAnimationActive={false}
				/>
			</BarChart>
		</ChartContainer>
	);
}
