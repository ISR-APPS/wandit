# Chart style: area

The trend card shows one series as a line with a soft fill below it, and a period Select.
The breakdown card shows a donut with the total in the center, and the parts below it.

## Data

- `TrendCard` takes `DailyPoint[]` from `dailyProductionQueryOptions(days)`.
  OverviewPage holds `days` and passes `onDaysChange` (data.md, section 5).
- `BreakdownCard` takes `BreakdownSlice[]` from `downtimeByReasonQueryOptions(DEFAULT_DAYS)`.
  The period Select changes only the trend.
  OverviewPage translates the labels first (data.md, section 5).
- Rename the query functions for your domain. Keep the shapes and the props.

## Rules in this code

- Colors come only from `var(--chart-1)` to `var(--chart-5)`. A sixth part gets the neutral color.
- Arabic: keep `reversed`, `orientation`, and `tick={{ textAnchor: "end" }}` on the axes. The code comments say why.
- Money: add `style: "currency"` and the currency of the user to the `compact` and `number` formatters.
  Give the same options as `valueFormat` to `ChartTooltipContent`.
- Empty state: every day is 0 in both periods, or the breakdown total is 0. The frame keeps its height.
  Point each `Link` to the page that records the events. A wrong path fails typecheck.

## Fallback

None. This donut is the fallback of `charts/gauge.md`.

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
		total: "Total",
	},
```

## File: src/features/overview/components/trend-card.tsx

```tsx
// Main trend card of the home, style "area": one series as a filled area, and a period Select.
// The home renders it with the rows of dailyProductionQueryOptions(days) (data.md).
// It calls ChartContainer and recharts. onDaysChange from the home changes the period and the query key.
import { Link } from "@tanstack/react-router";
import { useId } from "react";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
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
import { type DailyPoint, PERIOD_DAYS } from "../lib/series";

type TrendCardProps = {
	/** Card title, translated. The tooltip also uses it as the series name. */
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
	const fillId = useId();
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
	const config = {
		current: { label: title, color: "var(--chart-1)" },
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
						<AreaChart data={points} margin={{ top: 8, left: 0, right: 0 }}>
							{/* The fill fades from 30 % under the line to 0 at the axis, so the grid stays visible. */}
							<defs>
								<linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
									<stop
										offset="0%"
										stopColor="var(--color-current)"
										stopOpacity={0.3}
									/>
									<stop
										offset="100%"
										stopColor="var(--color-current)"
										stopOpacity={0}
									/>
								</linearGradient>
							</defs>
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
							<Area
								dataKey="current"
								type="monotone"
								stroke="var(--color-current)"
								strokeWidth={2}
								fill={`url(#${fillId})`}
								isAnimationActive={false}
							/>
						</AreaChart>
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
// Breakdown card of the home, style "area": a donut with the total in the center, and the parts below.
// The home renders it with the rows of downtimeByReasonQueryOptions(DEFAULT_DAYS), labels translated (data.md).
// It calls ChartContainer and recharts. Every number goes through Intl.
import { Link } from "@tanstack/react-router";
import { Pie, PieChart } from "recharts";
import { useT } from "~/shared/i18n";
import { Button } from "~/shared/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/shared/ui/card";
import {
	ChartContainer,
	ChartTooltip,
	ChartTooltipContent,
} from "~/shared/ui/chart";
import { Skeleton } from "~/shared/ui/skeleton";
import type { BreakdownSlice } from "../lib/series";

/** Colors in slice order: chart-1 to chart-5, then the neutral color for a sixth part. */
const SLICE_COLORS = [
	"var(--chart-1)",
	"var(--chart-2)",
	"var(--chart-3)",
	"var(--chart-4)",
	"var(--chart-5)",
	"var(--muted-foreground)",
] as const;

type BreakdownCardProps = {
	/** Card title, translated. */
	title: string;
	/** The 5 largest parts and one "Other" part, in the order of the data. Labels are translated. */
	slices: BreakdownSlice[];
};

/** The split of one total. A total of 0: the empty state with its action. */
export function BreakdownCard({ title, slices }: BreakdownCardProps) {
	const { t, locale } = useT();
	const number = new Intl.NumberFormat(locale);
	const total = slices.reduce((sum, slice) => sum + slice.value, 0);
	// Recharts reads the color of each slice from its `fill` field.
	const parts = slices.map((slice, index) => ({
		...slice,
		fill: SLICE_COLORS[Math.min(index, SLICE_COLORS.length - 1)],
	}));
	const summary = `${title}. ${parts.map((part) => `${part.label}: ${number.format(part.value)}`).join(", ")}`;

	return (
		<Card className="gap-4">
			<CardHeader>
				<CardTitle className="font-medium text-sm">{title}</CardTitle>
			</CardHeader>
			<CardContent className="grid gap-4">
				{total === 0 ? (
					<div className="flex h-52 flex-col items-center justify-center gap-3 text-center">
						<p className="text-muted-foreground text-sm">{t("chart.empty")}</p>
						<Button asChild variant="outline" size="sm">
							<Link to="/app/machines">{t("chart.breakdownEmptyAction")}</Link>
						</Button>
					</div>
				) : (
					<>
						<div className="relative">
							<ChartContainer
								config={{}}
								role="img"
								aria-label={summary}
								className="mx-auto aspect-square h-52"
							>
								<PieChart>
									<ChartTooltip
										cursor={false}
										content={<ChartTooltipContent hideLabel />}
									/>
									<Pie
										data={parts}
										dataKey="value"
										nameKey="label"
										// The 60 px hole holds the total. A 3 px line in the card color splits the slices.
										innerRadius={60}
										stroke="var(--card)"
										strokeWidth={3}
										isAnimationActive={false}
									/>
								</PieChart>
							</ChartContainer>
							<div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
								<span className="font-display font-semibold text-2xl tabular-nums">
									{number.format(total)}
								</span>
								<span className="text-muted-foreground text-xs">
									{t("chart.total")}
								</span>
							</div>
						</div>
						<ul className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
							{parts.map((part) => (
								<li
									key={part.label}
									className="flex min-w-0 items-center gap-2"
								>
									<span
										className="size-2.5 shrink-0 rounded-[2px]"
										style={{ backgroundColor: part.fill }}
									/>
									<span className="truncate text-muted-foreground">
										{part.label}
									</span>
									<span className="ms-auto font-medium tabular-nums">
										{number.format(part.value)}
									</span>
								</li>
							))}
						</ul>
					</>
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
				<Skeleton className="mx-auto size-52 rounded-full" />
				<Skeleton className="h-16 w-full" />
			</CardContent>
		</Card>
	);
}
```
