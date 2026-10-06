# Style comptoir
A shop counter at opening time: a dark counter top, white order slips torn from a pad, a till roll.
Mode: light only. Fits: shops, orders, COD, inventory, restaurants, repairs, rentals. Avoid: clinic, therapy, legal.
Radius 0.5rem. Controls: matched. Shell: recipe. Density: recipe.

## Identity
- Grey canvas ground (L 0.93, cool, never cream). Panels are white slips: no border, no shadow,
  a torn top edge, and a dashed perforation under the header.
- The home opens with the counter slab: one dark band with the page title, today's totals, and the main action.
- Amounts print in a receipt mono. The trade reads totals from slips and tills, so mono is a fact here.
  Mono is only for amounts, quantities, and order numbers.
- Status is a dot plus a word: green done, amber waiting, red problem. Nothing else takes a status color.
- The charts are ink. The accent marks money in, the main action, and today. A problem is never the accent.

## Fonts
### fonts=1
- Roles: display and body Rubik (400 to 700), numerals Courier Prime (400, 700). Rubik has its own Arabic letters.
- Link: `https://fonts.googleapis.com/css2?family=Rubik:wght@400;500;600;700&family=Courier+Prime:wght@400;700&display=swap`
- Font note: `Fonts of the style comptoir (fonts=1): Rubik + Courier Prime, Arabic twin Rubik (Google Fonts), loaded in __root.tsx.`
```css
/* Not inside @theme inline: the html:lang(ar) block below must swap these stacks. */
@theme {
	--font-sans: "Rubik", ui-sans-serif, system-ui, sans-serif;
	--font-display: "Rubik", ui-sans-serif, system-ui, sans-serif;
	--font-mono: "Courier Prime", ui-monospace, monospace;
}
html:lang(ar) {
	--font-sans: "Rubik", ui-sans-serif, system-ui, sans-serif;
	--font-display: "Rubik", ui-sans-serif, system-ui, sans-serif;
	--font-mono: "Courier Prime", "Rubik", ui-monospace, monospace;
}
```
### fonts=2
- Roles: display and body Spline Sans (400 to 700), numerals Martian Mono (400, 500, 700). Arabic twin: Alexandria (400 to 700).
- Link: `https://fonts.googleapis.com/css2?family=Spline+Sans:wght@400;500;600;700&family=Martian+Mono:wght@400;500;700&family=Alexandria:wght@400;500;600;700&display=swap`
- Font note: `Fonts of the style comptoir (fonts=2): Spline Sans + Martian Mono, Arabic twin Alexandria (Google Fonts), loaded in __root.tsx.`
```css
/* Not inside @theme inline: the html:lang(ar) block below must swap these stacks. */
@theme {
	--font-sans: "Spline Sans", ui-sans-serif, system-ui, sans-serif;
	--font-display: "Spline Sans", ui-sans-serif, system-ui, sans-serif;
	--font-mono: "Martian Mono", ui-monospace, monospace;
}
html:lang(ar) {
	--font-sans: "Alexandria", ui-sans-serif, system-ui, sans-serif;
	--font-display: "Alexandria", ui-sans-serif, system-ui, sans-serif;
	--font-mono: "Martian Mono", "Alexandria", ui-monospace, monospace;
}
```

## Palette
### Light
The block replaces `:root`. Leave `.dark` as it is: this style never sets the `dark` class.
```css
/* Style comptoir, accent=1 (cash green). Lowest: text 4.62:1 (warning on background), marks 3.21:1 (input on background). */
:root {
	--background: oklch(0.93 0.004 250);
	--foreground: oklch(0.22 0.012 255);
	--card: oklch(0.993 0.003 95);
	--card-foreground: oklch(0.22 0.012 255);
	--popover: oklch(0.993 0.003 95);
	--popover-foreground: oklch(0.22 0.012 255);
	--primary: oklch(0.53 0.13 155);
	--primary-foreground: oklch(0.99 0.003 155);
	--secondary: oklch(0.955 0.004 250);
	--secondary-foreground: oklch(0.26 0.012 255);
	--muted: oklch(0.955 0.004 250);
	--muted-foreground: oklch(0.47 0.012 255);
	--accent: oklch(0.945 0.005 250);
	--accent-foreground: oklch(0.22 0.012 255);
	--destructive: oklch(0.53 0.19 25);
	--destructive-foreground: oklch(0.99 0.003 25);
	--border: oklch(0.84 0.006 250);
	--input: oklch(0.6 0.01 255);
	--ring: oklch(0.53 0.13 155);
	--radius: 0.5rem;
	--control-radius: calc(var(--radius) * 0.8);
	--sidebar: oklch(0.915 0.005 250);
	--sidebar-foreground: oklch(0.26 0.012 255);
	--sidebar-primary: oklch(0.53 0.13 155);
	--sidebar-primary-foreground: oklch(0.99 0.003 155);
	--sidebar-accent: oklch(0.885 0.006 250);
	--sidebar-accent-foreground: oklch(0.2 0.012 255);
	--sidebar-border: oklch(0.85 0.006 250);
	--sidebar-ring: var(--ring);
	--chart-1: oklch(0.32 0.012 255);
	--chart-2: var(--primary);
	--chart-3: oklch(0.62 0.12 70);
	--chart-4: oklch(0.52 0.012 255);
	--chart-5: oklch(0.62 0.01 255);
	--success: oklch(0.5 0.12 148);
	--warning: oklch(0.52 0.11 65);
	--info: oklch(0.5 0.11 245);
}
```

## Accents
Set the row in `:root`. `--sidebar-ring` and `--chart-2` read the row through `var()`.
`--chart-1` stays ink for every row: a till roll prints in ink, and the accent marks only money in and today.
Every row keeps the block ratios, and the main action keeps 3:1 or more on the dark counter slab.
Each accent sits 55 degrees or more from `--destructive`, so money in never looks like a problem.

| Accent | Name | Mode | `--primary` | `--primary-foreground` | `--ring` | `--sidebar-primary` | `--sidebar-primary-foreground` |
|---|---|---|---|---|---|---|---|
| accent=1 | cash green | light | `oklch(0.53 0.13 155)` | `oklch(0.99 0.003 155)` | `oklch(0.53 0.13 155)` | `oklch(0.53 0.13 155)` | `oklch(0.99 0.003 155)` |
| accent=2 | cobalt blue | light | `oklch(0.54 0.15 258)` | `oklch(0.99 0.003 258)` | `oklch(0.54 0.15 258)` | `oklch(0.54 0.15 258)` | `oklch(0.99 0.003 258)` |
| accent=3 | plum purple | light | `oklch(0.55 0.16 330)` | `oklch(0.99 0.003 330)` | `oklch(0.55 0.16 330)` | `oklch(0.55 0.16 330)` | `oklch(0.99 0.003 330)` |

## Knobs
```css
/* Knobs of the style comptoir: paper slips with no border, mono amounts, dashed rules, ink charts. */
:root {
	--surface-border-width: 0px;
	--surface-shadow: 0 0 #0000;
	--surface-radius: var(--radius);
	--heading-weight: 700;
	--heading-tracking: -0.01em;
	--heading-case: none;
	--title-weight: 600;
	--title-case: none;
	--title-tracking: 0em;
	--label-weight: 500;
	--label-case: none;
	--label-tracking: 0em;
	--numeral-font: var(--font-mono);
	--icon-stroke: 2;
	--chart-stroke: 2;
	--chart-fill-opacity: 0;
	--chart-grid-dash: 2 4;
	--table-stripe: transparent;
	--table-head-bg: transparent;
	--nav-active-bg: var(--card);
	--nav-indicator-width: 0px;
}
```

## Anatomy
- **Page header.** On the home, the counter slab (Signature) replaces `PageHeader`. Other pages keep `PageHeader`.
- **Panels.** A panel is a slip: `<Card className="slip-edge pt-7">` with the perforation between header and body
  (Signature). Grids: `grid grid-cols-1 gap-4 @5xl/main:grid-cols-12`. White on grey: no border, no shadow.
- **Panel title.** `CardTitle`. A real figure of the slip (a count, a date) sits in `CardAction`,
  `font-numeric text-muted-foreground text-sm tabular-nums`.
- **KPI.** Each figure is a small receipt slip: `<Card className="slip-edge gap-3 pt-6 pb-4">`. Label `label-text text-muted-foreground text-sm`,
  then a `border-t border-dashed` rule, then the value `font-numeric text-3xl font-bold tabular-nums`.
  - number: label, rule, amount, one change line `font-numeric text-xs`. icon: the icon in
    `flex size-8 items-center justify-center rounded-full border-2 border-dashed` at the label end.
  - delta: the change printed under the amount, `font-numeric text-xs text-success` (or `text-destructive`), with its arrow.
  - spark: a till-roll row of thin bars, `h-10`, `maxBarSize={4}`, ink, the last bar in chart-2.
  - meter: a punch card of 10 holes, `flex gap-1` with `aria-hidden="true"`, each `size-3 rounded-full border-2 border-muted-foreground`.
    The 2 px edge has 6.69:1 on the slip. A punched hole adds `bg-foreground`. The share prints beside it.
    Punch `whole > 0 ? Math.round(Math.min(Math.max(item.value / whole, 0), 1) * 10) : 0` holes. The share is 0 to 1, clamped.
  - strip: one long slip. Rules: 2 px, dashed, `border-border`.
- **Charts.** Till-roll bars: square (`radius={0}`), narrow (`maxBarSize={14}`), in chart-1 ink.
  Today's bar takes chart-2 on its `Cell`. Grid: the dashed knob, `<CartesianGrid vertical={false} />`.
  Axes `tickLine={false} axisLine={false} tickMargin={8}`. Ticks stay in the sans: they are dates and scale steps.
  Main `h-60`, side `h-48`, mini `h-10`.
  - Side charts print values on the bars: `<LabelList position="top" className="fill-muted-foreground font-mono text-[0.6875rem]" />`.
  - area: an ink line only (`type="linear"`); the knob sets the fill to 0. compare: the previous period in chart-4,
    `strokeDasharray="4 3"`. stacked: chart-1, chart-3, chart-5, `stroke="var(--card)" strokeWidth={1}`.
  - heat: square cells `size-[14px] rounded-[2px]`, `gap-[3px]`, five steps from `--muted` to the ink of `--chart-1`.
- **Tables.** Dashed row rules, a solid ink rule under the head. Add to the `Table`:
  `[&_tbody_tr]:border-dashed [&_thead_tr]:border-foreground [&_thead_tr]:border-b-2`.
  Amounts and quantities `text-end font-numeric tabular-nums`. Order numbers `font-numeric`. A total row uses
  `TableFooter className="border-foreground border-t-2 border-dashed bg-transparent font-bold font-numeric"`.
- **Navigation.** Flat sidebar, one step darker than the ground. The active item is a white slip (knob). Brand mark:
  `flex aspect-square size-8 items-center justify-center rounded-md bg-sidebar-foreground font-bold font-display text-sidebar`.
- **Badges and status.** A dot plus a word, no pill: `<span className="inline-flex items-center gap-1.5 text-sm">` with
  `<span className="size-2 rounded-full bg-success" />` first. Done `bg-success`, waiting `bg-warning`, problem `bg-destructive`.
- **Buttons and inputs.** The main action is the default `Button`, on the slab. Others `variant="outline"`. Matched corners.
- **Motion.** None. A slip that opens a page darkens its title on hover; nothing moves.

## Signature
1. **The perforated slip.** Put this utility at the end of `tokens.css`. Bind it to the order, the repair job,
   or the rental: one slip holds one record or one topic.
```css
/* Style comptoir: the torn top edge of an order slip. A mask cuts 12 px wide teeth. */
@utility slip-edge {
	mask:
		conic-gradient(from 135deg at top, var(--card) 90deg, transparent 0deg) top / 0.75rem 0.375rem repeat-x,
		linear-gradient(var(--card), var(--card)) bottom / 100% calc(100% - 0.375rem) no-repeat;
}
```
   The perforation sits between `CardHeader` and `CardContent`:
   `<div aria-hidden="true" className="mx-6 border-border border-t-2 border-dashed" />`.

2. **The counter slab.** The dark band on top of the home. Bind it to the day of the shop.
   It shows the orders of today, their total, and the main action ("New order", "Check in a repair").
```tsx
// The counter slab of comptoir: a dark band at the top of the home. It replaces PageHeader there.
// The home page renders it. It calls nothing: the home passes the formatted totals and the action.
import type { ReactNode } from "react";

type CounterSlabProps = {
	/** The page title, already translated. It is the only h1 of the page. */
	title: string;
	/** Figures of today, each in its own span, already formatted with Intl. No middle dots between them. */
	totals: ReactNode;
	/** The one main action of the home, a default Button. */
	action: ReactNode;
};

/** The dark slab of the home. Its light text on `--foreground` keeps 8.38:1 or more. */
export function CounterSlab({ title, totals, action }: CounterSlabProps) {
	return (
		<section className="flex flex-wrap items-end justify-between gap-4 rounded-surface bg-foreground @3xl/main:px-8 px-5 py-5 text-background">
			<div className="grid min-w-0 gap-1.5">
				<h1 className="font-(--heading-weight) font-display text-2xl tracking-(--heading-tracking)">
					{title}
				</h1>
				<p className="flex flex-wrap gap-x-5 font-numeric text-background/75 text-sm tabular-nums">
					{totals}
				</p>
			</div>
			{action}
		</section>
	);
}
```

## Empty state
- The slab keeps the title and the main action. Its totals print `0` in mono.
- Each slip keeps its torn edge and its perforation. Under it, three blank receipt lines
  (`h-7 border-b border-dashed`), then one muted sentence and the action that adds the first record.
- KPI slips print `0`. The till roll keeps its axis and its dashed grid; each day prints an empty bar at 0.
- Setup strip, under the slab: `slip-edge flex flex-wrap items-center gap-3 rounded-surface bg-card px-4 pt-5 pb-3`.
  It holds one sentence and 2 to 4 `Button size="sm"`: the first is the main action, the rest `outline`.

## Do not
- Borders or shadows on slips. Keep white slips on the grey ground, with the torn edge.
- Pills for status. Use the dot and the word, in three colors only.
- Mono for headings, labels, or chart ticks. Keep mono for amounts, quantities, and order numbers.
- A second dark band, or dark panels. The slab appears once, on the home.
- Meta strings joined with middle dots on the slab. Give each figure its own span and a gap.

## Check
- Is the ground a cool grey, with white slips on it?
- Does each slip show a torn top edge and a dashed perforation under its header?
- Does a dark slab at the top of the home hold the title, the totals, and the main action?
- Do the amounts print in the receipt mono, at the end side of their column?
- Is each status a colored dot plus a word, in green, amber, or red?
