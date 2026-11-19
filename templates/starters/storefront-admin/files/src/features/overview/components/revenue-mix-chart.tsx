// The grouped bar chart of the "Revenue by month" card: two bars per month, new and returning customers.
// RevenueMixCard loads this file with React.lazy, so the chart library stays out of the first script of the app.
// It follows the bar form of the app-dashboard skill: theme radius, no Y axis, a money tooltip.
import { Bar, BarChart, XAxis } from "recharts";
import { CURRENCY } from "~/features/shop";
import { useT } from "~/shared/i18n";
import {
	type ChartConfig,
	ChartContainer,
	ChartTooltip,
	ChartTooltipContent,
} from "~/shared/ui/chart";
import { type AppThemeFile, useAppTheme } from "~/styles/theme";
import type { MonthRevenue } from "../lib/summary";

/** Bar corner in px for each radius of the theme. recharts takes a number, not a CSS variable. */
const BAR_RADIUS_PX = {
	none: 0,
	sm: 2,
	md: 2,
	lg: 4,
	xl: 4,
} satisfies Record<AppThemeFile["selection"]["radius"], number>;

type RevenueMixChartProps = {
	/** The last 6 calendar months, oldest first. */
	months: MonthRevenue[];
};

/** Two series per month. The tooltip names both amounts of the month. */
export function RevenueMixChart({ months }: RevenueMixChartProps) {
	const { t, locale, dir } = useT();
	const barRadius = BAR_RADIUS_PX[useAppTheme().selection.radius];
	const config = {
		newCustomers: {
			label: t("overview.mix.newCustomers"),
			color: "var(--chart-1)",
		},
		returningCustomers: {
			label: t("overview.mix.returningCustomers"),
			color: "var(--chart-2)",
		},
	} satisfies ChartConfig;
	// The 15th of the month at noon UTC names the same month in every time zone.
	const monthName = new Intl.DateTimeFormat(locale, {
		month: "short",
		timeZone: "UTC",
	});
	const monthOf = (month: string) => new Date(`${month}-15T12:00:00Z`);
	const money = new Intl.NumberFormat(locale, {
		style: "currency",
		currency: CURRENCY,
		maximumFractionDigits: 0,
	});
	const last = months.at(-1);

	return (
		<ChartContainer
			config={config}
			className="aspect-auto h-64 w-full"
			role="img"
			aria-label={
				last
					? `${t("overview.mix.title")}. ${monthName.format(monthOf(last.month))}: ${config.newCustomers.label} ${money.format(last.newCustomers)}, ${config.returningCustomers.label} ${money.format(last.returningCustomers)}.`
					: t("overview.mix.title")
			}
		>
			<BarChart data={months} margin={{ left: -6, right: -6 }}>
				<XAxis
					dataKey="month"
					tickLine={false}
					axisLine={false}
					tickMargin={10}
					reversed={dir === "rtl"}
					tickFormatter={(month: string) => monthName.format(monthOf(month))}
				/>
				<ChartTooltip
					cursor={false}
					content={
						<ChartTooltipContent
							indicator="dashed"
							labelFormatter={(month) =>
								new Intl.DateTimeFormat(locale, {
									month: "long",
									year: "numeric",
									timeZone: "UTC",
								}).format(monthOf(String(month)))
							}
							valueFormat={{
								style: "currency",
								currency: CURRENCY,
								maximumFractionDigits: 0,
							}}
						/>
					}
				/>
				<Bar
					dataKey="newCustomers"
					fill="var(--color-newCustomers)"
					radius={[barRadius, barRadius, 0, 0]}
					isAnimationActive={false}
				/>
				<Bar
					dataKey="returningCustomers"
					fill="var(--color-returningCustomers)"
					radius={[barRadius, barRadius, 0, 0]}
					isAnimationActive={false}
				/>
			</BarChart>
		</ChartContainer>
	);
}
