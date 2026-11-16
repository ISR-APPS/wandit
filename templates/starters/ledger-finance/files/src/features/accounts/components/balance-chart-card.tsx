// The balance chart of the account detail page: the balance at the end of each day, with a period control.
// AccountDetailPage renders it and holds the period. The card reads the series of that period itself,
// because the period changes after a click. The curve is a step line: a balance moves only on an entry.
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useId } from "react";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import {
	centsToUnits,
	compactMoneyFormat,
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
	Card,
	CardAction,
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
import { Skeleton } from "~/shared/ui/skeleton";
import { accountBalanceQueryOptions } from "../api/accounts.queries";

// The steps of the axis, as multiples of a power of ten. They give ticks such as 44K, 46K, 48K, and never 5.3K.
const NICE_STEPS = [1, 2, 5, 10];

// About 4 bands between the lowest and the highest tick. The axis has room for 5 labels at the chart height.
const TARGET_BANDS = 4;

// Round ticks around `low` and `high`, in currency units: the first tick is at or under `low`, the last at or over `high`.
function roundTicks(low: number, high: number): number[] {
	// A flat curve still gets a band, so the axis does not collapse to one tick.
	const span = high - low || Math.abs(high) || 1;
	const rawStep = span / TARGET_BANDS;
	const magnitude = 10 ** Math.floor(Math.log10(rawStep));
	const step =
		(NICE_STEPS.find((multiple) => multiple * magnitude >= rawStep) ?? 10) *
		magnitude;
	const first = Math.floor(low / step);
	const last = Math.ceil(high / step);
	// The product of two floats can end in 0.0000001. Rounding to cents keeps the label exact.
	return Array.from(
		{ length: last - first + 1 },
		(_, index) => Math.round((first + index) * step * 100) / 100,
	);
}

type BalanceChartCardProps = {
	/** The id of the account of the page. */
	accountId: string;
	/** The name of the account, for the label of the plot. */
	accountName: string;
	/** True for a card: the plot shows the amount owed, so a higher curve is a higher debt. */
	isDebt: boolean;
	/** The period of the plot, in days. AccountDetailPage holds it. */
	days: PeriodDays;
	/** Runs when the user picks another period. */
	onDaysChange: (days: PeriodDays) => void;
};

/** While a new period loads, the card keeps the curve of the last period, so the plot does not jump. */
export function BalanceChartCard({
	accountId,
	accountName,
	isDebt,
	days,
	onDaysChange,
}: BalanceChartCardProps) {
	const { t, locale, dir } = useT();
	const series = useQuery({
		...accountBalanceQueryOptions(accountId, days),
		placeholderData: keepPreviousData,
	});

	const gradientId = useId();
	const shortDay = dayFormat(locale);
	const longDay = dayFormat(locale, "long");
	const compact = compactMoneyFormat(locale);
	const chartConfig = {
		balance: {
			label: t(isDebt ? "accounts.owed" : "accounts.balance"),
			color: "var(--chart-1)",
		},
	} satisfies ChartConfig;

	// A card balance is negative, so the debt is its opposite. `cents` is the figure that the plot shows.
	const points = (series.data ?? []).map((point) => ({
		day: point.day,
		cents: isDebt ? -point.balanceCents : point.balanceCents,
	}));
	const rows = points.map((point) => ({
		day: point.day,
		balance: centsToUnits(point.cents),
	}));
	const title = t(isDebt ? "accounts.debtTrend" : "accounts.balanceTrend");
	const firstPoint = points[0];
	const lastPoint = points.at(-1);
	const isRtl = dir === "rtl";
	const balancesInUnits = rows.map((row) => row.balance);
	const ticks = roundTicks(
		Math.min(...balancesInUnits),
		Math.max(...balancesInUnits),
	);

	return (
		<Card>
			<CardHeader>
				<CardTitle>{title}</CardTitle>
				<CardDescription className="flex flex-wrap items-baseline gap-x-2">
					{firstPoint && lastPoint ? (
						<>
							<MoneyText
								amountCents={lastPoint.cents - firstPoint.cents}
								sign="always"
								className="text-foreground"
							/>
							<span>
								{fillMessage(t("accounts.changeSince"), {
									day: longDay.format(dayToDate(firstPoint.day)),
								})}
							</span>
						</>
					) : (
						<Skeleton className="h-5 w-48" />
					)}
				</CardDescription>
				<CardAction>
					<PeriodTabs days={days} onDaysChange={onDaysChange} />
				</CardAction>
			</CardHeader>
			<CardContent>
				{series.isError ? (
					<div className="grid h-64 content-center justify-items-center gap-3 text-center">
						<p className="text-sm" role="alert">
							{t("accounts.chartError")}
						</p>
						<Button
							type="button"
							variant="outline"
							size="sm"
							onClick={() => series.refetch()}
						>
							{t("common.retry")}
						</Button>
					</div>
				) : series.data === undefined ? (
					<Skeleton className="h-64 w-full" />
				) : (
					<ChartContainer
						config={chartConfig}
						className="aspect-auto h-64 w-full"
						role="img"
						aria-label={
							lastPoint
								? fillMessage(t("accounts.chartLabel"), {
										title,
										account: accountName,
										day: longDay.format(dayToDate(lastPoint.day)),
										balance: moneyFormat(locale, 0).format(
											centsToUnits(lastPoint.cents),
										),
									})
								: title
						}
					>
						<AreaChart
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
								// The scale does not start at zero: a balance of 50,000 that moves by 2,000 would look flat.
								domain={[ticks[0] ?? 0, ticks.at(-1) ?? 0]}
								ticks={ticks}
								tickFormatter={(value: number) => compact.format(value)}
							/>
							<ChartTooltip
								cursor={false}
								content={
									<ChartTooltipContent
										labelFormatter={(label) =>
											longDay.format(dayToDate(String(label)))
										}
										valueFormat={{
											style: "currency",
											currency: LEDGER_CURRENCY,
										}}
									/>
								}
							/>
							<Area
								dataKey="balance"
								type="stepAfter"
								stroke="var(--color-balance)"
								fill={`url(#${gradientId})`}
								// The fill starts at the lowest point of the scale, so it stays under the curve on a card debt too.
								baseValue="dataMin"
								isAnimationActive={false}
							/>
						</AreaChart>
					</ChartContainer>
				)}
			</CardContent>
		</Card>
	);
}
