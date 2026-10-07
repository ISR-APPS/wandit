# Chart form bars

The trend is one bar per day, with two views of the same events. The breakdown is a list of ranked bars.

## Data

- Trend part: `DailyPoint[]` from `dailySeriesQueryOptions(days)` (data.md, section 5). One row per day, oldest first.
  `current` is the day. `previous` is the same day one period earlier. A day with no event is 0.
- The home holds `days`, one of `PERIOD_DAYS`. It passes `onDaysChange` when the slot has a period control.
- The two views show the same events: the count of each day, and the running total since the first day.
  The trend part gets one series, so the views never mix two metrics.
- Breakdown part: `BreakdownSlice[]` from `breakdownQueryOptions(DEFAULT_DAYS)`: the 5 largest parts and "other".
  The home translates the labels first. The rows keep the order of the data. The period control changes only the trend.
- Rename the slot names to your read functions, as data.md section 5 shows. Keep the shapes.
- The trend part takes `title`, an optional `description`, `points`, `days`, and an optional `onDaysChange`.
  The breakdown part takes `title` and `slices`. Name each component after its data.

## Anatomy

Trend part:

1. Header: the title, an optional description, and the period control at the end.
2. View tabs on their own row: "Per day" and "Running total". At 375 px, they do not fit beside the period control.
3. Plot: one bar per day in `var(--chart-1)`.

Breakdown part:

1. Header: the title.
2. Ranked rows: a bar behind each row, the name at the start, and the value at the end.

- The style gives the panel, the bar corners, the grid, the axes, the sizes, and the weights.
- The snippet shows the logic. Its row height, gaps, padding, corners, text size, and value weight are the no-style defaults.
- The trend plot takes a main height of SKILL.md. The ranked list takes a side height.
- Each skeleton keeps the header, the tabs, the plot, and the rows in their final sizes.

## Rules

- `ChartContainer` from `~/shared/ui/chart` with a `ChartConfig`. The only color is `var(--chart-1)`.
- `ChartContainer` has `aspect-video` by default. Add `aspect-auto` with the height class.
- Bar corners: `radius={[r, r, 0, 0]}`, with `r` in px from the style. Bars are square when the style radius is 0.
- The view state is local: `useState<"perDay" | "runningTotal">`. The running total adds `current` day by day.
- The grid and the axes follow the style. With no style rule: `<CartesianGrid vertical={false} />`,
  and `tickLine={false} axisLine={false} tickMargin={8}` on both axes.
- `day` is `YYYY-MM-DD` with no time. Format `` new Date(`${day}T00:00:00Z`) `` with
  `Intl.DateTimeFormat(locale, { day: "numeric", month: "short", timeZone: "UTC" })`.
  Midnight UTC, shown in UTC, keeps the same calendar day.
- XAxis: `minTickGap={24}`, so the dates never overlap.
- YAxis on the main chart only, with `width="auto"` and `Intl.NumberFormat(locale, { notation: "compact" })`.
- Arabic: `reversed` on the XAxis. On the YAxis, `orientation="right"` and `tick={{ textAnchor: "end" }}`.
  SVG anchors follow the page direction, so "end" puts the text end at the plot side in LTR and RTL.
- Tooltip: `ChartTooltip` with `cursor={false}` and `ChartTooltipContent` with a `labelFormatter` for the date.
- Money: add `style: "currency"` and the currency of the user to the formatters.
  Give the same options as `valueFormat` to `ChartTooltipContent`.
- `isAnimationActive={false}` on every series.
- The plot has `role="img"` and an `aria-label`: the title, the last day, its value, and its change.
  The change compares with the same day one period earlier, only when that value is above 0.
- The period control shows only with `onDaysChange`. It is a `Select`, or `Tabs` when the style asks for a segmented control.
  The choices are `PERIOD_DAYS`, written with `Intl.NumberFormat(locale, { style: "unit", unit: "day", unitDisplay: "long" })`.
  It has `aria-label={t("chart.period")}`.
- Empty trend: every day is 0 in both periods. The plot keeps its height and shows its dates. Hide the Y axis.
  One muted sentence and one action link sit over the plot.
- The ranked bars are plain elements, not recharts. A long name stays readable in a short bar.
- The ranked bars use `bg-chart-1/20`, so the text on them stays readable. The values are text, so they need no tooltip.
- Empty breakdown: every part is 0, or no part exists. The panel keeps its height and shows the sentence and the action link.
- Each action link opens the page that records the events. A wrong path fails typecheck.
- A home can ask for the trend part at a mini or strip height. Then it has no axes, no grid, no legend,
  and no period control of its own. The tooltip and the `aria-label` stay.

The ranked rows, with imports from `~/shared/i18n` and the `BreakdownSlice` type of `series.ts`:

```tsx
/** Ranked parts of one total. The bar behind each row shows the share of the largest part. */
function RankedBars({ slices }: { slices: BreakdownSlice[] }) {
	const { locale } = useT();
	const number = new Intl.NumberFormat(locale);
	const largest = Math.max(0, ...slices.map((slice) => slice.value));
	// No-style defaults: h-8, the gaps, px-2.5, rounded-sm, text-sm, and font-medium. The style Anatomy replaces them.
	return (
		<ol className="grid gap-1.5">
			{slices.map((slice) => (
				<li key={slice.label} className="relative flex h-8 items-center justify-between gap-3 px-2.5 text-sm">
					{/* start-0 makes the bar grow from the start side: from the right in Arabic. */}
					<div
						className="absolute inset-y-0 start-0 rounded-sm bg-chart-1/20"
						style={{ width: `${largest > 0 ? (slice.value / largest) * 100 : 0}%` }}
					/>
					<span className="relative truncate">{slice.label}</span>
					<span className="relative font-medium tabular-nums">{number.format(slice.value)}</span>
				</li>
			))}
		</ol>
	);
}
```

## Fallback

None. This is the fallback of `charts/stacked.md`.

## Messages

Add a `chart` group to `messages` in `src/shared/i18n/messages.ts`. Write the text in the app language.
Name the real action in `emptyAction` and `breakdownEmptyAction`.

- `chart.period`: "Period"
- `chart.vsPrevious`: "against the same day one period earlier"
- `chart.empty`: "Nothing was recorded in this period."
- `chart.emptyAction`: the action that records the events of the trend, for example "Record a delivery"
- `chart.breakdownEmptyAction`: the action that records the events of the breakdown, for example "Record a return"
- `chart.perDay`: "Per day"
- `chart.runningTotal`: "Running total"
