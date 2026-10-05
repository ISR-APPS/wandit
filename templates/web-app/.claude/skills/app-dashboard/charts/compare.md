# Chart style: compare

The trend card shows this period as a solid line and the previous period as a dashed line.
A two-dot legend in the header names the lines. The breakdown card shows one bar split into the parts.
One row per part gives its value and its share.

## Data

- `TrendCard` takes `DailyPoint[]` from `dailyProductionQueryOptions(days)`.
  OverviewPage holds `days` and passes `onDaysChange` (data.md, section 5).
  `previous` is the same day one period earlier, so the two lines have the same length.
- `BreakdownCard` takes `BreakdownSlice[]` from `downtimeByReasonQueryOptions(DEFAULT_DAYS)`.
  The period Select changes only the trend.
  OverviewPage translates the labels first (data.md, section 5).
- Rename the query functions for your domain. Keep the shapes and the props.

## Rules in this code

- This period is `var(--chart-1)`, 2 px. The previous period is `var(--muted-foreground)`, dashed "4 4".
- The parts use `bg-chart-1` to `bg-chart-5`. A sixth part gets the neutral color.
- The split bar is plain divs with widths in percent. The rows give every value, so the bar has no tooltip.
  Its `rounded-sm` follows `--radius`, so a theme with `--radius: 0` gets square ends.
- Arabic: keep `reversed`, `orientation`, and `tick={{ textAnchor: "end" }}` on the axes. The code comments say why.
- Money: add `style: "currency"` and the currency of the user to the `compact` and `number` formatters.
  Give the same options as `valueFormat` to `ChartTooltipContent`.
- Empty state: every day is 0 in both periods, or the breakdown total is 0. The frame keeps its height.
  Point each `Link` to the page that records the events. A wrong path fails typecheck.

## Fallback

None.

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
		thisPeriod: "This period",
		previousPeriod: "Previous period",
	},
```

## File: src/features/overview/components/trend-card.tsx

```tsx
// Main trend card of the home, style "compare": this period solid, the previous period dashed.
// The home renders it with the rows of dailyProductionQueryOptions(days) (data.md).
// It calls ChartContainer and recharts. onDaysChange from the home changes the period and the query key.
import { Link } from "@tanstack/react-router";
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
		current: { label: t("chart.thisPeriod"), color: "var(--chart-1)" },
		previous: {
			label: t("chart.previousPeriod"),
			color: "var(--muted-foreground)",
		},
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
				{/* The legend names the two lines once, in the header, not under the chart. */}
				<div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-muted-foreground text-xs">
					<span className="flex items-center gap-1.5">
						<span className="size-2 rounded-full bg-chart-1" />
						{t("chart.thisPeriod")}
					</span>
					<span className="flex items-center gap-1.5">
						<span className="size-2 rounded-full bg-muted-foreground" />
						{t("chart.previousPeriod")}
					</span>
				</div>
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
						<LineChart data={points} margin={{ top: 8, left: 0, right: 0 }}>
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
							{/* The tooltip lists the series in this order, so this period comes first. */}
							<Line
								dataKey="current"
								type="monotone"
								stroke="var(--color-current)"
								strokeWidth={2}
								dot={false}
								isAnimationActive={false}
							/>
							<Line
								dataKey="previous"
								type="monotone"
								stroke="var(--color-previous)"
								strokeWidth={2}
								strokeDasharray="4 4"
								dot={false}
								isAnimationActive={false}
							/>
						</LineChart>
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
				<Skeleton className="mt-2 h-4 w-48" />
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
// Breakdown card of the home, style "compare": one bar split into parts, and one row per part.
// The home renders it with the rows of downtimeByReasonQueryOptions(DEFAULT_DAYS), labels translated (data.md).
// Plain divs with widths in percent. The rows give every value as text, so the bar needs no tooltip.
import { Link } from "@tanstack/react-router";
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import { Button } from "~/shared/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/shared/ui/card";
import { Skeleton } from "~/shared/ui/skeleton";
import type { BreakdownSlice } from "../lib/series";

/** Colors in part order: chart-1 to chart-5, then the neutral color for a sixth part. */
const PART_COLORS = [
	"bg-chart-1",
	"bg-chart-2",
	"bg-chart-3",
	"bg-chart-4",
	"bg-chart-5",
	"bg-muted-foreground",
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
	const share = new Intl.NumberFormat(locale, {
		style: "percent",
		maximumFractionDigits: 0,
	});
	const total = slices.reduce((sum, slice) => sum + slice.value, 0);
	const parts = slices.map((slice, index) => ({
		...slice,
		color: PART_COLORS[Math.min(index, PART_COLORS.length - 1)],
	}));

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
					<div className="grid gap-5">
						{/* The rows below repeat every value, so screen readers skip the bar. */}
						<div aria-hidden="true" className="flex h-3 gap-0.5">
							{parts.map((part) => (
								<div
									key={part.label}
									className={cn("rounded-sm", part.color)}
									style={{ width: `${(part.value / total) * 100}%` }}
								/>
							))}
						</div>
						<ul className="grid gap-2.5 text-sm">
							{parts.map((part) => (
								<li key={part.label} className="flex items-center gap-2">
									<span
										className={cn(
											"size-2.5 shrink-0 rounded-[2px]",
											part.color,
										)}
									/>
									<span className="truncate text-muted-foreground">
										{part.label}
									</span>
									<span className="ms-auto font-medium tabular-nums">
										{number.format(part.value)}
									</span>
									<span className="w-10 text-end text-muted-foreground tabular-nums">
										{share.format(part.value / total)}
									</span>
								</li>
							))}
						</ul>
					</div>
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
			<CardContent className="grid gap-5">
				<Skeleton className="h-3 w-full rounded-sm" />
				<Skeleton className="h-36 w-full" />
			</CardContent>
		</Card>
	);
}
```
