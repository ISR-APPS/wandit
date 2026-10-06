# Style tampon
A sticker board: white stickers with thick ink outlines and hard shadows on a pale pink board, flat bright fills, rubber stamps.
Mode: light only. Fits: creators, shops, marketing, events, startups, studios, delivery. Avoid: clinic, legal, funeral, banking.
Radius 0.625rem. Controls: matched. Shell: bordered (fixed). Density: recipe.

## Identity

- Each panel is a white sticker on a pale pink board. It has a 2 px ink outline and a hard shadow.
- Each KPI is a sticker of its own flat color. The colors come from a set of four, never from gradients.
- Type is heavy and plain: a black grotesk for headings, weight 800 for figures.
- A button moves down 2 px when pressed. A status is a rubber stamp, tilted by 2 degrees.
- The ink is a violet black at L 0.21, not #0B0B0B. The board is a pink off-white (#FEF3FA), not cream: the white stickers stand out on it.

## Fonts

Apply the link and the blocks of your `fonts=<n>` as SKILL.md, step 4 says.
Figures use `font-numeric font-extrabold tabular-nums`. The knob points `font-numeric` at the body family.

### fonts=1

Display: Archivo Black (one weight). Body and numerals: Archivo (numerals 800). Arabic twins: Lalezar (display), Vazirmatn (body).
Font note: `Fonts of the style tampon (fonts=1): Archivo Black + Archivo, Arabic twins Lalezar + Vazirmatn (Google Fonts), loaded in __root.tsx.`

Link: `https://fonts.googleapis.com/css2?family=Archivo+Black&family=Archivo:wght@400;500;700;800&family=Lalezar&family=Vazirmatn:wght@400;500;700;800&display=swap`

```css
/* Not inside @theme inline: utilities must emit var(--font-*) so the
   :lang(ar) scope below can swap the Latin stacks for the Arabic twins. */
@theme {
	--font-sans: "Archivo", ui-sans-serif, system-ui, sans-serif;
	--font-display: "Archivo Black", "Archivo", ui-sans-serif, system-ui, sans-serif;
}

html:lang(ar) {
	--font-sans: "Vazirmatn", ui-sans-serif, system-ui, sans-serif;
	--font-display: "Lalezar", "Vazirmatn", ui-sans-serif, system-ui, sans-serif;
}

/* Archivo Black and Lalezar have one weight. A heavier weight class must not draw a false bold. */
:is(h1, h2, h3, h4, .font-display) {
	font-synthesis-weight: none;
}
```

### fonts=2

Display, body, and numerals: Bricolage Grotesque (headings and figures 800). Arabic twins: Baloo Bhaijaan 2 (display), Readex Pro (body).
Font note: `Fonts of the style tampon (fonts=2): Bricolage Grotesque, Arabic twins Baloo Bhaijaan 2 + Readex Pro (Google Fonts), loaded in __root.tsx.`

Link: `https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,400;12..96,500;12..96,700;12..96,800&family=Baloo+Bhaijaan+2:wght@700;800&family=Readex+Pro:wght@400;500;700&display=swap`

```css
/* Not inside @theme inline: utilities must emit var(--font-*) so the
   :lang(ar) scope below can swap the Latin stacks for the Arabic twins. */
@theme {
	--font-sans: "Bricolage Grotesque", ui-sans-serif, system-ui, sans-serif;
	--font-display: "Bricolage Grotesque", ui-sans-serif, system-ui, sans-serif;
}

html:lang(ar) {
	--font-sans: "Readex Pro", ui-sans-serif, system-ui, sans-serif;
	--font-display: "Baloo Bhaijaan 2", "Readex Pro", ui-sans-serif, system-ui, sans-serif;
}
```

## Palette

### Light

Board L 0.975 (hue 340, pale pink) for every accent, stickers pure white, ink L 0.21. `--border` and `--input` are the ink.
`--chart-1` to `--chart-5` are the flat sticker fills. They do not follow the accent: a fill holds ink text, an accent holds white text.
Each fill holds ink text at 4.5:1 or more.
A fill never stands alone: an ink outline of 2 px gives every mark its edge.

```css
/* Lowest contrast, computed for accents 1-3: text 5.26:1 (white on the hot pink primary), ring 4.87:1 (hot pink on the board), ink on a fill 8.97:1. */
:root {
	--background: oklch(0.975 0.014 340);
	--foreground: oklch(0.21 0.03 275);
	--card: oklch(1 0 0);
	--card-foreground: oklch(0.21 0.03 275);
	--popover: oklch(1 0 0);
	--popover-foreground: oklch(0.21 0.03 275);
	--primary: oklch(0.56 0.22 358);
	--primary-foreground: oklch(1 0 0);
	--secondary: oklch(0.95 0.014 340);
	--secondary-foreground: oklch(0.21 0.03 275);
	--muted: oklch(0.945 0.016 340);
	--muted-foreground: oklch(0.45 0.03 275);
	--accent: oklch(0.94 0.02 300);
	--accent-foreground: oklch(0.21 0.03 275);
	--destructive: oklch(0.54 0.21 28);
	--destructive-foreground: oklch(1 0 0);
	--border: oklch(0.21 0.03 275);
	--input: oklch(0.21 0.03 275);
	--ring: oklch(0.56 0.22 358);
	--radius: 0.625rem;
	--control-radius: var(--radius);
	--sidebar: oklch(0.975 0.014 340);
	--sidebar-foreground: oklch(0.21 0.03 275);
	--sidebar-primary: oklch(0.56 0.22 358);
	--sidebar-primary-foreground: oklch(1 0 0);
	--sidebar-accent: oklch(1 0 0);
	--sidebar-accent-foreground: oklch(0.21 0.03 275);
	--sidebar-border: oklch(0.21 0.03 275);
	--sidebar-ring: var(--ring);
	--success: oklch(0.5 0.13 150);
	--warning: oklch(0.53 0.12 60);
	--info: oklch(0.5 0.14 255);
	--chart-1: oklch(0.8 0.13 355);
	--chart-2: oklch(0.78 0.12 245);
	--chart-3: oklch(0.91 0.16 112);
	--chart-4: oklch(0.81 0.13 65);
	--chart-5: oklch(0.8 0.1 300);
}
```

## Accents

Each row replaces five tokens of the Light block. `--sidebar-ring` reads `--ring` through `var()`.
Every primary fill sits inside a 2 px ink outline. The outline, not the fill, meets 3:1 on the board.

| accent | name | mode | `--primary` | `--primary-foreground` | `--ring` | `--sidebar-primary` | `--sidebar-primary-foreground` |
|---|---|---|---|---|---|---|---|
| accent=1 | hot pink | light | `oklch(0.56 0.22 358)` | `oklch(1 0 0)` | `oklch(0.56 0.22 358)` | `oklch(0.56 0.22 358)` | `oklch(1 0 0)` |
| accent=2 | electric blue | light | `oklch(0.52 0.22 265)` | `oklch(1 0 0)` | `oklch(0.52 0.22 265)` | `oklch(0.52 0.22 265)` | `oklch(1 0 0)` |
| accent=3 | lime yellow | light | `oklch(0.91 0.18 115)` | `oklch(0.21 0.03 275)` | `oklch(0.21 0.03 275)` | `oklch(0.91 0.18 115)` | `oklch(0.21 0.03 275)` |

With accent=3, the ring is the ink: lime has no contrast on the board.

## Knobs

```css
:root {
	--surface-border-width: 2px;
	/* The sticker shadow: hard, no blur, in the ink. */
	--surface-shadow: 4px 4px 0 0 var(--foreground);
	--surface-radius: var(--radius);
	/* 800 for both font sets. Archivo Black has one face, and the synthesis rule keeps it true. */
	--heading-weight: 800;
	--heading-tracking: -0.02em;
	--heading-case: none;
	--title-weight: 800;
	--title-case: none;
	--title-tracking: -0.01em;
	--label-weight: 700;
	--label-case: none;
	--label-tracking: 0em;
	--numeral-font: var(--font-sans);
	--icon-stroke: 2.5;
	--chart-stroke: 3;
	/* Flat fills. The ink line on top gives the edge. */
	--chart-fill-opacity: 1;
	--chart-grid-dash: none;
	--table-stripe: transparent;
	--table-head-bg: var(--muted);
	--nav-active-bg: var(--sidebar-accent);
	--nav-indicator-width: 0px;
}
```

## Anatomy

- Page header: the kit `PageHeader`, h1 `text-3xl`. The main action is a pressed button (Signature 2).
- Panel: a sticker, the `Card` of the knobs. The home grid uses `gap-5`, so each hard shadow has room.
- Panel title: `CardTitle` with `text-base`. No caps, no eyebrow.
- KPI: a sticker of its own fill. Give the tiles `bg-chart-1`, `bg-chart-2`, `bg-chart-3`, `bg-chart-4`, in order.
  The text stays ink. The label: `font-bold text-sm`. The value: `font-numeric text-5xl font-extrabold leading-none tabular-nums`.
  - number, strip: the change line under the value, `text-sm font-bold`. strip: one white sticker, rules 2 px in `border-foreground`, each cell its fill.
  - icon: the icon in a white circle, `size-9 rounded-full border-2 bg-card`, at the end of the label row.
  - delta: the change on a small white sticker: `rounded-control border-2 bg-card px-2 text-sm font-bold`.
  - spark: a 3 px ink line `h-10` across the bottom of the tile, no fill.
  - meter: a chunky bar `<Progress className="h-4 border-2 border-foreground bg-card" />`. In `progress.tsx`, the indicator becomes `bg-foreground`: 17.8:1 on the white track for every accent.
- Charts: no grid. Stroke and fill come from the knobs. Axes: `axisLine={{ stroke: "var(--foreground)", strokeWidth: 2 }} tickLine={false}`.
  - area: a flat `--chart-1` fill with a 3 px ink line on top (`stroke="var(--foreground)"`).
  - bars: fills from the set, `stroke="var(--foreground)" strokeWidth={2}`, `radius={[6, 6, 0, 0]}`.
  - compare: this period ink solid, the previous period ink dashed (`strokeDasharray="6 4"`).
  - stacked and donut: fills from the set, each part outlined in ink (`stroke="var(--foreground)" strokeWidth={2}`).
  - heat: cells `size-[15px] rounded-[3px]` with a 1 px ink outline, gap `gap-[3px]`. 90 days take 249 px inside the 2 px border.
  - The tooltip is a small sticker: `ChartTooltipContent className="border-2 border-foreground shadow-[2px_2px_0_0_var(--foreground)]"`.
  - Heights: main `h-64`, side `h-48`, KPI line `h-10`.
- Tables: inside a sticker. `TableHeader` gets `[&_tr]:border-b-2 [&_tr]:border-foreground`. Body rows get `border-foreground/15`.
  Numbers at the end in `font-numeric font-bold tabular-nums`. The status column holds stamps (Signature 1).
- Navigation: shell=bordered. In `app-sidebar.tsx`, `<Sidebar className="group-data-[side=start]:border-e-2">`.
  Nav rows get `border-2 border-transparent data-[active=true]:border-sidebar-border data-[active=true]:shadow-[2px_2px_0_0_var(--sidebar-border)]`.
  The knob fills the active row white. The brand mark: `-rotate-3 rounded-md border-2 border-sidebar-border bg-sidebar-primary font-display text-sidebar-primary-foreground`.
- Badges and status: no tint badges (`bg-success/12` or any other tint). A status is a stamp (Signature 1).
  Any other label is an ink-outlined chip: `<Badge variant="outline" className="border-2 border-foreground bg-card font-bold">`.
- Links: `text-foreground underline decoration-ring decoration-2 underline-offset-4`. Never `text-primary` on text.
  With accent=3 the ring is the ink, so the underline is never lime on the white card.
- Inputs: in `input.tsx`, `border` becomes `border-2`, so the field has the ink outline. Motion: only the button press.

## Signature

1. The stamp: a status as a rubber stamp, tilted 2 degrees. Bind it to the states of the main entity:
   "Paid", "Shipped", "Sold out". The list page maps each status to a tone with `satisfies Record<Status, StampTone>`.

```tsx
import { cn } from "~/shared/lib/utils";

type StampTone = "success" | "warning" | "info" | "destructive";

// One static class per tone, so Tailwind finds every class.
const STAMP_TONE = {
	success: "text-success",
	warning: "text-warning",
	info: "text-info",
	destructive: "text-destructive",
} as const satisfies Record<StampTone, string>;

type StampProps = {
	/** Translated status word, for example "Shipped". */
	label: string;
	/** Tone of the status, from the map of the list page. */
	tone: StampTone;
};

/** A ring in the status ink on its own white ground, 5.4:1 or more. The tilt mirrors in Arabic. */
export function Stamp({ label, tone }: StampProps) {
	return (
		<span className={cn("inline-flex -rotate-2 rounded-control border-2 border-current bg-card px-2 py-0.5 font-extrabold text-xs rtl:rotate-2", STAMP_TONE[tone])}>
			{label}
		</span>
	);
}
```

2. The pressed button. In `src/shared/ui/button.tsx`, add to the base string:
   `border-2 border-foreground shadow-[2px_2px_0_0_var(--foreground)] transition-[translate,box-shadow] duration-100 active:translate-x-[2px] active:translate-y-[2px] active:shadow-none`.
   In the `outline` variant, `border` becomes `border-2`. `ghost` and `link` add `border-transparent shadow-none active:translate-none`.
   The shadow is physical, so the press moves on the physical axes too. Bind it to the main action of the home.
   In the `link` variant, `text-primary underline-offset-4 hover:underline` becomes the Links line:
   `text-foreground underline decoration-ring decoration-2 underline-offset-4`.
   The login page uses this variant. With accent=3, lime text on the white card is 1.3:1, so the text is ink.

## Empty state

- KPI stickers keep their fills and show a real `0` in the big figure.
- Charts keep the ink axes and draw a flat ink line on 0. Bar charts show each day as a dashed ink slot:
  `<Bar background={{ fill: "transparent", stroke: "var(--foreground)", strokeDasharray: "4 3", strokeOpacity: 0.3 }} />`.
- Tables keep the header rule and show one row with a muted sentence and the action that fills it.
- The setup strip is a lime sticker under the page header:
  `flex flex-wrap items-center gap-3 rounded-surface border-2 border-foreground bg-chart-3 p-3 shadow-surface`.
  It holds 2 to 4 pressed buttons for the first actions, for example "Add your first product".

## Do not

- Soft blurred shadows or 1 px grey borders. Use the 2 px ink outline and the hard shadow.
- Gradients, tint badges, or glass. Use flat fills from the set, stamps, and ink-outlined chips.
- A tilt on panels, buttons, or text. Only the stamp and the brand mark tilt.
- `text-primary` for text. Use ink text with a `decoration-ring` underline.
- Caps on stamps or labels. Use weight 800 for emphasis.

## Check

- Do white stickers sit on a pale pink board, each with a 2 px ink outline and a hard shadow?
- Does each KPI tile have its own flat fill, with ink text?
- Does a button move down 2 px and lose its shadow when pressed?
- Are statuses tilted stamps with a ring in their color?
- Do the charts have 3 px ink lines, ink-outlined bars, and no grid?
