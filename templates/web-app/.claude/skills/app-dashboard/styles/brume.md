# Style brume
A pale room at dawn: pearl light, soft fields of tone, and the day told in one serif sentence.
Mode: light only. Fits: wellness, beauty, therapy, coaching, hospitality, HR, education. Avoid: industry, dev tools, logistics, security.
Radius 1.5rem. Controls: pill. Shell: floating (fixed). Density: comfortable (fixed).

## Identity
- The home opens with one serif sentence that gives the day with its real figures. Plain figures follow, with no boxes.
- The ground is a lavender pearl (L 0.955), never cream. Every field is lighter than the ground (L 0.985 or 0.97).
- Fields have no border line. Tone sets them apart, and a wide soft shadow, tinted with the accent, sits under the pearl field.
- The serif display is the brief's choice. Cool pearl and lavender, sage, or apricot keep it away from cream and terracotta.
- Not the SaaS-card kit: three surfaces differ by role (bare ground, pearl field, mist field). The KPI row has no cards.
  Only the summary sentence is large. The rest uses small sizes and slow color changes.

## Fonts
Use the section of the recipe. Apply it in this order:
1. `head().links` of `src/routes/__root.tsx`: keep `tokensCss` first. Remove every other font entry (comment, `preconnect`, stylesheets).
2. Add `{ rel: "stylesheet", href: "<the link>" }` under the comment `// Fonts of the style brume (Google Fonts): the Latin faces and their Arabic twins.`
3. `tokens.css`: replace the comment above `@theme`, the `@theme` font block, `html:lang(ar)`, and an old `font-synthesis-weight` rule with the CSS block.
4. Replace the font note of the `tokens.css` header comment (it starts with `Font pairing` or `Fonts of the`) with the Note line.

### fonts=1
Link: `https://fonts.googleapis.com/css2?family=Instrument+Serif&family=Instrument+Sans:wght@400;500;600&family=Markazi+Text:wght@400;600&family=Mada:wght@400;500;600&display=swap`
Roles: display Instrument Serif 400 (greeting, summary, panel titles). Body Instrument Sans 400, 500, 600. Numerals Instrument Serif.
Arabic: display Markazi Text 400, 600. Body Mada 400, 500, 600.
Note: `Fonts of the style brume: Instrument Serif + Instrument Sans, Arabic twins Markazi Text + Mada (Google Fonts), loaded in __root.tsx.`
```css
/* Not inside @theme inline: utilities must emit var(--font-*) so the
   :lang(ar) scope below can swap the Latin stacks for the Arabic twins. */
@theme {
	--font-sans: "Instrument Sans", ui-sans-serif, system-ui, sans-serif;
	--font-display: "Instrument Serif", ui-serif, Georgia, serif;
}
html:lang(ar) {
	--font-sans: "Mada", ui-sans-serif, system-ui, sans-serif;
	--font-display: "Markazi Text", "Mada", ui-serif, Georgia, serif;
}
/* Instrument Serif has one weight, 400. A heavier weight class must not draw a false bold. */
:is(h1, h2, h3, h4, .font-display, .font-numeric) {
	font-synthesis-weight: none;
}
```

### fonts=2
Link: `https://fonts.googleapis.com/css2?family=Cormorant:wght@500;600&family=Figtree:wght@400;500;600&family=Amiri:wght@400;700&family=Tajawal:wght@400;500;700&display=swap`
Roles: display Cormorant 500, 600 (greeting, summary, panel titles). Body Figtree 400, 500, 600. Numerals Cormorant 500.
Arabic: display Amiri 400, 700. Body Tajawal 400, 500, 700.
Note: `Fonts of the style brume: Cormorant + Figtree, Arabic twins Amiri + Tajawal (Google Fonts), loaded in __root.tsx.`
Cormorant has real weights, so this section has no `font-synthesis-weight` rule. Set `--heading-weight` and `--title-weight` to `500`.
```css
/* Not inside @theme inline: utilities must emit var(--font-*) so the
   :lang(ar) scope below can swap the Latin stacks for the Arabic twins. */
@theme {
	--font-sans: "Figtree", ui-sans-serif, system-ui, sans-serif;
	--font-display: "Cormorant", ui-serif, Georgia, serif;
}
html:lang(ar) {
	--font-sans: "Tajawal", ui-sans-serif, system-ui, sans-serif;
	--font-display: "Amiri", "Tajawal", ui-serif, Georgia, serif;
}
```

## Palette
Light only. Replace the `:root` block of the palette part of `src/styles/tokens.css` with this block. Keep the unused `.dark` block.
Apply `### mode=light` of `frame.md`: remove the `dark` class from `<html>` when an earlier build added it.
### Light
```css
/* brume, accents 1-3. Lowest text ratio 4.58:1 (warning on its badge tint on the ground). Lowest graphic ratio 3.34:1 (input on background). */
:root {
	--background: oklch(0.955 0.014 300);
	--foreground: oklch(0.28 0.03 295);
	--card: oklch(0.985 0.005 300);
	--card-foreground: oklch(0.28 0.03 295);
	--popover: oklch(0.99 0.004 300);
	--popover-foreground: oklch(0.28 0.03 295);
	--primary: oklch(0.5 0.11 295);
	--primary-foreground: oklch(0.985 0.006 295);
	--secondary: oklch(0.97 0.014 300);
	--secondary-foreground: oklch(0.3 0.035 295);
	--muted: oklch(0.935 0.016 300);
	--muted-foreground: oklch(0.49 0.025 295);
	--accent: oklch(0.932 0.022 295);
	--accent-foreground: oklch(0.27 0.045 295);
	--destructive: oklch(0.5 0.17 15);
	--destructive-foreground: oklch(0.985 0.006 15);
	--border: oklch(0.945 0.012 300);
	--input: oklch(0.61 0.025 295);
	--ring: oklch(0.5 0.11 295);
	--radius: 1.5rem;
	--control-radius: 9999px;
	--sidebar: oklch(0.985 0.005 300);
	--sidebar-foreground: oklch(0.34 0.03 295);
	--sidebar-primary: oklch(0.5 0.11 295);
	--sidebar-primary-foreground: oklch(0.985 0.006 295);
	--sidebar-accent: oklch(0.95 0.016 295);
	--sidebar-accent-foreground: oklch(0.27 0.045 295);
	--sidebar-border: oklch(0.985 0.005 300);
	--sidebar-ring: var(--ring);
	/* chart-1 follows the accent. The others are soft hues away from all three accents. */
	--chart-1: var(--primary);
	--chart-2: oklch(0.6 0.06 230);
	--chart-3: oklch(0.6 0.08 355);
	--chart-4: oklch(0.62 0.07 110);
	--chart-5: oklch(0.62 0.015 300);
	--success: oklch(0.48 0.1 155);
	--warning: oklch(0.5 0.11 65);
	--info: oklch(0.49 0.1 245);
}
```

## Accents
The palette block holds accent=1. For accent=2 or 3, replace these five tokens in `:root`.
`--chart-1` and `--sidebar-ring` follow through `var()`. Every accent passes 4.5:1 as text on the ground, the pearl field, and the mist field.
Lowest accent ratio: 5.02:1 (accent=3 as text on the ground). Lowest meter ratio: 4.72:1 (accent=3 arc on the `--muted` track).

| accent | name | `--primary` | `--primary-foreground` | `--ring` | `--sidebar-primary` | `--sidebar-primary-foreground` |
|---|---|---|---|---|---|---|
| accent=1 | deep lavender | `oklch(0.5 0.11 295)` | `oklch(0.985 0.006 295)` | `oklch(0.5 0.11 295)` | `oklch(0.5 0.11 295)` | `oklch(0.985 0.006 295)` |
| accent=2 | sage green | `oklch(0.48 0.07 160)` | `oklch(0.985 0.006 160)` | `oklch(0.48 0.07 160)` | `oklch(0.48 0.07 160)` | `oklch(0.985 0.006 160)` |
| accent=3 | deep apricot | `oklch(0.52 0.12 56)` | `oklch(0.985 0.008 58)` | `oklch(0.52 0.12 56)` | `oklch(0.52 0.12 56)` | `oklch(0.985 0.008 58)` |

## Knobs
Put this block after the `:root` palette block. Replace an earlier `/* Style knobs of ... */` block.
```css
/* Style knobs of brume: borderless fields, a wide soft shadow, serif titles, soft charts. */
:root {
	--surface-border-width: 0px;
	--surface-shadow: 0 1px 2px color-mix(in oklch, var(--foreground) 4%, transparent), 0 28px 56px -32px color-mix(in oklch, var(--primary) 30%, transparent);
	--surface-radius: var(--radius);
	--heading-weight: 400;
	--heading-tracking: -0.01em;
	--heading-case: none;
	--title-weight: 400;
	--title-case: none;
	--title-tracking: 0em;
	--label-weight: 500;
	--label-case: none;
	--label-tracking: 0em;
	--numeral-font: var(--font-display);
	--icon-stroke: 1.5;
	--chart-stroke: 2;
	--chart-fill-opacity: 0.16;
	--chart-grid-dash: none;
	--table-stripe: transparent;
	--table-head-bg: transparent;
	--nav-active-bg: color-mix(in oklch, var(--sidebar-primary) 14%, var(--sidebar));
	--nav-indicator-width: 0px;
}
```

## Anatomy
- **Frame.** Apply `### shell=floating` and `### density=comfortable` of `frame.md`, whatever the recipe says.
- **Page header.** In `page-header.tsx`, the h1 size `text-2xl` becomes `text-3xl @3xl/main:text-4xl`. The home h1 greets by the local hour.
- **Panels.** Three surfaces, chosen by role. Never put two pearl fields of the same size side by side for no reason.
  - Bare ground: the summary line, the figures, and short lists. A `<section className="grid gap-4">` with a serif h2.
  - Pearl field: charts and tables. `<Card className="gap-5 py-7">`, with `className="px-7"` on its header and content.
  - Mist field: one per home, for the soft ring or the next items. `<Card className="gap-5 bg-secondary py-7 shadow-none">`.
  - Page grid: `grid gap-10`, then `grid @4xl/main:grid-cols-[minmax(0,1fr)_20rem] grid-cols-1 gap-8` for main and side.
- **Panel title.** `CardTitle className="font-display text-xl leading-snug"`. One muted sentence under it, in sentence case. No eyebrow.
- **KPI.** The summary line carries the main figures. The kpi form of the recipe draws the plain figures under it.
  - Row: `flex flex-wrap gap-x-12 gap-y-6`. No box, no divider.
  - number: figure `font-numeric text-5xl lining-nums tabular-nums leading-none`, label under it `mt-2 text-muted-foreground text-sm`.
  - icon: a chip before the label, `grid size-10 place-items-center rounded-full bg-secondary text-secondary-foreground [&_svg]:size-5`.
  - delta: under the figure, `inline-flex items-center gap-1 text-sm text-success` (or `text-destructive`), arrow `size-3.5 rtl:-scale-x-100`.
  - spark: a smooth line beside the figure, `ChartContainer className="aspect-auto h-10 w-28"`, no axis, no fill.
  - meter: the soft ring of the Signature, in the mist field.
  - strip: one pearl field. Rules in `--background`, 2 px: the ground shows between the cells, with no drawn line.
- **Charts.** Smooth `type="natural"` curves. Pass `fill="var(--color-<key>)"`; the knob sets the low fill.
  - No `CartesianGrid`. X axis `tickLine={false} axisLine={false} tickMargin={10}`. Y axis on the main chart only, `tickCount={3}`.
    Heights: main `aspect-auto @3xl/main:h-72 h-64`, side `aspect-auto h-44`, spark `h-10`.
  - The earlier period is a thin line in `var(--chart-5)` with `strokeDasharray="4 6"`. Bars are pills: `radius={999}`, `barSize={12}`.
  - chart=heat: round cells `size-[14px] rounded-full` with `gap-[4px]`, in a pearl field. 90 days take 248 px.
- **Tables.** Airy rows with no rules. `TableRow className="border-0 hover:bg-accent/60"`, `TableHead className="h-11 text-muted-foreground"`,
  `TableCell className="py-3.5"`. Numbers `text-end tabular-nums` in the body face. Serif figures only from `text-2xl` up.
- **Navigation.** The floating sidebar is a pearl field with no border line: `--sidebar-border` equals `--sidebar`. Each `SidebarMenuButton` gets `className="rounded-full"`; the knob tints the active one.
  Brand mark: `flex aspect-square size-8 items-center justify-center rounded-full bg-sidebar-primary font-display text-lg text-sidebar-primary-foreground`.
- **Badges, buttons, inputs.** A status is a `Badge` with its variant and `className="border-transparent"`, plus a word.
  Pill buttons: one `default` per screen, the rest `secondary` or `ghost`. Inputs `h-10 rounded-2xl bg-card`.
- **Motion.** Hover tints `transition-colors duration-300`. The ring arc eases in 700 ms when its value changes. No entrance motion.

## Signature
**1. The summary line.** One serif sentence at the top of the home, with the real figures inline in the ink, not the accent.
Bind it to the day of this business. Salon: "Today: {booked} bookings, {open} to confirm". Coach: "{sessions} sessions this week".
```tsx
// The summary line of the brume home: one serif sentence with the figures of the day inline.
// The home passes a message with {name} slots and the figures, already formatted with Intl.
import type { ReactNode } from "react";

type SummaryLineProps = {
	/** Translated sentence with slots, for example "Today: {booked} bookings, {open} to confirm." */
	message: string;
	/** Formatted figure per slot name, for example { booked: "12", open: "3" }. */
	figures: Record<string, string>;
};
/** A slot without a figure keeps its {name} text, so a gap shows in review. */
export function SummaryLine({ message, figures }: SummaryLineProps) {
	const parts: ReactNode[] = [];
	let cursor = 0;
	for (const slot of message.matchAll(/\{(\w+)\}/g)) {
		const figure = figures[slot[1] ?? ""] ?? slot[0];
		parts.push(message.slice(cursor, slot.index), <bdi key={slot.index} className="font-numeric lining-nums tabular-nums">{figure}</bdi>);
		cursor = slot.index + slot[0].length;
	}
	parts.push(message.slice(cursor));
	return <p className="max-w-[34ch] text-pretty font-display @3xl/main:text-4xl text-3xl leading-tight">{parts}</p>;
}
```

**2. The soft ring.** A part of a whole that the data has, in the mist field. Bind it to booked slots of all slots today, sessions done of sessions planned, or rooms ready of all rooms.
```tsx
// Soft progress ring of the brume style: a part of a whole, as a percent in a ring.
// The kpi=meter form and the mist field render it. It reads the locale from useT.
import { useT } from "~/shared/i18n";

type SoftRingProps = {
	/** The part, for example 18 booked slots. */
	value: number;
	/** The whole, for example 24 slots. A whole of 0 shows an empty ring with no percent, hidden from screen readers. */
	total: number;
	/** Translated words after the percent, for example "of today's slots booked". */
	label: string;
};
/** A 9rem ring. The arc starts at the top and turns clockwise in every language: it does not mirror in Arabic. */
export function SoftRing({ value, total, label }: SoftRingProps) {
	const { locale } = useT();
	// Only the arc clamps to 0..1. The text keeps the real ratio; under the whole it stops at 99.9 %, never a rounded 100 %.
	const arc = total > 0 ? Math.min(Math.max(value / total, 0), 1) : 0;
	const percent = total > 0 ? new Intl.NumberFormat(locale, { style: "percent", maximumFractionDigits: 1 }).format(value < total ? Math.min(value / total, 0.999) : value / total) : null;
	return (
		<div role="img" aria-label={percent === null ? undefined : `${percent} ${label}`} aria-hidden={percent === null} className="relative grid size-36 place-items-center">
			{/* r 52 plus half of the 10 stroke fits the 120 box. pathLength 100 makes the dash a percent. A round cap on a 0 dash draws a dot, so 0 draws no arc. */}
			<svg viewBox="0 0 120 120" aria-hidden="true" className="absolute inset-0 -rotate-90">
				<circle cx="60" cy="60" r="52" pathLength={100} strokeWidth={10} className="fill-none stroke-muted" />
				{arc > 0 ? <circle cx="60" cy="60" r="52" pathLength={100} strokeWidth={10} strokeLinecap="round" strokeDasharray={`${arc * 100} 100`} className="fill-none stroke-primary transition-[stroke-dasharray] duration-700 ease-out motion-reduce:transition-none" /> : null}
			</svg>
			{percent === null ? null : <span className="font-numeric text-3xl tabular-nums">{percent}</span>}
		</div>
	);
}
```

## Empty state
- The summary line stays and says the zeros: "Today: 0 bookings, 0 to confirm." Never hide it.
- The plain figures show `0` at full size, with no delta. The soft ring shows its empty track, with no percent when its whole is 0.
- The chart field keeps its height. It draws the X axis and a flat line at 0, with one muted serif sentence above it.
- The table field keeps its header row, then one sentence and its action in `grid min-h-44 place-items-center text-center font-display text-lg text-muted-foreground`.
- The setup strip sits between the summary line and the figures: `flex flex-wrap items-center gap-2 rounded-full bg-secondary p-2 ps-5`.
  One sentence in `me-auto text-secondary-foreground text-sm`, then 2 to 4 pill buttons with real first actions ("Add a service").

## Do not
- Four equal white cards with a grey shadow in a row. Instead: the summary sentence and plain figures on the bare ground.
- A 1 px border around a field. Instead: the tone of the field and the soft shadow.
- Grid lines, axis lines, or a Y axis on a side chart. Instead: a smooth curve with a low fill.
- A bold or faux-bold serif. Instead: Instrument Serif at 400; size makes the hierarchy.
- Rules between table rows. Instead: airy rows and a hover tint.

## Check
- Does the home open with a serif sentence that holds the real figures of the day, in the ink?
- Do the panels have no border lines, and do they differ in tone (bare ground, pearl field, mist field)?
- Is the ground a lavender pearl, darker than the fields on it, and not cream?
- Is the sidebar a floating field with a round tinted active item? Do the charts have no grid lines?
