# Style suisse
A poster on a white wall: a strict grid, black ink, one block of strong color, and headline-size figures.
Mode: light only. Fits: agencies, media, retail, architecture, sports clubs, any business. Avoid: funeral, clinic.
Radius 0rem. Controls: matched. Shell: topbar (fixed). Density: recipe.

## Identity
- Pure white paper and untinted black ink. One strong primary color, used in one large block and almost nowhere else.
- No panel boxes. A strict 12-column grid places every block on a column edge. Spacing and font weight show the order of importance.
- Every corner is square: the brief asks for radius 0 on a grid poster. There are no hairlines: the few rules are 3 to 4 px.
- Headings and figures are 800 and tight. Text sits flush start with a ragged end. Nothing is centered.
- Use strong color and large size only on the primary block and the giant figures. Tables and lists stay plain.

## Fonts
Apply the link and the blocks of your `fonts=<n>` as SKILL.md, step 4 says. The Note line is the font note of the header comment.
### fonts=1
Link: `https://fonts.googleapis.com/css2?family=Schibsted+Grotesk:wght@400;500;700;800&family=Noto+Kufi+Arabic:wght@700;800&family=Noto+Sans+Arabic:wght@400;500;700&display=swap`
Roles: one family. Display Schibsted Grotesk 800. Body 400, 500, 700. Numerals Schibsted Grotesk 800.
Arabic: display Noto Kufi Arabic 700, 800. Body Noto Sans Arabic 400, 500, 700.
Note: `Fonts of the style suisse: Schibsted Grotesk, Arabic twins Noto Kufi Arabic + Noto Sans Arabic (Google Fonts), loaded in __root.tsx.`
```css
/* Not inside @theme inline: the html:lang(ar) block below must swap these stacks. */
@theme {
	--font-sans: "Schibsted Grotesk", ui-sans-serif, system-ui, sans-serif;
	--font-display: "Schibsted Grotesk", ui-sans-serif, system-ui, sans-serif;
}
html:lang(ar) {
	--font-sans: "Noto Sans Arabic", ui-sans-serif, system-ui, sans-serif;
	--font-display: "Noto Kufi Arabic", "Noto Sans Arabic", ui-sans-serif, system-ui, sans-serif;
}
```
### fonts=2
Link: `https://fonts.googleapis.com/css2?family=Hanken+Grotesk:wght@400;500;700;800&family=Alexandria:wght@700;800&family=Noto+Sans+Arabic:wght@400;500;700&display=swap`
Roles: one family. Display Hanken Grotesk 800. Body 400, 500, 700. Numerals Hanken Grotesk 800.
Arabic: display Alexandria 700, 800. Body Noto Sans Arabic 400, 500, 700.
Note: `Fonts of the style suisse: Hanken Grotesk, Arabic twins Alexandria + Noto Sans Arabic (Google Fonts), loaded in __root.tsx.`
```css
/* Not inside @theme inline: the html:lang(ar) block below must swap these stacks. */
@theme {
	--font-sans: "Hanken Grotesk", ui-sans-serif, system-ui, sans-serif;
	--font-display: "Hanken Grotesk", ui-sans-serif, system-ui, sans-serif;
}
html:lang(ar) {
	--font-sans: "Noto Sans Arabic", ui-sans-serif, system-ui, sans-serif;
	--font-display: "Alexandria", "Noto Sans Arabic", ui-sans-serif, system-ui, sans-serif;
}
```

## Palette
Light only: the block replaces `:root`, and `.dark` stays. Apply `### mode=light` of `frame.md`.
### Light
```css
/* suisse, accent=1. Lowest text ratio 4.70:1 (success on its badge tint). Lowest graphic ratio 3.19:1 (chart-5 on card). */
:root {
	--background: oklch(0.995 0 0);
	--foreground: oklch(0.17 0 0);
	--card: oklch(0.995 0 0);
	--card-foreground: oklch(0.17 0 0);
	--popover: oklch(1 0 0);
	--popover-foreground: oklch(0.17 0 0);
	--primary: oklch(0.56 0.215 28);
	--primary-foreground: oklch(0.995 0 0);
	--secondary: oklch(0.945 0 0);
	--secondary-foreground: oklch(0.17 0 0);
	--muted: oklch(0.95 0 0);
	--muted-foreground: oklch(0.48 0 0);
	--accent: oklch(0.93 0 0);
	--accent-foreground: oklch(0.17 0 0);
	--destructive: oklch(0.46 0.17 15);
	--destructive-foreground: oklch(0.995 0 0);
	--border: oklch(0.86 0 0);
	--input: oklch(0.17 0 0);
	--ring: oklch(0.56 0.215 28);
	--radius: 0rem;
	--control-radius: 0rem;
	--sidebar: oklch(0.995 0 0);
	--sidebar-foreground: oklch(0.17 0 0);
	--sidebar-primary: oklch(0.56 0.215 28);
	--sidebar-primary-foreground: oklch(0.995 0 0);
	--sidebar-accent: oklch(0.945 0 0);
	--sidebar-accent-foreground: oklch(0.17 0 0);
	--sidebar-border: oklch(0.86 0 0);
	--sidebar-ring: var(--ring);
	/* chart-1 follows the ring: the accent, or ink for the yellow accent. The rest are greys at 3:1 or more. */
	--chart-1: var(--ring);
	--chart-2: oklch(0.38 0 0);
	--chart-3: oklch(0.5 0 0);
	--chart-4: oklch(0.58 0 0);
	--chart-5: oklch(0.65 0 0);
	--success: oklch(0.5 0.13 150);
	--warning: oklch(0.52 0.12 60);
	--info: oklch(0.48 0.15 260);
}
```

## Accents
The palette block holds accent=1. For accent=2 or 3, replace these five tokens in `:root`; `--chart-1` and `--sidebar-ring` follow.
`--sidebar-ring: var(--ring)` and `--chart-1: var(--ring)` stay in the block. Lowest accent ratio: 5.12:1 (accent=1, white on red).
Yellow is a fill with ink text only. Its ring, its nav bar, `--chart-1`, the meter, and the link underline are ink.

| accent | name | `--primary` | `--primary-foreground` | `--ring` | `--sidebar-primary` | `--sidebar-primary-foreground` |
|---|---|---|---|---|---|---|
| accent=1 | signal red | `oklch(0.56 0.215 28)` | `oklch(0.995 0 0)` | `oklch(0.56 0.215 28)` | `oklch(0.56 0.215 28)` | `oklch(0.995 0 0)` |
| accent=2 | ultramarine blue | `oklch(0.45 0.22 266)` | `oklch(0.995 0 0)` | `oklch(0.45 0.22 266)` | `oklch(0.45 0.22 266)` | `oklch(0.995 0 0)` |
| accent=3 | poster yellow | `oklch(0.88 0.17 95)` | `oklch(0.17 0 0)` | `oklch(0.17 0 0)` | `oklch(0.17 0 0)` | `oklch(0.995 0 0)` |

## Knobs
Put this block after the `:root` palette block; replace an earlier `/* Style knobs of ... */` block.
```css
/* Style knobs of suisse: no surfaces, 800 headings, bold labels, thick strokes, solid areas, a thick nav bar. */
:root {
	--surface-border-width: 0px;
	--surface-shadow: 0 0 #0000;
	--surface-radius: 0px;
	--heading-weight: 800;
	--heading-tracking: -0.045em;
	--heading-case: none;
	--title-weight: 700;
	--title-case: none;
	--title-tracking: -0.015em;
	--label-weight: 700;
	--label-case: none;
	--label-tracking: 0em;
	--numeral-font: var(--font-display);
	--icon-stroke: 2.25;
	--chart-stroke: 3;
	--chart-fill-opacity: 1;
	--chart-grid-dash: none;
	--table-stripe: transparent;
	--table-head-bg: transparent;
	--nav-active-bg: transparent;
	--nav-indicator-width: 4px;
}
```

## Anatomy
- **Frame.** Apply `### shell=topbar` of `frame.md`, whatever the recipe says. Then make the top bar the only desktop nav: `collapsible="offcanvas"` in `app-sidebar.tsx`;
  `defaultOpen={false}` on the `SidebarProvider` of `app-shell.tsx`; `className="-ms-1 md:hidden"` on the `SidebarTrigger`. Phones keep the sidebar sheet. Remove the page name and its separator.
- **Grid.** Each page body is `grid @3xl/main:grid-cols-12 grid-cols-4 gap-x-6 gap-y-12`.
  Spans are 3, 4, 5, 6, 7, 8, or 12 columns. Every block starts on a column edge. Never center a block or a text.
- **Page header.** In `page-header.tsx`, the h1 size `text-2xl` becomes `@3xl/main:text-6xl text-4xl leading-[0.95]`.
- **Panels.** A panel is a grid area with no box: `<section className="grid content-start gap-4">`, title `<h2 className="font-bold text-xl tracking-tight">`.
  On list and detail pages, a Card gets `className="gap-4 py-0"`. Its header and content get `className="px-0"` to sit on the grid.
- **KPI.** One figure goes in the primary block (Signature 1). The others are giant figures (Signature 2), flush start.
  - number: label `font-bold text-sm` above the figure. icon: `size-6` above the label, in ink.
  - delta: `inline-flex items-center gap-1 font-bold text-sm text-success` (or `text-destructive`), arrow `size-4 rtl:-scale-x-100`. In the primary block, the change keeps `primary-foreground`, no status color: the sign and the arrow give the direction.
  - spark: a 3 px line under the figure, `ChartContainer className="aspect-auto h-12"`.
  - meter: `Progress className="h-2 rounded-none bg-secondary [&_[data-slot=progress-indicator]]:bg-chart-1"`: the accent, or the ink
    with accent=3 (4.4:1 or more). In the primary block: `h-2 rounded-none bg-primary-foreground/30 [&_[data-slot=progress-indicator]]:bg-primary-foreground` (3.4:1 or more).
  - strip: rules 4 px in `border-foreground`, like the bar of the giant figures. No other box.
- **Charts.** Thick bars: `radius={0}`, `maxBarSize={56}`. No `CartesianGrid`, no Y axis.
  - Value labels on the bars. In the chart component: `const valueFormat = new Intl.NumberFormat(locale);` with `locale` from `useT()`.
    Then `<LabelList position="top" offset={8} className="fill-foreground font-bold" formatter={(label) => (typeof label === "number" ? valueFormat.format(label) : label)} />`.
  - X axis: `tickLine={false} axisLine={{ stroke: "var(--foreground)", strokeWidth: 3 }} tick={{ fontWeight: 700 }}`.
  - An area is a solid field (the knob gives full opacity). The earlier period is a 3 px line in `var(--chart-2)` on top.
  - Heights: main `aspect-auto @3xl/main:h-80 h-72`, side `aspect-auto h-56`. `--chart-1` is the subject; greys draw the rest.
  - heat: square cells `size-[16px]` with no radius, gap `gap-[2px]`. 90 days take 250 px; a panel has no box padding.
- **Tables.** A heavy head rule and no stripes: `TableHeader className="[&_tr]:border-foreground [&_tr]:border-b-[3px]"`, `TableHead className="h-10 text-foreground"`,
  `TableCell className="py-3"`. Numbers `text-end font-bold tabular-nums`. A status is a square and a bold word: `inline-flex items-center gap-2 font-bold` with `size-2 bg-success`.
- **Navigation.** Bold text links in the top bar, after the app name. The active link has a thick ink underline. Brand mark: the square `bg-primary` letter of `frame.md`.
  ```tsx
  {/* Desktop nav of suisse. Phones use the sidebar sheet, where the knob draws a 4 px start bar. */}
  <nav aria-label={appName} className="ms-6 hidden h-full items-stretch gap-6 md:flex">
  	{NAV_ITEMS.map((item) => (
  		// The home path is a prefix of every page, so only an exact match marks it active.
  		<Link key={item.to} to={item.to} activeOptions={{ exact: item.to === "/app" }} className="flex items-center border-transparent border-b-4 pt-1 font-bold text-sm hover:border-foreground/30 data-[status=active]:border-foreground">
  			{t(item.labelKey)}
  		</Link>
  	))}
  </nav>
  ```
- **Badges, buttons, inputs.** Square corners everywhere. Buttons `font-bold`, outline buttons `border-2 border-foreground`. One `default` button per screen. Inputs keep the ink border of `--input`.
- **Links.** `font-bold text-foreground underline decoration-ring decoration-2 underline-offset-4`. Yellow text is 1.4:1 on white.
  In `button.tsx`, the `link` variant `text-primary underline-offset-4 hover:underline` becomes this string.
- **Motion.** None. Hover changes a color at once. No entrance motion.

## Signature
**1. The primary block.** The hero figure on a full primary field, spanning 6 or 7 of the 12 columns.
Bind it to the main number of this business: tickets sold this month, revenue this week, members today.
```tsx
// Hero block of the suisse style: one figure on a full primary field, flush start, giant.
// The home passes its main figure. It is the only large primary area of the page.
import type { ReactNode } from "react";

type HeroBlockProps = {
	/** Translated label of the figure, for example "Tickets sold this month". */
	label: string;
	/** The figure, formatted with Intl, for example "12,480". Over 7 characters, use Intl compact notation ("1.2M"). */
	value: string;
	/** The change against the earlier period, sign in a <bdi dir="ltr">, then an arrow. Null without earlier data. No status color: it stays primary-foreground, and the sign and the arrow give the direction. */
	change: ReactNode;
};

/** primary-foreground on primary passes 4.5:1 for every accent of this style. */
export function HeroBlock({ label, value, change }: HeroBlockProps) {
	return (
		<section className="@container @3xl/main:col-span-7 col-span-4 grid min-h-64 min-w-0 content-between gap-10 bg-primary @3xl/main:p-8 p-6 text-primary-foreground">
			<h2 className="font-bold text-base">{label}</h2>
			<div className="grid gap-3">
				{/* The block width sizes the figure. A 7-character value is at most 4.1em wide, so 22cqi fills at most 91%. */}
				<bdi className="font-extrabold font-numeric text-[clamp(3.5rem,22cqi,10rem)] tabular-nums leading-[0.85] tracking-tighter">
					{value}
				</bdi>
				{/* No earlier data: no change line, never "0%". */}
				{change ? <p className="font-bold text-lg">{change}</p> : null}
			</div>
		</section>
	);
}
```

**2. The giant figures.** Each other figure stands flush start under a 4 px ink bar, as large as a headline.
Bind them to the counts that follow the hero: open orders, new members, items low on stock.
```tsx
// Giant figure of the suisse style: a 4 px ink bar, a bold label, and an 800 figure. No box.
// The home renders one per supporting figure, after the primary block.
import type { ReactNode } from "react";

type GiantFigureProps = {
	/** Translated label, for example "Open orders". */
	label: string;
	/** The figure, formatted with Intl. Over 7 characters, use Intl compact notation. */
	value: string;
	/** Optional line under the figure, for example a delta with its arrow. */
	detail?: ReactNode;
};

/** Spans 3 of the 12 columns, so four figures fill one row. Below a 48rem main: full width, or half from 36rem. */
export function GiantFigure({ label, value, detail }: GiantFigureProps) {
	return (
		<div className="@container @3xl/main:col-span-3 @xl/main:col-span-2 col-span-4 grid min-w-0 content-start gap-2 border-foreground border-t-4 pt-3">
			<p className="font-bold text-sm">{label}</p>
			{/* The column width sizes the figure: 22cqi keeps a 7-character value inside its columns. */}
			<bdi className="font-extrabold font-numeric text-[clamp(2.25rem,22cqi,4.5rem)] tabular-nums leading-none tracking-tight">
				{value}
			</bdi>
			{detail}
		</div>
	);
}
```

## Empty state
- The primary block stays, with a giant `0` and its label. It shows no change line without earlier data.
- The giant figures show `0` under their ink bars. A bar chart keeps its ink baseline and its day labels.
- A table keeps its heavy head rule, then `grid min-h-40 content-center gap-3 font-bold text-lg` with one sentence and the action.
- The setup strip sits under the page header: `flex flex-wrap gap-x-8 gap-y-3 border-foreground border-y-2 py-3`.
  It holds 2 to 4 steps in order, each `inline-flex items-baseline gap-2 font-bold`: the step number in `font-numeric text-2xl`, then a link.

## Do not
- Rounded corners or a shadow. Instead: square edges on a flat page.
- A box or a tinted field around a panel. Instead: grid columns and space.
- A centered title, figure, or empty state. Instead: flush start with a ragged end.
- A second accent color, or the primary on small marks everywhere. Instead: one primary block; the rest is ink and grey.
- Light or medium figures. Instead: 800 weight, as large as the column allows.

## Check
- Does a full primary block hold the hero figure?
- Are the other figures giant, 800 weight, flush start, under a heavy ink bar?
- Is the desktop nav a row of bold links in the top bar, with the active link underlined thick?
- Do the bars show value labels, with no grid lines and a heavy ink baseline?
