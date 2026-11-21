// The line chart of the balance card: one line per account over about 7 months, with month ticks.
// BalanceSummaryCard loads it with React.lazy, so recharts loads after the first paint of the home.
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";
import { ACCOUNTS, CURRENCY } from "~/features/ledger";
import { useT } from "~/shared/i18n";
import {
	type ChartConfig,
	ChartContainer,
	ChartTooltip,
	ChartTooltipContent,
} from "~/shared/ui/chart";
import type { BalancePoint } from "../api/portfolio.queries";

type BalanceChartProps = {
	/** The points of accountBalancesQueryOptions, oldest first. */
	points: BalancePoint[];
	/** One color and one label per account. The card draws the same colors on its tiles. */
	config: ChartConfig;
	/** The text for screen readers, already translated: the value of each account today. */
	label: string;
};

/** The default export, so React.lazy can load the file. */
export default function BalanceChart({
	points,
	config,
	label,
}: BalanceChartProps) {
	const { locale, dir } = useT();
	const month = new Intl.DateTimeFormat(locale, { month: "short" });
	const day = new Intl.DateTimeFormat(locale, { dateStyle: "medium" });
	const compact = new Intl.NumberFormat(locale, {
		style: "currency",
		currency: CURRENCY,
		notation: "compact",
		maximumSignificantDigits: 3,
	});
	// One tick per month: the first point of each calendar month. The first point starts mid-month, so it gets no tick.
	const monthTicks = points
		.filter(
			(point, index) =>
				index > 0 &&
				new Date(point.time).getMonth() !==
					new Date(points[index - 1]?.time ?? 0).getMonth(),
		)
		.map((point) => point.time);
	const isRtl = dir === "rtl";

	return (
		<ChartContainer
			config={config}
			className="aspect-auto @4xl/main:h-88 h-64 w-full"
			role="img"
			aria-label={label}
		>
			<LineChart data={points} margin={{ left: 12, right: 12, top: 8 }}>
				<CartesianGrid vertical={false} />
				<XAxis
					dataKey="time"
					ticks={monthTicks}
					tickLine={false}
					axisLine={false}
					tickMargin={8}
					reversed={isRtl}
					tickFormatter={(time: number) => month.format(time)}
				/>
				<YAxis
					width="auto"
					tickLine={false}
					axisLine={false}
					tickMargin={8}
					orientation={isRtl ? "right" : "left"}
					tickFormatter={(value: number) => compact.format(value)}
				/>
				<ChartTooltip
					cursor={false}
					content={
						<ChartTooltipContent
							labelFormatter={(time) => day.format(Number(time))}
							valueFormat={{
								style: "currency",
								currency: CURRENCY,
								maximumFractionDigits: 0,
							}}
						/>
					}
				/>
				{ACCOUNTS.map((account) => (
					<Line
						key={account}
						dataKey={account}
						type="monotone"
						stroke={`var(--color-${account})`}
						strokeWidth={2}
						dot={false}
						isAnimationActive={false}
					/>
				))}
			</LineChart>
		</ChartContainer>
	);
}
