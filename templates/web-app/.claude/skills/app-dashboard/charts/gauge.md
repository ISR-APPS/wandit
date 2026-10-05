# Chart style: gauge

The trend card shows one series as a line with no fill, and a period Select.
The breakdown card shows one rate as an arc, with its target in a sentence below it.

## Data

- `TrendCard` takes `DailyPoint[]` from `dailyProductionQueryOptions(days)`.
  OverviewPage holds `days` and passes `onDaysChange` (data.md, section 5).
- Needs: one rate with a real target from the user. Example: good units against a yield target of 98 %.
- `BreakdownCard` takes `BreakdownSlice[]`: the good part first, then the other parts.
  The arc shows the share of the first part in the total.
- In the factory example, the breakdown slot reads `dailyOutputQueryOptions(DEFAULT_DAYS)`
  in place of `breakdownQueryOptions(DEFAULT_DAYS)`, in the route loader and in OverviewPage.
  OverviewPage adds up the rows of each category:

```ts
const { data: output } = useSuspenseQuery(
	dailyOutputQueryOptions(DEFAULT_DAYS),
);
const unitsOf = (category: "good" | "scrap") =>
	output
		.filter((point) => point.category === category)
		.reduce((sum, point) => sum + point.value, 0);
const slices = [
	{ label: t("output.good"), value: unitsOf("good") },
	{ label: t("output.scrap"), value: unitsOf("scrap") },
];
```

- Set `TARGET_RATE` to the target that the user gave, as a ratio (0.98 is 98 %). Never invent it.
- Rename the query functions for your domain. Keep the shapes and the props.

## Rules in this code

- The line and the arc use `var(--chart-1)`. The rate in the center is green at or above the target, else red.
- The rate rounds to 0.1 %, and the color follows the shown rate. With other parts, the rate stops at 99.9 %.
- The arc fills from the start side: from the left in LTR, from the right in Arabic.
- Arabic: keep `reversed`, `orientation`, and `tick={{ textAnchor: "end" }}` on the axes. The code comments say why.
- The `aria-label` of the gauge gives the rate and the target.
- Empty state: every day is 0 in both periods, or the total of the parts is 0. The frame keeps its height.
  Point each `Link` to the page that records the events. A wrong path fails typecheck.

## Fallback

The user gave no target: keep this trend card, and take the breakdown card of `charts/area.md` (the donut).

## Messages

Add these groups to `messages` in `src/shared/i18n/messages.ts`. Write the text in the app language.
Name the real action in `emptyAction`. Both empty states use it, because one page records both feeds.

```ts
	chart: {
		period: "Period",
		vsPrevious: "against the same day one period earlier",
		empty: "Nothing was recorded in this period.",
		emptyAction: "Record production",
		target: "Target",
	},
	output: {
		good: "Good",
		scrap: "Scrap",
	},
```

## File: src/features/overview/components/trend-card.tsx

```tsx
// Main trend card of the home, style "gauge": one series as a line with no fill, and a period Select.
// The home renders it with the rows of dailyProductionQueryOptions(days) (data.md).
// It calls ChartContainer and recharts. onDaysChange from the home changes the period and the query key.
import { Link } from "@tanstack/react-router";
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
								fillOpacity={0}
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
// Breakdown card of the home, style "gauge": the share of the first part as an arc, against a target.
// The home renders it with the good part first, for example good units and scrap units.
// It calls ChartContainer and recharts. TARGET_RATE is a fact from the user, never a guess.
import { Link } from "@tanstack/react-router";
import { PolarAngleAxis, RadialBar, RadialBarChart } from "recharts";
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import { Button } from "~/shared/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/shared/ui/card";
import {
	type ChartConfig,
	ChartContainer,
	ChartTooltip,
	ChartTooltipContent,
} from "~/shared/ui/chart";
import { Skeleton } from "~/shared/ui/skeleton";
import type { BreakdownSlice } from "../lib/series";

/** Target share of the first part, from the user: 0.98 is 98 %. No real target: use charts/area.md. */
const TARGET_RATE = 0.98;

// One decimal rounds 0.9996 up to "100%". A rate with other parts stops at 99.9 %.
const MAX_PARTIAL_RATE = 0.999;

type BreakdownCardProps = {
	/** Card title, translated. */
	title: string;
	/** The good part first (for example "Good"), then the other parts. Labels are translated. */
	slices: BreakdownSlice[];
};

/** The rate of the first part with its target. A total of 0: the empty state with its action. */
export function BreakdownCard({ title, slices }: BreakdownCardProps) {
	const { t, locale, dir } = useT();
	const percent = new Intl.NumberFormat(locale, {
		style: "percent",
		maximumFractionDigits: 1,
	});
	const total = slices.reduce((sum, slice) => sum + slice.value, 0);
	const good = slices[0];
	const exactRate = good && total > 0 ? good.value / total : 0;
	// Round to 0.1 %, the precision on screen, so the color always agrees with the shown rate.
	const rate = Math.min(
		Math.round(exactRate * 1000) / 1000,
		exactRate < 1 ? MAX_PARTIAL_RATE : 1,
	);
	const config = {
		rate: { label: good?.label ?? title, color: "var(--chart-1)" },
	} satisfies ChartConfig;
	// A 240 degree arc that fills from the start side: from the left in LTR, from the right in Arabic.
	const [startAngle, endAngle] = dir === "rtl" ? [-30, 210] : [210, -30];
	const summary = `${title}. ${config.rate.label}: ${percent.format(rate)}. ${t("chart.target")}: ${percent.format(TARGET_RATE)}`;

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
							<Link to="/app/production">{t("chart.emptyAction")}</Link>
						</Button>
					</div>
				) : (
					<div className="grid gap-2">
						<div className="relative">
							<ChartContainer
								config={config}
								role="img"
								aria-label={summary}
								className="mx-auto aspect-square h-52"
							>
								<RadialBarChart
									data={[{ rate }]}
									startAngle={startAngle}
									endAngle={endAngle}
									innerRadius="78%"
									outerRadius="100%"
								>
									{/* The angle axis maps 0 to 1 onto the arc. It draws nothing. */}
									<PolarAngleAxis type="number" domain={[0, 1]} tick={false} />
									<ChartTooltip
										cursor={false}
										content={
											<ChartTooltipContent
												hideLabel
												valueFormat={{
													style: "percent",
													maximumFractionDigits: 1,
												}}
											/>
										}
									/>
									<RadialBar
										dataKey="rate"
										fill="var(--color-rate)"
										background
										// 8 px gives soft ends to the arc. Use 0 when the theme sets --radius: 0.
										cornerRadius={8}
										isAnimationActive={false}
									/>
								</RadialBarChart>
							</ChartContainer>
							<div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
								<span
									className={cn(
										"font-display font-semibold text-3xl tabular-nums",
										rate >= TARGET_RATE ? "text-success" : "text-destructive",
									)}
								>
									{percent.format(rate)}
								</span>
								<span className="text-muted-foreground text-xs">
									{config.rate.label}
								</span>
							</div>
						</div>
						<p className="text-center text-muted-foreground text-sm">
							{t("chart.target")}{" "}
							<bdi
								dir="ltr"
								className="font-medium text-foreground tabular-nums"
							>
								{percent.format(TARGET_RATE)}
							</bdi>
						</p>
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
			<CardContent className="grid justify-items-center gap-2">
				<Skeleton className="size-52 rounded-full" />
				<Skeleton className="h-5 w-24" />
			</CardContent>
		</Card>
	);
}
```
