// The small balance curve of one account row: the balance at the end of each of the last 90 days.
// AccountRow renders it. The curve is a step line: a balance stays flat until the next entry moves it.
import { useId } from "react";
import { Area, AreaChart, XAxis, YAxis } from "recharts";
import {
	centsToUnits,
	type DailyBalance,
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

type BalanceSparklineProps = {
	/** The name of the account, for the label of the plot. */
	accountName: string;
	/** One balance per day, oldest first. */
	balances: DailyBalance[];
	/** True for a card: the plot shows the amount owed, so a higher curve is a higher debt. */
	isDebt: boolean;
};

/** The plot has no axis. Its scale runs from the lowest to the highest balance, so a small move still shows. */
export function BalanceSparkline({
	accountName,
	balances,
	isDebt,
}: BalanceSparklineProps) {
	const { t, locale } = useT();
	const day = dayFormat(locale, "long");
	// Each plot needs its own gradient id: the page draws one plot per account.
	const gradientId = useId();
	const chartConfig = {
		balance: {
			label: t(isDebt ? "accounts.owed" : "accounts.balance"),
			color: "var(--chart-1)",
		},
	} satisfies ChartConfig;
	const rows = balances.map((point) => ({
		day: point.day,
		// A card balance is negative, so the debt is its opposite.
		balance: centsToUnits(isDebt ? -point.balanceCents : point.balanceCents),
	}));

	return (
		<ChartContainer
			config={chartConfig}
			className="aspect-auto h-12 w-full"
			role="img"
			aria-label={`${accountName}, ${t(isDebt ? "accounts.debtTrend" : "accounts.balanceTrend")}`}
		>
			<AreaChart data={rows} margin={{ top: 2, right: 0, bottom: 2, left: 0 }}>
				<defs>
					{/* The fill fades to nothing at the bottom, so the curve stays the strong part. */}
					<linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
						<stop
							offset="0%"
							stopColor="var(--color-balance)"
							stopOpacity={0.5}
						/>
						<stop
							offset="100%"
							stopColor="var(--color-balance)"
							stopOpacity={0.04}
						/>
					</linearGradient>
				</defs>
				{/* Hidden: the tooltip reads the day of each point from this axis. */}
				<XAxis dataKey="day" hide />
				<YAxis hide domain={["dataMin", "dataMax"]} />
				<ChartTooltip
					cursor={false}
					content={
						<ChartTooltipContent
							labelFormatter={(label) => day.format(dayToDate(String(label)))}
							valueFormat={{ style: "currency", currency: LEDGER_CURRENCY }}
						/>
					}
				/>
				<Area
					dataKey="balance"
					type="stepAfter"
					stroke="var(--color-balance)"
					fill={`url(#${gradientId})`}
					// The fill starts at the lowest balance, not at zero, so it stays inside the plot.
					baseValue="dataMin"
					isAnimationActive={false}
				/>
			</AreaChart>
		</ChartContainer>
	);
}
