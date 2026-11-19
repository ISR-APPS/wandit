// The bars of the cash flow card: one bar per calendar month, money in or money out.
// CashFlowCard loads this file with React.lazy, so the chart library stays out of the first script of the app.
import { Bar, BarChart, CartesianGrid, XAxis } from "recharts";
import {
	BANK_CURRENCY,
	BAR_RADIUS_PX,
	centsToUnits,
	dayToDate,
	moneyFormat,
} from "~/features/bank";
import { useT } from "~/shared/i18n";
import {
	type ChartConfig,
	ChartContainer,
	ChartTooltip,
	ChartTooltipContent,
} from "~/shared/ui/chart";
import { useAppTheme } from "~/styles/theme";
import type { MonthFlow } from "../lib/overview";

type CashFlowChartProps = {
	/** The last 6 months, oldest first. */
	flows: MonthFlow[];
	/** The series on show: money in or money out. */
	series: "in" | "out";
	/** The translated name of the series, for the tooltip and the aria-label. */
	label: string;
};

/** No Y axis, as in the kit: the tooltip and the aria-label give the values. */
export function CashFlowChart({ flows, series, label }: CashFlowChartProps) {
	const { locale, dir } = useT();
	const barRadius = BAR_RADIUS_PX[useAppTheme().selection.radius];
	const money = moneyFormat(locale, 0);
	const shortMonth = new Intl.DateTimeFormat(locale, {
		month: "short",
		timeZone: "UTC",
	});
	const longMonth = new Intl.DateTimeFormat(locale, {
		month: "long",
		year: "numeric",
		timeZone: "UTC",
	});
	const chartConfig = {
		amount: {
			label,
			color: series === "in" ? "var(--chart-1)" : "var(--chart-2)",
		},
	} satisfies ChartConfig;
	const data = flows.map((flow) => ({
		month: flow.month,
		amount: centsToUnits(series === "in" ? flow.inCents : flow.outCents),
	}));
	return (
		<ChartContainer
			config={chartConfig}
			className="aspect-auto @4xl/main:h-72 h-56 w-full"
			role="img"
			aria-label={`${label}: ${data
				.map(
					(point) =>
						`${longMonth.format(dayToDate(point.month))} ${money.format(point.amount)}`,
				)
				.join(", ")}`}
		>
			<BarChart data={data} margin={{ top: 8, right: 0, bottom: 0, left: 0 }}>
				<CartesianGrid vertical={false} />
				<XAxis
					dataKey="month"
					tickLine={false}
					axisLine={false}
					tickMargin={10}
					reversed={dir === "rtl"}
					tickFormatter={(month: string) => shortMonth.format(dayToDate(month))}
				/>
				<ChartTooltip
					cursor={false}
					content={
						<ChartTooltipContent
							labelFormatter={(month) =>
								longMonth.format(dayToDate(String(month)))
							}
							valueFormat={{
								style: "currency",
								currency: BANK_CURRENCY,
								maximumFractionDigits: 0,
							}}
						/>
					}
				/>
				<Bar
					dataKey="amount"
					fill="var(--color-amount)"
					radius={[barRadius, barRadius, 0, 0]}
					isAnimationActive={false}
				/>
			</BarChart>
		</ChartContainer>
	);
}
