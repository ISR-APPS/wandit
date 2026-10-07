# Style serre
A greenhouse: pale sage glass, a deep green frame, and soft serif labels on the seed trays.
Mode: light only. Fits: farms, gardens, food producers, cafes, eco, real estate. Avoid: dev tools, nightlife, security.
Radius 1rem. Controls: pill. Shell: recipe. Density: recipe.

## Identity

- Ground: pale sage, L 0.965 at hue 140. The ground has a clear green tint, never plain white.
- Panels: flat fields of a deeper sage, with no border and no shadow. The tint alone sets them apart.
- The leaf corner: the top start corner of each panel is twice as round as the other three.
- Frame: the sidebar is deep green in every shell. The page stays light.
- Type: a soft serif for the page title, the panel titles, and the KPI figures. A plain sans for the rest.
- Charts: bars of counts per day over season bands. An area only for one continuous measure. The accent draws the main series.
- This is not the cream, serif, and terracotta default. The ground is green, and no accent is clay.

## Fonts

Each block gives the link for `__root.tsx`, the roles, and the CSS for `tokens.css`. Name the four families in the font note.

### fonts=1

Display and figures: Young Serif 400. Body: Karla 400 to 700. Arabic display: Amiri. Arabic body: Almarai.
`https://fonts.googleapis.com/css2?family=Young+Serif&family=Karla:wght@400;500;600;700&family=Amiri:wght@400;700&family=Almarai:wght@400;700&display=swap`

```css
/* Not in @theme inline: utilities emit var(--font-*), so html:lang(ar) can swap in the Arabic twins. */
@theme {
	--font-sans: "Karla", ui-sans-serif, system-ui, sans-serif;
	--font-display: "Young Serif", ui-serif, Georgia, serif;
}
html:lang(ar) {
	--font-sans: "Almarai", ui-sans-serif, system-ui, sans-serif;
	--font-display: "Amiri", "Almarai", ui-serif, Georgia, serif;
}
/* Young Serif has one weight, 400. A heavier weight class must not draw a false bold. */
:is(h1, h2, h3, h4, .font-display, .font-numeric) {
	font-synthesis-weight: none;
}
```

### fonts=2

Display and figures: Lora 400 to 700. Body: Nunito Sans 400 to 700. Arabic display: Markazi Text. Arabic body: Mada.
`https://fonts.googleapis.com/css2?family=Lora:wght@400;500;600;700&family=Nunito+Sans:wght@400;500;600;700&family=Markazi+Text:wght@400;500;600;700&family=Mada:wght@400;500;600;700&display=swap`

```css
/* Not in @theme inline: utilities emit var(--font-*), so html:lang(ar) can swap in the Arabic twins. */
@theme {
	--font-sans: "Nunito Sans", ui-sans-serif, system-ui, sans-serif;
	--font-display: "Lora", ui-serif, Georgia, serif;
}
html:lang(ar) {
	--font-sans: "Mada", ui-sans-serif, system-ui, sans-serif;
	--font-display: "Markazi Text", "Mada", ui-serif, Georgia, serif;
}
```

## Palette

The block holds accent=1, moss green. `--card` is the panel sage, `--popover` is lighter, and the sidebar is the green frame.

### Light

Replace the `:root` block. This style is light only: leave the `.dark` block as it is.

```css
/* Lowest contrast, accents 1-3: text 4.67:1 (muted-foreground on muted), lines 3.14:1 (accent=1 ring on card). */
:root {
	--background: oklch(0.965 0.02 140);
	--foreground: oklch(0.27 0.045 152);
	--card: oklch(0.935 0.03 138);
	--card-foreground: oklch(0.27 0.045 152);
	--popover: oklch(0.985 0.01 140);
	--popover-foreground: oklch(0.27 0.045 152);
	--primary: oklch(0.47 0.11 135);
	--primary-foreground: oklch(0.98 0.012 135);
	--secondary: oklch(0.9 0.035 140);
	--secondary-foreground: oklch(0.29 0.05 150);
	--muted: oklch(0.905 0.03 140);
	--muted-foreground: oklch(0.49 0.04 150);
	--accent: oklch(0.895 0.045 132);
	--accent-foreground: oklch(0.28 0.06 140);
	--destructive: oklch(0.49 0.17 30);
	--destructive-foreground: oklch(0.98 0.01 90);
	--border: oklch(0.86 0.035 140);
	--input: oklch(0.6 0.04 145);
	--ring: oklch(0.6 0.13 135);
	--sidebar: oklch(0.3 0.055 155);
	--sidebar-foreground: oklch(0.9 0.03 140);
	--sidebar-primary: oklch(0.82 0.13 128);
	--sidebar-primary-foreground: oklch(0.25 0.05 145);
	--sidebar-accent: oklch(0.375 0.06 152);
	--sidebar-accent-foreground: oklch(0.975 0.015 135);
	--sidebar-border: oklch(0.38 0.05 152);
	--sidebar-ring: var(--ring);
	--chart-1: var(--primary);
	--chart-2: oklch(0.36 0.06 165);
	--chart-3: oklch(0.58 0.08 150);
	--chart-4: oklch(0.5 0.05 65);
	--chart-5: oklch(0.58 0.05 110);
	--success: oklch(0.46 0.11 155);
	--warning: oklch(0.47 0.1 65);
	--info: oklch(0.47 0.1 235);
	--radius: 1rem;
	--control-radius: 9999px;
}
```

## Accents

Each row keeps 4.5:1 for its text and 3:1 for the accent on the ground and a panel. The accent draws the main series: `--chart-1` reads `--primary`.
`--ring` is a mid tone of the accent. The focus ring then keeps 3:1 on the pale page and on the deep green sidebar. `--sidebar-ring` reads it.

| accent | name | --primary | --primary-foreground | --ring | --sidebar-primary | --sidebar-primary-foreground |
|---|---|---|---|---|---|---|
| accent=1 | moss green | oklch(0.47 0.11 135) | oklch(0.98 0.012 135) | oklch(0.6 0.13 135) | oklch(0.82 0.13 128) | oklch(0.25 0.05 145) |
| accent=2 | garden plum | oklch(0.45 0.12 345) | oklch(0.98 0.01 345) | oklch(0.61 0.13 345) | oklch(0.82 0.08 345) | oklch(0.27 0.06 345) |
| accent=3 | dry ochre | oklch(0.5 0.1 70) | oklch(0.985 0.01 80) | oklch(0.61 0.11 70) | oklch(0.83 0.12 80) | oklch(0.27 0.05 70) |

## Knobs

Put this block after the palette block. Weight 500 draws Lora 500. Young Serif has one weight and stays at 400, with no false bold.

```css
/* Style knobs of serre: flat sage fields, serif titles, a gentle area fill, dotted grid rows. */
:root {
	--surface-border-width: 0px;
	--surface-shadow: 0 0 #0000;
	--surface-radius: var(--radius);
	--heading-weight: 500;
	--heading-tracking: -0.01em;
	--heading-case: none;
	--title-weight: 500;
	--title-case: none;
	--title-tracking: 0em;
	--label-weight: 600;
	--label-case: none;
	--label-tracking: 0em;
	--numeral-font: var(--font-display);
	--icon-stroke: 1.75;
	--chart-stroke: 2;
	--chart-fill-opacity: 0.22;
	--chart-grid-dash: 2 6;
	--table-stripe: transparent;
	--table-head-bg: transparent;
	--nav-active-bg: var(--sidebar-accent);
	--nav-indicator-width: 0px;
}
```

## Anatomy

- Page header: `PageHeader`. The knobs draw the h1 in the serif. Put the place or the period in `description`.
- Panel: a `Card` with the leaf corner, `className="gap-4 rounded-ss-[calc(var(--surface-radius)*2)] py-5"`.
  The kit gives the sage fill, no border, and no shadow. Never put a panel inside a panel.
  Rows inside a panel: `divide-y divide-border`. A row that opens a page: `rounded-md px-2 hover:bg-accent/60`.
- Panel title: `<CardTitle className="font-display text-lg">`. One muted line under it at most.
- KPI: a small panel with the leaf corner. Label `text-muted-foreground text-sm` first,
  then the value `font-numeric text-4xl tabular-nums leading-none`, then the growth bar (snippet below).
  - kpi=number: label, value, growth bar.
  - kpi=icon: the icon in a leaf chip, `flex size-9 items-center justify-center rounded-md rounded-ss-xl bg-accent text-accent-foreground`.
  - kpi=delta: the delta sits at the end of the growth bar row, `text-sm tabular-nums`.
  - kpi=spark: a mini area `h-12` in place of the growth bar, with the chart fill rule below.
  - kpi=meter: the kit `Progress` of the part over the whole, `className="h-1.5 bg-muted"`, no mark. Both numbers under it.
  - kpi=strip: one panel. Rules in `--border`, 1 px. Deltas only, no bars.

```tsx
type GrowthBarProps = {
	/** Total of this period, from the KPI SQL function. */
	current: number;
	/** Total of the previous period of the same length, from the same function. */
	previous: number;
};

/** This period as the fill, the previous one as a mark. With no previous data (change is null), do not render it. */
function GrowthBar({ current, previous }: GrowthBarProps) {
	const scale = Math.max(current, previous, 0);
	// Share of the scale, 0 to 1. A total below 0 clamps to the start.
	const previousShare = scale > 0 ? Math.min(Math.max(previous / scale, 0), 1) : 0;
	return (
		<div aria-hidden className="relative">
			<Progress value={current} max={scale} className="h-1.5 bg-muted" />
			{/* Both totals at 0 give no scale: the empty track shows, with no mark. */}
			{scale > 0 ? (
				<span className="absolute -top-0.5 h-2.5 w-0.5 rounded-full bg-foreground/60" style={{ insetInlineStart: `${previousShare * 100}%` }} />
			) : null}
		</div>
	);
}
```

- Charts: counts per day are bars over the season bands: `radius={[8, 8, 2, 2]}`, `maxBarSize={32}`, `fill="var(--color-<key>)"`.
  An area is only for one continuous measure, such as a stock level or a balance.
  The area: `type="monotone"`, no dots, no gradient defs, `fill="var(--color-<key>)"`. The knob sets its opacity.
  `<CartesianGrid vertical={false} />`, dotted by the knob. Axes `tickLine={false} axisLine={false}`. Main `h-64` with a Y axis; side `h-48`, no Y axis.
  Horizontal bars `radius={6}`. A breakdown is bars, not a donut. A stack uses chart 1, 2, and 4 first.
  - chart=heat: cells `size-[14px] rounded-[4px]` with `gap-[3px]`, on the sage panel. 90 days take 235 px.
- Tables: no stripes and no head fill. Rows `hover:bg-accent/50`. Numbers `text-end tabular-nums` in the body face.
- Navigation: the deep green sidebar of the palette. The active item takes the knob fill and `font-medium`.
  Brand mark: in `app-sidebar.tsx`, replace `rounded-lg` with `rounded-md rounded-ss-xl`: the leaf corner again.
- Badges and status: a pill `Badge` (`success`, `warning`, `info`, `destructive`) plus the word.
- Buttons and inputs: pill buttons. The main action is the `default` variant. An input on a panel gets `bg-popover`.
- Motion: row hover tints only, `transition-colors`. Nothing moves on load.

## Signature

1. The season band. Every time chart draws its months as bands under the bars or the area. Every second month is a deeper sage.
   Bind it to the trade: harvest windows, the terrace season, or school terms from the data. Else use calendar months.

```tsx
/** Calendar months of a daily series, oldest first. `day` is YYYY-MM-DD, so the first 7 characters name the month. */
function monthBands(points: DailyPoint[]): { first: string; last: string }[] {
	const bands: { first: string; last: string }[] = [];
	for (const point of points) {
		const band = bands.at(-1);
		if (band && band.first.slice(0, 7) === point.day.slice(0, 7)) {
			band.last = point.day;
		} else {
			bands.push({ first: point.day, last: point.day });
		}
	}
	return bands;
}

{/* Inside the BarChart or the AreaChart, before the Bar or the Area. zIndex -50 keeps the band above the grid and under the marks. */}
{monthBands(points).map((band, index) =>
	// Every second month gets a band, so two months side by side never share one tone.
	index % 2 === 1 ? (
		<ReferenceArea key={band.first} x1={band.first} x2={band.last} fill="var(--muted)" fillOpacity={1} zIndex={-50} />
	) : null,
)}
```

2. The leaf corner on every panel and on the brand mark. One panel per home gets `bg-accent`:
   the panel of the most important figure of the trade (harvest, covers, viewings).

## Empty state

- Every panel keeps its place, its size, and its leaf corner.
- KPI figures show real zeros in the serif. The growth bar shows the empty `bg-muted` track and no mark.
- Time charts keep the season bands and draw a flat line at 0.
- Lists show three empty slots, `h-10 rounded-md border border-border border-dashed`, then one muted sentence.
- Setup strip: under the page header, `flex flex-wrap items-center gap-3 rounded-surface rounded-ss-[calc(var(--surface-radius)*2)] bg-accent px-5 py-3`.
  One sentence and 2 to 4 `size="sm"` buttons with the first real actions, named after the trade.

## Do not

- A border or a shadow on a panel. Instead, let the sage fill and the leaf corner set the panel apart.
- A leaf corner on every corner, or on buttons. Instead, round one top start corner: panels, icon chips, the brand mark.
- A light sidebar. Instead, keep the deep green sidebar of the palette in every shell.
- A gradient under an area, or a dark chart. Instead, use one flat fill at the knob opacity over season bands.
- A tinted panel inside a tinted panel. Instead, use rows with `divide-y` inside one panel.

## Check

- Is the ground pale sage, and is the sidebar deep green?
- Do the panels have a sage fill, no border, no shadow, and one large top start corner?
- Are the page title, the panel titles, and the KPI figures in the serif?
- Does each time chart show season bands under its bars, or under one soft area for a continuous measure?
- With no rows, does every panel stay in place, with zeros and dashed empty slots?
