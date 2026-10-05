# Chart style: bars

The trend card shows one bar per day, two metric tabs, and a period Select.
The breakdown card shows ranked bars: the name in the bar and the value at the end of the row.

## Data

- `TrendCard` takes `DailyPoint[]` from `dailyProductionQueryOptions(days)`.
  OverviewPage holds `days` and passes `onDaysChange` (data.md, section 5).
- The tabs show two views of the same events: the count per day, and the running total.
  `TrendCard` gets one series, so the tabs show two views of it, not two different metrics.
- `BreakdownCard` takes `BreakdownSlice[]` from `downtimeByReasonQueryOptions(DEFAULT_DAYS)`.
  The period Select changes only the trend.
  OverviewPage translates the labels first (data.md, section 5).
  The rows keep the order of the data.
- Rename the query functions for your domain. Keep the shapes and the props.

## Rules in this code

- The only color is `var(--chart-1)`. The ranked bars use it at 20 %, so the text on them stays readable.
- Bars have 4 px top corners. Use 0 when the theme sets `--radius: 0`.
- The ranked bars are plain divs, not recharts. A long name stays readable in a short bar.
  The bars grow from the start side in Arabic with no extra code. The values are text, so the bars have no tooltip.
- Arabic: keep `reversed`, `orientation`, and `tick={{ textAnchor: "end" }}` on the axes. The code comments say why.
- Money: add `style: "currency"` and the currency of the user to the `compact` and `number` formatters.
  Give the same options as `valueFormat` to `ChartTooltipContent`.
- Empty state: every day is 0 in both periods, or every part is 0. The frame keeps its height.
  Point each `Link` to the page that records the events. A wrong path fails typecheck.

## Fallback

None. This is the fallback of `charts/stacked.md`.

## Messages

Add this group to `messages` in `src/shared/i18n/messages.ts`. Write the text in the app language.
Name the real action in `emptyAction` and `breakdownEmptyAction`.

```ts
	chart: {
		period: "Period",
		vsPrevious: "against the same day one period earlier",
		empty: "Nothing was recorded in this period.",
		emptyAction: "Record production",
		breakdownEmptyAction: "Record downtime",
		perDay: "Per day",
		runningTotal: "Running total",
	},
```

## File: src/features/overview/components/trend-card.tsx

```tsx
// Main trend card of the home, style "bars": one bar per day, metric tabs, and a period Select.
// The home renders it with the rows of dailyProductionQueryOptions(days) (data.md).
// It calls ChartContainer and recharts. onDaysChange from the home changes the period and the query key.
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
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
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "~/shared/ui/select";
import { Skeleton } from "~/shared/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "~/shared/ui/tabs";
import { type DailyPoint, PERIOD_DAYS } from "../lib/series";

type TrendCardProps = {
	/** Card title, translated. */
	title: string;
	/** One muted line under the title, for example the unit or the scope. */
	description?: string;
	/** One row per day, oldest first, with 0 on a day with no event (data.md). */
	points: DailyPoint[];
	/** Length of the period in days, one of PERIOD_DAYS. */
	days: number;
	/** Called with the chosen period. Without it, the card has no Select. */
	onDaysChange?: (days: number) => void;
};

/** The main chart of the home. Every day at 0 in both periods: the empty state with its action. */
export function TrendCard({
	title,
	description,
	points,
	days,
	onDaysChange,
}: TrendCardProps) {
	const { t, locale, dir } = useT();
	// Two views of the same events: the count of each day, or the sum since the first day.
	const [metric, setMetric] = useState<"perDay" | "runningTotal">("perDay");
	const isRtl = dir === "rtl";
	const number = new Intl.NumberFormat(locale);
	const compact = new Intl.NumberFormat(locale, { notation: "compact" });
	const percent = new Intl.NumberFormat(locale, {
		style: "percent",
		signDisplay: "exceptZero",
		maximumFractionDigits: 1,
	});
	const dayCount = new Intl.NumberFormat(locale, {
		style: "unit",
		unit: "day",
		unitDisplay: "long",
	});
	const date = new Intl.DateTimeFormat(locale, {
		day: "numeric",
		month: "short",
		timeZone: "UTC",
	});
	// `day` has no time. Midnight UTC, shown in UTC, keeps the same calendar day.
	const formatDay = (day: string) => date.format(new Date(`${day}T00:00:00Z`));
	let runningTotal = 0;
	const rows = points.map((point) => {
		runningTotal += point.current;
		return {
			day: point.day,
			value: metric === "perDay" ? point.current : runningTotal,
		};
	});
	const config = {
		value: { label: t(`chart.${metric}`), color: "var(--chart-1)" },
	} satisfies ChartConfig;
	const isEmpty = points.every(
		(point) => point.current === 0 && point.previous === 0,
	);
	// Screen readers get the last day and its change against the same day one period earlier.
	const last = points.at(-1);
	const lastChange =
		last && last.previous > 0
			? ` ${percent.format((last.current - last.previous) / last.previous)} ${t("chart.vsPrevious")}`
			: "";
	const summary = last
		? `${title}. ${formatDay(last.day)}: ${number.format(last.current)}${lastChange}`
		: title;

	return (
		<Card className="gap-4">
			<CardHeader>
				<CardTitle className="font-medium text-sm">{title}</CardTitle>
				{description ? <CardDescription>{description}</CardDescription> : null}
				{onDaysChange ? (
					<CardAction>
						<Select
							value={String(days)}
							onValueChange={(value) => onDaysChange(Number(value))}
						>
							<SelectTrigger className="w-32" aria-label={t("chart.period")}>
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								{PERIOD_DAYS.map((period) => (
									<SelectItem key={period} value={String(period)}>
										{dayCount.format(period)}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</CardAction>
				) : null}
				<Tabs
					value={metric}
					onValueChange={(value) =>
						setMetric(value === "runningTotal" ? "runningTotal" : "perDay")
					}
					// The tabs get their own row. At 375 px, they do not fit beside the period Select.
					className="col-span-full mt-2"
				>
					<TabsList>
						<TabsTrigger value="perDay">{t("chart.perDay")}</TabsTrigger>
						<TabsTrigger value="runningTotal">
							{t("chart.runningTotal")}
						</TabsTrigger>
					</TabsList>
				</Tabs>
			</CardHeader>
			<CardContent>
				{isEmpty ? (
					<div className="flex h-64 flex-col items-center justify-center gap-3 text-center">
						<p className="text-muted-foreground text-sm">{t("chart.empty")}</p>
						<Button asChild variant="outline" size="sm">
							<Link to="/app/production">{t("chart.emptyAction")}</Link>
						</Button>
					</div>
				) : (
					<ChartContainer
						config={config}
						role="img"
						aria-label={summary}
						className="aspect-auto h-64 w-full"
					>
						<BarChart data={rows} margin={{ top: 8, left: 0, right: 0 }}>
							<CartesianGrid vertical={false} />
							{/* Time runs from right to left in Arabic, so the values move to the right side. */}
							<XAxis
								dataKey="day"
								reversed={isRtl}
								tickLine={false}
								axisLine={false}
								tickMargin={8}
								// Recharts hides a date nearer than 24 px to the last one, so the dates never overlap.
								minTickGap={24}
								tickFormatter={formatDay}
							/>
							<YAxis
								orientation={isRtl ? "right" : "left"}
								// SVG anchors follow the page direction. "end" puts the text end at the plot side in LTR and RTL.
								tick={{ textAnchor: "end" }}
								width="auto"
								tickLine={false}
								axisLine={false}
								tickMargin={8}
								tickFormatter={(value: number) => compact.format(value)}
							/>
							<ChartTooltip
								cursor={false}
								content={
									<ChartTooltipContent
										labelFormatter={(label) => formatDay(String(label))}
									/>
								}
							/>
							{/* 4 px corners. Use 0 when the theme sets --radius: 0. */}
							<Bar
								dataKey="value"
								fill="var(--color-value)"
								radius={[4, 4, 0, 0]}
								isAnimationActive={false}
							/>
						</BarChart>
					</ChartContainer>
				)}
			</CardContent>
		</Card>
	);
}

/** Placeholder of TrendCard in its final size. The home pendingComponent renders it. */
export function TrendCardSkeleton() {
	return (
		<Card className="gap-4">
			<CardHeader>
				<Skeleton className="h-5 w-40" />
				<Skeleton className="mt-2 h-9 w-full max-w-52" />
				<CardAction>
					<Skeleton className="h-9 w-32" />
				</CardAction>
			</CardHeader>
			<CardContent>
				<Skeleton className="h-64 w-full" />
			</CardContent>
		</Card>
	);
}
```

## File: src/features/overview/components/breakdown-card.tsx

```tsx
// Breakdown card of the home, style "bars": one ranked bar per part, the name in the bar.
// The home renders it with the rows of downtimeByReasonQueryOptions(DEFAULT_DAYS), labels translated (data.md).
// Plain divs, not recharts: a long name stays readable in a short bar, and RTL needs no axis code.
import { Link } from "@tanstack/react-router";
import { useT } from "~/shared/i18n";
import { Button } from "~/shared/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/shared/ui/card";
import { Skeleton } from "~/shared/ui/skeleton";
import type { BreakdownSlice } from "../lib/series";

type BreakdownCardProps = {
	/** Card title, translated. */
	title: string;
	/** The 5 largest parts and one "Other" part, in the order of the data. Labels are translated. */
	slices: BreakdownSlice[];
};

/** Ranked parts of one total. Every part at 0: the empty state with its action. */
export function BreakdownCard({ title, slices }: BreakdownCardProps) {
	const { t, locale } = useT();
	const number = new Intl.NumberFormat(locale);
	const largest = Math.max(0, ...slices.map((slice) => slice.value));

	return (
		<Card className="gap-4">
			<CardHeader>
				<CardTitle className="font-medium text-sm">{title}</CardTitle>
			</CardHeader>
			<CardContent>
				{largest === 0 ? (
					<div className="flex h-52 flex-col items-center justify-center gap-3 text-center">
						<p className="text-muted-foreground text-sm">{t("chart.empty")}</p>
						<Button asChild variant="outline" size="sm">
							<Link to="/app/machines">{t("chart.breakdownEmptyAction")}</Link>
						</Button>
					</div>
				) : (
					<ol className="grid gap-1.5">
						{slices.map((slice) => (
							<li
								key={slice.label}
								className="relative flex h-8 items-center justify-between gap-3 px-2.5 text-sm"
							>
								{/* The bar length is the share of the largest part. */}
								<div
									className="absolute inset-y-0 start-0 rounded-md bg-chart-1/20"
									style={{ width: `${(slice.value / largest) * 100}%` }}
								/>
								<span className="relative truncate">{slice.label}</span>
								<span className="relative font-medium tabular-nums">
									{number.format(slice.value)}
								</span>
							</li>
						))}
					</ol>
				)}
			</CardContent>
		</Card>
	);
}

/** Placeholder of BreakdownCard in its final size. The home pendingComponent renders it. */
export function BreakdownCardSkeleton() {
	return (
		<Card className="gap-4">
			<CardHeader>
				<Skeleton className="h-5 w-32" />
			</CardHeader>
			<CardContent className="grid gap-1.5">
				<Skeleton className="h-8 w-full" />
				<Skeleton className="h-8 w-4/5" />
				<Skeleton className="h-8 w-3/5" />
				<Skeleton className="h-8 w-2/5" />
				<Skeleton className="h-8 w-1/4" />
			</CardContent>
		</Card>
	);
}
```
