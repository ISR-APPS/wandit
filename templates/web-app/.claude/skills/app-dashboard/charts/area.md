# Chart form area

The trend is one series as a line with a soft fill under it. The breakdown is a donut with the total in its hole.

## Data

- Trend part: `DailyPoint[]` from `dailySeriesQueryOptions(days)` (data.md, section 5). One row per day, oldest first.
  `current` is the day. `previous` is the same day one period earlier. A day with no event is 0.
- The home holds `days`, one of `PERIOD_DAYS`. It passes `onDaysChange` when the slot has a period control.
- Breakdown part: `BreakdownSlice[]` from `breakdownQueryOptions(DEFAULT_DAYS)`: the 5 largest parts and "other".
  The home translates the labels first. The period control changes only the trend.
- Rename the slot names to your read functions, as data.md section 5 shows. Keep the shapes.
- The trend part takes `title`, an optional `description`, `points`, `days`, and an optional `onDaysChange`.
  The breakdown part takes `title` and `slices`. Name each component after its data.

## Anatomy

Trend part:

1. Header: the title, an optional description, and the period control at the end.
2. Plot: one series as a line, with a fill under it. No legend: the title names the series.

Breakdown part:

1. Header: the title.
2. Donut: one slice per part. The total sits in the hole, with the word "Total" under it.
3. Parts list under the donut, in 2 columns: a color mark, the name, and the value.

- The style gives the panel, the curve type, the fill, the grid, the axes, the sizes, and the weights.
- The snippet shows the logic. Its curve, fill, grid, and axes are the no-style defaults.
- The trend plot takes a main height of SKILL.md. The donut takes a side height, with `aspect-square`.
- Each skeleton keeps the header, the plot, and the list in their final sizes.

## Rules

- `ChartContainer` from `~/shared/ui/chart` with a `ChartConfig`. Colors come only from `var(--chart-1)` to `var(--chart-5)`.
- `ChartContainer` has `aspect-video` by default. Add `aspect-auto` with the height class.
- Do not set `strokeWidth` or `fillOpacity`. The knobs `--chart-stroke` and `--chart-fill-opacity` set them.
- The curve type and the fill follow the style Anatomy. A flat fill is `fill="var(--color-current)"` with no gradient.
- With no style rule: the curve is `type="monotone"`, and the fill is a vertical gradient of the series color.
  The gradient goes from 30 % at the line to 0 at the base.
  The knob `--chart-fill-opacity` multiplies it. A style with no fill sets the knob to 0.
- The grid and the axes follow the style. With no style rule: `<CartesianGrid vertical={false} />`,
  and `tickLine={false} axisLine={false} tickMargin={8}` on both axes.
- `day` is `YYYY-MM-DD` with no time. Format `` new Date(`${day}T00:00:00Z`) `` with
  `Intl.DateTimeFormat(locale, { day: "numeric", month: "short", timeZone: "UTC" })`.
  Midnight UTC, shown in UTC, keeps the same calendar day.
- XAxis: `minTickGap={24}`, so the dates never overlap.
- YAxis on the main chart only, with `width="auto"` and `Intl.NumberFormat(locale, { notation: "compact" })`.
- Arabic: `reversed` on the XAxis. On the YAxis, `orientation="right"` and `tick={{ textAnchor: "end" }}`.
- Tooltip: `ChartTooltip` with `cursor={false}` and `ChartTooltipContent` with a `labelFormatter` for the date.
- Money: add `style: "currency"` and the currency of the user to the formatters.
  Give the same options as `valueFormat` to `ChartTooltipContent`.
- `isAnimationActive={false}` on every series.
- The plot has `role="img"` and an `aria-label`: the title, the last day, its value, and its change.
  The change compares with the same day one period earlier, only when that value is above 0.
- The period control shows only with `onDaysChange`. It is a `Select`, or `Tabs` when the style asks for a segmented control.
  The choices are `PERIOD_DAYS`, written with `Intl.NumberFormat(locale, { style: "unit", unit: "day", unitDisplay: "long" })`.
  It has `aria-label={t("chart.period")}`.
- Empty trend: every day is 0 in both periods. The plot keeps its height and draws the real zeros:
  the dates, and the line on the base. Hide the Y axis. One muted sentence and one action link sit over the plot.
- Donut: `Pie` with `dataKey="value"`, `nameKey="label"`, and an inner radius of about 60 %.
  Recharts reads the color of each slice from its `fill` field: chart-1 to chart-5, then `var(--muted-foreground)`.
- Split the slices with a line in the panel color: `stroke="var(--card)"`. A panel with no fill uses `var(--background)`.
- The donut tooltip uses `hideLabel`. The `aria-label` gives the title and each part with its value.
- Empty breakdown: the total is 0. Recharts `Pie` draws no sector when the sum is 0.
  Draw it with one placeholder slice `{ value: 1, fill: "var(--muted)" }` and no tooltip.
  The aria-label keeps the real total of 0. The hole shows "0". The muted sentence and the action link go under it.
- Each action link opens the page that records the events. A wrong path fails typecheck.
- A home can ask for the trend part at a mini or strip height. Then it has no axes, no grid, no legend,
  and no period control of its own. The tooltip and the `aria-label` stay.

The trend plot, inside `ChartContainer`. `fillId` comes from `useId()`, and `isRtl` is `dir === "rtl"`:

```tsx
<AreaChart data={points} margin={{ top: 8, left: 0, right: 0 }}>
	{/* No-style default: this gradient. A style with a flat fill drops the defs and passes fill="var(--color-current)". */}
	<defs>
		<linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
			<stop offset="0%" stopColor="var(--color-current)" stopOpacity={0.3} />
			<stop offset="100%" stopColor="var(--color-current)" stopOpacity={0} />
		</linearGradient>
	</defs>
	{/* No-style defaults: a horizontal grid, and axes with no tick line and no axis line. The style Anatomy replaces them. */}
	<CartesianGrid vertical={false} />
	{/* Time runs from right to left in Arabic, so the values move to the right side. */}
	<XAxis dataKey="day" reversed={isRtl} tickLine={false} axisLine={false} tickMargin={8} minTickGap={24} tickFormatter={formatDay} />
	{/* SVG anchors follow the page direction. "end" puts the text end at the plot side in LTR and RTL. */}
	<YAxis hide={isEmpty} orientation={isRtl ? "right" : "left"} tick={{ textAnchor: "end" }} width="auto"
		tickLine={false} axisLine={false} tickMargin={8} tickFormatter={(value: number) => compact.format(value)} />
	<ChartTooltip cursor={false} content={<ChartTooltipContent labelFormatter={(label) => formatDay(String(label))} />} />
	{/* No-style default: type="monotone". The style Anatomy gives the curve, for example natural, linear, or stepAfter. */}
	<Area dataKey="current" type="monotone" stroke="var(--color-current)" fill={`url(#${fillId})`} isAnimationActive={false} />
</AreaChart>
```

## Fallback

None.

## Messages

Add a `chart` group to `messages` in `src/shared/i18n/messages.ts`. Write the text in the app language.
Name the real action in `emptyAction` and `breakdownEmptyAction`.

- `chart.period`: "Period"
- `chart.vsPrevious`: "against the same day one period earlier"
- `chart.empty`: "Nothing was recorded in this period."
- `chart.emptyAction`: the action that records the events of the trend, for example "Record a delivery"
- `chart.breakdownEmptyAction`: the action that records the events of the breakdown, for example "Record a return"
- `chart.total`: "Total"
