# Style etabli
A product workbench: an ordered bench, tools in labeled trays, a tag with a number on every item.
Mode: light or dark. Fits: project tracking, agencies, tasks, support, recruiting, CRM, content. Avoid: kids, food, beauty.
Radius 0.375rem. Controls: matched. Shell: recipe. Density: recipe.

## Identity
- Low-contrast neutrals. A panel has no box: a tinted header band on the ground, then rows split by low-alpha hairlines. No shadow.
- The main object is a list grouped by status: a status circle, a mono id, a title, muted meta. No KPI tiles.
- Mono only for ids, counts, and key hints. The trade reads items by their ids ("SUP-142"), so mono is a fact here.
- One accent: the main action, the active item, focus, and the main line. A command-bar look with real key hints.

## Fonts
### fonts=1
- Roles: display and body IBM Plex Sans (400 to 600), numerals and ids IBM Plex Mono (400, 500). Arabic twin: IBM Plex Sans Arabic.
- Link: `https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans+Arabic:wght@400;500;600&display=swap`
- Font note: `Fonts of the style etabli (fonts=1): IBM Plex Sans + IBM Plex Mono, Arabic twin IBM Plex Sans Arabic (Google Fonts), loaded in __root.tsx.`
```css
/* Not inside @theme inline: the html:lang(ar) block below must swap these stacks. */
@theme {
	--font-sans: "IBM Plex Sans", ui-sans-serif, system-ui, sans-serif;
	--font-display: "IBM Plex Sans", ui-sans-serif, system-ui, sans-serif;
	--font-mono: "IBM Plex Mono", ui-monospace, monospace;
}
html:lang(ar) {
	--font-sans: "IBM Plex Sans Arabic", ui-sans-serif, system-ui, sans-serif;
	--font-display: "IBM Plex Sans Arabic", ui-sans-serif, system-ui, sans-serif;
	--font-mono: "IBM Plex Mono", "IBM Plex Sans Arabic", ui-monospace, monospace;
}
```
### fonts=2
- Roles: display and body Fira Sans (400 to 600), numerals and ids Fira Code (400, 500). Arabic twin: Vazirmatn.
- Link: `https://fonts.googleapis.com/css2?family=Fira+Sans:wght@400;500;600&family=Fira+Code:wght@400;500&family=Vazirmatn:wght@400;500;600&display=swap`
- Font note: `Fonts of the style etabli (fonts=2): Fira Sans + Fira Code, Arabic twin Vazirmatn (Google Fonts), loaded in __root.tsx.`
```css
/* Not inside @theme inline: the html:lang(ar) block below must swap these stacks. */
@theme {
	--font-sans: "Fira Sans", ui-sans-serif, system-ui, sans-serif;
	--font-display: "Fira Sans", ui-sans-serif, system-ui, sans-serif;
	--font-mono: "Fira Code", ui-monospace, monospace;
}
html:lang(ar) {
	--font-sans: "Vazirmatn", ui-sans-serif, system-ui, sans-serif;
	--font-display: "Vazirmatn", ui-sans-serif, system-ui, sans-serif;
	--font-mono: "Fira Code", "Vazirmatn", ui-monospace, monospace;
}
```

## Palette
### Light
```css
/* Style etabli light, accent=1 (tangerine orange). Lowest: text 4.58:1 (warning on its tint), marks 3.11:1 (chart-5 on card). */
:root {
	--background: oklch(0.99 0.002 270);
	--foreground: oklch(0.24 0.012 270);
	--card: oklch(1 0 0);
	--card-foreground: oklch(0.24 0.012 270);
	--popover: oklch(1 0 0);
	--popover-foreground: oklch(0.24 0.012 270);
	--primary: oklch(0.65 0.155 55);
	--primary-foreground: oklch(0.2 0.035 50);
	--secondary: oklch(0.96 0.003 270);
	--secondary-foreground: oklch(0.28 0.012 270);
	--muted: oklch(0.965 0.003 270);
	--muted-foreground: oklch(0.5 0.012 270);
	--accent: oklch(0.955 0.004 270);
	--accent-foreground: oklch(0.24 0.012 270);
	--destructive: oklch(0.55 0.2 25);
	--destructive-foreground: oklch(0.99 0.003 25);
	--border: oklch(0.24 0.012 270 / 9%);
	--input: oklch(0.64 0.01 270);
	--ring: oklch(0.65 0.155 55);
	--radius: 0.375rem;
	--control-radius: calc(var(--radius) * 0.8);
	--sidebar: oklch(0.975 0.003 270);
	--sidebar-foreground: oklch(0.32 0.012 270);
	--sidebar-primary: oklch(0.65 0.155 55);
	--sidebar-primary-foreground: oklch(0.2 0.035 50);
	--sidebar-accent: oklch(0.935 0.005 270);
	--sidebar-accent-foreground: oklch(0.2 0.012 270);
	--sidebar-border: oklch(0.24 0.012 270 / 8%);
	--sidebar-ring: var(--ring);
	--chart-1: var(--primary);
	--chart-2: oklch(0.56 0.012 270);
	--chart-3: oklch(0.58 0.09 200);
	--chart-4: oklch(0.6 0.12 110);
	--chart-5: oklch(0.66 0.01 270);
	--success: oklch(0.48 0.12 150);
	--warning: oklch(0.53 0.11 75);
	--info: oklch(0.52 0.13 250);
}
```
### Dark
```css
/* Style etabli dark, accent=1 (tangerine orange). Lowest: text 5.67:1 (destructive on card), marks 3.22:1 (input on card). */
.dark {
	--background: oklch(0.19 0.012 270);
	--foreground: oklch(0.93 0.005 270);
	--card: oklch(0.21 0.012 270);
	--card-foreground: oklch(0.93 0.005 270);
	--popover: oklch(0.235 0.013 270);
	--popover-foreground: oklch(0.93 0.005 270);
	--primary: oklch(0.75 0.15 58);
	--primary-foreground: oklch(0.2 0.035 50);
	--secondary: oklch(0.25 0.012 270);
	--secondary-foreground: oklch(0.9 0.005 270);
	--muted: oklch(0.24 0.012 270);
	--muted-foreground: oklch(0.7 0.012 270);
	--accent: oklch(0.255 0.014 270);
	--accent-foreground: oklch(0.95 0.005 270);
	--destructive: oklch(0.68 0.18 25);
	--destructive-foreground: oklch(0.18 0.03 25);
	--border: oklch(0.93 0.005 270 / 8%);
	--input: oklch(0.52 0.014 270);
	--ring: oklch(0.75 0.15 58);
	--sidebar: oklch(0.175 0.012 270);
	--sidebar-foreground: oklch(0.84 0.008 270);
	--sidebar-primary: oklch(0.75 0.15 58);
	--sidebar-primary-foreground: oklch(0.2 0.035 50);
	--sidebar-accent: oklch(0.245 0.014 270);
	--sidebar-accent-foreground: oklch(0.95 0.005 270);
	--sidebar-border: oklch(0.93 0.005 270 / 7%);
	--sidebar-ring: var(--ring);
	--chart-1: var(--primary);
	--chart-2: oklch(0.62 0.012 270);
	--chart-3: oklch(0.72 0.09 200);
	--chart-4: oklch(0.74 0.12 110);
	--chart-5: oklch(0.54 0.01 270);
	--success: oklch(0.76 0.13 152);
	--warning: oklch(0.8 0.13 78);
	--info: oklch(0.74 0.11 250);
}
```

## Accents
Set the row of each mode in its block. `--sidebar-ring: var(--ring)` and `--chart-1: var(--primary)` follow it: the accent draws the main line.

| Accent | Name | Mode | `--primary` | `--primary-foreground` | `--ring` | `--sidebar-primary` | `--sidebar-primary-foreground` |
|---|---|---|---|---|---|---|---|
| accent=1 | tangerine orange | light | `oklch(0.65 0.155 55)` | `oklch(0.2 0.035 50)` | `oklch(0.65 0.155 55)` | `oklch(0.65 0.155 55)` | `oklch(0.2 0.035 50)` |
| accent=1 | tangerine orange | dark | `oklch(0.75 0.15 58)` | `oklch(0.2 0.035 50)` | `oklch(0.75 0.15 58)` | `oklch(0.75 0.15 58)` | `oklch(0.2 0.035 50)` |
| accent=2 | deep indigo | light | `oklch(0.5 0.17 278)` | `oklch(0.99 0.003 278)` | `oklch(0.5 0.17 278)` | `oklch(0.5 0.17 278)` | `oklch(0.99 0.003 278)` |
| accent=2 | deep indigo | dark | `oklch(0.7 0.13 278)` | `oklch(0.18 0.03 278)` | `oklch(0.7 0.13 278)` | `oklch(0.7 0.13 278)` | `oklch(0.18 0.03 278)` |
| accent=3 | vivid rose | light | `oklch(0.54 0.19 350)` | `oklch(0.99 0.003 350)` | `oklch(0.54 0.19 350)` | `oklch(0.54 0.19 350)` | `oklch(0.99 0.003 350)` |
| accent=3 | vivid rose | dark | `oklch(0.72 0.15 350)` | `oklch(0.18 0.03 350)` | `oklch(0.72 0.15 350)` | `oklch(0.72 0.15 350)` | `oklch(0.18 0.03 350)` |

## Knobs
```css
/* Knobs of the style etabli: no card box and no shadow, plain labels, mono figures, thin lines. */
:root {
	--surface-border-width: 0px;
	--surface-shadow: 0 0 #0000;
	--surface-radius: calc(var(--radius) * 1.333);
	--heading-weight: 600;
	--heading-tracking: -0.015em;
	--heading-case: none;
	--title-weight: 500;
	--title-case: none;
	--title-tracking: -0.005em;
	--label-weight: 500;
	--label-case: none;
	--label-tracking: 0em;
	--numeral-font: var(--font-mono);
	--icon-stroke: 1.75;
	--chart-stroke: 1.5;
	--chart-fill-opacity: 0;
	--chart-grid-dash: none;
	--table-stripe: transparent;
	--table-head-bg: color-mix(in oklch, var(--muted) 70%, transparent);
	--nav-active-bg: var(--sidebar-accent);
	--nav-indicator-width: 0px;
}
```

## Anatomy
- **Page header.** `PageHeader`. Its `actions` hold the command bar (Signature). The description gives the scope.
- **Panels.** No outline card: the knobs remove the border and the shadow. A panel is a group section on the ground:
  - `<section className="grid content-start">`. Page grid `grid gap-x-6 gap-y-8` with the spans of the home file.
  - Header band: `flex h-9 items-center gap-2 rounded-md bg-muted/60 px-3`, with the group name and its inline counter.
  - Rows under it: `flex h-9 items-center gap-3 border-b px-3 transition-colors hover:bg-muted/40`, each with a status circle and a mono id.
    `--border` is the ink at 9% alpha, so each row rule is a hairline. A chart sits under its band with `pt-3`.
- **Panel title.** `<h2 className="font-medium text-sm">` in the band, then the count `font-numeric text-muted-foreground text-xs tabular-nums`.
- **KPI.** No tile. Each figure is an inline counter in a header band.
  - number: the count after the group name. delta: a signed change after it, `text-xs text-success`, in `<bdi dir="ltr">`.
  - icon: the status circle. spark: a mini line `h-6 w-16` at the band end. meter: a `started` circle; its pie shows the share (0 to 1).
  - strip: the strip of `kpis/strip.md` on the ground above the groups. Rules 1 px in `border-border`.
- **Charts.** Small and inline. One main line per page at most: `h-56`, `type="linear"`, `dot={false}`, no fill.
  Side `h-44`, mini `h-6` to `h-10`. `<CartesianGrid vertical={false} />`. Axes `tickLine={false} axisLine={false}`.
  Ticks stay in the body sans: `ChartContainer className="text-[0.6875rem]"`. Mono is only for ids, counts, and key hints.
  bars: `maxBarSize={10}`, `radius={2}`. area: the line only (fill 0). compare: the previous period in chart-2 grey, `strokeDasharray="2 3"`.
  stacked: chart-1, 3, 4. heat: cells `size-[12px] rounded-[2px]`, gap `gap-[3px]`. 90 days take 207 px at every density.
- **Tables.** `DataTable` grouped by status. Above each group: `<TableRow className="bg-muted/60 hover:bg-muted/60">` with the
  circle, the word, and the count. Rows `h-9`. First cell: the circle and the id `font-mono text-muted-foreground text-xs`. Meta at the end.
- **Navigation.** Sections: one `SidebarGroup` each, a `SidebarGroupLabel` in sentence case. Counts in
  `SidebarMenuBadge className="font-mono"`, only above 0. Active item: subtle fill (knob). Brand mark: `rounded-md`.
- **Badges and status.** Status: the circle plus the word, never a pill. A label: `Badge variant="outline"` with a `size-1.5 rounded-full bg-chart-3` dot.
- **Buttons and inputs.** `size="sm"` in bars and headers. The main action is the only `default` button. A key hint
  sits inside a button and keeps its text color: `<kbd className="ms-1 rounded-[0.25rem] border border-current/30 px-1 font-mono text-[0.6875rem]">`.
- **Links.** `text-foreground underline decoration-ring underline-offset-4`: tangerine text is only 3.4:1 on the card.
  In `button.tsx`, the `link` variant `text-primary underline-offset-4 hover:underline` becomes this string.
- **Motion.** `transition-colors duration-100` on rows and nav items. Nothing moves on its own.

## Signature
1. **The status circle.** The shape shows the state. Map each status of the main entity (a ticket, a deal) to one shape.
```tsx
import { cn } from "~/shared/lib/utils";

/** Shape of a workflow step. A page maps each business status to one of these. */
type CircleState = "planned" | "open" | "started" | "done" | "dropped";
const CIRCLE_LOOK = {
	planned: "border-[1.5px] border-muted-foreground border-dashed",
	open: "border-[1.5px] border-muted-foreground",
	started: "border-[1.5px] border-warning bg-clip-content p-[2px] text-warning",
	done: "bg-success",
	dropped: "bg-muted-foreground/50",
} satisfies Record<CircleState, string>;
type StatusCircleProps = {
	state: CircleState;
	/** Done part of a started item or a group, 0 to 1. No value draws an empty pie. */
	share?: number;
};
/** Rows, header bands, and the meter use it. aria-hidden: the word beside it gives the meaning. */
export function StatusCircle({ state, share = 0 }: StatusCircleProps) {
	// Clamp to 0 to 1, then turn the share into degrees. A whole of 0 gives NaN, so an empty pie.
	const done = Number.isFinite(share) ? Math.min(Math.max(share, 0), 1) : 0;
	const pie = `conic-gradient(currentColor ${done * 360}deg, transparent 0deg)`;
	return (
		<span
			aria-hidden="true"
			className={cn("inline-block size-3.5 rounded-full", CIRCLE_LOOK[state])}
			// Only a started item has a done part, so only the started shape draws the pie.
			style={{ backgroundImage: state === "started" ? pie : undefined }}
		/>
	);
}
```

2. **The command bar.** One bar holds the header actions: `flex items-center gap-1 rounded-control border bg-card p-1`.
   It holds the main action with its key hint (`kbd` above), and the view tabs when two views exist. Bind the hint
   to the main action of the business ("New ticket", "Add candidate"). Show a hint only for a bound key: one `keydown` listener on `document`, in an effect marked `// effect: listens to the keyboard`.
   The listener skips a key typed in a field (`input`, `textarea`, `select`, `[contenteditable]`) or held with a modifier.

## Empty state
- Every header band stays, with `0`. Each group shows one empty slot with a muted sentence:
  `h-9 rounded-md border border-dashed px-4 text-muted-foreground text-sm`.
- The main line keeps its axes and draws a flat line at 0. Inline counters show `0`, never a dash. Sidebar badges hide at 0.
- Setup strip, under the page header: `flex flex-wrap items-center gap-2 rounded-surface border border-dashed px-3 py-2`.
  It holds 2 to 4 `Button size="sm" variant="outline"`. A button shows its key hint when the page binds one.

## Do not
- A row of KPI tiles. Put the counts in the header bands and the strip.
- Outline cards, thick borders, or shadows. Use a header band and low-alpha hairline rows on the ground.
- Colored pills for every status. Use the status circle and the word.
- A key hint with no binding. Bind the key in the command bar listener, or drop the hint.

## Check
- Is there no KPI tile row on the home?
- Does the main list group its rows by status, with a circle and a mono id per row?
- Is each panel a header band and hairline rows on the ground, with no outline card and no shadow?
- Does the sidebar show sections and real counts?
- Is the accent only on the main action, the active state, and the main line?
