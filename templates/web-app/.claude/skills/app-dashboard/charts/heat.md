# Chart form heat

The trend is a calendar of counts per day in 5 color steps. The breakdown is a ranked list with a step square per part.

## Data

- Trend part: `DailyPoint[]` from `dailySeriesQueryOptions(days)` (data.md, section 5). One row per day, oldest first.
  It reads `current` only. A day with no event is 0.
- Needs only an event table with a time, so this form always renders.
- The home holds `days` and its period choices. It passes `onDaysChange` when the slot has a period control.
- A home period under 30 days: draw the strip, not the calendar. A week fills only one calendar column.
  In a panel, 7 days give a strip, and 30 or 90 days give the calendar.
- A day view (a home about today) can show the 24 hours of today in place of the days.
  Write one more read function with the rules of data.md, section 3. It returns `hour` and `value`.
  `hour` is 0 to 23 in the user time zone. A `generate_series(0, 23)` gives 0 to an hour with no event.
  Parse the rows with a zod schema with named fields in `series.ts`.
- Breakdown part: `BreakdownSlice[]` from `breakdownQueryOptions(DEFAULT_DAYS)`: the 5 largest parts and "other".
  The home translates the labels first. The period control changes only the trend.
- Rename the slot names to your read functions, as data.md section 5 shows. Keep the shapes.
- The trend part takes `title`, `points`, `days`, and an optional `onDaysChange`.
  The breakdown part takes `title` and `slices`. Name each component after its data.

## Anatomy

Trend part, in a panel:

1. Header: the title, and the period control at the end.
2. Calendar: one column per week and one row per weekday, Monday on top. One cell per day.
   A period under 30 days draws the strip here in place of the calendar.
3. Facts: the total of the period, and the busiest day with its count.
   They sit beside the calendar from `@xl/main:`, and under it at 375 px.
4. Legend: the word "Less", the 5 step squares, and the word "More".

Trend part, in a slim slot (a band under the totals, a header strip) or for a day view:

1. A strip: one row of cells, one per day of `days`, or one per hour of today.
2. The legend at the end of the strip.

A home that asks for the trend part with no axes, at a mini or strip height, gets the strip.

Breakdown part:

1. Header: the title.
2. Ranked rows in the order of the data. Each row has a step square, the name, and the value at the end.

- The style gives the panel, the cell size and corners, the gaps, the sizes, and the weights.
- The snippet shows the logic. Its cell size, gaps, and corners are the no-style defaults.
- The calendar fits its slot. A strip takes a mini height of SKILL.md.
- Each skeleton keeps the header, the calendar or the strip, the facts, and the legend in their final sizes.

## Rules

- The heat is plain elements, not recharts. CSS grid draws the calendar. `ChartContainer` and the chart knobs do not apply.
- `HEAT_STEPS` holds the 5 steps from `--muted` to `--chart-1`. Step 0 is a day with no event.
  Steps 1 to 4 split the range from 0 to the busiest cell in 4 equal parts. The legend shows the same 5 steps.
- `heatStep` returns a `number` from 0 to 4, the index of a step in `HEAT_STEPS`. Type a cell step as `number`.
- The only hue is `--chart-1`. A style that sets `--chart-1` changes the scale.
- The breakdown squares take the step of each part against the largest part.
- `day` is `YYYY-MM-DD` with no time. Read the weekday with `getUTCDay()` of `` new Date(`${day}T00:00:00Z`) ``.
- Format a date with `Intl.DateTimeFormat(locale, { day: "numeric", month: "short", timeZone: "UTC" })` on the same date.
  Midnight UTC, shown in UTC, keeps the same calendar day.
- Arabic: the grid columns start on the start side, so the first week sits on the right. Do not reverse the data.
- A strip of days uses `grid grid-flow-col auto-cols-fr`, so 7, 30, or 90 days fill the same width.
  Use `gap-px` for 90 days. The period control of a strip follows the home.
  A strip of hours uses `grid-cols-12 @xl/main:grid-cols-24`, so it wraps into 2 rows at 375 px.
- The style gives the cell size and the gap in px. With no style rule: `size-[16px]` and `gap-[4px]`.
  Never use the spacing scale (`size-4`, `gap-1`) for them: density scales it and resizes the calendar.
- 90 days take up to 14 week columns. With the defaults, the calendar is 14 cells of 16 px and 13 gaps of 4 px: 276 px.
  This width is the same at every density.
- At 375 px, `main` has `p-4`, and a default panel has a 1 px border and `px-6`. The paddings scale with density.
  The room for the calendar: about 301 px at compact, 293 px at regular, 285 px at comfortable.
  The calendar fits in each. With `size-4 gap-1`, the calendar takes about 303 px at comfortable and overflows.
- Larger cells only from `@xl/main:`, also in px. A style with other cells, a wider border, or more padding checks this sum again.
- The calendar or the strip has `role="img"` and an `aria-label`: the title, the period, its total, and the busiest day.
- Each cell has a `title` with its date and its count, for a mouse pointer. The legend has `aria-hidden="true"`.
- Every count goes through `Intl.NumberFormat(locale)`.
- Money: add `style: "currency"` and the currency of the user to the number formatter.
- The period control shows only with `onDaysChange`. It is a `Select`, or `Tabs` when the style asks for a segmented control.
  Write each choice with `Intl.NumberFormat(locale, { style: "unit", unit: "day", unitDisplay: "long" })`.
  It has `aria-label={t("chart.period")}`.
- Empty trend: every day is 0. Every cell shows step 0: this is the empty frame of the form.
  The facts show a total of 0 and no busiest day. The muted sentence and the action link go under the calendar or the strip.
- Empty breakdown: the total is 0. The panel keeps its height and shows the sentence and the action link.
- Each action link opens the page that records the events. A wrong path fails typecheck.

The steps and the calendar, with imports from `~/shared/lib/utils` and the `DailyPoint` type of `series.ts`:

```tsx
/** The 5 steps from `--muted` (no event) to `--chart-1` (the busiest cell). The legend shows the same 5. */
const HEAT_STEPS = [
	"bg-muted",
	"bg-[color-mix(in_oklch,var(--chart-1)_25%,var(--muted))]",
	"bg-[color-mix(in_oklch,var(--chart-1)_50%,var(--muted))]",
	"bg-[color-mix(in_oklch,var(--chart-1)_75%,var(--muted))]",
	"bg-chart-1",
] as const;
/**
 * Step of one cell: 0 to 4, an index of HEAT_STEPS. value / max is a share from 0 to 1.
 * Any event gives step 1 or more, so a quiet day never looks empty. A max of 0 gives step 0.
 * Math.min keeps a value above max on the last step.
 */
function heatStep(value: number, max: number): number {
	return value <= 0 || max <= 0 ? 0 : Math.min(HEAT_STEPS.length - 1, Math.ceil((value / max) * (HEAT_STEPS.length - 1)));
}
/** One column per week, Monday on top. No-style defaults: 16 px cells, 4 px gaps, and 2 px corners. */
function HeatCalendar({ points, label, cellTitle }: { points: DailyPoint[]; label: string; cellTitle: (point: DailyPoint) => string }) {
	const max = Math.max(0, ...points.map((point) => point.current));
	const first = points[0];
	// Blank cells move the first day down to the row of its weekday. getUTCDay gives 0 for Sunday.
	const blanks = first ? (new Date(`${first.day}T00:00:00Z`).getUTCDay() + 6) % 7 : 0;
	return (
		<div role="img" aria-label={label} className="grid w-fit grid-flow-col grid-rows-7 gap-[4px]">
			{Array.from({ length: blanks }, (_, blank) => <span key={`blank-${blank}`} />)}
			{points.map((point) => <span key={point.day} title={cellTitle(point)} className={cn("size-[16px] rounded-[2px]", HEAT_STEPS[heatStep(point.current, max)])} />)}
		</div>
	);
}
```

## Fallback

None. Every app with an event table can feed it.

## Messages

Add a `chart` group to `messages` in `src/shared/i18n/messages.ts`. Write the text in the app language.
Name the real action in `emptyAction` and `breakdownEmptyAction`.

- `chart.period`: "Period"
- `chart.empty`: "Nothing was recorded in this period."
- `chart.emptyAction`: the action that records the events of the trend, for example "Record a delivery"
- `chart.breakdownEmptyAction`: the action that records the events of the breakdown, for example "Record a return"
- `chart.total`: "Total"
- `chart.busiestDay`: "Busiest day"
- `chart.less`: "Less"
- `chart.more`: "More"
