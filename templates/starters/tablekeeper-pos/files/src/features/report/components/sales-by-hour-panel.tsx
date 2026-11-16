// The "Sales by hour" panel of the day report: one bar per clock hour since the first check.
// ReportPage renders it in the first row. A paid check counts in the hour of its payment, as on a till.
// It reads the hour points of the day report. It writes nothing.
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import {
	fillMessage,
	formatCents,
	RESTAURANT_CURRENCY,
	wholeMoneyFormat,
} from "~/features/restaurant";
import { useT } from "~/shared/i18n";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "~/shared/ui/card";
import {
	type ChartConfig,
	ChartContainer,
	ChartTooltip,
	ChartTooltipContent,
} from "~/shared/ui/chart";
import { type AppThemeFile, useAppTheme } from "~/styles/theme";
import type { HourPoint } from "../lib/day-report";

/** Bar corner in px for each radius of the theme. recharts takes a number, not a CSS variable. */
const BAR_RADIUS_PX = {
	none: 0,
	sm: 2,
	md: 2,
	lg: 4,
	xl: 4,
} satisfies Record<AppThemeFile["selection"]["radius"], number>;

type SalesByHourPanelProps = {
	/** One point per clock hour, oldest first. */
	hours: HourPoint[];
};

/** A Card with a bar chart at main height. The busiest hour is named in the description. */
export function SalesByHourPanel({ hours }: SalesByHourPanelProps) {
	const { t, locale, dir } = useT();
	const barRadius = BAR_RADIUS_PX[useAppTheme().selection.radius];
	const wholeMoney = wholeMoneyFormat(locale);
	const compactMoney = new Intl.NumberFormat(locale, {
		style: "currency",
		currency: RESTAURANT_CURRENCY,
		notation: "compact",
	});
	const hourFormat = new Intl.DateTimeFormat(locale, { hour: "numeric" });
	// recharts plots whole currency units: the cents become euros here, for the axis and the tooltip.
	const data = hours.map((point) => ({
		hourStart: point.hourStart,
		sales: point.salesCents / 100,
	}));
	const busiest = hours.reduce<HourPoint | undefined>(
		(best, point) =>
			best === undefined || point.salesCents > best.salesCents ? point : best,
		undefined,
	);
	const label =
		busiest && busiest.salesCents > 0
			? fillMessage(t("report.salesByHourLabel"), {
					hour: hourFormat.format(new Date(busiest.hourStart)),
					amount: formatCents(wholeMoney, busiest.salesCents),
				})
			: t("chart.empty");
	const config = {
		sales: { label: t("report.sales"), color: "var(--chart-1)" },
	} satisfies ChartConfig;
	const isRtl = dir === "rtl";

	return (
		<Card className="h-full">
			<CardHeader>
				<CardTitle>{t("report.salesByHour")}</CardTitle>
				<CardDescription>{label}</CardDescription>
			</CardHeader>
			<CardContent>
				<ChartContainer
					config={config}
					className="aspect-auto h-64 w-full"
					role="img"
					aria-label={`${t("report.salesByHour")}. ${label}`}
				>
					<BarChart
						data={data}
						margin={{ top: 4, left: isRtl ? 8 : 0, right: isRtl ? 0 : 8 }}
					>
						<CartesianGrid vertical={false} />
						<XAxis
							dataKey="hourStart"
							reversed={isRtl}
							tickLine={false}
							axisLine={false}
							tickMargin={8}
							minTickGap={16}
							tickFormatter={(value: string) =>
								hourFormat.format(new Date(value))
							}
						/>
						{/* A fixed tick count with whole values makes recharts pick round steps, not 95 or 285. */}
						<YAxis
							domain={[0, "auto"]}
							allowDecimals={false}
							tickCount={5}
							width="auto"
							orientation={isRtl ? "right" : "left"}
							tick={{ textAnchor: "end" }}
							tickLine={false}
							axisLine={false}
							tickMargin={8}
							tickFormatter={(value: number) => compactMoney.format(value)}
						/>
						<ChartTooltip
							cursor={false}
							content={
								<ChartTooltipContent
									labelFormatter={(value) =>
										hourFormat.format(new Date(String(value)))
									}
									valueFormat={{
										style: "currency",
										currency: RESTAURANT_CURRENCY,
									}}
								/>
							}
						/>
						<Bar
							dataKey="sales"
							fill="var(--color-sales)"
							radius={[barRadius, barRadius, 0, 0]}
							isAnimationActive={false}
						/>
					</BarChart>
				</ChartContainer>
			</CardContent>
		</Card>
	);
}
