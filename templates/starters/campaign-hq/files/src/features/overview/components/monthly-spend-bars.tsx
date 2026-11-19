// The stacked bars of the spend card: the spend of each calendar month, paid media under owned channels.
// MonthlySpendCard loads this file with React.lazy, so the chart library stays out of the first script.
// Paid media sits at the base with the bottom corners round, owned channels on top with the top corners round.
import { Bar, BarChart, XAxis } from "recharts";
import { CURRENCY, moneyFormat } from "~/features/marketing";
import { useT } from "~/shared/i18n";
import {
	type ChartConfig,
	ChartContainer,
	ChartTooltip,
	ChartTooltipContent,
} from "~/shared/ui/chart";
import type { MonthSpend } from "../api/overview.queries";

type MonthlySpendBarsProps = {
	/** Six calendar months, the oldest first. */
	months: MonthSpend[];
};

/** The aria-label names each month and its spend, so the chart reads without the tooltip. */
export function MonthlySpendBars({ months }: MonthlySpendBarsProps) {
	const { t, locale, dir } = useT();
	const money = moneyFormat(locale, "compact");
	const monthFormat = new Intl.DateTimeFormat(locale, {
		month: "short",
		timeZone: "UTC",
	});
	// A YYYY-MM key at noon UTC on the 15th, so every time zone reads the same month.
	const monthName = (month: string) =>
		monthFormat.format(new Date(`${month}-15T12:00:00Z`));
	const config = {
		paid: { label: t("overview.paidMedia"), color: "var(--chart-1)" },
		owned: { label: t("overview.ownedChannels"), color: "var(--chart-3)" },
	} satisfies ChartConfig;
	return (
		<ChartContainer
			config={config}
			className="aspect-21/9 w-full"
			role="img"
			aria-label={`${t("overview.spendTitle")}: ${months
				.map(
					(month) =>
						`${monthName(month.month)} ${money.format(month.paid + month.owned)}`,
				)
				.join(", ")}`}
		>
			<BarChart data={months} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
				<Bar
					dataKey="paid"
					stackId="spend"
					fill="var(--color-paid)"
					radius={[0, 0, 5, 5]}
					maxBarSize={50}
					isAnimationActive={false}
				/>
				<Bar
					dataKey="owned"
					stackId="spend"
					fill="var(--color-owned)"
					radius={[5, 5, 0, 0]}
					maxBarSize={50}
					isAnimationActive={false}
				/>
				{/* Time runs from right to left in Arabic. */}
				<XAxis
					dataKey="month"
					tickLine={false}
					axisLine={false}
					tickMargin={10}
					reversed={dir === "rtl"}
					tickFormatter={monthName}
				/>
				<ChartTooltip
					cursor={false}
					content={
						<ChartTooltipContent
							labelFormatter={(month) => monthName(String(month))}
							valueFormat={{
								style: "currency",
								currency: CURRENCY,
								notation: "compact",
								maximumSignificantDigits: 3,
							}}
						/>
					}
				/>
			</BarChart>
		</ChartContainer>
	);
}
