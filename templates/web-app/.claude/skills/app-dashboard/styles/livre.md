# Style livre
An accounting ledger on cool ruled paper: ink figures in columns, rules in place of boxes.
Mode: light only. Fits: finance, invoicing, legal, wholesale, property, admin back offices. Avoid: kids, nightlife, games, fitness.
Radius 0.125rem. Controls: matched. Shell: bordered (fixed). Density: recipe.

## Identity

- The page looks like one sheet of ledger paper. A panel is a section under an ink rule, with no box. `--card` equals `--background`.
- Text and rules use a blue-black ink. The accent colors only the main action, the links, and the last chart point.
- Figures are the largest text. They use a serif with tabular digits, aligned at the end of each column.
- Hairline rules are a trait of the generic broadsheet look. The brief names them: a ledger is ruled paper,
  and each rule separates two entries. The radius is small, not zero. The columns hold figures, not news text.
- A serif on light paper is not the cream and terracotta look. The paper is a cool green grey.
  The accents are bottle green, ink blue, and oxblood red.

## Fonts

Apply the link and the blocks of your `fonts=<n>` as SKILL.md, step 4 says.
Every figure gets `font-numeric tabular-nums`. Both serifs have tabular digits, and their default digits are lining.

### fonts=1

Display and numerals: Source Serif 4. Body: Public Sans. Arabic twins: Noto Naskh Arabic (display), IBM Plex Sans Arabic (body).
Font note: `Fonts of the style livre (fonts=1): Source Serif 4 + Public Sans, Arabic twins Noto Naskh Arabic + IBM Plex Sans Arabic (Google Fonts), loaded in __root.tsx.`

Link: `https://fonts.googleapis.com/css2?family=Source+Serif+4:opsz,wght@8..60,400;8..60,500;8..60,600&family=Public+Sans:wght@400;500;600&family=Noto+Naskh+Arabic:wght@400;500;600&family=IBM+Plex+Sans+Arabic:wght@400;500;600&display=swap`

```css
/* Not inside @theme inline: utilities must emit var(--font-*) so the
   :lang(ar) scope below can swap the Latin stacks for the Arabic twins. */
@theme {
	--font-sans: "Public Sans", ui-sans-serif, system-ui, sans-serif;
	--font-display: "Source Serif 4", ui-serif, Georgia, serif;
}

html:lang(ar) {
	--font-sans: "IBM Plex Sans Arabic", ui-sans-serif, system-ui, sans-serif;
	--font-display: "Noto Naskh Arabic", "IBM Plex Sans Arabic", ui-serif, serif;
}
```

### fonts=2

Display and numerals: Newsreader. Body: Chivo. Arabic twins: Amiri (display), Noto Sans Arabic (body).
Font note: `Fonts of the style livre (fonts=2): Newsreader + Chivo, Arabic twins Amiri + Noto Sans Arabic (Google Fonts), loaded in __root.tsx.`

Link: `https://fonts.googleapis.com/css2?family=Newsreader:opsz,wght@6..72,400;6..72,500;6..72,600&family=Chivo:wght@400;500;600&family=Amiri:wght@400;700&family=Noto+Sans+Arabic:wght@400;500;600&display=swap`

```css
/* Not inside @theme inline: utilities must emit var(--font-*) so the
   :lang(ar) scope below can swap the Latin stacks for the Arabic twins. */
@theme {
	--font-sans: "Chivo", ui-sans-serif, system-ui, sans-serif;
	--font-display: "Newsreader", ui-serif, Georgia, serif;
}

html:lang(ar) {
	--font-sans: "Noto Sans Arabic", ui-sans-serif, system-ui, sans-serif;
	--font-display: "Amiri", "Noto Sans Arabic", ui-serif, serif;
}
```

## Palette

### Light

The paper has hue 175 (cool green grey). `--card` equals `--background`, so a panel shows no box.
`--chart-1` is the ink of the lines. `--chart-2` reads the accent: it marks the last point only.
Section rules use `border-foreground/55`: 3.68:1 on the paper. The pale `--border` (1.42:1) draws only lines with no meaning:
table rows, the X axis, and the meter track.

```css
/* Lowest contrast, computed for accents 1-3: text 4.66:1 (warning on its badge tint), lines 3.37:1 (input). */
:root {
	--background: oklch(0.975 0.007 175);
	--foreground: oklch(0.24 0.03 255);
	--card: oklch(0.975 0.007 175);
	--card-foreground: oklch(0.24 0.03 255);
	--popover: oklch(0.99 0.004 175);
	--popover-foreground: oklch(0.24 0.03 255);
	--primary: oklch(0.43 0.085 165);
	--primary-foreground: oklch(0.98 0.006 175);
	--secondary: oklch(0.935 0.012 175);
	--secondary-foreground: oklch(0.28 0.03 255);
	--muted: oklch(0.948 0.011 175);
	--muted-foreground: oklch(0.47 0.022 240);
	--accent: oklch(0.93 0.016 170);
	--accent-foreground: oklch(0.24 0.03 255);
	--destructive: oklch(0.5 0.18 27);
	--destructive-foreground: oklch(0.98 0.006 175);
	--border: oklch(0.86 0.018 180);
	--input: oklch(0.62 0.025 230);
	--ring: oklch(0.43 0.085 165);
	--radius: 0.125rem;
	--control-radius: var(--radius);
	--sidebar: oklch(0.975 0.007 175);
	--sidebar-foreground: oklch(0.3 0.03 255);
	--sidebar-primary: oklch(0.43 0.085 165);
	--sidebar-primary-foreground: oklch(0.98 0.006 175);
	--sidebar-accent: oklch(0.94 0.012 175);
	--sidebar-accent-foreground: oklch(0.24 0.03 255);
	--sidebar-border: oklch(0.86 0.018 180);
	--sidebar-ring: var(--ring);
	--success: oklch(0.47 0.11 150);
	--warning: oklch(0.51 0.11 70);
	--info: oklch(0.47 0.11 245);
	--chart-1: oklch(0.3 0.03 255);
	--chart-2: var(--primary);
	--chart-3: oklch(0.55 0.025 250);
	--chart-4: oklch(0.52 0.06 195);
	--chart-5: oklch(0.58 0.05 60);
}
```

## Accents

Each row replaces five tokens of the Light block. `--sidebar-ring` and `--chart-2` read them through `var()`.

| accent | name | mode | `--primary` | `--primary-foreground` | `--ring` | `--sidebar-primary` | `--sidebar-primary-foreground` |
|---|---|---|---|---|---|---|---|
| accent=1 | bottle green | light | `oklch(0.43 0.085 165)` | `oklch(0.98 0.006 175)` | `oklch(0.43 0.085 165)` | `oklch(0.43 0.085 165)` | `oklch(0.98 0.006 175)` |
| accent=2 | ink blue | light | `oklch(0.42 0.12 260)` | `oklch(0.98 0.006 175)` | `oklch(0.42 0.12 260)` | `oklch(0.42 0.12 260)` | `oklch(0.98 0.006 175)` |
| accent=3 | oxblood red | light | `oklch(0.4 0.12 20)` | `oklch(0.98 0.006 175)` | `oklch(0.4 0.12 20)` | `oklch(0.4 0.12 20)` | `oklch(0.98 0.006 175)` |

With accent=3, a negative amount and the accent are both red inks. Keep negatives in `--destructive`: it is brighter.

## Knobs

```css
:root {
	/* No boxes: a panel is a ruled section. */
	--surface-border-width: 0px;
	--surface-shadow: 0 0 #0000;
	--surface-radius: 0rem;
	--heading-weight: 600;
	--heading-tracking: -0.01em;
	--heading-case: none;
	--title-weight: 600;
	--title-case: none;
	--title-tracking: 0em;
	--label-weight: 500;
	--label-case: none;
	--label-tracking: 0.01em;
	--numeral-font: var(--font-display);
	--icon-stroke: 1.5;
	/* Ledger lines are pen strokes, thinner than the default 2 px. */
	--chart-stroke: 1.25;
	--chart-fill-opacity: 0;
	--chart-grid-dash: 1 3;
	--table-stripe: transparent;
	--table-head-bg: transparent;
	/* The active nav item gets an ink rule at its start, not a fill. */
	--nav-active-bg: transparent;
	--nav-indicator-width: 2px;
}
```

## Anatomy

- Page header: in `page-header.tsx`, the outer div gets `border-b-[3px] border-double border-foreground pb-3`. The h1 gets `text-3xl`.
- Panel: a `Card` with `className="gap-3 border-foreground/55 border-t py-4 [&>[data-slot^=card-]]:px-0"`.
  The top rule is an ink hairline (see Palette). The text starts on the same line as the rule. Panels sit on a
  `grid gap-x-10 gap-y-6` grid, so white space, not boxes, separates two columns.
- Panel title: `CardTitle` with `font-display text-lg`.
- KPI: one ruled row of figures, never separate tiles. The row is a `<dl>` with
  `grid grid-cols-2 gap-y-4 border-y border-foreground py-4 @3xl/main:grid-cols-4`.
  Each cell: `grid content-start gap-1 @3xl/main:not-first:border-s @3xl/main:not-first:ps-5`.
  The label comes first: `<dt className="text-muted-foreground text-sm">`. The value follows:
  `<dd className="font-numeric text-4xl tabular-nums">`. The kpi forms map to it:
  - number: the cell as above, and one change line in `text-sm`. strip: the grid of `kpis/strip.md`, not the `<dl>` cell rules, with 1 px ink rules (`border-foreground`).
  - icon: the icon sits before the label, `size-3.5 text-muted-foreground`. No icon chip.
  - delta: the signed change follows the value on the same baseline, `text-sm`, in `text-success` or `text-destructive`.
  - spark: an ink line `h-8` under the value, no fill, the last point in `--chart-2`.
  - meter: the part as "18 / 24" and a pen bar: `<Progress className="h-0.5 rounded-none bg-border" />`.
- Charts: `type="linear"`, so each segment is a straight pen line. `dot={false}`. The stroke and the fill come from the knobs.
  - No grid. One dotted zero line: `<ReferenceLine y={0} stroke="var(--foreground)" strokeDasharray="1 3" />`.
  - The last point only: `<ReferenceDot x={last.day} y={last.value} r={3} fill="var(--chart-2)" stroke="none" />`.
    Its `label` shows the series name and the value at the end side (`position` "right", "left" in Arabic).
  - X axis: `axisLine={{ stroke: "var(--border)" }} tickLine={false}`. Y axis: `axisLine={false} tickLine={false}`.
  - bars: `barSize={6}`, radius 0, `--chart-1` ink, the last bar in `--chart-2` (one `Cell`).
  - compare: this period in `--chart-1`, the previous period in `--chart-3` with `strokeDasharray="4 3"`.
  - stacked: `--chart-1`, `--chart-3`, `--chart-4`, `--chart-5`, with a 1 px paper gap (`stroke="var(--card)"`).
  - chart=heat: square cells `size-[14px] rounded-none` with `gap-[2px]`. The top step is the ink of `--chart-1`.
  - Heights: main `h-60`, side `h-44`, KPI line `h-8`.
- Tables: rows ruled in `--border`, no stripes, no row box. Every amount cell gets
  `text-end font-numeric tabular-nums`. A totals row uses `TableFooter` with
  `bg-transparent [&_td]:border-foreground [&_td]:border-b-[3px] [&_td]:border-double`.
- Navigation: shell=bordered on paper. The knobs draw the active item: no fill, a 2 px start rule.
  In `app-sidebar.tsx`, give the active row `data-[active=true]:before:bg-sidebar-foreground`, so the rule is ink.
  The brand mark: `rounded-sm border border-sidebar-foreground bg-transparent font-display text-sidebar-foreground`.
- Badges and status: a status is a word in its ink, after a small square, with no pill:
  `<Badge variant="success" className="border-0 bg-transparent px-0 before:size-1.5 before:bg-current">`.
- Buttons and inputs: the main action is a filled `default` button. Other actions are `outline` with
  `border-foreground`. Inputs keep the `--input` line, which has 3:1 on the paper.
- Motion: only color transitions of 150 ms. Nothing moves on page load.

## Signature

1. The totals line: a single ink rule above the sum, a double rule under it.
   Bind it to the sum that the business closes each period: the balance due, the month revenue, the stock value.

```tsx
type TotalsLineProps = {
	/** Translated label, for example "Balance due". */
	label: string;
	/** The sum, formatted with Intl and the app locale. A negative sum keeps its minus sign. */
	value: string;
	/** True when the sum is below 0. The value then shows in red ink. */
	isNegative: boolean;
};

/** The last line of a ledger panel. It closes the panel, so put nothing under it. */
export function TotalsLine({ label, value, isNegative }: TotalsLineProps) {
	return (
		<div className="flex items-baseline justify-between gap-4 border-foreground border-t pt-2">
			<span className="text-muted-foreground text-sm">{label}</span>
			<span
				dir="ltr"
				className={cn(
					"border-foreground border-b-[3px] border-double pb-0.5 font-numeric text-2xl tabular-nums",
					// A ledger shows a sum below 0 in red ink, with its minus sign.
					isNegative && "text-destructive",
				)}
			>
				{value}
			</span>
		</div>
	);
}
```

2. Red ink: a negative amount shows in `text-destructive` with the minus sign of `Intl.NumberFormat`.
   Never use parentheses (`currencySign: "accounting"`). A positive amount stays in plain ink, never green.

## Empty state

- The ruled KPI row stays. Each cell shows a real `0` in ink, not a dash.
- Each chart keeps its axes and the dotted zero line. The ink line lies on the zero line.
- Each table keeps its head and shows three empty ruled lines, `h-9 border-b border-foreground/25` (1.68:1, darker than `--border`).
  The first line holds one muted sentence. The totals line shows `0`.
- The setup strip sits under the page header: one ruled line,
  `flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-dashed py-2 text-sm`.
  It holds 2 to 4 `link` buttons for the first real actions, for example "Record the first invoice".

## Do not

- A box around a panel, or a pale grey top rule. Use the ink top rule (`border-foreground/55`) and white space.
- Pills and filled badges. Write the status word in its ink after a small square.
- Area fills, gradients, or one color per series. Draw ink lines, with the accent on the last point only.
- Parentheses or a red color for any number that is only low. Use red ink for a negative amount or a bad change.
- Cream paper or a terracotta accent. Keep the cool paper and the three accents of this file.

## Check

- Does the page title sit over a double rule?
- Does an ink rule open each panel, with no side borders, no shadow, and no fill?
- Are all figures in the serif, with their columns aligned at the end side?
- Does each line chart show one accent point only, at its last value?
- Does a negative amount show in red ink with a minus sign?
- Is the active nav item marked by an ink rule at its start, with no fill?
