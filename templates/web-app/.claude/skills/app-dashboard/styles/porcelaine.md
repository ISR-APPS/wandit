# Style porcelaine
A calm clinic counter: cool white porcelain, outlined trays with a tinted lip, and readings shown inside their usual range.
Mode: light only. Fits: health, clinics, dental, vets, labs, pharmacy, care homes, services. Avoid: nightlife, gaming.
Radius 0.875rem. Controls: pill. Shell: recipe. Density: recipe.

## Identity
- The ground is a cool white with a blue-green tint. Trays are pure white, with a 1 px outline and no shadow.
- Each tray has a tinted header strip. The title sits in it, in sentence case.
- Type is humanist and open. Figures are medium weight, never heavy. Labels are short and exact: a value, a unit, a time.
- Each figure has a range band under it: where the value sits between the low and the high of the period.
- The accent is a fill or a mark, never body text. Use strong color only on the range band and the "Next" panel.

## Fonts
Apply the link and the blocks of your `fonts=<n>` as SKILL.md, step 4 says. The Note line is the font note of the header comment.
### fonts=1
Link: `https://fonts.googleapis.com/css2?family=Lexend:wght@400;500;600&family=Readex+Pro:wght@400;500;600&display=swap`
Roles: one family. Display Lexend 500 (headings, titles). Body Lexend 400. Numerals Lexend 500.
Arabic: display and body Readex Pro 400, 500, 600.
Note: `Fonts of the style porcelaine: Lexend, Arabic twin Readex Pro (Google Fonts), loaded in __root.tsx.`
```css
/* Not inside @theme inline: the html:lang(ar) block below must swap these stacks. */
@theme {
	--font-sans: "Lexend", ui-sans-serif, system-ui, sans-serif;
	--font-display: "Lexend", ui-sans-serif, system-ui, sans-serif;
}
html:lang(ar) {
	--font-sans: "Readex Pro", ui-sans-serif, system-ui, sans-serif;
	--font-display: "Readex Pro", ui-sans-serif, system-ui, sans-serif;
}
```
### fonts=2
Link: `https://fonts.googleapis.com/css2?family=Atkinson+Hyperlegible+Next:wght@400;500;600&family=Noto+Sans+Arabic:wght@400;500;600&display=swap`
Roles: one family, made for low vision. Display Atkinson Hyperlegible Next 500. Body 400. Numerals 500: 0 and O, 1 and l differ.
Arabic: display and body Noto Sans Arabic 400, 500, 600.
Note: `Fonts of the style porcelaine: Atkinson Hyperlegible Next, Arabic twin Noto Sans Arabic (Google Fonts), loaded in __root.tsx.`
```css
/* Not inside @theme inline: the html:lang(ar) block below must swap these stacks. */
@theme {
	--font-sans: "Atkinson Hyperlegible Next", ui-sans-serif, system-ui, sans-serif;
	--font-display: "Atkinson Hyperlegible Next", ui-sans-serif, system-ui, sans-serif;
}
html:lang(ar) {
	--font-sans: "Noto Sans Arabic", ui-sans-serif, system-ui, sans-serif;
	--font-display: "Noto Sans Arabic", ui-sans-serif, system-ui, sans-serif;
}
```

## Palette
Light only: the block replaces `:root`, and `.dark` stays. Apply `### mode=light` of `frame.md`.
### Light
```css
/* porcelaine, accent=1. Lowest text ratio 4.59:1 (success badge on a hovered row). Lowest graphic ratio 3.45:1 (input on background). */
:root {
	--background: oklch(0.985 0.006 200);
	--foreground: oklch(0.26 0.03 215);
	--card: oklch(0.998 0.002 200);
	--card-foreground: oklch(0.26 0.03 215);
	--popover: oklch(0.998 0.002 200);
	--popover-foreground: oklch(0.26 0.03 215);
	--primary: oklch(0.48 0.08 178);
	--primary-foreground: oklch(0.99 0.005 190);
	--secondary: oklch(0.955 0.018 195);
	--secondary-foreground: oklch(0.3 0.04 205);
	--muted: oklch(0.962 0.012 200);
	--muted-foreground: oklch(0.48 0.025 215);
	--accent: oklch(0.94 0.022 195);
	--accent-foreground: oklch(0.26 0.04 205);
	--destructive: oklch(0.52 0.19 25);
	--destructive-foreground: oklch(0.985 0.005 25);
	--border: oklch(0.885 0.018 205);
	--input: oklch(0.62 0.03 210);
	--ring: oklch(0.48 0.08 178);
	--radius: 0.875rem;
	--control-radius: 9999px;
	--sidebar: oklch(0.955 0.02 195);
	--sidebar-foreground: oklch(0.3 0.035 210);
	--sidebar-primary: oklch(0.48 0.08 178);
	--sidebar-primary-foreground: oklch(0.99 0.005 190);
	--sidebar-accent: oklch(0.925 0.03 195);
	--sidebar-accent-foreground: oklch(0.24 0.035 205);
	--sidebar-border: oklch(0.9 0.022 200);
	--sidebar-ring: var(--ring);
	/* chart-1 follows the ring: the accent at 3:1 or more on white. The others avoid all three accent hues. */
	--chart-1: var(--ring);
	--chart-2: oklch(0.58 0.11 330);
	--chart-3: oklch(0.6 0.1 95);
	--chart-4: oklch(0.55 0.04 60);
	--chart-5: oklch(0.62 0.015 210);
	--success: oklch(0.5 0.1 155);
	--warning: oklch(0.515 0.11 65);
	--info: oklch(0.5 0.1 245);
}
```

## Accents
The palette block holds accent=1. For accent=2 or 3, replace these five tokens in `:root`; `--chart-1` and `--sidebar-ring` follow.
`--sidebar-ring: var(--ring)` and `--chart-1: var(--ring)` stay in the block. Lowest accent ratio: 4.48:1 (accent=3 ring on the background).
Coral is a light fill (2.8:1 on the card) with ink text. Its ring and `--chart-1` use a deeper coral. Links and its meter use the ink.

| accent | name | `--primary` | `--primary-foreground` | `--ring` | `--sidebar-primary` | `--sidebar-primary-foreground` |
|---|---|---|---|---|---|---|
| accent=1 | pine teal | `oklch(0.48 0.08 178)` | `oklch(0.99 0.005 190)` | `oklch(0.48 0.08 178)` | `oklch(0.48 0.08 178)` | `oklch(0.99 0.005 190)` |
| accent=2 | cornflower blue | `oklch(0.52 0.13 262)` | `oklch(0.985 0.004 262)` | `oklch(0.52 0.13 262)` | `oklch(0.52 0.13 262)` | `oklch(0.985 0.004 262)` |
| accent=3 | soft coral | `oklch(0.7 0.14 22)` | `oklch(0.22 0.04 20)` | `oklch(0.58 0.17 22)` | `oklch(0.7 0.14 22)` | `oklch(0.22 0.04 20)` |

## Knobs
Put this block after the `:root` palette block; replace an earlier `/* Style knobs of ... */` block.
```css
/* Style knobs of porcelaine: outlined trays with no shadow, medium titles, tinted table heads, a filled active pill. */
:root {
	--surface-border-width: 1px;
	--surface-shadow: 0 0 #0000;
	--surface-radius: var(--radius);
	--heading-weight: 500;
	--heading-tracking: -0.015em;
	--heading-case: none;
	--title-weight: 500;
	--title-case: none;
	--title-tracking: 0em;
	--label-weight: 500;
	--label-case: none;
	--label-tracking: 0em;
	--numeral-font: var(--font-display);
	--icon-stroke: 1.75;
	--chart-stroke: 2;
	--chart-fill-opacity: 0.14;
	--chart-grid-dash: none;
	--table-stripe: transparent;
	--table-head-bg: var(--secondary);
	--nav-active-bg: color-mix(in oklch, var(--sidebar-primary) 18%, var(--sidebar));
	--nav-indicator-width: 0px;
}
```

## Anatomy
- **Frame.** Shell and density follow the recipe. The sidebar is tinted by the palette on every shell.
- **Page header.** `PageHeader` as it is. The knobs give the medium weight. Actions are pill buttons.
- **Panels.** A panel is a tray: `<Card className="gap-0 overflow-hidden py-0">`. The knobs give the outline and the radius.
  - Header strip: `<CardHeader className="border-b bg-secondary px-5 py-3">`, title `<CardTitle className="text-sm">`.
    An icon before the title is `size-4 text-secondary-foreground`. A `CardAction` holds one small control.
  - Body: `<CardContent className="p-5">`. Page grid: `grid grid-cols-1 gap-5` plus the spans of the home file.
- **KPI.** One tray holds the figures as cells: `grid @4xl/main:grid-cols-4 @xl/main:grid-cols-2 grid-cols-1 gap-px bg-border`.
  Each cell is `grid gap-1 bg-card p-5`. Use 2 or 4 figures; with 3, use `@xl/main:grid-cols-3` so no cell stays empty.
  - number: label `text-muted-foreground text-sm`, figure `font-medium font-numeric text-3xl tabular-nums`, the range band under it in `mt-3`.
  - icon: a chip before the label, `grid size-8 place-items-center rounded-full bg-secondary text-secondary-foreground [&_svg]:size-4`.
  - delta: a soft pill, `inline-flex items-center gap-1 rounded-full bg-success/12 px-2 py-0.5 text-success text-xs`, arrow `size-3 rtl:-scale-x-100`.
  - spark: a line `ChartContainer className="aspect-auto h-10"` with the usual range as a `ReferenceArea` band behind it.
  - meter: done of all, `Progress className="h-1.5 bg-secondary"`, with "18 of 24" under it. With accent=3, add
    `[&_[data-slot=progress-indicator]]:bg-foreground`: coral is 2.5:1 on the track, the ink is 13.6:1.
  - strip: the grid of `kpis/strip.md` replaces the `gap-px` grid. Rules 1 px in `border-border`. Figure `text-2xl`.
- **Charts.** Rounded bars: `radius={[6, 6, 2, 2]}`, `maxBarSize={28}`. Lines `type="monotone"`, no dots.
  - The usual range is a shaded band: `<ReferenceArea y1={usualLow} y2={usualHigh} fill="var(--chart-1)" fillOpacity={0.08} stroke="none" />`.
    It spans the 25th to the 75th percentile of the daily values of the earlier period. Fewer than 7 earlier days: no band.
  - `<CartesianGrid vertical={false} />`, solid. Axes `tickLine={false} axisLine={false} tickMargin={8}`; a Y axis on the main chart only.
  - Heights: main `aspect-auto h-64`, side `aspect-auto h-48`, mini `h-10`.
  - heat: cells `size-[16px] rounded-[4px]`, gap `gap-[4px]`. 90 days take 276 px; the tray body leaves 293 px or more at 375 px.
- **Tables.** Roomy rows with soft dividers. The knob tints the head row like a header strip.
  `TableHead className="h-10 text-secondary-foreground"`, `TableRow className="border-border/70"`, `TableCell className="py-3"`.
  Numbers `text-end font-medium tabular-nums`. A status is a soft `Badge`: `success`, `warning`, or `info`.
  The kit `destructive` badge is a solid fill. A problem takes the soft look too, 4.97:1 on the card:
  `<Badge variant="destructive" className="border-destructive/25 bg-destructive/12 text-destructive hover:bg-destructive/12">`.
- **Navigation.** A tinted sidebar. Each `SidebarMenuButton` gets `className="rounded-full px-3"`; the knob fills the active pill.
  Brand mark: `flex aspect-square size-8 items-center justify-center rounded-full bg-sidebar-primary font-medium text-sidebar-primary-foreground`.
- **Buttons, inputs, links.** Pill buttons. Inputs `h-10 rounded-xl`. Never set text in `text-primary`.
  A link reads `text-foreground underline decoration-2 decoration-ring underline-offset-4`.
  In `button.tsx`, the `link` variant `text-primary underline-offset-4 hover:underline` becomes this string.
- **Motion.** Hover colors `transition-colors duration-150`. No entrance motion. The range marker does not animate.

## Signature
**1. The range band.** A thin track under a figure. A shaded band marks the low to the high of the period, and a dot marks the value now.
A caption under the track gives the low and the high as text. Bind it to readings of this business: visits today, or the stock of a drug.
```tsx
// Range band of the porcelaine style: where a value sits between the low and the high of the period.
// KPI cells use it. The caption gives the low and the high as text, so the pale band is only a visual aid.
type RangeBandProps = {
	/** The value now, for example 18 visits today. Counts start at 0. */
	value: number;
	/** Lowest daily value of the period, from the same series. */
	low: number;
	/** Highest daily value of the period, from the same series. */
	high: number;
	/** Translated line with the low and the high, formatted with Intl, for example "Usual range 12 to 30". */
	caption: string;
};

/** The track runs from 0 to the largest of high and value. No data puts the dot at the start. */
export function RangeBand({ value, low, high, caption }: RangeBandProps) {
	const scaleMax = Math.max(high, value, 0);
	// Place on the track in percent, 0 to 100. A negative count clamps to 0.
	const at = (point: number) => (scaleMax > 0 ? (Math.min(Math.max(point, 0), scaleMax) / scaleMax) * 100 : 0);
	return (
		<div className="grid gap-1.5">
			<div aria-hidden="true" className="relative h-2 rounded-full bg-muted">
				{/* One value or none in the period: there is no range to draw. */}
				{high > low ? <div className="absolute inset-y-0 rounded-full bg-chart-1/25" style={{ insetInlineStart: `${at(low)}%`, width: `${at(high) - at(low)}%` }} /> : null}
				<div className="absolute top-1/2 size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-card bg-chart-1 rtl:translate-x-1/2" style={{ insetInlineStart: `${at(value)}%` }} />
			</div>
			<p className="text-muted-foreground text-sm tabular-nums">{caption}</p>
		</div>
	);
}
```

**2. The "Next" panel.** One tray with the next item in time, its start time large. Bind it to the next appointment,
the next sample pickup, or the next shift. Nothing planned: it shows the action that books one.
```tsx
// "Next" panel of porcelaine. The home passes the first row of a query ordered by start time, from now on.
import type { ReactNode } from "react";
import { useT } from "~/shared/i18n";
import { Card, CardContent, CardHeader, CardTitle } from "~/shared/ui/card";

type NextPanelProps = {
	/** Translated panel title, for example "Next appointment". */
	title: string;
	/** Start of the next item, an ISO timestamp from the database. Null when nothing is planned. */
	startsAt: string | null;
	/** What the item is, for example the patient name and the reason, with a link to its page. */
	summary: ReactNode;
	/** Shown when nothing is planned: one sentence and the action that books the next item. */
	empty: ReactNode;
};
/** Shows the start time large: with the weekday in the next 6 days, with the date after that. */
export function NextPanel({ title, startsAt, summary, empty }: NextPanelProps) {
	const { locale } = useT();
	// At 7 days, the weekday of today comes back, so a weekday is clear only up to 6 days (here in ms).
	const later = startsAt !== null && Date.parse(startsAt) - Date.now() >= 6 * 24 * 60 * 60 * 1000;
	const time = new Intl.DateTimeFormat(locale, later ? { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" } : { weekday: "short", hour: "2-digit", minute: "2-digit" });
	return (
		<Card className="gap-0 overflow-hidden py-0">
			<CardHeader className="border-b bg-secondary px-5 py-3"><CardTitle className="text-sm">{title}</CardTitle></CardHeader>
			<CardContent className="grid gap-2 p-5">
				{startsAt === null ? empty : <><time dateTime={startsAt} className="font-medium font-numeric text-4xl tabular-nums">{time.format(new Date(startsAt))}</time><div className="text-sm">{summary}</div></>}
			</CardContent>
		</Card>
	);
}
```

## Empty state
- Every tray stays in place with its header strip. The KPI cells show `0`, the bare track with the dot at the start, and the caption "No earlier data".
- The bar chart keeps its height and its X axis. Over the plot: one muted sentence and the action that records the first event.
- The "Next" panel shows "Nothing planned" and the action that books the first item.
- A table tray keeps its tinted head row, then `grid min-h-40 place-items-center gap-3 text-center text-muted-foreground text-sm` with one sentence and the action.
- The setup strip sits under the page header: `flex flex-wrap items-center gap-3 rounded-lg border bg-card px-4 py-3`.
  It holds 2 to 4 steps in order. Each step is a numbered chip `grid size-5 place-items-center rounded-full bg-secondary text-secondary-foreground text-xs`
  and a pill button with the real first action ("Add a practitioner").

## Do not
- A shadow under a tray. Instead: the 1 px outline and the tinted header strip.
- Text in the accent color. Instead: foreground text; the accent marks bands, dots, bars, and the active pill.
- A heavy 700 or 800 figure. Instead: medium 500 figures with a range band.
- Red or coral for anything that is not a problem or the accent. Instead: the status tones of the palette.
- Dense rows or tiny type for patients and staff. Instead: roomy `py-3` rows and `text-sm` as the smallest body size.

## Check
- Does every panel have a 1 px outline, no shadow, and a tinted header strip?
- Does each KPI figure have a range band under it?
- Is there a "Next" panel with the next item in time, its time large?
- Is the active nav item a filled pill in a tinted sidebar?
- Are the bars rounded, with a shaded usual range behind them?
