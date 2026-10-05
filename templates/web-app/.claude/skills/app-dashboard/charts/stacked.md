# Chart style: stacked

The trend card shows one bar per day, split by status or type, and a period Select.
The breakdown card shows one row per part: the name, the count, and a small bar of its share.

## Data

- `TrendCard` takes `CategoryPoint[]`, not `DailyPoint[]`: one row per day and category.
  With chart=stacked, the trend slot reads `dailyOutputQueryOptions(days)` (data.md, section 5).
  OverviewPage holds `days` and passes `onDaysChange`.
- The categories are codes. OverviewPage translates them before the card:
  ``points={trend.data.map((point) => ({ ...point, category: t(`output.${point.category}`) }))}``.
- The series keep the order of the rows. The first category is at the bottom of each bar.
- `BreakdownCard` takes `BreakdownSlice[]` from `downtimeByReasonQueryOptions(DEFAULT_DAYS)`.
  The period Select changes only the trend.
  OverviewPage translates the labels first (data.md, section 5).
- Rename the query functions for your domain. Keep the shapes and the props.

## Rules in this code

- At most 5 series. More than 5 categories: the first 4 keep a series, and the others join "Other".
- The series use `var(--chart-1)` to `var(--chart-5)` in order. Only the top segment has 4 px corners.
  Use 0 when the theme sets `--radius: 0`.
- Arabic: keep `reversed`, `orientation`, and `tick={{ textAnchor: "end" }}` on the axes. The code comments say why.
- The `aria-label` gives the last day and the value of each series on that day.
- Empty state: every value is 0, or the breakdown total is 0. The frame keeps its height.
  Point each `Link` to the page that records the events. A wrong path fails typecheck.

## Fallback

The events have no status or type column: use `charts/bars.md`.

## Messages

Add this group to `messages` in `src/shared/i18n/messages.ts`. Write the text in the app language.
Name the real action in `emptyAction` and `breakdownEmptyAction`.

```ts
	chart: {
		period: "Period",
		empty: "Nothing was recorded in this period.",
		emptyAction: "Record production",
		breakdownEmptyAction: "Record downtime",
		other: "Other",
	},
	output: {
		good: "Good",
		scrap: "Scrap",
	},
```

## File: src/features/overview/components/trend-card.tsx

```tsx
// Main trend card of the home, style "stacked": one bar per day, split by category.
// The home renders it with the rows of dailyOutputQueryOptions(days) (data.md).
// It calls ChartContainer and recharts. onDaysChange from the home changes the period and the query key.
import { Link } from "@tanstack/react-router";
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
import { type CategoryPoint, PERIOD_DAYS } from "../lib/series";

// More series than this cannot be told apart. More than 5 categories: the first 4 keep a series, the others join "Other".
const MAX_SERIES = 5;

/** One bar: the day, then one value per series key s0 to s4 (CSS-safe keys for ChartConfig). */
type StackRow = { day: string; [series: `s${number}`]: number };

type TrendCardProps = {
	/** Card title, translated. */
	title: string;
	/** One muted line under the title, for example the unit or the scope. */
	description?: string;
	/** One row per day and category, oldest first. `category` is translated text. */
	points: CategoryPoint[];
	/** Length of the period in days, one of PERIOD_DAYS. */
	days: number;
	/** Called with the chosen period. Without it, the card has no Select. */
	onDaysChange?: (days: number) => void;
};

/** The main chart of the home. Every value at 0: the empty state with its action. */
export function TrendCard({
	title,
	description,
	points,
	days,
	onDaysChange,
}: TrendCardProps) {
	const { t, locale, dir } = useT();
	const isRtl = dir === "rtl";
	const number = new Intl.NumberFormat(locale);
	const compact = new Intl.NumberFormat(locale, { notation: "compact" });
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
	// Series in the order of the rows. The first one sits at the bottom of each bar.
	const categories = [...new Set(points.map((point) => point.category))];
	const named =
		categories.length > MAX_SERIES
			? categories.slice(0, MAX_SERIES - 1)
			: categories;
	const labels =
		categories.length > named.length ? [...named, t("chart.other")] : named;
	const rowsByDay = new Map<string, StackRow>();
	for (const point of points) {
		const row = rowsByDay.get(point.day) ?? { day: point.day };
		const index = named.indexOf(point.category);
		const key = `s${index === -1 ? named.length : index}` as const;
		row[key] = (row[key] ?? 0) + point.value;
		rowsByDay.set(point.day, row);
	}
	const rows = [...rowsByDay.values()];
	const config = Object.fromEntries(
		labels.map((label, index) => [
			`s${index}`,
			{ label, color: `var(--chart-${index + 1})` },
		]),
	) satisfies ChartConfig;
	const isEmpty = points.every((point) => point.value === 0);
	// Screen readers get the last day and the value of each series on that day.
	const last = rows.at(-1);
	const summary = last
		? `${title}. ${formatDay(last.day)}: ${labels.map((label, index) => `${label} ${number.format(last[`s${index}`] ?? 0)}`).join(", ")}`
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
							{labels.map((label, index) => (
								<Bar
									key={label}
									dataKey={`s${index}`}
									stackId="day"
									fill={`var(--color-s${index})`}
									// Only the top segment gets 4 px corners. Use 0 when the theme sets --radius: 0.
									radius={index === labels.length - 1 ? [4, 4, 0, 0] : 0}
									isAnimationActive={false}
								/>
							))}
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
// Breakdown card of the home, style "stacked": one row per part with its count and a small bar.
// The home renders it with the rows of downtimeByReasonQueryOptions(DEFAULT_DAYS), labels translated (data.md).
// It calls Progress from the shared kit. Every number goes through Intl.
import { Link } from "@tanstack/react-router";
import { useT } from "~/shared/i18n";
import { Button } from "~/shared/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/shared/ui/card";
import { Progress } from "~/shared/ui/progress";
import { Skeleton } from "~/shared/ui/skeleton";
import type { BreakdownSlice } from "../lib/series";

type BreakdownCardProps = {
	/** Card title, translated. */
	title: string;
	/** The 5 largest parts and one "Other" part, in the order of the data. Labels are translated. */
	slices: BreakdownSlice[];
};

/** The parts of one total as rows. A total of 0: the empty state with its action. */
export function BreakdownCard({ title, slices }: BreakdownCardProps) {
	const { t, locale } = useT();
	const number = new Intl.NumberFormat(locale);
	const total = slices.reduce((sum, slice) => sum + slice.value, 0);

	return (
		<Card className="gap-4">
			<CardHeader>
				<CardTitle className="font-medium text-sm">{title}</CardTitle>
			</CardHeader>
			<CardContent>
				{total === 0 ? (
					<div className="flex h-52 flex-col items-center justify-center gap-3 text-center">
						<p className="text-muted-foreground text-sm">{t("chart.empty")}</p>
						<Button asChild variant="outline" size="sm">
							<Link to="/app/machines">{t("chart.breakdownEmptyAction")}</Link>
						</Button>
					</div>
				) : (
					<ul className="grid gap-4">
						{slices.map((slice) => (
							<li key={slice.label} className="grid gap-1.5 text-sm">
								<div className="flex items-center justify-between gap-3">
									<span className="truncate">{slice.label}</span>
									<span className="font-medium tabular-nums">
										{number.format(slice.value)}
									</span>
								</div>
								<Progress
									value={slice.value}
									max={total}
									aria-label={slice.label}
									className="h-1.5"
								/>
							</li>
						))}
					</ul>
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
			<CardContent className="grid gap-4">
				<Skeleton className="h-9 w-full" />
				<Skeleton className="h-9 w-full" />
				<Skeleton className="h-9 w-full" />
				<Skeleton className="h-9 w-full" />
			</CardContent>
		</Card>
	);
}
```
