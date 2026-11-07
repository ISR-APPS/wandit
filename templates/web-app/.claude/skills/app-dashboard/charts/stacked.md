# Chart form stacked

The trend is one bar per day, split by status or type. The breakdown is one row per part with a thin share bar.

## Data

- Trend part: `CategoryPoint[]`, not `DailyPoint[]`: one row per day and category, oldest first.
  With chart=stacked, the trend slot reads a category series (data.md, section 5).
  In the factory example, it is `dailyOutputQueryOptions(days)`.
- The categories are codes. The home translates them before the trend part:
  ``points={trend.map((point) => ({ ...point, category: t(`output.${point.category}`) }))}``.
- The series keep the order of the rows. The first category sits at the bottom of each bar.
- The home holds `days`, one of `PERIOD_DAYS`. It passes `onDaysChange` when the slot has a period control.
- Breakdown part: `BreakdownSlice[]` from `breakdownQueryOptions(DEFAULT_DAYS)`: the 5 largest parts and "other".
  The home translates the labels first. The period control changes only the trend.
- Rename the slot names to your read functions, as data.md section 5 shows. Keep the shapes.
- The trend part takes `title`, an optional `description`, `points`, `days`, and an optional `onDaysChange`.
  The breakdown part takes `title` and `slices`. Name each component after its data.

## Anatomy

Trend part:

1. Header: the title, an optional description, and the period control at the end.
2. Legend in the header: a mark and a name for each series, in stack order. Not under the plot.
3. Plot: one bar per day, split into one segment per series. The first series is at the bottom.

Breakdown part:

1. Header: the title.
2. Rows: one per part. The name at the start and the count at the end, with a thin share bar under them.

- The panel is a `Card`.
- The trend plot takes a main height of SKILL.md. The breakdown takes a side height.
- Each skeleton keeps the header, the legend, the plot, and the rows in their final sizes.

## Rules

- At most 5 series. More than 5 categories: the first 4 keep a series, and the others join "Other".
- The series keys are `s0` to `s4`. A `ChartConfig` key becomes `--color-<key>`, so it must be CSS-safe.
- The series use `var(--chart-1)` to `var(--chart-5)` in order.
- `ChartContainer` has `aspect-video` by default. Add `aspect-auto` with the height class.
- Each `Bar` has `stackId="day"`. Only the top segment has round top corners: `radius={[barRadius, barRadius, 0, 0]}`.
  `barRadius` is in px: 0 for none, 2 for sm or md, 4 for lg or xl.
  Read the radius with `useAppTheme()` in the chart component, as `src/shared/ui/sonner.tsx` reads the mode.
  Never write a fixed number: the user can change the radius in the builder, with no turn.

  ```tsx
  import { type AppThemeFile, useAppTheme } from "~/styles/theme";

  /** Bar corner in px for each radius of the theme. recharts takes a number, not a CSS variable. */
  const BAR_RADIUS_PX = { none: 0, sm: 2, md: 2, lg: 4, xl: 4 } satisfies Record<AppThemeFile["selection"]["radius"], number>;

  // In the chart component: the hook gives the radius of the live theme.
  const barRadius = BAR_RADIUS_PX[useAppTheme().selection.radius];
  ```
- The grid and the axes: `<CartesianGrid vertical={false} />`,
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
- The plot has `role="img"` and an `aria-label`: the title, the last day, and each series value on that day.
- The period control shows only with `onDaysChange`. It is a `Select`. `Tabs` also fit: the theme draws them.
  The choices are `PERIOD_DAYS`, written with `Intl.NumberFormat(locale, { style: "unit", unit: "day", unitDisplay: "long" })`.
  It has `aria-label={t("chart.period")}`.
- Empty trend: every value is 0. The plot keeps its height and shows its dates. Hide the Y axis.
  One muted sentence and one action link sit over the plot.
- The share bar of a row is `Progress` from `~/shared/ui/progress`, with `value={slice.value}`, `max={total}`,
  and `aria-label={slice.label}`.
- Empty breakdown: the total is 0. The panel keeps its height and shows the sentence and the action link.
- Each action link opens the page that records the events. A wrong path fails typecheck.
- A home can ask for the trend part at a mini or strip height. Then it has no axes, no grid, no legend,
  and no period control of its own. The tooltip and the `aria-label` stay.

The rows of the plot, one per day, from the translated `points`:

```tsx
// More series than this cannot be told apart. The first 4 categories keep a series, the others join "Other".
const MAX_SERIES = 5;

/** One bar: the day, then one value per series key s0 to s4 (CSS-safe keys for ChartConfig). */
type StackRow = { day: string; [series: `s${number}`]: number };

// Series in the order of the rows. The first one sits at the bottom of each bar.
const categories = [...new Set(points.map((point) => point.category))];
const named = categories.length > MAX_SERIES ? categories.slice(0, MAX_SERIES - 1) : categories;
const labels = categories.length > named.length ? [...named, t("chart.other")] : named;
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
	labels.map((label, index) => [`s${index}`, { label, color: `var(--chart-${index + 1})` }]),
) satisfies ChartConfig;
```

## Fallback

The events have no status or type column: use `charts/bars.md`.

## Messages

Add a `chart` group to `messages` in `src/shared/i18n/messages.ts`. Write the text in the app language.
Name the real action in `emptyAction` and `breakdownEmptyAction`.
Add one group for the category codes, named after the business, for example `output` with `good` and `scrap`.

- `chart.period`: "Period"
- `chart.empty`: "Nothing was recorded in this period."
- `chart.emptyAction`: the action that records the events of the trend, for example "Record a delivery"
- `chart.breakdownEmptyAction`: the action that records the events of the breakdown, for example "Record a return"
- `chart.other`: "Other"
