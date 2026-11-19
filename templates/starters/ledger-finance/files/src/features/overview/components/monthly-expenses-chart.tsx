// The bar chart of the monthly expenses card: one bar per calendar month, the oldest first.
// MonthlyExpensesCard loads this file with React.lazy, so the chart library stays out of the first script of the app.
// It follows recipe 3.2 of the kit system: no grid, a month axis with no line, rounded bars.
import { Bar, BarChart, XAxis } from "recharts";
import {
	centsToUnits,
	dayToDate,
	LEDGER_CURRENCY,
	moneyFormat,
} from "~/features/ledger";
import { useT } from "~/shared/i18n";
import {
	type ChartConfig,
	ChartContainer,
	ChartTooltip,
	ChartTooltipContent,
} from "~/shared/ui/chart";
import type { MonthExpense } from "../lib/overview-summary";

type MonthlyExpensesChartProps = {
	/** The expenses of each month, the oldest first. */
	months: MonthExpense[];
};

/** The aria-label names every month and its amount, for screen readers. */
export function MonthlyExpensesChart({ months }: MonthlyExpensesChartProps) {
	const { t, locale, dir } = useT();
	const shortMonth = new Intl.DateTimeFormat(locale, {
		month: "short",
		timeZone: "UTC",
	});
	const longMonth = new Intl.DateTimeFormat(locale, {
		month: "long",
		year: "numeric",
		timeZone: "UTC",
	});
	const money = moneyFormat(locale, 0);
	const chartConfig = {
		expenses: { label: t("overview.expenses"), color: "var(--chart-1)" },
	} satisfies ChartConfig;
	const data = months.map((month) => ({
		monthStart: month.monthStart,
		expenses: centsToUnits(month.expenseCents),
	}));

	return (
		<ChartContainer
			config={chartConfig}
			className="aspect-auto @4xl/main:h-80 h-56 w-full"
			role="img"
			aria-label={`${t("overview.monthlyTitle")}: ${months
				.map(
					(month) =>
						`${longMonth.format(dayToDate(month.monthStart))} ${money.format(
							centsToUnits(month.expenseCents),
						)}`,
				)
				.join(", ")}`}
		>
			<BarChart data={data} margin={{ top: 8, right: 0, bottom: 0, left: 0 }}>
				<XAxis
					dataKey="monthStart"
					tickLine={false}
					axisLine={false}
					tickMargin={10}
					reversed={dir === "rtl"}
					tickFormatter={(day: string) => shortMonth.format(dayToDate(day))}
				/>
				<ChartTooltip
					cursor={false}
					content={
						<ChartTooltipContent
							labelFormatter={(label) =>
								longMonth.format(dayToDate(String(label)))
							}
							valueFormat={{
								style: "currency",
								currency: LEDGER_CURRENCY,
								maximumFractionDigits: 0,
							}}
						/>
					}
				/>
				<Bar
					dataKey="expenses"
					fill="var(--color-expenses)"
					radius={8}
					isAnimationActive={false}
				/>
			</BarChart>
		</ChartContainer>
	);
}
