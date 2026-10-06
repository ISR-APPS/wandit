# Style console
An operator terminal: a graphite screen, ruled sections, mono ids, and a prompt line at the top of each page.
Mode: dark only. Fits: dev tools, APIs, IT, infra, data ops, security, AI ops. Avoid: beauty, kids, food, wellness.
Radius 0.1875rem. Controls: matched. Shell: bordered (fixed). Density: recipe.

## Identity
- The ground is graphite `oklch(0.25 0.008 260)` (#1F2226) with a faint blue tint. Text is a cool off-white.
- No cards. Each panel is a full-width section with a 1 px top rule and a header row. Tables are the main object.
- Mono sets ids, numbers, timestamps, and section titles, because operators copy ids. Labels, table heads, and prose use the sans.
- One flat accent, with no glow and no gradient. It marks the prompt sign, the active nav row, the main action, and chart-1.
- The signature: the prompt line and the go-to keys at the top, and sparkbars in the status cells of the main table. No bottom bar.

## Fonts
Apply your `fonts=<n>` as SKILL.md, step 4 says. The Note line replaces the font note of the `tokens.css` header comment.
The block also sets `--font-mono`. Ids stay Latin, so the mono face stays in Arabic.
### fonts=1
Link: `https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600&family=Geist+Mono:wght@400;500;600&family=Noto+Kufi+Arabic:wght@500;600&family=IBM+Plex+Sans+Arabic:wght@400;500;600&display=swap`
Roles: display Geist Mono 500 (headings, section titles). Body Geist 400, 500, 600. Numerals and ids Geist Mono 400, 500.
Arabic: display Noto Kufi Arabic 500, 600. Body IBM Plex Sans Arabic 400, 500, 600.
Note: `Fonts of the style console: Geist Mono + Geist, Arabic twins Noto Kufi Arabic + IBM Plex Sans Arabic (Google Fonts), loaded in __root.tsx.`
```css
/* Not inside @theme inline: utilities must emit var(--font-*) so the
   :lang(ar) scope below can swap the Latin stacks for the Arabic twins. */
@theme {
	--font-sans: "Geist", ui-sans-serif, system-ui, sans-serif;
	--font-display: "Geist Mono", ui-monospace, SFMono-Regular, Menlo, monospace;
	--font-mono: "Geist Mono", ui-monospace, SFMono-Regular, Menlo, monospace;
}
html:lang(ar) {
	--font-sans: "IBM Plex Sans Arabic", ui-sans-serif, system-ui, sans-serif;
	--font-display: "Noto Kufi Arabic", "IBM Plex Sans Arabic", ui-sans-serif, system-ui, sans-serif;
}
```
### fonts=2
Link: `https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600&family=Golos+Text:wght@400;500;600&family=Kufam:wght@500;600&family=IBM+Plex+Sans+Arabic:wght@400;500;600&display=swap`
Roles: display JetBrains Mono 500 (headings, section titles). Body Golos Text 400, 500, 600. Numerals and ids JetBrains Mono 400, 500.
Arabic: display Kufam 500, 600. Body IBM Plex Sans Arabic 400, 500, 600.
Note: `Fonts of the style console: JetBrains Mono + Golos Text, Arabic twins Kufam + IBM Plex Sans Arabic (Google Fonts), loaded in __root.tsx.`
```css
/* Not inside @theme inline: utilities must emit var(--font-*) so the
   :lang(ar) scope below can swap the Latin stacks for the Arabic twins. */
@theme {
	--font-sans: "Golos Text", ui-sans-serif, system-ui, sans-serif;
	--font-display: "JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace;
	--font-mono: "JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace;
}
html:lang(ar) {
	--font-sans: "IBM Plex Sans Arabic", ui-sans-serif, system-ui, sans-serif;
	--font-display: "Kufam", "IBM Plex Sans Arabic", ui-sans-serif, system-ui, sans-serif;
}
```

## Palette
Dark only. This block replaces `.dark` in `src/styles/tokens.css`. Keep the unused `:root` block.
### Dark
```css
/* console, accent=1. Lowest text ratio 4.61:1 (placeholder text on the input fill, input at 30% on the ground).
   Lowest graphic ratio 3.44:1 (chart-5 on background). */
.dark {
	--background: oklch(0.25 0.008 260);
	--foreground: oklch(0.94 0.006 260);
	--card: oklch(0.25 0.008 260);
	--card-foreground: oklch(0.94 0.006 260);
	--popover: oklch(0.29 0.01 260);
	--popover-foreground: oklch(0.94 0.006 260);
	--primary: oklch(0.8 0.12 210);
	--primary-foreground: oklch(0.18 0.03 220);
	--secondary: oklch(0.325 0.01 260);
	--secondary-foreground: oklch(0.91 0.006 260);
	--muted: oklch(0.305 0.009 260);
	--muted-foreground: oklch(0.74 0.01 260);
	--accent: oklch(0.335 0.012 260);
	--accent-foreground: oklch(0.96 0.005 260);
	--destructive: oklch(0.72 0.17 22);
	--destructive-foreground: oklch(0.18 0.03 22);
	--border: oklch(0.36 0.01 260);
	--input: oklch(0.605 0.012 260);
	--ring: oklch(0.8 0.12 210);
	--radius: 0.1875rem;
	--control-radius: 0.1875rem;
	--sidebar: oklch(0.225 0.008 260);
	--sidebar-foreground: oklch(0.86 0.008 260);
	--sidebar-primary: oklch(0.8 0.12 210);
	--sidebar-primary-foreground: oklch(0.18 0.03 220);
	--sidebar-accent: oklch(0.3 0.012 260);
	--sidebar-accent-foreground: oklch(0.96 0.005 260);
	--sidebar-border: oklch(0.34 0.01 260);
	--sidebar-ring: var(--ring);
	/* The accent draws the main series. Four greys, light to dark, draw the rest. Status hues never draw a series. */
	--chart-1: var(--primary);
	--chart-2: oklch(0.87 0.008 260);
	--chart-3: oklch(0.74 0.01 260);
	--chart-4: oklch(0.63 0.012 260);
	--chart-5: oklch(0.56 0.012 260);
	--success: oklch(0.78 0.13 160);
	--warning: oklch(0.86 0.14 95);
	--info: oklch(0.77 0.1 250);
}
```

## Accents
The palette block holds accent=1. For accent=2 or 3, replace these five tokens in `.dark`; `--chart-1` and `--sidebar-ring` follow.
Each accent is light on a dark ground, so it can draw link text, a meter cell, and a ring. Lowest ratios, all accent=3:
link text on the ground 6.40:1, a lit meter cell on `--muted` 5.36:1, the ring on the ground 6.40:1.

| accent | name | `--primary` | `--primary-foreground` | `--ring` | `--sidebar-primary` | `--sidebar-primary-foreground` |
|---|---|---|---|---|---|---|
| accent=1 | signal cyan | `oklch(0.8 0.12 210)` | `oklch(0.18 0.03 220)` | `oklch(0.8 0.12 210)` | `oklch(0.8 0.12 210)` | `oklch(0.18 0.03 220)` |
| accent=2 | warm amber | `oklch(0.8 0.14 65)` | `oklch(0.2 0.04 60)` | `oklch(0.8 0.14 65)` | `oklch(0.8 0.14 65)` | `oklch(0.2 0.04 60)` |
| accent=3 | bright magenta | `oklch(0.74 0.17 340)` | `oklch(0.17 0.03 340)` | `oklch(0.74 0.17 340)` | `oklch(0.74 0.17 340)` | `oklch(0.17 0.03 340)` |

## Knobs
Put this block after the palette blocks; replace an earlier `/* Style knobs of ... */` block.
`--surface-border-width` is a border-width shorthand: `1px 0 0` draws only the top rule, so a Card becomes a ruled section.
```css
/* Style knobs of console: top-ruled sections, mono titles, 1 px lines on a dotted grid. */
:root {
	--surface-border-width: 1px 0 0;
	--surface-shadow: 0 0 #0000;
	--surface-radius: 0px;
	--heading-weight: 500;
	--heading-tracking: 0em;
	--heading-case: none;
	--title-weight: 500;
	--title-case: none;
	--title-tracking: 0em;
	--label-weight: 500;
	--label-case: none;
	--label-tracking: 0em;
	--numeral-font: var(--font-display);
	--icon-stroke: 1.5;
	--chart-stroke: 1;
	--chart-fill-opacity: 0.08;
	--chart-grid-dash: 1 3;
	--table-stripe: transparent;
	--table-head-bg: transparent;
	--nav-active-bg: var(--sidebar-accent);
	--nav-indicator-width: 2px;
}
```

## Anatomy
- **Frame.** Apply `### mode=dark` and `### shell=bordered` of `frame.md`, whatever the recipe says. Density follows the recipe.
- **Page header.** `PageHeader` with the prompt line as its `description` (Signature 1).
  In `page-header.tsx`, the h1 size `text-2xl` becomes `text-xl`. Actions use `size="sm"` buttons.
- **Panels.** A panel is a ruled section, not a box: `<section className="grid gap-3 border-t pt-3">`. Its body is flush, with no fill.
  - Header row `flex items-baseline justify-between gap-3`: title `<h2 className="font-display font-medium text-sm">` in sentence case,
    then a count or the last update in `font-mono text-muted-foreground text-xs tabular-nums`.
  - Page grid: `grid gap-10`, then `grid @4xl/main:grid-cols-[minmax(0,1fr)_22rem] grid-cols-1 gap-x-8 gap-y-10`.
    A Card from `tables.md` keeps its parts; the knobs flatten it into the same ruled section.
- **KPI.** One stat line, never tiles: `flex flex-wrap gap-x-10 gap-y-4 border-y py-3`.
  - number: label `label-text text-muted-foreground text-xs` (sans) over the value `font-numeric text-2xl tabular-nums` (mono).
  - icon: as number, with a `size-3.5 text-muted-foreground` icon before the label.
  - delta: after the value, `inline-flex items-center gap-1 font-mono text-success text-xs` (or `text-destructive`), arrow `size-3 rtl:-scale-x-100`.
  - spark: sparkbars after the value, `ChartContainer className="aspect-auto h-6 w-20"`, `<Bar radius={0} minPointSize={1} />`.
  - meter: 20 cells in `grid grid-cols-20 gap-px`. The share is `whole > 0 ? Math.min(1, Math.max(0, value / whole)) : 0`, from 0 to 1.
    `Math.round(share * 20)` cells are lit `h-2 bg-primary`; the rest are `h-2 bg-muted`. A whole of 0 lights no cell.
  - strip: the line is the strip panel. The rules of `kpis/strip.md` are 1 px `border-border`. Values `text-lg`.
- **Charts.** `ChartContainer className="aspect-auto h-56 font-mono"` (main) or `h-36` (side). Ticks inherit the mono face.
  - Lines `type="linear"`, no dots; the knobs give 1 px and a faint fill. `<CartesianGrid vertical={false} />`; the knob dots it.
  - Bars `radius={0}`, `barSize={6}`. `--chart-1` draws the subject; the greys draw the rest and the earlier period.
  - heat: calendar cells `size-[11px] rounded-[1px]` with `gap-[2px]`. A strip runs full width with no panel:
    `grid auto-cols-fr grid-flow-col gap-px`, cells `h-[12px] rounded-[1px]`.
- **Tables.** The main object: dense rows, no zebra, a hover highlight. `TableHead className="h-8 text-muted-foreground text-xs"` (sans),
  `TableRow className="border-border/60 hover:bg-muted"`, `TableCell className="py-1.5"`. Ids `font-mono text-muted-foreground text-xs`.
  Numbers and times `text-end font-mono tabular-nums`. A status is `inline-flex items-center gap-1.5`: a `size-1.5 rounded-full bg-success` dot and a word.
  The sparkbars end the status cell of the main table (Signature 2).
- **Navigation.** The bordered sidebar is darker than the ground. Each `SidebarMenuButton` gets `className="h-7 text-[0.8125rem]"`.
  Each row ends with its go-to hint (Signature 1). The knobs draw the active row: a fill and a 2 px start bar.
  Brand mark: `flex aspect-square size-6 items-center justify-center rounded-sm bg-sidebar-primary font-mono text-sidebar-primary-foreground text-xs`.
- **Badges, buttons, inputs.** Badges `rounded-sm font-mono text-[0.6875rem]`; in tables, prefer the dot and the word.
  Buttons keep the matched 3 px radius; `size="sm"` is the normal size. Id and code inputs get `h-8 font-mono`.
- **Motion.** Row hover `transition-colors duration-75`. No entrance motion, no pulse, no glow.

## Signature
**1. The prompt line and the go-to keys.** The prompt line is text in the page header: the path of the page and its period.
It has no input and opens nothing. Pass it as the `description` of `PageHeader`: `<PromptLine days={days} />`, or `<PromptLine />` on a page with no period.
```tsx
// Prompt line of the console style: the path of the page and its period, in the page header.
// It is text only: no input, no click. The period label is the chart.period message of the chart forms.
import { useLocation } from "@tanstack/react-router";
import { useT } from "~/shared/i18n";
type PromptLineProps = {
	/** Period of the page in days, the `days` state of the home. Absent on a page with no period. */
	days?: number;
};
/** Renders spans only, because PageHeader puts its description in a <p>. */
export function PromptLine({ days }: PromptLineProps) {
	const { t, locale } = useT();
	const pathname = useLocation({ select: (location) => location.pathname });
	const period = new Intl.NumberFormat(locale, { style: "unit", unit: "day", unitDisplay: "short" });
	return (
		<span className="flex min-w-0 items-baseline gap-2 font-mono text-xs">
			<span aria-hidden="true" className="text-primary">$</span>
			{/* A path reads left to right, also in an Arabic page. */}
			<bdi dir="ltr" className="min-w-0 truncate text-foreground">{pathname}</bdi>
			{days === undefined ? null : <span>{t("chart.period")} {period.format(days)}</span>}
		</span>
	);
}
```
The go-to keys are real. Add `hotkey` to `NavItem`, with this comment: `/** One lowercase Latin letter, never "g". "g" then this key opens the page. */`.
Give each item its own letter, bound to this business: `g d` deploys, `g i` incidents.
Each sidebar row ends with `<kbd className="ms-auto hidden font-mono text-[0.6875rem] text-sidebar-foreground/70 md:inline">g {item.hotkey}</kbd>`.
The hint hides at phone width, where no keyboard exists. Call this hook once in `AppShell`.
```tsx
// Go-to keys of the console style: "g", then the hotkey of a nav item, opens its page.
// AppShell calls the hook once. The sidebar rows show the same hints from NAV_ITEMS.
import { useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { NAV_ITEMS } from "../lib/nav-items";
/** 1.2 s. The second key must follow "g" within this time. */
const CHORD_MS = 1200;
/** Listens on the window. It reads event.key, so the letters follow the keyboard layout (AZERTY, QWERTZ). */
export function useGoToKeys() {
	const navigate = useNavigate();
	// effect: the keydown listener on window is an external system.
	useEffect(() => {
		let pressedGAt = Number.NEGATIVE_INFINITY;
		function onKeyDown(event: KeyboardEvent) {
			// A key typed in a field belongs to that field and never navigates.
			const target = event.target;
			const isTyping = target instanceof HTMLElement && (target.isContentEditable || target.closest("input, textarea, select") !== null);
			if (isTyping || event.defaultPrevented || event.repeat || event.metaKey || event.ctrlKey || event.altKey) return;
			// A non-Latin layout (Arabic) gives no Latin letter. Then the physical key gives the letter.
			const key = /^[a-z]$/i.test(event.key) ? event.key.toLowerCase() : event.code.replace(/^Key/, "").toLowerCase();
			const item = NAV_ITEMS.find((entry) => entry.hotkey === key);
			if (item && event.timeStamp - pressedGAt < CHORD_MS) void navigate({ to: item.to });
			// No hotkey is "g", so a "g" only starts a new chord. Any other key ends the chord.
			pressedGAt = key === "g" ? event.timeStamp : Number.NEGATIVE_INFINITY;
		}
		window.addEventListener("keydown", onKeyDown);
		return () => window.removeEventListener("keydown", onKeyDown);
	}, [navigate]);
}
```

**2. The sparkbars.** The status cell of the main table ends with 14 thin bars: the events of that row on each of the last 14 days.
Bind them to the main event of a row: the deploys of a service, the calls of an API key, the alerts of a host.
The cell is `flex items-center gap-3`: the status dot and word, then the bars. A table with no status shows the bars in a last column.
Write one read function with the rules of data.md, section 3. Its inputs are `p_days` (14), `p_time_zone`, and `p_ids uuid[]`.
`p_ids` holds the ids that the table shows. More than 1,000 ids raise `invalid_input`.
It returns one row per id: `id` and `counts int[]`, oldest day first. `generate_series` and `coalesce` give 0 to a day with no event.
Parse the rows with a zod schema with named fields in `series.ts`. The loader reads the list, then the counts of its ids.
The page reads both with `useSuspenseQuery`. An id with no row gets 14 zeros.
```tsx
// Sparkbars of the console style: the daily events of one table row, at the end of its status cell.
// Plain spans, not recharts, so a table of 1,000 rows stays light. The counts come from the read function.
import { cn } from "~/shared/lib/utils";
/** Bar height of each step: a 1 px floor for a day with no event, up to 16 px for the busiest day. */
const BAR_HEIGHTS = ["h-px", "h-[4px]", "h-[8px]", "h-[12px]", "h-[16px]"] as const;
type SparkbarsProps = {
	/** Events of the row per day, oldest first: the `counts` of the read function. A day with no event is 0. */
	counts: number[];
	/** Translated total for screen readers, for example "12 deploys in 14 days". */
	label: string;
};
/** 14 bars of 3 px and 13 gaps of 1 px: 55 px. The busiest day of the row takes the full height. */
export function Sparkbars({ counts, label }: SparkbarsProps) {
	const max = Math.max(0, ...counts);
	return (
		<span role="img" aria-label={label} className="inline-flex h-[16px] shrink-0 items-end gap-px">
			{counts.map((count, index) => {
				// Any event gives step 1 or more, so a quiet day never looks empty.
				const step = count <= 0 || max <= 0 ? 0 : Math.ceil((count / max) * (BAR_HEIGHTS.length - 1));
				// The age of the day keys the bar, so the bar of today keeps its key when the data reloads.
				const daysAgo = counts.length - 1 - index;
				return <span key={daysAgo} className={cn("w-[3px] bg-chart-3", BAR_HEIGHTS[step])} />;
			})}
		</span>
	);
}
```

## Empty state
- Every section keeps its rule and header row; the count says `0`. The stat line shows `0`, with no delta.
- The prompt line shows the path and the period. A line chart is flat at 0. A row with no event draws 14 bars at the 1 px floor.
- A table keeps its head row, then one `<TableCell colSpan={columnCount} className="h-24 text-center font-mono text-muted-foreground text-xs">` with "0 rows" and the first action.
- The setup strip sits under the page header: `flex flex-wrap items-center gap-x-6 gap-y-2 border-y py-2 text-xs`, with `setup 1/3` in mono
  and 2 to 4 steps. Each step has `CircleIcon` or `CircleCheckIcon` from the real data, and a link to do it.

## Do not
- A black #0B0B0B ground or a neon glow. Instead: graphite `oklch(0.25 0.008 260)` (#1F2226) and flat marks.
- An acid-green accent. Instead: a row of the Accents table.
- Rounded cards with shadows. Instead: full-width sections with a 1 px top rule.
- A key hint with no key handler, or a search box that opens nothing. Instead: wire `useGoToKeys`, and draw the prompt line as text.
- A bottom status bar, or mono on labels and table heads. Instead: the prompt line at the top, the sparkbars in the table, and sans labels.

## Check
- Is the ground graphite, with top rules between sections and no card boxes?
- Are ids, numbers, timestamps, and section titles in mono, and labels, table heads, and prose in sans?
- Does the page header show a `$` prompt line with the page path and the period, as text with no box?
- Does each sidebar row end with a hint of `g` and one letter, with no two rows on the same letter?
- Does the status cell of each main table row end with 14 grey sparkbars, with one label for a screen reader?
- Are the lines 1 px on a dotted horizontal grid, and is the main table dense with no zebra?
