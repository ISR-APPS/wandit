// The mini bars of the card KPI: what the cards owed at the end of each day of the period.
// OverviewPage loads this file with React.lazy, so the chart library stays out of the first script of the app.
// It follows recipe 3.8 of the kit system: one bar per day, no axis, on the bottom edge of the card.
import { Bar, BarChart, XAxis } from "recharts";
import {
	centsToUnits,
	dayFormat,
	dayToDate,
	LEDGER_CURRENCY,
} from "~/features/ledger";
import { useT } from "~/shared/i18n";
import {
	type ChartConfig,
	ChartContainer,
	ChartTooltip,
	ChartTooltipContent,
} from "~/shared/ui/chart";

type CardDebtBarsProps = {
	/** What the cards owed at the end of each day, oldest first, in cents. */
	points: { day: string; debtCents: number }[];
};

/** The KPI text above names the value, so the chart is hidden from screen readers. The tooltip names each day. */
export function CardDebtBars({ points }: CardDebtBarsProps) {
	const { t, locale, dir } = useT();
	const day = dayFormat(locale);
	const chartConfig = {
		debt: { label: t("overview.cardDebt"), color: "var(--chart-1)" },
	} satisfies ChartConfig;
	const data = points.map((point) => ({
		label: day.format(dayToDate(point.day)),
		debt: centsToUnits(point.debtCents),
	}));
	return (
		<ChartContainer
			config={chartConfig}
			aria-hidden="true"
			className="aspect-auto h-14 w-full"
		>
			<BarChart data={data} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
				{/* A hidden axis gives the tooltip the day of the bar as its title. */}
				<XAxis dataKey="label" hide reversed={dir === "rtl"} />
				<ChartTooltip
					cursor={false}
					content={
						<ChartTooltipContent
							valueFormat={{
								style: "currency",
								currency: LEDGER_CURRENCY,
								maximumFractionDigits: 0,
							}}
						/>
					}
				/>
				<Bar
					dataKey="debt"
					fill="var(--color-debt)"
					radius={[3, 3, 0, 0]}
					isAnimationActive={false}
				/>
			</BarChart>
		</ChartContainer>
	);
}
