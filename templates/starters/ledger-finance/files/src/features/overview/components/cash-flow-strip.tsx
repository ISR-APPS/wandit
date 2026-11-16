// The slim activity strip of the home: one bar per day, money in above the line and money out below it.
// OverviewPage renders it between the totals and the table, and holds the period.
// The strip reads the daily series of that period itself, because the period changes after a click.
// It follows the chart form "stacked" of the app-dashboard skill at strip height: no axis, no grid, a tooltip per day.
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Bar, BarChart, ReferenceLine, XAxis } from "recharts";
import {
	centsToUnits,
	dayFormat,
	dayToDate,
	fillMessage,
	LEDGER_CURRENCY,
	MoneyText,
	moneyFormat,
	type PeriodDays,
	PeriodTabs,
} from "~/features/ledger";
import { useT } from "~/shared/i18n";
import { Button } from "~/shared/ui/button";
import {
	type ChartConfig,
	ChartContainer,
	ChartTooltip,
	ChartTooltipContent,
} from "~/shared/ui/chart";
import { Skeleton } from "~/shared/ui/skeleton";
import { type AppThemeFile, useAppTheme } from "~/styles/theme";
import { dailyCashFlowQueryOptions } from "../api/overview.queries";
import { KPI_PERIOD_DAYS } from "../lib/overview-kpis";

/** Bar corner in px for each radius of the theme. recharts takes a number, not a CSS variable. */
const BAR_RADIUS_PX = {
	none: 0,
	sm: 2,
	md: 2,
	lg: 4,
	xl: 4,
} satisfies Record<AppThemeFile["selection"]["radius"], number>;

/** One bar of the strip, in currency units. `moneyOut` is negative, so it hangs under the zero line. */
type StripRow = { day: string; moneyIn: number; moneyOut: number };

type CashFlowStripProps = {
	/** The period of the strip, in days. OverviewPage holds it. */
	days: PeriodDays;
	/** Runs when the user picks another period. */
	onDaysChange: (days: PeriodDays) => void;
};

/** While a new period loads, the strip keeps the bars of the last period, so it does not jump. */
export function CashFlowStrip({ days, onDaysChange }: CashFlowStripProps) {
	const { t, locale } = useT();
	const flow = useQuery({
		...dailyCashFlowQueryOptions(days),
		placeholderData: keepPreviousData,
	});
	const barRadius = BAR_RADIUS_PX[useAppTheme().selection.radius];

	const day = dayFormat(locale, "long");
	const money = moneyFormat(locale, 0);
	const dayCount = new Intl.NumberFormat(locale, {
		style: "unit",
		unit: "day",
		unitDisplay: "long",
	});
	const chartConfig = {
		moneyIn: { label: t("overview.moneyIn"), color: "var(--chart-1)" },
		moneyOut: { label: t("overview.moneyOut"), color: "var(--chart-2)" },
	} satisfies ChartConfig;

	// One row per day. The points come oldest first, two per day.
	const rowsByDay = new Map<string, StripRow>();
	let moneyInCents = 0;
	let moneyOutCents = 0;
	for (const point of flow.data ?? []) {
		const row = rowsByDay.get(point.day) ?? {
			day: point.day,
			moneyIn: 0,
			moneyOut: 0,
		};
		if (point.category === "moneyIn") {
			row.moneyIn = centsToUnits(point.value);
			moneyInCents += point.value;
		} else {
			row.moneyOut = -centsToUnits(point.value);
			moneyOutCents += point.value;
		}
		rowsByDay.set(point.day, row);
	}
	const rows = [...rowsByDay.values()];
	const lastRow = rows.at(-1);
	// At 30 days the Income and Expenses totals above already give the two sums, so the legend shows names only.
	const showsSums = days !== KPI_PERIOD_DAYS;

	return (
		<section className="grid gap-3 border-t pt-4">
			{/* A phone gets two lines: the period and its control, then the legend. A wide page gets one line. */}
			<div className="grid @3xl/main:grid-cols-[auto_1fr_auto] grid-cols-[1fr_auto] items-center gap-x-6 gap-y-2 text-sm">
				<h2 className="font-medium font-sans">
					{fillMessage(t("overview.lastPeriod"), {
						period: dayCount.format(days),
					})}
				</h2>
				<div className="@3xl/main:order-none order-last @3xl/main:col-span-1 col-span-2 flex min-h-5 flex-wrap items-center gap-x-5 gap-y-1">
					<span className="flex items-center gap-2 text-muted-foreground">
						<span
							aria-hidden="true"
							className="size-2 rounded-full bg-chart-1"
						/>
						{t("overview.moneyIn")}
						{flow.data && showsSums ? (
							<MoneyText
								amountCents={moneyInCents}
								withCents={false}
								className="text-foreground"
							/>
						) : null}
					</span>
					<span className="flex items-center gap-2 text-muted-foreground">
						<span
							aria-hidden="true"
							className="size-2 rounded-full bg-chart-2"
						/>
						{t("overview.moneyOut")}
						{flow.data && showsSums ? (
							<MoneyText
								amountCents={moneyOutCents}
								withCents={false}
								className="text-foreground"
							/>
						) : null}
					</span>
				</div>
				<PeriodTabs days={days} onDaysChange={onDaysChange} />
			</div>
			{flow.isError ? (
				<div className="flex h-24 items-center gap-3">
					<p className="text-sm" role="alert">
						{t("overview.stripError")}
					</p>
					<Button
						type="button"
						variant="outline"
						size="sm"
						onClick={() => flow.refetch()}
					>
						{t("common.retry")}
					</Button>
				</div>
			) : flow.data === undefined ? (
				<Skeleton className="h-24 w-full" />
			) : (
				<ChartContainer
					config={chartConfig}
					className="aspect-auto h-24 w-full"
					role="img"
					aria-label={
						lastRow
							? fillMessage(t("overview.stripLabel"), {
									day: day.format(dayToDate(lastRow.day)),
									moneyIn: money.format(lastRow.moneyIn),
									moneyOut: money.format(-lastRow.moneyOut),
								})
							: t("overview.moneyIn")
					}
				>
					{/* stackOffset "sign" puts the positive part above the zero line and the negative part under it. */}
					<BarChart
						data={rows}
						stackOffset="sign"
						barCategoryGap="8%"
						margin={{ top: 0, right: 0, bottom: 0, left: 0 }}
					>
						{/* Hidden: the tooltip reads the day of each bar from this axis. */}
						<XAxis dataKey="day" hide />
						<ReferenceLine y={0} />
						<ChartTooltip
							cursor={false}
							content={
								<ChartTooltipContent
									labelFormatter={(label) =>
										day.format(dayToDate(String(label)))
									}
									valueFormat={{
										style: "currency",
										currency: LEDGER_CURRENCY,
										maximumFractionDigits: 0,
									}}
								/>
							}
						/>
						{/* A pay day is 50 times a lunch. 2 px keeps a small income day visible; a day with no entry draws nothing. */}
						{/* Only the income bar has this floor: on a negative bar of a "sign" stack, recharts draws the floor above the zero line. */}
						<Bar
							dataKey="moneyIn"
							stackId="day"
							fill="var(--color-moneyIn)"
							radius={[barRadius, barRadius, 0, 0]}
							minPointSize={(value) => (value ? 2 : 0)}
							isAnimationActive={false}
						/>
						<Bar
							dataKey="moneyOut"
							stackId="day"
							fill="var(--color-moneyOut)"
							radius={[barRadius, barRadius, 0, 0]}
							isAnimationActive={false}
						/>
					</BarChart>
				</ChartContainer>
			)}
		</section>
	);
}
