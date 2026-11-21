// The mini bars of the outstanding card: the amount invoiced on each day of the period.
// BillingPage loads this file with React.lazy, so the chart library stays out of the first script of the app.
// It follows the bar spark of recipe 3.8: one bar series, no axis, a tooltip. The card text gives the value.
import { Bar, BarChart, XAxis } from "recharts";
import { BAR_RADIUS_PX, dayToDate } from "~/features/practice";
import { useT } from "~/shared/i18n";
import {
	type ChartConfig,
	ChartContainer,
	ChartTooltip,
	ChartTooltipContent,
} from "~/shared/ui/chart";
import { useAppTheme } from "~/styles/theme";

type InvoicedSparkProps = {
	/** One point per day of the period, oldest first. `amount` is in whole USD. */
	points: { day: string; amount: number }[];
};

/** aria-hidden: the card names the outstanding total in text. The tooltip names each day. */
export function InvoicedSpark({ points }: InvoicedSparkProps) {
	const { t, locale, dir } = useT();
	const { radius } = useAppTheme().selection;
	const dayFormat = new Intl.DateTimeFormat(locale, {
		day: "numeric",
		month: "short",
		timeZone: "UTC",
	});
	const chartConfig = {
		amount: { label: t("billing.invoiced"), color: "var(--chart-1)" },
	} satisfies ChartConfig;

	return (
		<ChartContainer
			config={chartConfig}
			aria-hidden="true"
			className="aspect-auto h-12 w-full"
		>
			<BarChart data={points} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
				<XAxis dataKey="day" hide reversed={dir === "rtl"} />
				<ChartTooltip
					cursor={false}
					content={
						<ChartTooltipContent
							labelFormatter={(day) => dayFormat.format(dayToDate(String(day)))}
						/>
					}
				/>
				<Bar
					dataKey="amount"
					fill="var(--color-amount)"
					radius={BAR_RADIUS_PX[radius]}
					isAnimationActive={false}
				/>
			</BarChart>
		</ChartContainer>
	);
}
