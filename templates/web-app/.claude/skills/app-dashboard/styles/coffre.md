# Style coffre
A bank vault after closing time: blue-steel walls, brushed panels lit from above, one warm lamp.
Mode: dark only. Fits: finance, wealth, real estate, luxury, legal, hotels, investors. Avoid: kids, food trucks, schools.
Radius 0.875rem. Controls: matched. Shell: recipe. Density: recipe.

## Identity
- Blue-steel ground `oklch(0.2 0.03 235)`, never black. Panels sit one step up (L 0.24), the sidebar one step down.
- Each part of the home has one surface role:
  - The main chart sits on the bare ground, with no panel.
  - The KPI figures sit on the ground in one row. kpi=strip puts them in one shared panel. Never one panel per figure.
  - List, table, and side chart panels have the bevel: a light top edge and a faint inner glow. They have no border.
- Two typefaces: a Didone serif for the page title, a clean sans for all other text and every number.
- Two things glow: the last point of the main line and the busiest heatmap days. Nothing else glows.
- Wide gaps, few colors, one warm accent. The accent goes on the data and the main action, not on the frame.
- Dark only: apply `### mode=dark` of `frame.md` whatever the recipe mode says.

## Fonts
### fonts=1
- Roles: display Bodoni Moda (500, 600), body Manrope (400 to 700), numerals Manrope 300 with `tabular-nums`.
  Arabic twins: display El Messiri (500, 600), body Noto Sans Arabic (300 to 700).
- Link: `https://fonts.googleapis.com/css2?family=Bodoni+Moda:opsz,wght@6..96,500;6..96,600&family=Manrope:wght@300;400;500;600;700&family=El+Messiri:wght@500;600&family=Noto+Sans+Arabic:wght@300;400;500;600;700&display=swap`
- Font note: `Fonts of the style coffre (fonts=1): Bodoni Moda + Manrope, Arabic twins El Messiri + Noto Sans Arabic (Google Fonts), loaded in __root.tsx.`
```css
/* Not inside @theme inline: the html:lang(ar) block below must swap these stacks. */
@theme {
	--font-sans: "Manrope", ui-sans-serif, system-ui, sans-serif;
	--font-display: "Bodoni Moda", ui-serif, Georgia, serif;
}
html:lang(ar) {
	--font-sans: "Noto Sans Arabic", ui-sans-serif, system-ui, sans-serif;
	--font-display: "El Messiri", "Noto Sans Arabic", ui-sans-serif, system-ui, sans-serif;
}
```
### fonts=2
- Roles: display Gloock (400 only), body Sora (400 to 600), numerals Sora 300 with `tabular-nums`.
  Arabic twins: display Amiri (400, 700), body Readex Pro (300 to 600).
- Link: `https://fonts.googleapis.com/css2?family=Gloock&family=Sora:wght@300;400;500;600&family=Amiri:wght@400;700&family=Readex+Pro:wght@300;400;500;600&display=swap`
- Font note: `Fonts of the style coffre (fonts=2): Gloock + Sora, Arabic twins Amiri + Readex Pro (Google Fonts), loaded in __root.tsx.`
```css
/* Not inside @theme inline: the html:lang(ar) block below must swap these stacks. */
@theme {
	--font-sans: "Sora", ui-sans-serif, system-ui, sans-serif;
	--font-display: "Gloock", ui-serif, Georgia, serif;
}
html:lang(ar) {
	--font-sans: "Readex Pro", ui-sans-serif, system-ui, sans-serif;
	--font-display: "Amiri", "Readex Pro", ui-serif, Georgia, serif;
}

/* Gloock has one weight, 400. A heavier weight class must not draw a false bold. */
:is(h1, h2, h3, h4, .font-display) {
	font-synthesis-weight: none;
}
```

## Palette
### Dark
The block replaces `.dark`. Leave `:root` as it is: the `dark` class is always on `<html>`.
```css
/* Style coffre, accent=1 (champagne gold).
   Lowest text ratio 5.38:1 (destructive on its delta tint in a panel). Lowest mark ratio 4.18:1 (input on card). */
.dark {
	--background: oklch(0.2 0.03 235);
	--foreground: oklch(0.94 0.012 235);
	--card: oklch(0.24 0.032 235);
	--card-foreground: oklch(0.94 0.012 235);
	--popover: oklch(0.265 0.033 235);
	--popover-foreground: oklch(0.94 0.012 235);
	--primary: oklch(0.83 0.08 85);
	--primary-foreground: oklch(0.22 0.035 75);
	--secondary: oklch(0.295 0.03 235);
	--secondary-foreground: oklch(0.91 0.012 235);
	--muted: oklch(0.28 0.03 235);
	--muted-foreground: oklch(0.76 0.022 235);
	--accent: oklch(0.315 0.034 235);
	--accent-foreground: oklch(0.96 0.01 235);
	--destructive: oklch(0.73 0.16 22);
	--destructive-foreground: oklch(0.2 0.03 22);
	--border: oklch(0.94 0.012 235 / 10%);
	--input: oklch(0.6 0.03 235);
	--ring: oklch(0.83 0.08 85);
	--radius: 0.875rem;
	--control-radius: calc(var(--radius) * 0.6);
	--sidebar: oklch(0.175 0.028 235);
	--sidebar-foreground: oklch(0.87 0.014 235);
	--sidebar-primary: oklch(0.83 0.08 85);
	--sidebar-primary-foreground: oklch(0.22 0.035 75);
	--sidebar-accent: oklch(0.24 0.032 235);
	--sidebar-accent-foreground: oklch(0.96 0.01 235);
	--sidebar-border: oklch(0.94 0.012 235 / 8%);
	--sidebar-ring: var(--ring);
	/* The accent draws the main series. chart-2 and chart-3 are the two other accents, so no hue shows twice. */
	--chart-1: var(--primary);
	--chart-2: oklch(0.8 0.07 228);
	--chart-3: oklch(0.76 0.12 162);
	--chart-4: oklch(0.74 0.07 300);
	--chart-5: oklch(0.66 0.03 245);
	--success: oklch(0.78 0.13 158);
	--warning: oklch(0.81 0.13 62);
	--info: oklch(0.79 0.09 235);
}
```

## Accents
Set the row in `.dark`. `--sidebar-ring` and `--chart-1` read `--primary`. `--chart-2` and `--chart-3` change, so no accent shows twice.
Each accent is light on a dark ground, so it draws link text, the meter fill, and a ring. Lowest ratios, all accent=3:
link text on a panel 8.06:1, the meter fill on `--muted` 7.15:1, the ring on the ground 8.89:1.

| Accent | Name | Mode | `--primary` | `--primary-foreground` | `--ring` | `--sidebar-primary` | `--sidebar-primary-foreground` | `--chart-2` | `--chart-3` |
|---|---|---|---|---|---|---|---|---|---|
| accent=1 | champagne gold | dark | `oklch(0.83 0.08 85)` | `oklch(0.22 0.035 75)` | `oklch(0.83 0.08 85)` | `oklch(0.83 0.08 85)` | `oklch(0.22 0.035 75)` | `oklch(0.8 0.07 228)` | `oklch(0.76 0.12 162)` |
| accent=2 | ice blue | dark | `oklch(0.81 0.08 228)` | `oklch(0.2 0.035 240)` | `oklch(0.81 0.08 228)` | `oklch(0.81 0.08 228)` | `oklch(0.2 0.035 240)` | `oklch(0.83 0.08 85)` | `oklch(0.76 0.12 162)` |
| accent=3 | emerald green | dark | `oklch(0.76 0.13 162)` | `oklch(0.2 0.035 165)` | `oklch(0.76 0.13 162)` | `oklch(0.76 0.13 162)` | `oklch(0.2 0.035 165)` | `oklch(0.83 0.08 85)` | `oklch(0.8 0.07 228)` |

## Knobs
```css
/* Knobs of the style coffre: bevel panels with no border and no drop shadow, a warm active line, quiet data lines. */
:root {
	--surface-border-width: 0px;
	/* Two inset layers: the light top edge (the bevel) and a faint inner glow. No outer shadow. */
	--surface-shadow: inset 0 1px 0 0 color-mix(in oklch, var(--foreground) 14%, transparent),
		inset 0 0 2.5rem 0 color-mix(in oklch, var(--foreground) 4%, transparent);
	--surface-radius: var(--radius);
	--heading-weight: 500;
	--heading-tracking: -0.01em;
	--heading-case: none;
	--title-weight: 600;
	--title-case: none;
	--title-tracking: -0.01em;
	--label-weight: 500;
	--label-case: none;
	--label-tracking: 0.01em;
	--numeral-font: var(--font-sans);
	--icon-stroke: 1.5;
	--chart-stroke: 1.75;
	--chart-fill-opacity: 0.22;
	--chart-grid-dash: none;
	--table-stripe: transparent;
	--table-head-bg: transparent;
	--nav-active-bg: var(--sidebar-accent);
	--nav-indicator-width: 2px;
}
```

## Anatomy
- **Page header.** `PageHeader` as it is: the knobs set the Didone h1. `description` holds the scope, for example the portfolio name.
- **Page grid.** `grid @5xl/main:grid-cols-12 grid-cols-1 gap-8 @5xl/main:gap-x-6`. Wide gaps keep the ground visible.
- **Main chart, on the ground.** No `Card`: `<section className="grid gap-4">`. Its header row
  `flex flex-wrap items-end justify-between gap-3` holds an `<h2 className="font-semibold text-base">` and the period control.
- **List and side panels.** A `Card` as it is: the knobs draw the bevel, the glow, and the radius.
  `<Card className="gap-0 py-0">` with rows `px-6 py-3.5` in a `divide-y divide-border` list. `CardTitle` (sans 600), no icon.
- **KPI.** The figures sit on the ground: `grid @5xl/main:grid-cols-4 @xl/main:grid-cols-2 grid-cols-1 gap-x-10 gap-y-6`, with no box and no rule.
  Label `label-text text-muted-foreground text-sm`. Value `font-light font-numeric text-4xl tabular-nums tracking-tight`.
  The value row is `flex items-end justify-between gap-4`. A KPI with a `series` ends that row with a mini line,
  `ChartContainer className="aspect-auto h-10 w-28"`. It has one `Line` and a `GlowDot`, with no axis and no grid.
  - number: label, value, one change line `text-xs`. icon: the icon in
    `flex size-9 items-center justify-center rounded-full text-primary ring-1 ring-primary/35` at the label end.
  - delta: the change in `rounded-control bg-success/12 px-2 py-0.5 text-success text-xs` (or `destructive`).
  - spark: the mini line is the spark.
  - meter: a track `relative h-0.5 rounded-full bg-muted` holds a fill `h-full rounded-full bg-primary` and a dot at the fill end.
    `share` is the value as a percent of its whole, from 0 to 100: `whole > 0 ? Math.min(100, Math.max(0, (value / whole) * 100)) : 0`.
    The fill has ``style={{ width: `${share}%` }}``. The dot is `absolute top-1/2 -ms-1 size-2 -translate-y-1/2 rounded-full bg-primary
    shadow-[0_0_8px_var(--primary)]` with ``style={{ insetInlineStart: `${share}%` }}``. A whole of 0 draws the track only.
  - strip: the only KPI form in a panel: one bevel `Card className="gap-0 py-0"`, cells `px-6 py-5`, the strip rules 1 px `border-border`.
- **Charts.** Main `h-64` (`@5xl/main:h-72` from 5xl), side `h-48`, mini `h-10`. Curves `type="monotone"`, `dot={false}`.
  Grid `<CartesianGrid vertical={false} />`. Axes `tickLine={false} axisLine={false} tickMargin={10}`.
  - area: one flat `fill="var(--color-<key>)"`; the knob sets its opacity. No gradient.
    The last point of the chart-1 series gets a `GlowDot`. Only the main chart and the KPI mini lines have one.
  - bars: `radius={[4, 4, 0, 0]}`. Past bars get `fillOpacity={0.5}` on their `Cell`. The current bar is full.
  - compare: this period in chart-1 with a `GlowDot`, the previous period in chart-5 with `strokeDasharray="3 5"`.
  - stacked: chart-1 to chart-3, with `strokeWidth={1}` between parts in the surface color: `var(--background)` or `var(--card)`.
  - heat: the calendar of Signature 2: cells `size-[14px] rounded-[3px]` with `gap-[3px]`. 90 days take 235 px.
- **Tables.** `DataTable` in a list panel. The 10% hairline of `--border` splits the rows. Amounts
  `text-end font-numeric tabular-nums`. Ids and dates `text-muted-foreground`. No stripes, no head fill.
- **Navigation.** Flat dark sidebar. The active item gets the soft fill and a 2px start line (knobs).
  Brand mark in `app-sidebar.tsx`: replace the square chip with
  `flex size-8 items-center justify-center rounded-full font-sans text-lg text-sidebar-foreground ring-1 ring-sidebar-border`.
- **Badges and status.** `Badge` tints (`success`, `warning`, `info`, `destructive`) plus a word. No solid pills.
- **Buttons and inputs.** Main action: the default `Button` (gold, dark text). Others `outline`, or `ghost` in a panel. Inputs as the kit.
- **Motion.** No load animation. Menus and tooltips keep the kit fade. The glow is still: no pulse.

## Signature
1. **The glowing end dot.** The last point of the main line has a halo of its own color.
   Bind it to the figure that the owner checks first: assets under care, occupancy, signed fees.
```tsx
// The last point of a coffre line chart. A blur of --chart-1 around it makes it glow.
import { ReferenceDot } from "recharts";
type GlowDotProps = {
	/** X value of the last point, the same value as the XAxis dataKey, for example a day key. */
	x: string;
	/** Y value of the last point, in the unit of the series. Zero data gives 0. */
	y: number;
};
/** Last child of the LineChart or AreaChart. The ground-colored ring cuts the dot from the line. */
export function GlowDot({ x, y }: GlowDotProps) {
	return (
		<ReferenceDot
			x={x}
			y={y}
			r={4}
			fill="var(--chart-1)"
			stroke="var(--background)"
			strokeWidth={2}
			ifOverflow="visible"
			// The glow marks a value. A zero on a first visit gets the dot with no glow.
			className={y > 0 ? "drop-shadow-[0_0_6px_var(--chart-1)]" : undefined}
		/>
	);
}
```

2. **The calendar heatmap.** Weeks are columns, days are 7 rows: `grid grid-flow-col grid-rows-7 gap-[3px]`, in text direction.
   Bind it to the event that moves value in this business: deposits, viewings, check-ins, signed deeds.
   Copy `HEAT_STEPS` and `heatStep` of `charts/heat.md` as they are. Each day cell is a `HeatDay`.
```tsx
// One day of the coffre calendar heatmap. HEAT_STEPS and heatStep come from charts/heat.md, unchanged.
import { cn } from "~/shared/lib/utils";
type HeatDayProps = {
	/** Step of the day from heatStep: 0 (no event) to 4 (the busiest), an index of HEAT_STEPS. */
	step: number;
	/** Date and count of the day, for a mouse pointer. */
	title: string;
};
/** A 14 px square, in px so density never widens the calendar. Only the last step glows: the busiest days read first. */
export function HeatDay({ step, title }: HeatDayProps) {
	return (
		<span
			title={title}
			className={cn(
				"size-[14px] rounded-[3px]",
				HEAT_STEPS[step],
				step === HEAT_STEPS.length - 1 && "shadow-[0_0_8px_var(--chart-1)]",
			)}
		/>
	);
}
```

## Empty state
- The main chart keeps its axes and its grid on the ground, with a flat line at 0 over the whole period.
- KPI values show `0` in the same light face. A mini line runs flat at 0. Its end dot shows with no glow.
- The calendar heatmap shows every day at step 0: the empty calendar is the frame.
- A list panel keeps its bevel and its header row. The first row holds one muted sentence and the action that fills it.
- Setup strip, under the page header: `flex flex-wrap items-center gap-3 rounded-surface bg-card px-5 py-3 shadow-surface`.
  It holds one muted sentence and 2 to 4 `Button size="sm"`: the first is the main action, the rest `outline`.

## Do not
- Four equal KPI cards, or the main chart in a card. Instead: figures and the main chart on the bare ground.
- A 1px border or a drop shadow on a panel. Instead: the bevel and the inner glow of the knobs.
- Glow on buttons, text, or panels. Instead: glow only on the last chart-1 point and on the busiest heat step.
- Didone numerals or Didone body text. Instead: the sans for every number, the serif for the h1 only.
- A black or grey ground, or gold on large areas. Instead: the blue-steel ladder, and gold on the data and the main action.

## Check
- Is the ground blue-steel, with no black and no grey?
- Do the main chart and the KPI figures sit on the bare ground, with no panel around each figure?
- Do the list panels show a light top edge, no side borders, and no drop shadow?
- Is the page title the only serif text on the screen?
- Does the last point of the main line glow, and nothing else except the busiest heat days?
- Is a calendar heatmap on the home, with figures in the light sans face?
