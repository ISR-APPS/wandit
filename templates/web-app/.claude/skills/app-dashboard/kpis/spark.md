# KPI form spark

Each figure shows its label, its value, the change, and a small area chart of the period under them.

## Data

- The figures read `KpiItem[]` from `overviewKpisQueryOptions()` (data.md, sections 4 and 6).
  The home turns each `labelKey` into `label` with `t()` and keeps the first `KPI_COUNT` items.
- The home decides where the figures go and how many it shows. This file gives the parts of one figure.
- One component draws the figures of one slot. It takes `items` and the layout class of the home.
  Its skeleton takes `count` and the same class.
- The KPI function always returns one row. On a first visit, each value is a real 0 and each change is `null`.
- Needs: `series` on at least one KPI, one value per day, oldest first.
  In the factory example, `buildOverviewKpis` gives the units of each day to "units-today".
- Give `series` to each shown KPI that counts events per day. Use the days of the first trend view.

## Anatomy

1. Label: `item.label`, in the label look of the style (`label-text`).
2. Value: `new Intl.NumberFormat(locale, item.format).format(item.value)`, with `font-numeric tabular-nums`.
3. Delta: one line with the arrow, the percent, and a screen reader text. Or the muted line "No earlier data".
4. Spark: a mini area chart along the bottom edge of the figure, full width.

- The spark shows the shape of the period. The value and the change stay in text above it.
- The style gives the panel of a figure: a card, a ruled cell, a tile, a slip, or no box.
  The style also says if the spark touches the panel edges.
- The style gives the sizes, the weights, the curve, the fill, and the gaps. The spark height is a mini height of SKILL.md.
- The snippet shows the logic. Its height, curve, and fill are the no-style defaults.
- The skeleton keeps the four parts in their final sizes.

## Rules

- A figure with fewer than 2 values gets no spark. It keeps its text.
- One `Area` in `var(--chart-1)`. No axis line, no grid, no tooltip, no animation.
- Do not set `strokeWidth` or `fillOpacity`. The knobs `--chart-stroke` and `--chart-fill-opacity` set them.
- The curve type and the fill follow the style Anatomy. A flat fill is `fill="var(--color-value)"` with no gradient.
- With no style rule: the curve is `type="monotone"`, and the fill is a 20 % tint of the series color.
  The knob multiplies the fill.
- No Y axis. The Y scale of recharts then starts at 0. A flat series shows a flat band, not a false wave.
- Time runs from right to left in Arabic: `reversed` on the hidden XAxis.
- Screen readers skip the spark (`aria-hidden="true"`). The text above gives the facts.
- `ChartContainer` has `aspect-video` by default. Add `aspect-auto` with the height class.
- `change` is a ratio from `changeRatio` (data.md). A change of 0.123 shows "+12.3%".
- Format it with `Intl.NumberFormat(locale, { style: "percent", signDisplay: "exceptZero", maximumFractionDigits: 1 })`.
- A change under 0.05 % shows "0%" in muted text, with no arrow and no color.
- The arrow shows the direction: `TrendingUpIcon` for a rise, `TrendingDownIcon` for a fall.
- The color shows good or bad news from `goodWhen`. With `goodWhen: "down"`, a fall is good news.
- Mirror the arrow with `rtl:-scale-x-100`, never with `rtl:rotate-180`. A rotation turns a rise into a fall.
- The percent sits in `<bdi dir="ltr">`, so "+12%" keeps its order in Arabic.
- `change: null` shows "No earlier data". Never show "0%" for it.
- The home names the period once. No figure repeats it.

The spark, with its imports from `react`, `recharts`, `~/shared/i18n`, and `~/shared/ui/chart`:

```tsx
const SPARK_CONFIG = { value: { color: "var(--chart-1)" } } satisfies ChartConfig;

/** The spark of one figure. Fewer than 2 values: no spark, and the text of the figure stays. */
function Spark({ series }: { series: number[] }) {
	const { dir } = useT();
	const fillId = useId();
	if (series.length < 2) {
		return null;
	}
	return (
		// The text of the figure gives the value and the change, so screen readers skip the spark.
		<ChartContainer aria-hidden="true" config={SPARK_CONFIG} className="mt-auto aspect-auto h-12 w-full">
			{/* The 4 px top margin keeps the stroke of the highest value inside the chart. */}
			<AreaChart data={series.map((value, day) => ({ day, value }))} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
				<defs>
					<linearGradient id={fillId}><stop stopColor="var(--color-value)" stopOpacity={0.2} /></linearGradient>
				</defs>
				{/* Time runs from right to left in Arabic. */}
				<XAxis dataKey="day" hide reversed={dir === "rtl"} />
				{/* No-style defaults: h-12, type="monotone", and the 20 % tint above. The style Anatomy replaces them. */}
				<Area dataKey="value" type="monotone" stroke="var(--color-value)" fill={`url(#${fillId})`} isAnimationActive={false} />
			</AreaChart>
		</ChartContainer>
	);
}
```

## Fallback

No KPI has a daily series: use `kpis/number.md`.

## Messages

Add a `kpi` group to `messages` in `src/shared/i18n/messages.ts`. Write the text in the app language.

- `kpi.noComparison`: "No earlier data"
- `kpi.vsPrevious`: "against the previous period". Screen readers read it after the percent.
