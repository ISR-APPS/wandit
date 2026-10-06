# Style coulisses
Backstage at night: violet dark wings, ticket stubs pinned to the wall, and stage light on the figures.
Mode: dark only. Fits: events, venues, music, media, nightlife, ticketing, creators, gaming. Avoid: clinic, finance, legal, B2B industry.
Radius 0.75rem. Controls: pill. Shell: recipe. Density: recipe.

## Identity
- Ground: violet black, L 0.16 at hue 300. The violet stays visible. It is never a neutral near-black.
- Panels: ticket stubs. A flat violet fill, no border, no shadow, and two notches on the tear line under the head.
- Only data marks are vivid. The brief allows a magenta to tangerine gradient on data marks, and nowhere else.
- Type: a wide bold display for titles and big figures, a clean sans for the rest. A pulse dot marks a live count.
- This is not the near-black and acid green default. The ground is violet, and the marks are magenta and tangerine.

## Fonts
Each block gives the link for `__root.tsx`, the roles, and the CSS for `tokens.css`. Name the four families in the font note.

### fonts=1
Display and figures: Unbounded 400, 600, and 700. Body: Onest 400 to 700. Arabic display: Rakkas. Arabic body: Cairo.
`https://fonts.googleapis.com/css2?family=Unbounded:wght@400;600;700&family=Onest:wght@400;500;600;700&family=Rakkas&family=Cairo:wght@400;500;600;700&display=swap`

```css
/* Not in @theme inline: utilities emit var(--font-*), so html:lang(ar) can swap in the Arabic twins. */
@theme {
	--font-sans: "Onest", ui-sans-serif, system-ui, sans-serif;
	--font-display: "Unbounded", "Onest", ui-sans-serif, system-ui, sans-serif;
}
html:lang(ar) {
	--font-sans: "Cairo", ui-sans-serif, system-ui, sans-serif;
	--font-display: "Rakkas", "Cairo", ui-sans-serif, system-ui, sans-serif;
}
/* Rakkas has one weight, 400. In Arabic, a heavier weight class must not draw a false bold. */
html:lang(ar) :is(h1, h2, h3, h4, .font-display, .font-numeric) {
	font-synthesis-weight: none;
}
```

### fonts=2
Display and figures: Syne 500 to 800. Body: Epilogue 400 to 700. Arabic display: Lemonada. Arabic body: Vazirmatn.
`https://fonts.googleapis.com/css2?family=Syne:wght@500;600;700;800&family=Epilogue:wght@400;500;600;700&family=Lemonada:wght@400;600;700&family=Vazirmatn:wght@400;500;600;700&display=swap`

```css
/* Not in @theme inline: utilities emit var(--font-*), so html:lang(ar) can swap in the Arabic twins. */
@theme {
	--font-sans: "Epilogue", ui-sans-serif, system-ui, sans-serif;
	--font-display: "Syne", "Epilogue", ui-sans-serif, system-ui, sans-serif;
}
html:lang(ar) {
	--font-sans: "Vazirmatn", ui-sans-serif, system-ui, sans-serif;
	--font-display: "Lemonada", "Vazirmatn", ui-sans-serif, system-ui, sans-serif;
}
```

## Palette
The block holds accent=1, stage magenta. `--chart-1` and `--chart-2` are the data gradient. The sidebar is darker than the ground.

### Dark
Replace the `.dark` block and leave `:root`. This style is dark only: apply `mode=dark` of `frame.md` for every recipe.

```css
/* Lowest text contrast 5.73:1 (muted-foreground in an input). Input border 3.07:1 on card. */
.dark {
	--background: oklch(0.16 0.032 300);
	--foreground: oklch(0.96 0.012 300);
	--card: oklch(0.225 0.042 300);
	--card-foreground: oklch(0.96 0.012 300);
	--popover: oklch(0.255 0.045 300);
	--popover-foreground: oklch(0.96 0.012 300);
	--primary: oklch(0.7 0.2 350);
	--primary-foreground: oklch(0.16 0.03 330);
	--secondary: oklch(0.29 0.05 300);
	--secondary-foreground: oklch(0.94 0.012 300);
	--muted: oklch(0.27 0.045 300);
	--muted-foreground: oklch(0.75 0.035 300);
	--accent: oklch(0.31 0.065 320);
	--accent-foreground: oklch(0.96 0.012 300);
	--destructive: oklch(0.7 0.18 22);
	--destructive-foreground: oklch(0.17 0.03 22);
	--border: oklch(0.33 0.05 300);
	--input: oklch(0.52 0.06 300);
	--ring: oklch(0.7 0.2 350);
	--sidebar: oklch(0.13 0.028 300);
	--sidebar-foreground: oklch(0.88 0.02 300);
	--sidebar-primary: oklch(0.7 0.2 350);
	--sidebar-primary-foreground: oklch(0.16 0.03 330);
	--sidebar-accent: oklch(0.235 0.05 305);
	--sidebar-accent-foreground: oklch(0.97 0.01 300);
	--sidebar-border: oklch(0.24 0.04 300);
	--sidebar-ring: var(--ring);
	--chart-1: oklch(0.66 0.22 350);
	--chart-2: oklch(0.78 0.145 55);
	--chart-3: oklch(0.66 0.18 290);
	--chart-4: oklch(0.8 0.11 200);
	--chart-5: oklch(0.7 0.05 300);
	--success: oklch(0.78 0.15 155);
	--warning: oklch(0.84 0.14 85);
	--info: oklch(0.77 0.12 230);
	--radius: 0.75rem;
	--control-radius: 9999px;
}
```

## Accents
Each row keeps 4.5:1 for its text and 3:1 for the accent. `--sidebar-ring` reads `--ring` through `var()`.
Keep `--chart-1` and `--chart-2` for every accent: the data gradient stays fixed, and the accent never colors data.

| accent | name | --primary | --primary-foreground | --ring | --sidebar-primary | --sidebar-primary-foreground |
|---|---|---|---|---|---|---|
| accent=1 | stage magenta | oklch(0.7 0.2 350) | oklch(0.16 0.03 330) | oklch(0.7 0.2 350) | oklch(0.7 0.2 350) | oklch(0.16 0.03 330) |
| accent=2 | neon tangerine | oklch(0.77 0.15 55) | oklch(0.18 0.04 50) | oklch(0.77 0.15 55) | oklch(0.77 0.15 55) | oklch(0.18 0.04 50) |
| accent=3 | electric violet | oklch(0.68 0.17 285) | oklch(0.15 0.03 285) | oklch(0.68 0.17 285) | oklch(0.68 0.17 285) | oklch(0.15 0.03 285) |

## Knobs
Put this block after the palette blocks. Stubs have no border and no shadow. Strokes are thick, the grid is dotted.

```css
/* Style knobs of coulisses: flat stubs, a wide bold display, thick vivid marks, an accent nav tint. */
:root {
	--surface-border-width: 0px;
	--surface-shadow: 0 0 #0000;
	--surface-radius: var(--radius);
	--heading-weight: 700;
	--heading-tracking: -0.02em;
	--heading-case: none;
	--title-weight: 600;
	--title-case: none;
	--title-tracking: -0.01em;
	--label-weight: 500;
	--label-case: none;
	--label-tracking: 0em;
	--numeral-font: var(--font-display);
	--icon-stroke: 2;
	--chart-stroke: 3;
	--chart-fill-opacity: 0.3;
	--chart-grid-dash: 1 6;
	--table-stripe: transparent;
	--table-head-bg: transparent;
	--nav-active-bg: color-mix(in oklch, var(--primary) 20%, var(--sidebar));
	--nav-indicator-width: 0px;
}
```

## Anatomy
- Page header: `PageHeader`. The h1 is the wide display at 700. Put the next event or the venue in `description`.
- Panel: a ticket stub (Signature 1). The head is exactly `h-12`, so the notches meet the tear line.
  The title is `font-display text-sm` in the head. A description goes in the body. Keep `px-5`: no text under a notch.

```tsx
<Card className="ticket-stub gap-0 py-0">
	<CardHeader className="h-12 content-center px-5">
		<CardTitle className="font-display text-sm">{title}</CardTitle>
	</CardHeader>
	<div aria-hidden className="mx-4 border-border border-t-2 border-dotted" />
	<CardContent className="px-5 py-5">{children}</CardContent>
</Card>
```

- KPI: a stub. The head holds the label (`text-muted-foreground text-sm`), the body holds the figure:
  `font-numeric font-semibold text-4xl tabular-nums leading-none`, `@xl/main:text-5xl` on the main figure.
  - kpi=number: label in the head, figure in the body, a live pulse when the count is live.
  - kpi=icon: the icon `size-4 text-primary` before the label in the head.
  - kpi=delta: the delta under the figure, `text-sm`, in `text-success` or `text-destructive` by `goodWhen`.
  - kpi=spark: mini gradient bars `h-10` under the figure, not a line.
  - kpi=meter: the kit `Progress` with `className="h-1.5 bg-muted"`, then the part and the whole in `text-sm`.
  - kpi=strip: one wide stub. The head names the period. Rules: 2 px, dotted, `border-border`.
- Charts: bars first. One series fills its bars with the gradient, and the latest bar glows. Main `h-72`, side `h-52`.

```tsx
const gradientId = useId();
<defs>
	{/* Magenta at the base, tangerine at the top. Only data marks take this gradient. */}
	<linearGradient id={gradientId} x1="0" y1="1" x2="0" y2="0">
		<stop offset="0%" stopColor="var(--chart-1)" />
		<stop offset="100%" stopColor="var(--chart-2)" />
	</linearGradient>
</defs>
<Bar dataKey="current" fill={`url(#${gradientId})`} radius={[6, 6, 0, 0]} maxBarSize={36} isAnimationActive={false}>
	{points.map((point, index) => (
		<Cell key={point.day} className={index === points.length - 1 ? "drop-shadow-[0_0_0.5rem_var(--chart-2)]" : undefined} />
	))}
</Bar>
```

  - Lines and areas: `type="monotone"` in `var(--chart-1)`. The knobs give the 3 px stroke and the fill.
    One `ReferenceDot` marks the last point: `r={5}`, `fill="var(--chart-2)"`, and the same glow class.
  - Stacks and breakdowns: flat chart 1, 3, 4, and 5. Grid: `<CartesianGrid vertical={false} />`, dotted by the knob.
  - heat: cells `size-[16px] rounded-[4px]`, `gap-[4px]`, five flat steps from `--muted` to `--chart-1`. No gradient.
- Tables: compact, `TableHead className="h-9"`, `TableCell className="py-1.5"`, rows `hover:bg-primary/10`, ids `font-numeric text-xs`.
- Navigation: the sidebar, darker than the ground. The active item takes the accent tint of the knob. Keep the kit brand mark.
- Badges and buttons: pills. A status is a `Badge` plus the word. The main action is the `default` variant.
- Inputs: the kit `Input` with `className="rounded-full"`, to match the pill buttons. A `Textarea` keeps its corners.
  The `--input` line has 3.07:1 on the card.
- Motion: the pulse dot only, still under `motion-reduce:animate-none`. Nothing moves on load.

## Signature
1. The ticket stub. Add this utility at the end of `tokens.css`. The stub head names the show, the date, or the ticket type.

```css
/* Two notches at --stub-at from the top (default: an h-12 head). The radial gradients are a mask: they paint no color. */
@utility ticket-stub {
	--stub-y: var(--stub-at, calc(var(--spacing) * 12));
	--stub-cut: transparent 0.625rem, var(--card) 0.66rem;
	mask-image:
		radial-gradient(circle at 0 var(--stub-y), var(--stub-cut)),
		radial-gradient(circle at 100% var(--stub-y), var(--stub-cut));
	mask-position:
		0 0,
		100% 0;
	mask-size: 51% 100%;
	mask-repeat: no-repeat;
}
```

2. The live pulse, beside a count whose query has `refetchInterval` (tickets sold tonight, people inside). Never on a static count.

```tsx
type LivePulseProps = {
	/** Translated word that a screen reader says, for example "Live". */
	label: string;
};

/** A dot that pulses beside a live count. With reduced motion, the dot stays still. */
function LivePulse({ label }: LivePulseProps) {
	return (
		<span className="relative inline-flex size-2.5 shrink-0">
			<span className="absolute inset-0 animate-ping rounded-full bg-chart-2 opacity-70 motion-reduce:animate-none" />
			<span className="relative size-2.5 rounded-full bg-chart-2 shadow-[0_0_0.5rem_var(--chart-2)]" />
			<span className="sr-only">{label}</span>
		</span>
	);
}
```

## Empty state
- Every stub keeps its place, notches, and tear line. Figures show a real 0. A live count keeps its pulse at 0.
- While every value is 0, the `Bar` draws empty dashed slots:
  `background={{ fill: "transparent", stroke: "var(--border)", strokeDasharray: "3 4", radius: 6 }}`.
- Lists show three dotted slots, `h-9 rounded-md border border-border border-dotted`, then one muted sentence.
- Setup strip: under the page header, `ticket-stub flex flex-wrap items-center gap-3 rounded-surface bg-card px-6 py-3 [--stub-at:50%]`.
  One sentence and 2 to 4 `size="sm"` buttons with the first real actions, named after the trade.

## Do not
- A gradient on a surface, a button, or a text. Instead, keep it on data bars. The latest point and the pulse are flat `--chart-2`.
- A border or a shadow on a stub. Instead, use the flat fill and the two notches.
- A pulse beside a figure that does not refresh. Instead, show the pulse only for a count with `refetchInterval`.
- A neutral black ground or an acid green mark. Instead, keep the violet ground and the magenta and tangerine marks.

## Check
- Is the ground violet black, never a neutral black?
- Is every panel a ticket stub, with two notches on a dotted tear line?
- Do the bars carry the magenta to tangerine gradient, while every surface stays flat?
- Are the page title, the panel titles, and the big figures in the wide display?
- Does a pulse dot sit only beside live counts?
