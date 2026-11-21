// The line of the balance history card: the end-of-day balance of one account, or of all three.
// BalanceHistoryCard loads this file with React.lazy, so the chart library stays out of the first script of the app.
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";
import {
	BANK_CURRENCY,
	centsToUnits,
	dayFormat,
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
import type { BalancePoint } from "../lib/overview";

type BalanceLineChartProps = {
	/** The end-of-day balances, oldest first. */
	points: BalancePoint[];
	/** The translated name of the account or of "All accounts", for the tooltip and the aria-label. */
	label: string;
};

/** The aria-label names the first and the last balance, so the line needs no table. */
export function BalanceLineChart({ points, label }: BalanceLineChartProps) {
	const { locale, dir } = useT();
	const shortDay = dayFormat(locale);
	const longDay = dayFormat(locale, "long");
	const money = moneyFormat(locale, 0);
	const chartConfig = {
		balance: { label, color: "var(--chart-1)" },
	} satisfies ChartConfig;
	const data = points.map((point) => ({
		day: point.day,
		balance: centsToUnits(point.cents),
	}));
	const first = data[0];
	const last = data.at(-1);
	return (
		<ChartContainer
			config={chartConfig}
			className="aspect-auto h-64 w-full"
			role="img"
			aria-label={
				first && last
					? `${label}: ${longDay.format(dayToDate(first.day))} ${money.format(first.balance)}, ${longDay.format(dayToDate(last.day))} ${money.format(last.balance)}`
					: label
			}
		>
			<LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
				<CartesianGrid vertical={false} />
				<XAxis
					dataKey="day"
					tickLine={false}
					axisLine={false}
					tickMargin={8}
					minTickGap={32}
					reversed={dir === "rtl"}
					tickFormatter={(day: string) => shortDay.format(dayToDate(day))}
				/>
				{/* Hidden: it only fits the line to the range of the balances, so the moves stay visible. */}
				<YAxis hide domain={["dataMin", "dataMax"]} />
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
				<Line
					dataKey="balance"
					type="monotone"
					stroke="var(--color-balance)"
					strokeWidth={2}
					dot={false}
					isAnimationActive={false}
				/>
			</LineChart>
		</ChartContainer>
	);
}
