# Style regie
A night control room: a tight wall of dark tiles, large figures, status lights, and a live status bar at the bottom.
Mode: dark only. Fits: logistics, dispatch, field service, fleet, security, monitoring, manufacturing. Avoid: beauty, kids, wellness, weddings.
Radius 0.25rem. Controls: matched. Shell: rail (fixed). Density: compact (fixed).

## Identity
- The home is one wall of tiles. A 3 px gap separates the tiles. No tile has a shadow.
- The ground is navy (`oklch(0.17 0.03 250)`), not black. Tiles are one step lighter, with a 1 px inner border.
- Figures are large and condensed, so a person can read them at a distance from the screen.
- Safety orange is the color of the trade: hi-vis vests and traffic cones. Every accent lights only the items that need a person now.
- Uppercase only on panel titles, because a short caps title names a tile. Labels, headings, and table heads use sentence case.

## Fonts
Apply your `fonts=<n>` as SKILL.md, step 4 says. The style is dark only: also apply `### mode=dark` of `frame.md`.
### fonts=1
Display and numerals: Barlow Condensed. Body: Barlow. Arabic twins: Changa (display), Cairo (body).
Font note: `Fonts of the style regie (fonts=1): Barlow Condensed + Barlow, Arabic twins Changa + Cairo (Google Fonts), loaded in __root.tsx.`
Link: `https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@500;600;700&family=Barlow:wght@400;500;600&family=Changa:wght@500;600;700&family=Cairo:wght@400;500;600&display=swap`
```css
/* Not inside @theme inline: utilities must emit var(--font-*) so the
   :lang(ar) scope below can swap the Latin stacks for the Arabic twins. */
@theme {
	--font-sans: "Barlow", ui-sans-serif, system-ui, sans-serif;
	--font-display: "Barlow Condensed", "Barlow", ui-sans-serif, system-ui, sans-serif;
}
html:lang(ar) {
	--font-sans: "Cairo", ui-sans-serif, system-ui, sans-serif;
	--font-display: "Changa", "Cairo", ui-sans-serif, system-ui, sans-serif;
}
```
### fonts=2
Display, numerals, and body: Saira, with a width axis. Display and figures use the 75% width. Arabic twins: Changa (display), Tajawal (body).
Font note: `Fonts of the style regie (fonts=2): Saira (condensed width for display), Arabic twins Changa + Tajawal (Google Fonts), loaded in __root.tsx.`
Link: `https://fonts.googleapis.com/css2?family=Saira:wdth,wght@75,500;75,600;75,700;100,400;100,500;100,600&family=Changa:wght@500;600;700&family=Tajawal:wght@400;500;700&display=swap`
```css
/* Not inside @theme inline: utilities must emit var(--font-*) so the
   :lang(ar) scope below can swap the Latin stacks for the Arabic twins. */
@theme {
	--font-sans: "Saira", ui-sans-serif, system-ui, sans-serif;
	--font-display: "Saira", ui-sans-serif, system-ui, sans-serif;
}
html:lang(ar) {
	--font-sans: "Tajawal", ui-sans-serif, system-ui, sans-serif;
	--font-display: "Changa", "Tajawal", ui-sans-serif, system-ui, sans-serif;
}

/* style regie fonts=2 */
/* The link loads the 75% width of Saira. Arabic faces have no width axis, so they keep their width. */
:is(h1, h2, h3, h4, .font-display, .font-numeric) {
	font-stretch: 75%;
}
```

## Palette
### Dark
Ground L 0.17, tiles L 0.205, rail L 0.14, hue 250. `--chart-1` reads the accent; the others are cold greys and a violet.
```css
/* regie, accent=1. Lowest ratios: text 4.78:1 (destructive in the bg-muted delta box), lines 3.40:1 (input on a tile), grid 1.53:1. */
.dark {
	--background: oklch(0.17 0.03 250);
	--foreground: oklch(0.93 0.012 240);
	--card: oklch(0.205 0.03 250);
	--card-foreground: oklch(0.93 0.012 240);
	--popover: oklch(0.23 0.032 250);
	--popover-foreground: oklch(0.93 0.012 240);
	--primary: oklch(0.71 0.18 40);
	--primary-foreground: oklch(0.17 0.03 250);
	--secondary: oklch(0.26 0.032 250);
	--secondary-foreground: oklch(0.9 0.012 240);
	--muted: oklch(0.24 0.03 250);
	--muted-foreground: oklch(0.72 0.028 245);
	--accent: oklch(0.28 0.04 250);
	--accent-foreground: oklch(0.95 0.01 240);
	--destructive: oklch(0.66 0.21 22);
	--destructive-foreground: oklch(0.17 0.03 250);
	--border: oklch(0.34 0.035 250);
	--input: oklch(0.53 0.04 250);
	--ring: oklch(0.71 0.18 40);
	--radius: 0.25rem;
	--control-radius: var(--radius);
	--sidebar: oklch(0.14 0.028 250);
	--sidebar-foreground: oklch(0.85 0.015 240);
	--sidebar-primary: oklch(0.71 0.18 40);
	--sidebar-primary-foreground: oklch(0.17 0.03 250);
	--sidebar-accent: oklch(0.235 0.035 250);
	--sidebar-accent-foreground: oklch(0.95 0.01 240);
	--sidebar-border: oklch(0.26 0.032 250);
	--sidebar-ring: var(--ring);
	--success: oklch(0.79 0.16 150);
	--warning: oklch(0.83 0.15 80);
	--info: oklch(0.78 0.1 225);
	/* The accent draws the main series: the series that needs a person. */
	--chart-1: var(--primary);
	--chart-2: oklch(0.84 0.02 240);
	--chart-3: oklch(0.7 0.07 240);
	--chart-4: oklch(0.6 0.04 250);
	--chart-5: oklch(0.76 0.1 300);
}
```

## Accents
Each row replaces six tokens of the Dark block. `--sidebar-ring` and `--chart-1` read them through `var()`.
`--warning` changes with the row. With accent=2 it is a darker orange: its luminance ratio to the amber light is 1.53:1.
Each accent is light on a dark ground, so it draws link text, a meter cell, and a ring. Lowest ratios, all accent=1:
link text on a tile 6.49:1, a lit meter cell on `--muted` 5.95:1, the ring on the ground 6.93:1.

| accent | name | mode | `--primary` | `--primary-foreground` | `--ring` | `--sidebar-primary` | `--sidebar-primary-foreground` | `--warning` |
|---|---|---|---|---|---|---|---|---|
| accent=1 | safety orange | dark | `oklch(0.71 0.18 40)` | `oklch(0.17 0.03 250)` | `oklch(0.71 0.18 40)` | `oklch(0.71 0.18 40)` | `oklch(0.17 0.03 250)` | `oklch(0.83 0.15 80)` |
| accent=2 | signal amber | dark | `oklch(0.85 0.16 100)` | `oklch(0.17 0.03 250)` | `oklch(0.85 0.16 100)` | `oklch(0.85 0.16 100)` | `oklch(0.17 0.03 250)` | `oklch(0.74 0.15 60)` |
| accent=3 | radar cyan | dark | `oklch(0.8 0.13 210)` | `oklch(0.17 0.03 250)` | `oklch(0.8 0.13 210)` | `oklch(0.8 0.13 210)` | `oklch(0.17 0.03 250)` | `oklch(0.83 0.15 80)` |

## Knobs
```css
:root {
	--surface-border-width: 1px;
	/* Tiles sit flat in the wall: the border separates them, not a shadow. */
	--surface-shadow: 0 0 #0000;
	--surface-radius: var(--radius);
	--heading-weight: 600;
	--heading-tracking: 0em;
	--heading-case: none;
	--title-weight: 600;
	/* Panel titles only: a caps title names a tile of the wall. */
	--title-case: uppercase;
	--title-tracking: 0.06em;
	--label-weight: 500;
	--label-case: none;
	--label-tracking: 0.01em;
	--numeral-font: var(--font-display);
	--icon-stroke: 1.75;
	--chart-stroke: 1.5;
	--chart-fill-opacity: 0.12;
	--chart-grid-dash: 1 4;
	/* Zebra rows: the card lightened by about 0.02 L. */
	--table-stripe: color-mix(in oklch, var(--card), var(--foreground) 3%);
	--table-head-bg: var(--muted);
	--nav-active-bg: var(--sidebar-accent);
	--nav-indicator-width: 2px;
}
```

## Anatomy
- Page header: the kit `PageHeader`, `text-2xl`. The actions sit at the end. Keep it on one line at lg.
- Panel: a tile. The home grid is the wall: `grid @3xl/main:grid-cols-12 grid-cols-1 gap-[3px]`.
  Each tile is a `Card` with `className="gap-2 py-3 [&>[data-slot^=card-]]:px-3"`: a tight padding.
- Panel title: `CardTitle` with `font-display text-sm`. The knobs make it caps with wide tracking.
- KPI: a tile with a status light, a label, and a big condensed number.
  The light is a `StatusLight` (Signature 1). Use it only when the data gives the rule: a limit, a due time, a `goodWhen` change.
  The number: `font-numeric font-semibold text-5xl tabular-nums leading-none`. The label: `text-muted-foreground text-xs`.
  - number: the change line under the number, `text-xs` with sign and arrow.
  - strip: all figures in one wide tile. The rules of `kpis/strip.md` are 1 px `border-border`.
  - icon: the icon at the end of the label row, `size-4 text-muted-foreground`.
  - delta: the change in a readout box at the end: `rounded-sm bg-muted px-1.5 font-numeric text-sm tabular-nums`.
  - spark: a step line `h-8` under the number, `type="stepAfter"`, no fill.
  - meter: 10 cells in `grid grid-cols-10 gap-0.5`, each `h-2 rounded-[1px]`. The share is `whole > 0 ? Math.min(1, Math.max(0, value / whole)) : 0`, 0 to 1.
    `Math.round(share * 10)` cells are lit `bg-chart-1`; the others are `bg-muted`. A whole of 0 lights no cell.
- Charts: step lines, `type="stepAfter"`, `dot={false}`. The knobs give the stroke and a flat fill: no gradient.
  - Grid both ways: `<CartesianGrid stroke="var(--border)" />`; the knob dots it. The prop replaces the faint kit color (`--border` at 50%).
  - A threshold band only for a real limit of the data (a capacity, a service time):
    `<ReferenceArea y1={limit} fill="var(--chart-1)" fillOpacity={0.08} />`. Never invent a limit.
  - Axes: `tickLine={false} axisLine={false}`, ticks in `font-numeric`.
  - bars: square ends (`radius={0}`), `--chart-2` for normal bars, `--chart-1` for bars over the limit.
  - compare: this period in `--chart-1`, the previous period in `--chart-4`, both step lines.
  - stacked: `--chart-2`, `--chart-3`, `--chart-4`, `--chart-5`. The part that needs a person takes `--chart-1`.
  - heat: square cells `size-[12px] rounded-[1px]` with `gap-[3px]`, five steps from `--muted` to `--chart-1`.
  - Heights: main `h-56`, side `h-40`, KPI line `h-8`.
- Tables: compact rows. The knobs give the zebra and the head band. Numbers at the end in `font-numeric`.
  A row that needs a person gets an accent start bar: `[&>td:first-child]:border-s-2 [&>td:first-child]:border-s-primary`.
- Navigation: shell=rail, darker than the ground. The knobs give the active icon a fill and a 2 px bar. The brand mark is not in the accent:
  `flex size-8 items-center justify-center rounded-sm border border-sidebar-border bg-sidebar-accent font-display font-semibold text-sidebar-accent-foreground`.
- Badges and status: a `StatusLight`, not a pill. `Badge` only for a tag that is not a state.
- Buttons and inputs: matched corners. The main action is the accent with dark text. Inputs use `bg-muted`.
- Motion: none on load. A light that turns to attention fades in its halo once:
  `transition-[background-color,box-shadow] duration-600 ease-out motion-reduce:transition-none`. It never blinks.

## Signature
1. The status light: a dot and a word. Bind each tone to a real rule of the data: late jobs, a full dock, a sensor over its limit.
```tsx
// Status light of the regie style: a dot and the status word. KPI tiles, tables, and the status bar use it.
import { cn } from "~/shared/lib/utils";
/** State of a light. The data gives the rule: a limit, a due time, or a goodWhen change. */
export type LightTone = "normal" | "near" | "attention";
/** One shape per tone: a hollow dot, a filled dot, and a filled dot with a halo. */
const LIGHT_CLASS = {
	normal: "border-[1.5px] border-success",
	near: "bg-warning",
	attention: "bg-primary ring-[3px] ring-primary/30",
} satisfies Record<LightTone, string>;
type StatusLightProps = {
	/** State of the item, from the rule of the data. */ tone: LightTone;
	/** Translated status word, for example "Late". A screen reader reads the word, not the dot. */ label: string;
};
/** The halo fades in once when a light turns to attention. It never blinks. */
export function StatusLight({ tone, label }: StatusLightProps) {
	return (
		<span className="inline-flex items-center gap-1.5 text-xs">
			<span aria-hidden="true" className={cn("size-2 shrink-0 rounded-full transition-[background-color,box-shadow] duration-600 ease-out motion-reduce:transition-none", LIGHT_CLASS[tone])} />
			{label}
		</span>
	);
}
```
2. The live status bar: a clock and one count per status, at the bottom of the window.
   Bind it to the states of the business: vehicles out, jobs late, alarms open. In the shell, `SidebarInset` is a column at least
   `min-h-svh` high, and `<main>` fills it (`flex-1 flex-col`). The home returns a fragment with the bar last, so the bar is a child of `<main>`.
   The bar, with imports from `react` (`useSyncExternalStore`), `~/shared/i18n` (`useT`), `~/shared/lib/utils` (`cn`), and the file of `StatusLight` and `LightTone`:
```tsx
// Live status bar of the regie style: a clock and one count per status. The last child of <main>.
type StatusCount = {
	/** Translated status name, for example "Late". */ label: string;
	/** Rows in this status now, from the same query as the wall. */ count: number;
	/** Light of the status. "attention" also lights the count in the accent. */ tone: LightTone;
};
/** 60 s. The clock shows minutes. */
const MINUTE_MS = 60_000;
// A 1 s tick keeps the clock on time. The snapshot is the minute, so React renders once per minute.
const subscribeToClock = (onTick: () => void) => {
	const timer = window.setInterval(onTick, 1_000);
	return () => window.clearInterval(timer);
};
/** mt-auto puts the bar at the window bottom on a short page. sticky keeps it there on a long page. */
export function LiveStatusBar({ counts }: { counts: StatusCount[] }) {
	const { locale } = useT();
	const now = new Date(useSyncExternalStore(subscribeToClock, () => Math.floor(Date.now() / MINUTE_MS)) * MINUTE_MS);
	return (
		// The negative margins cancel the p-4 md:p-6 of <main>, so the bar spans the page column.
		<div className="sticky bottom-0 z-10 -mx-4 mt-auto -mb-4 flex items-center gap-5 overflow-x-auto border-t bg-sidebar px-4 py-1.5 font-display text-sm md:-mx-6 md:-mb-6">
			<time className="font-numeric tabular-nums" dateTime={now.toISOString()}>{new Intl.DateTimeFormat(locale, { timeStyle: "short" }).format(now)}</time>
			{counts.map((status) => (
				<span key={status.label} className={cn("flex items-center gap-2 whitespace-nowrap", status.tone === "attention" && "text-primary")}>
					<StatusLight tone={status.tone} label={status.label} /><span className="font-numeric tabular-nums">{new Intl.NumberFormat(locale).format(status.count)}</span>
				</span>
			))}
		</div>
	);
}
```

## Empty state
- The wall keeps every tile. KPI tiles show a real `0`. A light follows its rule on the zero: 0 late jobs is `normal`.
- Charts keep the dotted grid and draw a flat step line on 0. No threshold band without data.
- Tables keep the head band and show three empty zebra rows. The first row holds one muted sentence.
- The status bar shows the clock and `0` for each status. It stays at the bottom of the window.
- The setup strip is one tile across the wall top: `col-span-full flex flex-wrap items-center gap-3 border border-primary/60 border-dashed px-3 py-2`.
  It holds 2 to 4 first actions, for example "Add the first vehicle". The main one is the accent button.

## Do not
- Wide gaps and soft shadows between panels. Instead: the 3 px wall with flat tiles.
- Caps on labels, headings, or table heads. Instead: caps on panel titles only.
- The accent on a normal value, the brand mark, or a decoration. Instead: light only what needs a person.
- A light in color only, or a light that blinks. Instead: a `StatusLight` with its shape and its word, steady.
- Smooth `monotone` curves. Instead: step lines, because the data comes in readings.

## Check
- Do the tiles touch with a 3 px gap, with no shadow?
- Is the nav a dark rail of icons, with a brand mark that is not in the accent?
- Are the figures large and condensed?
- Does each status light have a word next to it, and do normal, near, and attention lights have different shapes?
- On a short page, does the status bar touch the bottom of the window, with a clock and counts per status?
- Are the charts step lines on a dotted grid that shows on the tiles?
