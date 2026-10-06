# Style preau
A bright school playground: butter-yellow paper, chunky name cards, colored stickers on a board.
Mode: light only. Fits: schools, tutoring, kids, sports clubs, camps, pets, family services. Avoid: legal, banking, funeral.
Radius 1.25rem. Controls: pill. Shell: recipe. Density: recipe.

## Identity
- Butter-tinted paper ground (#FBF5DF, L 0.97, hue 95). Panels are warm white name cards: 2px tinted border, round corners.
- The butter is lighter and more yellow than cream. With round sans type and no serif, it is not the cream default.
- Color shows the category. Each KPI, each panel chip, and each category takes one color of a six-color set.
  This style allows a multi-hue set, so it is not a rainbow chart: one series keeps one color.
- The accent is a pair: a main color and a companion. The companion marks the sticker of today or the top item.
- Rounded type for headings, figures, and text. Icons sit in round colored chips. Empty panels show building blocks.
- Friendly, never childish: no emoji, no mascot, no confetti, no tilted stamps.

## Fonts
### fonts=1
- Roles: display Fredoka (500, 600), body Nunito (400 to 800), numerals Fredoka 600 with `tabular-nums`. Arabic: Baloo Bhaijaan 2 (400 to 700).
- Link: `https://fonts.googleapis.com/css2?family=Fredoka:wght@500;600&family=Nunito:wght@400;500;600;700;800&family=Baloo+Bhaijaan+2:wght@400;500;600;700&display=swap`
- Font note: `Fonts of the style preau (fonts=1): Fredoka + Nunito, Arabic twin Baloo Bhaijaan 2 (Google Fonts), loaded in __root.tsx.`
```css
/* Not inside @theme inline: the html:lang(ar) block below must swap these stacks. */
@theme {
	--font-sans: "Nunito", ui-sans-serif, system-ui, sans-serif;
	--font-display: "Fredoka", "Nunito", ui-sans-serif, system-ui, sans-serif;
}
html:lang(ar) {
	--font-sans: "Baloo Bhaijaan 2", ui-sans-serif, system-ui, sans-serif;
	--font-display: "Baloo Bhaijaan 2", ui-sans-serif, system-ui, sans-serif;
}
```
### fonts=2
- Roles: display Baloo 2 (500 to 700), body Quicksand (400 to 700), numerals Baloo 2 600 with `tabular-nums`.
  Arabic twins: display Baloo Bhaijaan 2 (500 to 700), body Tajawal (400, 500, 700).
- Link: `https://fonts.googleapis.com/css2?family=Baloo+2:wght@500;600;700&family=Quicksand:wght@400;500;600;700&family=Baloo+Bhaijaan+2:wght@500;600;700&family=Tajawal:wght@400;500;700&display=swap`
- Font note: `Fonts of the style preau (fonts=2): Baloo 2 + Quicksand, Arabic twins Baloo Bhaijaan 2 + Tajawal (Google Fonts), loaded in __root.tsx.`
```css
/* Not inside @theme inline: the html:lang(ar) block below must swap these stacks. */
@theme {
	--font-sans: "Quicksand", ui-sans-serif, system-ui, sans-serif;
	--font-display: "Baloo 2", "Quicksand", ui-sans-serif, system-ui, sans-serif;
}
html:lang(ar) {
	--font-sans: "Tajawal", ui-sans-serif, system-ui, sans-serif;
	--font-display: "Baloo Bhaijaan 2", "Tajawal", ui-sans-serif, system-ui, sans-serif;
}
```

## Palette
### Light
The block replaces `:root`. Leave `.dark` as it is: this style never sets the `dark` class.
```css
/* Style preau, accent=1 (cobalt with sunflower). Lowest mark ratio 3.03:1 (chart-2 on the --muted bar slot).
   Lowest text ratio 4.87:1 (success badge on the bg-accent hover cell; status tokens are dark for the table cells). */
:root {
	--background: oklch(0.97 0.03 95);
	--foreground: oklch(0.28 0.055 262);
	--card: oklch(0.995 0.008 95);
	--card-foreground: oklch(0.28 0.055 262);
	--popover: oklch(0.995 0.008 95);
	--popover-foreground: oklch(0.28 0.055 262);
	--primary: oklch(0.48 0.16 258);
	--primary-foreground: oklch(0.985 0.006 250);
	--secondary: oklch(0.935 0.045 92);
	--secondary-foreground: oklch(0.3 0.06 260);
	--muted: oklch(0.945 0.04 93);
	--muted-foreground: oklch(0.46 0.05 255);
	--accent: oklch(0.92 0.055 92);
	--accent-foreground: oklch(0.28 0.055 262);
	--destructive: oklch(0.53 0.2 27);
	--destructive-foreground: oklch(0.99 0.003 27);
	--border: oklch(0.87 0.07 90);
	--input: oklch(0.58 0.07 75);
	--ring: oklch(0.48 0.16 258);
	--radius: 1.25rem;
	--control-radius: 9999px;
	--sidebar: oklch(0.935 0.05 92);
	--sidebar-foreground: oklch(0.28 0.055 262);
	--sidebar-primary: oklch(0.48 0.16 258);
	--sidebar-primary-foreground: oklch(0.985 0.006 250);
	--sidebar-accent: oklch(0.895 0.07 90);
	--sidebar-accent-foreground: oklch(0.25 0.06 262);
	--sidebar-border: oklch(0.86 0.065 90);
	--sidebar-ring: var(--ring);
	--chart-1: var(--primary);
	--chart-2: oklch(0.63 0.13 80);
	--chart-3: oklch(0.6 0.12 165);
	--chart-4: oklch(0.56 0.19 32);
	--chart-5: oklch(0.5 0.19 322);
	--success: oklch(0.44 0.12 150);
	--warning: oklch(0.46 0.1 62);
	--info: oklch(0.45 0.11 245);
}
```

## Accents
The six colors of the set, in order (mark tones, 3:1 or more on the ground and the card): cobalt `oklch(0.48 0.16 258)`,
sunflower `oklch(0.63 0.13 80)`, mint `oklch(0.6 0.12 165)`, tomato `oklch(0.56 0.19 32)`,
grape `oklch(0.5 0.19 322)`, tangerine `oklch(0.64 0.16 52)`.
Set the row in `:root`. `--sidebar-ring: var(--ring)` and `--chart-1: var(--primary)` follow it. `--chart-2` is the companion.
`--chart-3` to `--chart-5` take the first three set colors that the row does not use.
Every row keeps text at 4.69:1 or more, also on the table cells. Marks stay at 3.03:1 or more (sunflower and tangerine on the `--muted` bar slot).

| Accent | Name | Mode | `--primary` | `--primary-foreground` | `--ring` | `--sidebar-primary` | `--sidebar-primary-foreground` | `--chart-2` |
|---|---|---|---|---|---|---|---|---|
| accent=1 | cobalt with sunflower | light | `oklch(0.48 0.16 258)` | `oklch(0.985 0.006 250)` | `oklch(0.48 0.16 258)` | `oklch(0.48 0.16 258)` | `oklch(0.985 0.006 250)` | `oklch(0.63 0.13 80)` |
| accent=2 | tomato with mint | light | `oklch(0.56 0.19 32)` | `oklch(0.99 0.003 30)` | `oklch(0.56 0.19 32)` | `oklch(0.56 0.19 32)` | `oklch(0.99 0.003 30)` | `oklch(0.6 0.12 165)` |
| accent=3 | grape with tangerine | light | `oklch(0.5 0.19 322)` | `oklch(0.985 0.008 320)` | `oklch(0.5 0.19 322)` | `oklch(0.5 0.19 322)` | `oklch(0.985 0.008 320)` | `oklch(0.64 0.16 52)` |

## Knobs
```css
/* Knobs of the style preau: chunky tinted borders, no shadow, thick round strokes. */
:root {
	--surface-border-width: 2px;
	--surface-shadow: 0 0 #0000;
	--surface-radius: var(--radius);
	--heading-weight: 600;
	--heading-tracking: -0.005em;
	--heading-case: none;
	--title-weight: 700;
	--title-case: none;
	--title-tracking: 0em;
	--label-weight: 700;
	--label-case: none;
	--label-tracking: 0em;
	--numeral-font: var(--font-display);
	--icon-stroke: 2.25;
	--chart-stroke: 3;
	--chart-fill-opacity: 0.2;
	--chart-grid-dash: 2 6;
	--table-stripe: transparent;
	--table-head-bg: transparent;
	--nav-active-bg: var(--card);
	--nav-indicator-width: 0px;
}
```

## Anatomy
- **Page header.** `PageHeader` as it is. Put the day in `description`, with `Intl.DateTimeFormat` and `dateStyle: "full"`.
- **Panels.** A panel is a `Card` as it is: warm white, a 2px tinted border, 1.25rem corners, no shadow.
  Grids: `grid grid-cols-1 gap-4 @5xl/main:grid-cols-12 @5xl/main:gap-5`.
- **Panel title.** `<CardTitle className="flex items-center gap-2.5">` with a chip first, one set color per panel:
  `flex size-8 shrink-0 items-center justify-center rounded-full bg-chart-1/20` (`chart-1` to `chart-5`), icon `size-4`.
- **KPI.** Each figure is a sticker on its own soft color, not a white panel. Give one chart color per KPI:
  `rounded-[1rem] border-2 border-chart-1/30 bg-chart-1/14 px-4 py-3.5` (chart-1 to chart-5).
  Label `label-text text-sm`. Value `font-numeric text-4xl font-semibold tabular-nums leading-none`. Text stays `foreground`.
  - number: label, value, one change line `text-xs font-semibold`. icon: a white chip
    `flex size-9 items-center justify-center rounded-full bg-card` at the label end.
  - delta: the change in a white pill `rounded-full bg-card px-2 py-0.5 text-xs font-bold text-success` (or `text-destructive`).
  - spark: 7 to 14 mini bars along the sticker foot, `h-10`, `radius={3}`, in the ink `fill="var(--foreground)"`: a set color is under 3:1 on its own tint.
  - meter: a progress ring at the sticker end (see Charts). strip: one white panel, rules 2 px in `border-border`.
    Each cell starts with a `size-2.5 rounded-full bg-chart-1` dot.
- **Charts.** Main `h-64`, side `h-52`, mini `h-10`. Ticks `text-xs font-semibold`. Grid: the dotted knob,
  `<CartesianGrid vertical={false} />`. Axes `tickLine={false} axisLine={false} tickMargin={8}`.
  - bars: `radius={6}`, `maxBarSize={28}`, `background={{ fill: "var(--muted)", radius: 6 }}`: each bar fills
    a round slot. Today's bar takes `var(--chart-2)` on its `Cell`, the sticker color.
  - area: the 3px line with round points `dot={{ r: 3.5, strokeWidth: 2, fill: "var(--card)" }}` up to 14 points.
  - compare: the previous period as round dots, `strokeDasharray="0.1 8" strokeLinecap="round"`.
  - stacked: chart-1 to chart-3, `stroke="var(--card)" strokeWidth={2}`, `radius={[6, 6, 0, 0]}` on the top part.
  - heat: round cells `size-[16px] rounded-full`, gap `gap-[4px]`. The 2px border leaves 283 px for the 276 px calendar.
  - Progress ring (meter, breakdown): `viewBox="0 0 40 40"`, a `var(--muted)` track circle `r="16"`, the share text in the center.
    The arc circle in `var(--chart-1)` gets `pathLength={100}`, `strokeLinecap="round"`, ``strokeDasharray={`${share} 100`}``,
    `strokeWidth={5}`, and `transform="rotate(-90 20 20)"`.
    `share` is a percent, 0 to 100: `Math.min(Math.max((value / whole) * 100, 0), 100)`. At 0, omit the arc: a round cap draws a dot.
- **Tables.** `DataTable`, each row a rounded pill on `--muted`. Add to the `Table`:
  `border-separate border-spacing-y-1 [&_tbody_tr]:border-0 [&_tbody_tr]:hover:bg-transparent [&_tbody_td]:bg-muted [&_tbody_tr:hover>td]:bg-accent [&_td:first-child]:rounded-s-xl [&_td:last-child]:rounded-e-xl`.
  The color sits on the cells, so the round ends show. The dark status tokens keep each badge at 4.5:1 on both cells.
- **Navigation.** Tinted sidebar. Each nav icon sits in a chip. In `app-sidebar.tsx`, wrap `<item.icon />`:
  `<span className="-m-1 flex size-6 shrink-0 items-center justify-center rounded-full bg-sidebar-accent in-data-[active=true]:bg-sidebar-primary in-data-[active=true]:text-sidebar-primary-foreground"><item.icon className="size-3.5" /></span>`.
  The active item is a white card (knob). Brand mark: the template chip with `rounded-full` in place of `rounded-lg`.
- **Badges and status.** `<Badge variant="success" className="gap-1.5 px-2.5 font-bold">` with a `size-1.5 rounded-full bg-current` dot first.
- **Buttons and inputs.** Pills. The main action is `Button size="lg"` with `font-bold`. Others `variant="outline"`.
- **Motion.** Hover tints only. No bounce, no wobble, no load animation.

## Signature
1. **The sticker.** Today, or the top item of a ranking, gets the companion color and a star tag.
   Bind it to the item that a parent or a coach looks for first: today's class or the top player.
```tsx
// The preau sticker: marks today or the top item with --chart-2, the companion color of the accent row.
import { StarIcon } from "lucide-react";
import type { ReactNode } from "react";

type StickerProps = {
	/** Translated word on the tag, for example "Today" or "Top of the week". */
	label: string;
	/** The marked item: a list row, a day cell, a ranked bar label. */
	children: ReactNode;
};

/** Wraps one item. The tag sits on the top edge, at the end side. The chart-2 ring is 3:1 or more on the ground. */
export function Sticker({ label, children }: StickerProps) {
	return (
		<div className="relative rounded-[1rem] bg-chart-2/16 p-1.5 ring-2 ring-chart-2">
			<span className="absolute end-3 -top-3 inline-flex items-center gap-1 rounded-full bg-card px-2.5 py-0.5 font-bold text-foreground text-xs ring-2 ring-chart-2">
				<StarIcon
					className="size-3 fill-chart-2 text-chart-2"
					aria-hidden="true"
				/>
				{label}
			</span>
			{children}
		</div>
	);
}
```

2. **Block art in empty panels.** The style names this drawing, so it is allowed behind login.
   Bind it to every empty panel. The sentence under it names the business object ("No class this week yet").
```tsx
// Empty-panel art of preau: three blocks and a sun. Decorative: the sentence and the action under it give the meaning.

/** Top-left corner and fill of each 28 px block, in the 120 x 72 view box. */
const BLOCKS = [
	{ x: 12, y: 42, fill: "fill-chart-1" },
	{ x: 44, y: 42, fill: "fill-chart-3" },
	{ x: 28, y: 12, fill: "fill-chart-4" },
] as const;

/** Draws in the set colors (--chart-1 to --chart-4), so its colors change with the accent row. */
export function BlocksArt() {
	return (
		<svg viewBox="0 0 120 72" className="h-16 w-auto" aria-hidden="true">
			<circle cx="98" cy="16" r="10" className="fill-chart-2" />
			{BLOCKS.map((block) => (
				<rect
					key={block.fill}
					x={block.x}
					y={block.y}
					width="28"
					height="28"
					rx="8"
					className={block.fill}
				/>
			))}
		</svg>
	);
}
```

## Empty state
- Every panel stays in place. Stickers keep their colors and show `0`. Rings show the bare `--muted` track.
- A bar chart keeps its axes and its round `--muted` slots, so the empty week shows empty blocks.
- A list or a table panel shows `BlocksArt`, one sentence, and the action that fills it, centered in the panel.
- The setup strip sits under the page header, as numbered steps (the actions are a real sequence):
  `flex flex-wrap items-center gap-3 rounded-surface border-2 border-dashed border-chart-2 bg-card px-4 py-3`.
  2 to 4 steps, each a `Button variant="outline" size="sm"` after a number in `flex size-6 items-center justify-center rounded-full bg-chart-2/25 font-bold text-xs`.

## Do not
- Grey or one-hue charts for categories. Give each category its own set color.
- Sharp corners or 1px hairlines. Keep 1.25rem corners and the 2px tinted border.
- Emoji, mascots, or a cartoon font. Use the round type, the icon chips, and the block art.
- Saturated text on a saturated fill. Put `foreground` text on soft tints (`/14` to `/20`).
- Tilted stamps or hard offset shadows. Stickers lie flat; panels have no shadow.

## Check
- Is the ground a light butter yellow (#FBF5DF), not white, grey, or cream?
- Do the panels show a 2px tinted border, big round corners, and no shadow?
- Does each KPI sit on its own soft color?
- Are the bars round blocks in set colors, with a sticker on today or the top item?
- Do the nav icons and the panel titles sit in round colored chips?
- Does each empty panel show the block art and one action?
