# Style cadran
A precision instrument: a cool face with thin outlines, light readouts, dials, and ruler marks.
Mode: light or dark. Fits: SaaS metrics, analytics, energy, labs, engineering, IoT. Avoid: kids, food, beauty.
Radius 0.375rem. Controls: matched. Shell: bordered (fixed). Density: recipe.

## Identity

- Each panel has a 1 px outline, tick marks on two corners, and no shadow.
- Readouts are huge, light (300), and mono, so each digit has the same width. Labels stay sans: mono labels look generic.
- A thin arc dial shows a real share. Time axes carry ruler marks. One signal color; the rest is graphite.

## Fonts

Apply your `fonts=<n>` as SKILL.md, step 4 says. `--numeral-font` reads `--font-mono`. Arabic digits fall back to the body twin.

### fonts=1
- Roles: display Red Hat Display, body Red Hat Text, numerals Red Hat Mono 300. Arabic: Alexandria (display), Rubik (body). Note: `Fonts of the style cadran (fonts=1): Red Hat Display + Red Hat Text + Red Hat Mono, Arabic twins Alexandria + Rubik (Google Fonts), loaded in __root.tsx.`
- Link: `https://fonts.googleapis.com/css2?family=Red+Hat+Display:wght@400;500;600&family=Red+Hat+Text:wght@400;500;600&family=Red+Hat+Mono:wght@300;400;500&family=Alexandria:wght@400;500;600&family=Rubik:wght@300;400;500&display=swap`
```css
/* Not in @theme inline: utilities must emit var(--font-*), so html:lang(ar) can swap in the Arabic twins. */
@theme {
	--font-sans: "Red Hat Text", ui-sans-serif, system-ui, sans-serif;
	--font-display: "Red Hat Display", "Red Hat Text", ui-sans-serif, system-ui, sans-serif;
	--font-mono: "Red Hat Mono", ui-monospace, monospace;
}
html:lang(ar) {
	--font-sans: "Rubik", ui-sans-serif, system-ui, sans-serif;
	--font-display: "Alexandria", "Rubik", ui-sans-serif, system-ui, sans-serif;
	--font-mono: "Red Hat Mono", "Rubik", ui-monospace, monospace;
}
```
### fonts=2
- Roles: display and body Outfit, numerals DM Mono 300. Arabic: Noto Kufi Arabic (display), Noto Sans Arabic (body). Note: `Fonts of the style cadran (fonts=2): Outfit + DM Mono, Arabic twins Noto Kufi Arabic + Noto Sans Arabic (Google Fonts), loaded in __root.tsx.`
- Link: `https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600&family=DM+Mono:wght@300;400;500&family=Noto+Kufi+Arabic:wght@400;500;600&family=Noto+Sans+Arabic:wght@300;400;500&display=swap`
```css
/* Not in @theme inline: utilities must emit var(--font-*), so html:lang(ar) can swap in the Arabic twins. */
@theme {
	--font-sans: "Outfit", ui-sans-serif, system-ui, sans-serif;
	--font-display: "Outfit", ui-sans-serif, system-ui, sans-serif;
	--font-mono: "DM Mono", ui-monospace, monospace;
}
html:lang(ar) {
	--font-sans: "Noto Sans Arabic", ui-sans-serif, system-ui, sans-serif;
	--font-display: "Noto Kufi Arabic", "Noto Sans Arabic", ui-sans-serif, system-ui, sans-serif;
	--font-mono: "DM Mono", "Noto Sans Arabic", ui-monospace, monospace;
}
```

## Palette

`--card` equals `--background`. The dark face is cyan graphite (L 0.225). The Light block holds the shape and the chart set.
### Light
```css
/* Lowest contrast, computed for accents 1-3: text 4.61:1 (warning on its badge tint), lines 3.35:1 (input). */
:root {
	--background: oklch(0.985 0.004 250);
	--foreground: oklch(0.23 0.02 262);
	--card: oklch(0.985 0.004 250);
	--card-foreground: oklch(0.23 0.02 262);
	--popover: oklch(0.995 0.002 250);
	--popover-foreground: oklch(0.23 0.02 262);
	--primary: oklch(0.5 0.19 275);
	--primary-foreground: oklch(0.985 0.004 250);
	--secondary: oklch(0.945 0.008 250);
	--secondary-foreground: oklch(0.28 0.02 262);
	--muted: oklch(0.95 0.007 250);
	--muted-foreground: oklch(0.49 0.02 260);
	--accent: oklch(0.945 0.014 275);
	--accent-foreground: oklch(0.28 0.06 275);
	--destructive: oklch(0.52 0.2 25);
	--destructive-foreground: oklch(0.985 0.004 250);
	--border: oklch(0.865 0.01 250);
	--input: oklch(0.63 0.015 255);
	--ring: oklch(0.5 0.19 275);
	--radius: 0.375rem;
	--control-radius: var(--radius);
	--sidebar: oklch(0.97 0.006 250);
	--sidebar-foreground: oklch(0.32 0.02 262);
	--sidebar-primary: oklch(0.5 0.19 275);
	--sidebar-primary-foreground: oklch(0.985 0.004 250);
	--sidebar-accent: oklch(0.935 0.01 250);
	--sidebar-accent-foreground: oklch(0.23 0.02 262);
	--sidebar-border: oklch(0.865 0.01 250);
	--sidebar-ring: var(--ring);
	--success: oklch(0.49 0.11 160);
	--warning: oklch(0.52 0.11 65);
	--info: oklch(0.5 0.1 235);
	--chart-1: var(--primary);
	--chart-2: color-mix(in oklch, var(--foreground) 85%, var(--background));
	--chart-3: color-mix(in oklch, var(--foreground) 62%, var(--background));
	--chart-4: color-mix(in oklch, var(--primary) 70%, var(--foreground));
	--chart-5: color-mix(in oklch, var(--foreground) 48%, var(--background));
}
```
### Dark
```css
/* Lowest contrast, computed for accents 1-3: text 5.38:1 (destructive on its badge tint), lines 3.68:1 (input). */
.dark {
	--background: oklch(0.225 0.012 215);
	--foreground: oklch(0.95 0.006 215);
	--card: oklch(0.225 0.012 215);
	--card-foreground: oklch(0.95 0.006 215);
	--popover: oklch(0.26 0.013 215);
	--popover-foreground: oklch(0.95 0.006 215);
	--primary: oklch(0.74 0.125 275);
	--primary-foreground: oklch(0.2 0.03 275);
	--secondary: oklch(0.285 0.013 215);
	--secondary-foreground: oklch(0.92 0.006 215);
	--muted: oklch(0.27 0.012 215);
	--muted-foreground: oklch(0.75 0.012 215);
	--accent: oklch(0.3 0.03 275);
	--accent-foreground: oklch(0.95 0.006 215);
	--destructive: oklch(0.72 0.17 25);
	--destructive-foreground: oklch(0.2 0.03 25);
	--border: oklch(0.36 0.013 215);
	--input: oklch(0.56 0.013 215);
	--ring: oklch(0.74 0.125 275);
	--sidebar: oklch(0.2 0.012 215);
	--sidebar-foreground: oklch(0.87 0.008 215);
	--sidebar-primary: oklch(0.74 0.125 275);
	--sidebar-primary-foreground: oklch(0.2 0.03 275);
	--sidebar-accent: oklch(0.28 0.014 215);
	--sidebar-accent-foreground: oklch(0.95 0.006 215);
	--sidebar-border: oklch(0.32 0.013 215);
	--sidebar-ring: var(--ring);
	--success: oklch(0.79 0.13 160);
	--warning: oklch(0.84 0.13 75);
	--info: oklch(0.78 0.1 235);
}
```

## Accents
| accent | name | mode | `--primary` | `--primary-foreground` | `--ring` | `--sidebar-primary` | `--sidebar-primary-foreground` |
|---|---|---|---|---|---|---|---|
| accent=1 | violet blue | light | `oklch(0.5 0.19 275)` | `oklch(0.985 0.004 250)` | `oklch(0.5 0.19 275)` | `oklch(0.5 0.19 275)` | `oklch(0.985 0.004 250)` |
| accent=1 | violet blue | dark | `oklch(0.74 0.125 275)` | `oklch(0.2 0.03 275)` | `oklch(0.74 0.125 275)` | `oklch(0.74 0.125 275)` | `oklch(0.2 0.03 275)` |
| accent=2 | instrument teal | light | `oklch(0.5 0.09 205)` | `oklch(0.985 0.004 250)` | `oklch(0.5 0.09 205)` | `oklch(0.5 0.09 205)` | `oklch(0.985 0.004 250)` |
| accent=2 | instrument teal | dark | `oklch(0.78 0.11 190)` | `oklch(0.2 0.03 190)` | `oklch(0.78 0.11 190)` | `oklch(0.78 0.11 190)` | `oklch(0.2 0.03 190)` |
| accent=3 | deep crimson | light | `oklch(0.5 0.19 5)` | `oklch(0.985 0.004 250)` | `oklch(0.5 0.19 5)` | `oklch(0.5 0.19 5)` | `oklch(0.985 0.004 250)` |
| accent=3 | deep crimson | dark | `oklch(0.74 0.15 5)` | `oklch(0.2 0.03 5)` | `oklch(0.74 0.15 5)` | `oklch(0.74 0.15 5)` | `oklch(0.2 0.03 5)` |

`--sidebar-ring` and the chart set read the row through `var()`. With accent=3, a destructive button always names its action.

## Knobs

```css
:root {
	--surface-border-width: 1px;
	--surface-shadow: 0 0 #0000;
	--surface-radius: var(--radius);
	--heading-weight: 500;
	--heading-tracking: -0.02em;
	--heading-case: none;
	--title-weight: 500;
	--title-case: none;
	--title-tracking: 0em;
	--label-weight: 500;
	--label-case: none;
	--label-tracking: 0.02em;
	--numeral-font: var(--font-mono);
	--icon-stroke: 1.25;
	--chart-stroke: 1.25;
	--chart-fill-opacity: 0;
	--chart-grid-dash: none;
	--table-stripe: transparent;
	--table-head-bg: transparent;
	--nav-active-bg: transparent;
	--nav-indicator-width: 2px;
}
```

## Anatomy

- Page header: the kit `PageHeader`, h1 `text-2xl`. No rule under it.
- Panel: the outline `Card` of the knobs plus two corner ticks. Add this to the `Card` base string in `card.tsx`:
  `relative before:pointer-events-none before:absolute before:-top-px before:-start-px before:size-2 before:rounded-ss-surface before:border-foreground/50 before:border-s before:border-t after:pointer-events-none after:absolute after:-end-px after:-bottom-px after:size-2 after:rounded-ee-surface after:border-foreground/50 after:border-e after:border-b`.
- Panel title: `CardTitle` with `text-sm`. The unit ("kWh per day") goes in `CardDescription`, in the sans.
- KPI: the label (`text-muted-foreground text-sm`), the readout `font-numeric text-5xl font-light tabular-nums tracking-tight`,
  the unit in `text-base text-muted-foreground`. Every kpi form of this style reads `item.target`, the whole of a KPI.
  - In every kpi form, only a whole of kind 1 or 2 (a count of all, a capacity) gets the arc dial (Signature 1)
    before its readout. Set `target` and the share line as kpis/meter.md says. meter draws no bar.
  - A previous-period whole (kind 3), a user target, or no whole: the plain light readout, with no dial.
  - number: a change line in `font-numeric text-sm`. strip: rules in `--border`, 1 px. icon: a `size-7 rounded-full border` circle.
  - delta: the change after a small filled `TriangleIcon`. spark: a 1.25 px line `h-10`.
- Charts: thin lines, `type="linear"`, `dot={false}`, no grid. Time axis: ruler marks (Signature 2).
  Y axis: `axisLine={false} tickSize={4} tickLine={{ stroke: "var(--border)" }}`. Main `h-64`, side `h-48`.
  - Days before the first record get a `ReferenceArea` with a hatch `<pattern>`. Its lines use `--border`,
    45 degrees, 6 units apart. Its id comes from `useId()`. A day with 0 events is a real 0, never hatched.
  - bars: `barSize={8}`, `radius={2}`, `--chart-2`, the latest bar `--chart-1`. compare: previous period `--chart-3`, dashed `2 3`.
  - stacked: `--chart-2`, `--chart-3`, `--chart-5`; the part to watch takes `--chart-1`.
  - chart=heat: cells `size-[12px] rounded-[1px]` with `gap-[4px]`, five steps from `--muted` to `--chart-1`.
  - Small multiples: one `h-16` line per part in `grid gap-4 @xl/main:grid-cols-3`, one Y domain.
- Tables: light rules in `--border`, no stripes. Numbers at the end in `font-numeric tabular-nums`.
- Navigation: apply `### shell=bordered` of `frame.md`, whatever the recipe says. It gives a flat sidebar with a 1 px end rule,
  no shadow, and no box. The knobs give the active item no fill and a 2 px tick in `--sidebar-primary`.
  The brand mark: `rounded-full border border-sidebar-foreground/40 bg-transparent font-numeric`.
- Badges: kit status variants. Buttons: main action filled, others `outline`. Inputs keep the 1 px `--input` line. Motion: the dial only.

## Signature

1. The arc dial: a 240 degree arc for a share of a whole of kind 1 or 2, never of the previous period. Bind it to seats sold of capacity, tickets closed of all.
```tsx
// Open at the bottom, 240 degrees. pathLength 100 turns the share into a dash length. Stroke 3 of 100: a thin line.
const ARC_PATH = "M 15.36 70 A 40 40 0 1 1 84.64 70";
/** The dial at the start of a readout. `share` is 0 to 1. Screen readers skip it: the share line gives the percent. */
export function ArcDial({ share }: { share: number }) {
	// A whole of 0 gives NaN, and a value above its whole gives more than 1. Both clamp to an empty or a full arc.
	const percent = Number.isFinite(share) ? Math.min(Math.max(share, 0), 1) * 100 : 0;
	return (
		<svg viewBox="0 0 100 80" aria-hidden="true" className="h-14 w-auto shrink-0 rtl:-scale-x-100">
			<path d={ARC_PATH} pathLength={100} fill="none" strokeWidth={3} className="stroke-border" />
			<path d={ARC_PATH} pathLength={100} fill="none" strokeWidth={3} strokeDasharray={`${percent} 100`}
				className="stroke-primary transition-[stroke-dasharray] duration-500 motion-reduce:transition-none" />
		</svg>
	);
}
```
2. The ruler axis: a short mark per day, a long mark every 7th day, and a date every 7th day (every 28th at 90 days). Bind it to the period control.
   On the time XAxis: `interval={0} tickSize={0} tickMargin={0} tick={(props) => <RulerTick {...props} formatDay={formatDay} />}`.
```tsx
/** One time-axis tick (props type from recharts). `formatDay` turns the day key into a short local date. With `interval={0}`, `visibleTicksCount` is the day count. */
function RulerTick({ x, y, index, payload, visibleTicksCount, formatDay }: XAxisTickContentProps & { formatDay: (day: string) => string }) {
	// A week is the major unit: every 7th day gets a long mark. 13 week dates crowd 90 days, so past 31 days only every 28th day gets a date.
	const isMajor = index % 7 === 0;
	const hasDate = index % (visibleTicksCount > 31 ? 28 : 7) === 0;
	return (
		<g transform={`translate(${x},${y})`}>
			{/* A major mark is 8 px, twice a minor 4 px mark, so the week marks stand out. */}
			<line y2={isMajor ? 8 : 4} className="stroke-muted-foreground" />
			{hasDate ? (
				// A baseline at 20 px leaves about 4 px under the 8 px mark. Digits at 10 px are about 7 px tall.
				<text dy={20} textAnchor="middle" className="fill-muted-foreground font-numeric text-[0.625rem]">
					{formatDay(String(payload.value))}
				</text>
			) : null}
		</g>
	);
}
```

## Empty state

- Panels keep outline and ticks. Readouts show a real `0`; dials show the empty track. Charts draw a flat line on 0.
  With no record at all, nothing is hatched: the zeros are real. Tables keep the head and one muted sentence.
- Setup strip under the page header: an outline panel `flex flex-wrap items-center gap-3 px-4 py-2` with 2 to 4 first actions.

## Do not

- Bold figures. Readouts are light, 300, in the mono face.
- Filled panels with soft shadows. Use the 1 px outline with two corner ticks.
- A dial for a previous period, a target, or no whole. Draw one only for a count of all or a capacity (kind 1 or 2).
- The mono face on labels, titles, or prose. Mono is for readouts and axis figures only.

## Check

- Are the figures large, light, and monospaced?
- Do the panels have a 1 px outline with ticks on two corners, and no shadow?
- Does each dial show a real share, with its percent in text? Is the sidebar flat, with a 1 px end rule and no shadow?
- Does the time axis show ruler marks, long every 7 days?
- Are days before the first record hatched, while days with 0 events sit at 0?
