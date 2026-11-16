// The spend curve of the budgets page: the spend of every budget since day 1 of the month, against an even plan.
// BudgetsPage renders it in the rail with the burn points of the report.
// The spend is a step line: it moves only on the day of an expense. The plan is a dashed line.
import { useId } from "react";
import {
	Area,
	CartesianGrid,
	ComposedChart,
	Line,
	XAxis,
	YAxis,
} from "recharts";
import {
	centsToUnits,
	compactMoneyFormat,
	dayFormat,
	dayToDate,
	fillMessage,
	LEDGER_CURRENCY,
	moneyFormat,
} from "~/features/ledger";
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
import type { BurnPoint } from "../lib/budget-report";

// The next round figure above `largest`, in steps of its own size: 33,450 gives 40,000, and 780 gives 800.
function roundAxisMax(largest: number): number {
	if (largest <= 0) {
		return 1;
	}
	const step = 10 ** Math.floor(Math.log10(largest));
	return Math.ceil(largest / step) * step;
}

type BurnChartCardProps = {
	/** One point per day of the month, oldest first. `spentCents` is null after today. */
	points: BurnPoint[];
};

/** The legend sits in the header. A day after today has a plan value and no spend value. */
export function BurnChartCard({ points }: BurnChartCardProps) {
	const { t, locale, dir } = useT();
	const gradientId = useId();
	const shortDay = dayFormat(locale);
	const compact = compactMoneyFormat(locale);
	const money = moneyFormat(locale, 0);
	const chartConfig = {
		spent: { label: t("budgets.spent"), color: "var(--chart-1)" },
		plan: { label: t("budgets.plan"), color: "var(--chart-5)" },
	} satisfies ChartConfig;
	const rows = points.map((point) => ({
		day: point.day,
		spent: point.spentCents === null ? null : centsToUnits(point.spentCents),
		plan: centsToUnits(point.planCents),
	}));
	// The last day with a spend value: today, or the last day of a closed month.
	const lastSpent = points.filter((point) => point.spentCents !== null).at(-1);
	const isRtl = dir === "rtl";

	return (
		<Card>
			<CardHeader>
				<CardTitle>{t("budgets.burnTitle")}</CardTitle>
				<CardDescription className="flex flex-wrap items-center gap-x-4 gap-y-1">
					<span className="flex items-center gap-2">
						<span aria-hidden="true" className="h-0.5 w-4 bg-chart-1" />
						{t("budgets.spent")}
					</span>
					<span className="flex items-center gap-2">
						<span
							aria-hidden="true"
							className="w-4 border-chart-5 border-t border-dashed"
						/>
						{t("budgets.plan")}
					</span>
				</CardDescription>
			</CardHeader>
			<CardContent>
				<ChartContainer
					config={chartConfig}
					className="aspect-auto h-56 w-full"
					role="img"
					aria-label={
						lastSpent
							? fillMessage(t("budgets.burnLabel"), {
									day: shortDay.format(dayToDate(lastSpent.day)),
									spent: money.format(centsToUnits(lastSpent.spentCents ?? 0)),
									plan: money.format(centsToUnits(lastSpent.planCents)),
								})
							: t("budgets.burnTitle")
					}
				>
					<ComposedChart
						data={rows}
						// The margin on the axis side keeps the ticks off the edge of the plot.
						margin={{
							top: 8,
							bottom: 0,
							left: isRtl ? 0 : 4,
							right: isRtl ? 4 : 8,
						}}
					>
						<defs>
							{/* The fill fades to nothing at the bottom, so the curve stays the strong part. */}
							<linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
								<stop
									offset="0%"
									stopColor="var(--color-spent)"
									stopOpacity={0.5}
								/>
								<stop
									offset="100%"
									stopColor="var(--color-spent)"
									stopOpacity={0.04}
								/>
							</linearGradient>
						</defs>
						<CartesianGrid vertical={false} />
						<XAxis
							dataKey="day"
							tickLine={false}
							axisLine={false}
							tickMargin={8}
							minTickGap={32}
							reversed={isRtl}
							tickFormatter={(day: string) => shortDay.format(dayToDate(day))}
						/>
						<YAxis
							width="auto"
							tickLine={false}
							axisLine={false}
							tickMargin={8}
							orientation={isRtl ? "right" : "left"}
							tick={{ textAnchor: "end" }}
							// The scale ends on a round figure, so the ticks read 10K, 20K, and not 8.5K, 17K.
							domain={[0, roundAxisMax]}
							tickFormatter={(value: number) => compact.format(value)}
						/>
						<ChartTooltip
							cursor={false}
							content={
								<ChartTooltipContent
									labelFormatter={(label) =>
										shortDay.format(dayToDate(String(label)))
									}
									valueFormat={{
										style: "currency",
										currency: LEDGER_CURRENCY,
										maximumFractionDigits: 0,
									}}
								/>
							}
						/>
						<Area
							dataKey="spent"
							type="stepAfter"
							stroke="var(--color-spent)"
							fill={`url(#${gradientId})`}
							isAnimationActive={false}
						/>
						<Line
							dataKey="plan"
							type="linear"
							stroke="var(--color-plan)"
							strokeDasharray="4 4"
							dot={false}
							isAnimationActive={false}
						/>
					</ComposedChart>
				</ChartContainer>
			</CardContent>
		</Card>
	);
}
