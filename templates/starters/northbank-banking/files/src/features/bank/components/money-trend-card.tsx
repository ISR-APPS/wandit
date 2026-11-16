// A trend panel of money: this period as a solid line over the previous period as a dashed line.
// The card detail page (running spend) and the statement page (balance through the month) render it.
// It follows the chart form "compare" of the app-dashboard skill. The parent reads the points.
import type { ReactNode } from "react";
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";
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
import { dayToDate } from "../lib/bank-day";
import {
	centsToUnits,
	compactMoneyFormat,
	dayFormat,
	moneyFormat,
} from "../lib/format";
import { BANK_CURRENCY } from "../lib/sample-accounts";
import type { DailyPoint } from "../lib/series";

// The axis has about four steps between its lowest and its highest tick.
const AXIS_STEPS = 4;

// Steps of 1, 2, 2.5, or 5 times a power of ten, so the axis reads $1K, $2K, and not $950, $1.9K.
const NICE_FACTORS = [1, 2, 2.5, 5, 10];

// The ticks of the money axis, in whole units, from a round value at or under `low` to one at or over `high`.
function niceTicks(low: number, high: number): number[] {
	// An empty plot has no range. A step of 1 then gives the single tick 0.
	const rawStep = (high - low) / AXIS_STEPS || 1;
	const power = 10 ** Math.floor(Math.log10(rawStep));
	const step =
		NICE_FACTORS.map((factor) => factor * power).find(
			(candidate) => candidate >= rawStep,
		) ?? rawStep;
	const first = Math.floor(low / step);
	const last = Math.ceil(high / step);
	return Array.from(
		{ length: last - first + 1 },
		(_, index) => (first + index) * step,
	);
}

type MoneyTrendCardProps = {
	title: string;
	description?: string;
	/** One point per day in cents, oldest first. undefined while the points load: the plot shows a skeleton. */
	points: DailyPoint[] | undefined;
	/** The name of the solid line, for example "This period" or "October". */
	currentLabel: string;
	/** The name of the dashed line, for example "Previous period" or "September". */
	previousLabel: string;
	/** A control at the end of the header, for example the period Select. */
	action?: ReactNode;
	/** A sentence over the plot when every point is 0 in both periods. */
	emptyText: string;
	/** True for a sum that starts at 0 (spend). False for a balance: the axis then starts near the lowest value. */
	yFromZero: boolean;
	/** Set only when the points did not load. The plot then shows `errorText` and a Try again button that calls it. */
	onRetry?: () => void;
	/** The sentence of the error state, for example "The spend line did not load." */
	errorText?: string;
};

/** The plot is h-64. The legend sits in the header, not under the plot. */
export function MoneyTrendCard({
	title,
	description,
	points,
	currentLabel,
	previousLabel,
	action,
	emptyText,
	yFromZero,
	onRetry,
	errorText,
}: MoneyTrendCardProps) {
	const { t, locale } = useT();
	const day = dayFormat(locale);
	const money = moneyFormat(locale, 0);
	const compact = compactMoneyFormat(locale);
	const config = {
		current: { label: currentLabel, color: "var(--chart-1)" },
		previous: { label: previousLabel, color: "var(--muted-foreground)" },
	} satisfies ChartConfig;
	const rows = (points ?? []).map((point) => ({
		day: point.day,
		current: centsToUnits(point.current),
		previous: centsToUnits(point.previous),
	}));
	const isEmpty = rows.every((row) => row.current === 0 && row.previous === 0);
	// A spend axis starts at 0. A balance axis starts near its lowest value, so the changes inside a month show.
	const values = rows.flatMap((row) => [row.current, row.previous]);
	let lowest = values.length > 0 ? Math.min(...values) : 0;
	let highest = values.length > 0 ? Math.max(...values) : 0;
	// A flat balance has no range. 5 % of the value on each side, at least 1, gives the axis a scale.
	if (!isEmpty && lowest === highest) {
		const margin = Math.max(1, Math.abs(lowest) * 0.05);
		lowest -= margin;
		highest += margin;
	}
	const ticks = niceTicks(yFromZero ? Math.min(0, lowest) : lowest, highest);
	// Screen readers get the last day and its value.
	const last = rows.at(-1);
	const summary = last
		? `${title}. ${day.format(dayToDate(last.day))}: ${money.format(last.current)}`
		: title;

	return (
		<Card>
			<CardHeader>
				<CardTitle>{title}</CardTitle>
				{description ? <CardDescription>{description}</CardDescription> : null}
				{action ? <CardAction>{action}</CardAction> : null}
			</CardHeader>
			<CardContent className="grid gap-4">
				<ul className="flex flex-wrap items-center gap-x-4 gap-y-1 text-muted-foreground text-sm">
					<li className="flex items-center gap-2">
						<span aria-hidden="true" className="h-0.5 w-4 bg-chart-1" />
						{currentLabel}
					</li>
					<li className="flex items-center gap-2">
						<span
							aria-hidden="true"
							className="w-4 border-muted-foreground border-t border-dashed"
						/>
						{previousLabel}
					</li>
				</ul>
				{onRetry ? (
					<div className="flex h-64 flex-col items-center justify-center gap-3 text-sm">
						<p role="alert">{errorText}</p>
						<Button type="button" variant="outline" size="sm" onClick={onRetry}>
							{t("common.retry")}
						</Button>
					</div>
				) : points === undefined ? (
					<Skeleton className="h-64 w-full" />
				) : (
					<div className="relative">
						<ChartContainer
							config={config}
							className="aspect-auto h-64 w-full"
							role="img"
							aria-label={summary}
						>
							<LineChart data={rows} margin={{ top: 8, left: 4, right: 8 }}>
								<CartesianGrid vertical={false} />
								<XAxis
									dataKey="day"
									tickLine={false}
									axisLine={false}
									tickMargin={8}
									minTickGap={24}
									tickFormatter={(value: string) =>
										day.format(dayToDate(value))
									}
								/>
								<YAxis
									hide={isEmpty}
									width="auto"
									tickLine={false}
									axisLine={false}
									tickMargin={8}
									ticks={ticks}
									domain={[ticks[0] ?? 0, ticks.at(-1) ?? 0]}
									tickFormatter={(value: number) => compact.format(value)}
								/>
								<ChartTooltip
									cursor={false}
									content={
										<ChartTooltipContent
											labelFormatter={(value) =>
												day.format(dayToDate(String(value)))
											}
											valueFormat={{
												style: "currency",
												currency: BANK_CURRENCY,
												maximumFractionDigits: 0,
											}}
										/>
									}
								/>
								<Line
									dataKey="current"
									type="monotone"
									stroke="var(--color-current)"
									dot={false}
									isAnimationActive={false}
								/>
								<Line
									dataKey="previous"
									type="monotone"
									stroke="var(--color-previous)"
									strokeDasharray="4 4"
									dot={false}
									isAnimationActive={false}
								/>
							</LineChart>
						</ChartContainer>
						{isEmpty ? (
							<p className="absolute inset-x-0 top-1/3 text-center text-muted-foreground text-sm">
								{emptyText}
							</p>
						) : null}
					</div>
				)}
			</CardContent>
		</Card>
	);
}
