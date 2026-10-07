# Chart form compare

The trend draws this period as a solid line over the previous period as a dashed line. The breakdown is one split bar.

## Data

- Trend part: `DailyPoint[]` from `dailySeriesQueryOptions(days)` (data.md, section 5). One row per day, oldest first.
  `current` is the day. `previous` is the same day one period earlier, so the two lines have the same length.
- The home holds `days`, one of `PERIOD_DAYS`. It passes `onDaysChange` when the slot has a period control.
- Breakdown part: `BreakdownSlice[]` from `breakdownQueryOptions(DEFAULT_DAYS)`: the 5 largest parts and "other".
  The home translates the labels first. The period control changes only the trend.
- Rename the slot names to your read functions, as data.md section 5 shows. Keep the shapes.
- The trend part takes `title`, an optional `description`, `points`, `days`, and an optional `onDaysChange`.
  The breakdown part takes `title` and `slices`. Name each component after its data.

## Anatomy

Trend part:

1. Header: the title, an optional description, and the period control at the end.
2. Legend in the header: a mark and a name for each line, "This period" and "Previous period". Not under the plot.
3. Plot: this period as a solid line, the previous period as a dashed line. No dots.

Breakdown part:

1. Header: the title.
2. Split bar: one thin bar, cut into the parts.
3. Rows: one per part, with a color mark, the name, the value, and the share.

- The style gives the panel, the curve type, the grid, the axes, the sizes, and the weights.
- The trend plot takes a main height of SKILL.md. The breakdown takes a side height.
- Each skeleton keeps the header, the legend, the plot, the bar, and the rows in their final sizes.

## Rules

- `ChartContainer` from `~/shared/ui/chart` with a `ChartConfig`. The series read `var(--color-current)` and `var(--color-previous)`.
- `ChartContainer` has `aspect-video` by default. Add `aspect-auto` with the height class.
- This period is `var(--chart-1)`. The previous period is the neutral `var(--muted-foreground)`, with `strokeDasharray="4 4"`.
- Do not set `strokeWidth`. The knob `--chart-stroke` sets it for both lines.
- Put the `Line` of this period first. The tooltip lists the series in that order.
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
- The plot has `role="img"` and the `aria-label` of the snippet.
- The period control shows only with `onDaysChange`. It is a `Select`, or `Tabs` when the style asks for a segmented control.
  The choices are `PERIOD_DAYS`, written with `Intl.NumberFormat(locale, { style: "unit", unit: "day", unitDisplay: "long" })`.
  It has `aria-label={t("chart.period")}`.
- Empty trend: every day is 0 in both periods. The plot keeps its height and draws the real zeros:
  the dates, and both lines on the base. Hide the Y axis. One muted sentence and one action link sit over the plot.
- The split bar is plain elements. Each part has the width `(value / total) * 100` in percent.
  The rows repeat every value, so the bar has `aria-hidden="true"` and no tooltip. Its corners follow the style.
- The parts use `bg-chart-1` to `bg-chart-5`, then `bg-muted-foreground` for a sixth part.
- The share is `Intl.NumberFormat(locale, { style: "percent", maximumFractionDigits: 0 })`, in a column of fixed width at the end.
- Empty breakdown: the total is 0. The split bar is one empty track in `bg-muted`. The sentence and the action link go under it.
- Each action link opens the page that records the events. A wrong path fails typecheck.
- A home can ask for the trend part at a mini or strip height. Then it has no axes, no grid, no legend,
  and no period control of its own. The tooltip and the `aria-label` stay.

The config and the screen reader text of the trend part, after the formatters `number`, `percent`, and `formatDay`:

```tsx
const config = {
	current: { label: t("chart.thisPeriod"), color: "var(--chart-1)" },
	previous: { label: t("chart.previousPeriod"), color: "var(--muted-foreground)" },
} satisfies ChartConfig;
// Screen readers get the last day and its change against the same day one period earlier.
const last = points.at(-1);
// A previous value of 0 gives no change, so the text never says "0%" or "Infinity".
const lastChange =
	last && last.previous > 0
		? ` ${percent.format((last.current - last.previous) / last.previous)} ${t("chart.vsPrevious")}`
		: "";
const summary = last ? `${title}. ${formatDay(last.day)}: ${number.format(last.current)}${lastChange}` : title;
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
- `chart.thisPeriod`: "This period"
- `chart.previousPeriod`: "Previous period"
