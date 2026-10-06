# Style brigade
A kitchen ticket wall: cool steel-white paper, order tickets under burnt ink bands, and one strong accent.
Mode: light only. Fits: restaurants, kitchens, workshops, repair shops, print shops, warehouses, construction. Avoid: clinic, legal, luxury.
Radius 0.25rem. Controls: matched. Shell: recipe. Density: recipe.

## Identity
- Ground: a cool grey-white paper, L 0.965 at hue 235, with almost no chroma.
- Panels: tickets. A dark ink band runs across the top and holds the title. A white body holds the content.
- Capitals: the band titles and the page title are heavy condensed capitals. The brief allows uppercase there,
  because short capital titles stay readable from a distance. Labels, table heads, and the nav stay in sentence case.
- One accent: it marks one thing per ticket. Everything else is ink on paper.
- Time is a main figure. An open item shows how long it waits: "12 min".
- Charts: thick square bars in ink. The bar that needs action takes the accent. A target line shows when the data has one.
- This is not the near-black and vermilion default. The ground is a light cool grey, and the ink is a warm dark brown.

## Fonts
Each block gives the link for `__root.tsx`, the roles, and the CSS for `tokens.css`. Name the four families in the font note.

### fonts=1
Display and figures: Anton 400. Body: Sofia Sans Condensed 400 to 800. Arabic display: Lalezar. Arabic body: Cairo.
`https://fonts.googleapis.com/css2?family=Anton&family=Sofia+Sans+Condensed:wght@400;500;600;700;800&family=Lalezar&family=Cairo:wght@400;500;600;700&display=swap`

```css
/* Not in @theme inline: utilities emit var(--font-*), so html:lang(ar) can swap in the Arabic twins. */
@theme {
	--font-sans: "Sofia Sans Condensed", ui-sans-serif, system-ui, sans-serif;
	--font-display:
		"Anton", "Sofia Sans Condensed", ui-sans-serif, system-ui, sans-serif;
}
html:lang(ar) {
	--font-sans: "Cairo", ui-sans-serif, system-ui, sans-serif;
	--font-display: "Lalezar", "Cairo", ui-sans-serif, system-ui, sans-serif;
}
/* Anton and Lalezar have one weight, 400. A heavier weight class must not draw a false bold. */
:is(h1, h2, h3, h4, .font-display, .font-numeric) {
	font-synthesis-weight: none;
}
```

### fonts=2
Display and figures: Big Shoulders Display 600 to 900. Body: Bitter 400 to 700. Arabic display: Kufam. Arabic body: Noto Sans Arabic.
`https://fonts.googleapis.com/css2?family=Big+Shoulders+Display:wght@600;700;800;900&family=Bitter:wght@400;500;600;700&family=Kufam:wght@500;700;800&family=Noto+Sans+Arabic:wght@400;500;600;700&display=swap`

```css
/* Not in @theme inline: utilities emit var(--font-*), so html:lang(ar) can swap in the Arabic twins. */
@theme {
	--font-sans: "Bitter", ui-serif, Georgia, serif;
	--font-display:
		"Big Shoulders Display", "Bitter", ui-sans-serif, system-ui, sans-serif;
}
html:lang(ar) {
	--font-sans: "Noto Sans Arabic", ui-sans-serif, system-ui, sans-serif;
	--font-display:
		"Kufam", "Noto Sans Arabic", ui-sans-serif, system-ui, sans-serif;
}
```

## Palette
The block holds accent=1, tomato red. `--foreground` is the ink of the bands, `--card` the ticket body, `--chart-1` ink.

### Light
Replace the `:root` block. This style is light only: leave the `.dark` block as it is.

```css
/* Lowest text contrast 4.92:1 (primary-foreground on primary). Input border 3.56:1 on background. */
:root {
	--background: oklch(0.965 0.005 235);
	--foreground: oklch(0.23 0.012 50);
	--card: oklch(0.993 0.002 235);
	--card-foreground: oklch(0.23 0.012 50);
	--popover: oklch(0.993 0.002 235);
	--popover-foreground: oklch(0.23 0.012 50);
	--primary: oklch(0.56 0.2 30);
	--primary-foreground: oklch(0.985 0.005 90);
	--secondary: oklch(0.915 0.008 235);
	--secondary-foreground: oklch(0.25 0.012 50);
	--muted: oklch(0.935 0.006 235);
	--muted-foreground: oklch(0.47 0.012 240);
	--accent: oklch(0.93 0.01 235);
	--accent-foreground: oklch(0.24 0.012 50);
	--destructive: oklch(0.47 0.17 18);
	--destructive-foreground: oklch(0.985 0.005 90);
	--border: oklch(0.86 0.008 235);
	--input: oklch(0.6 0.012 240);
	--ring: oklch(0.56 0.2 30);
	--sidebar: oklch(0.935 0.007 235);
	--sidebar-foreground: oklch(0.27 0.012 50);
	--sidebar-primary: oklch(0.56 0.2 30);
	--sidebar-primary-foreground: oklch(0.985 0.005 90);
	--sidebar-accent: oklch(0.99 0.002 235);
	--sidebar-accent-foreground: oklch(0.2 0.012 50);
	--sidebar-border: oklch(0.86 0.008 235);
	--sidebar-ring: var(--ring);
	--chart-1: oklch(0.3 0.015 50);
	--chart-2: var(--primary);
	--chart-3: oklch(0.56 0.02 240);
	--chart-4: oklch(0.5 0.07 155);
	--chart-5: oklch(0.62 0.01 60);
	--success: oklch(0.48 0.11 150);
	--warning: oklch(0.5 0.1 65);
	--info: oklch(0.48 0.12 245);
	--radius: 0.25rem;
	--control-radius: calc(var(--radius) * 0.8);
}
```

## Accents
Each row keeps 4.5:1 for its text and 3:1 for the accent on the paper and the ticket. `--chart-2` follows `--primary`.
`--chart-1` stays ink for every row: the bars are ink, and the accent marks only the bar that needs action.
Mustard is light: 3.88:1 on the ticket. So no row paints text or a meter bar in `--primary`. These use the ink.

| accent | name | --primary | --primary-foreground | --ring | --sidebar-primary | --sidebar-primary-foreground |
|---|---|---|---|---|---|---|
| accent=1 | tomato red | oklch(0.56 0.2 30) | oklch(0.985 0.005 90) | oklch(0.56 0.2 30) | oklch(0.56 0.2 30) | oklch(0.985 0.005 90) |
| accent=2 | mustard yellow | oklch(0.6 0.12 92) | oklch(0.2 0.02 60) | oklch(0.6 0.12 92) | oklch(0.6 0.12 92) | oklch(0.2 0.02 60) |
| accent=3 | kitchen blue | oklch(0.5 0.12 245) | oklch(0.985 0.005 90) | oklch(0.5 0.12 245) | oklch(0.5 0.12 245) | oklch(0.985 0.005 90) |

## Knobs
Put this block after the palette block. Weight 800 draws Big Shoulders Display 800. Anton has one weight and stays at 400.

```css
/* Style knobs of brigade: tickets with a 2 px bottom edge, capitals in bands, thick marks, an accent bar on the active item. */
:root {
	--surface-border-width: 1px;
	--surface-shadow: 0 2px 0 0 var(--border);
	--surface-radius: var(--radius);
	--heading-weight: 800;
	--heading-tracking: 0.01em;
	--heading-case: uppercase;
	--title-weight: 800;
	--title-case: uppercase;
	--title-tracking: 0.04em;
	--label-weight: 700;
	--label-case: none;
	--label-tracking: 0em;
	--numeral-font: var(--font-display);
	--icon-stroke: 2.25;
	--chart-stroke: 3;
	--chart-fill-opacity: 0.12;
	--chart-grid-dash: none;
	--table-stripe: color-mix(in oklch, var(--muted) 60%, transparent);
	--table-head-bg: var(--secondary);
	--nav-active-bg: var(--sidebar-accent);
	--nav-indicator-width: 4px;
}
```

## Anatomy
- Page header: `PageHeader`. The knobs draw the h1 in heavy condensed capitals.
  Put the service or the shift in `description`, for example the open hours of today from the data.
- Panel: a ticket (Signature 1). The band holds the title only. A control or a description goes in the body.
- Panel title: `<CardTitle className="font-display text-base leading-none">` inside the band. The knobs make it capitals.
- KPI: a ticket. The band holds the label. The body holds the figure, `font-numeric text-5xl tabular-nums leading-none`.
  A KPI of open items, for example open orders, adds the elapsed timer of the oldest item (Signature 2).
  - kpi=number: band label, figure, timer row when the items are open.
  - kpi=icon: the icon `size-4` in the band, before the title.
  - kpi=delta: the delta beside the figure, `font-semibold text-sm tabular-nums`, by `goodWhen`.
  - kpi=spark: thick mini bars `h-10` in ink. The last bar takes `var(--chart-2)`.
  - kpi=meter: with a whole of 12 or less, a row of cells, `flex gap-1` of `h-3 flex-1 rounded-xs`,
    filled `bg-foreground`, empty `bg-muted`. A larger whole: the kit `Progress`,
    `className="h-3 rounded-xs bg-muted *:data-[slot=progress-indicator]:bg-foreground"`. The bar is ink for every accent.
  - kpi=strip: one long ticket. The band names the period. Rules: 2 px, `border-border`.
- Charts: thick square bars, `maxBarSize={44}`, `radius={[2, 2, 0, 0]}`, in `var(--chart-1)` (ink).
  The bar that needs action (today, or over the target) takes `var(--chart-2)` through a `Cell`.
  Lines are straight, `type="linear"`, with the 3 px knob stroke. `<CartesianGrid vertical={false} />`, solid.
  A target from the data or the user: `<ReferenceLine y={target} stroke="var(--foreground)" strokeDasharray="6 4" strokeWidth={2} />`.
  No target in the data: no line. Heights: main `h-64`, side `h-48`, mini `h-10`.
  - heat: square cells `size-[16px] rounded-[2px]`, `gap-[4px]`, five steps from `--muted` to the ink of `--chart-1`.
- Tables: the knobs give the grey head band, bold sentence-case heads, and light zebra rows. `TableHead className="h-9"`.
  An open item gets an elapsed timer column. Amounts `text-end font-semibold tabular-nums`.
- Navigation: a light sidebar. The active item is white, with a 4 px accent bar at its start (the knobs).
  Brand mark: in `app-sidebar.tsx`, replace `rounded-lg` with `rounded-sm`.
- Badges and status: a `Badge` plus the word, `font-semibold`. Waiting `warning`, in progress `info`, ready `success`.
- Buttons and inputs: matched corners from `--control-radius`. The main action is the `default` variant.
  Buttons move down 1 px when pressed: `active:translate-y-px`.
  Links: `text-foreground underline decoration-2 decoration-primary underline-offset-4`, never `text-primary`.
- Motion: timers tick every 30 s with no transition. Nothing moves on load.

## Signature
1. The ink band. Every panel is a ticket: a dark band with a light capital title over a white body.
   Bind it to the trade: the band names the station, the bench, or the stage (Grill, Pass, Bench 2).

```tsx
<Card className="gap-0 overflow-hidden py-0">
	{/* The ink band: --foreground as the fill and --background as the text. The pair keeps the page text contrast. */}
	<CardHeader className="h-10 content-center bg-foreground px-4 text-background">
		<CardTitle className="font-display text-base leading-none">{title}</CardTitle>
	</CardHeader>
	<CardContent className="px-4 py-4">{children}</CardContent>
</Card>
```

2. The elapsed timer. It shows the age of the oldest open item: an order, a job, a repair.
   It turns red only past a limit from the data or the user, for example a promised preparation time.

```tsx
type ElapsedTimerProps = {
	/** ISO time when the item came in, for example `created_at` of the oldest open order. */
	since: string;
	/** Minutes after which the timer turns red. Only a limit from the data or the user. */
	limitMinutes?: number;
};

/** The age of an item: "12 min" under one hour, then whole hours ("2 hr" in English). It ticks every 30 s. */
function ElapsedTimer({ since, limitMinutes }: ElapsedTimerProps) {
	const { locale } = useT();
	const [now, setNow] = useState(() => Date.now());
	// effect: the wall clock is an external system. A 30 s tick keeps the minute at most 30 s late.
	useEffect(() => {
		const timer = window.setInterval(() => setNow(Date.now()), 30_000);
		return () => window.clearInterval(timer);
	}, []);
	// 60 000 ms in one minute.
	const minutes = Math.max(0, Math.floor((now - Date.parse(since)) / 60_000));
	// From 60 minutes on, whole hours keep the figure short. Intl writes the unit word in the app language.
	const unit = minutes < 60 ? "minute" : "hour";
	const isLate = limitMinutes !== undefined && minutes >= limitMinutes;
	return (
		<span className={cn("inline-flex items-center gap-1 font-numeric tabular-nums", isLate && "text-destructive")}>
			{/* A late timer gets an icon too, so the color is not the only sign. */}
			{isLate ? <AlarmClockIcon aria-hidden className="size-4" /> : null}
			<time dateTime={since}>
				{new Intl.NumberFormat(locale, { style: "unit", unit, unitDisplay: "short" }).format(unit === "minute" ? minutes : Math.floor(minutes / 60))}
			</time>
		</span>
	);
}
```

## Empty state
- Every ticket keeps its band, its place, and its size.
- Figures show a real 0. A timer with no open item shows the muted word of the messages, for example "None open".
- Bar charts sit at 0. The target line stays when the data has a target.
- Lists show three empty ticket slots, `h-10 rounded-xs border-2 border-border border-dashed`, then one muted sentence.
- Setup strip: under the page header, one slim ink band,
  `flex flex-wrap items-center gap-3 rounded-surface bg-foreground px-4 py-2.5 text-background`.
  It holds one sentence and 2 to 4 `size="sm"` buttons (`default` first, then `secondary`), named after the trade.

## Do not
- Capitals on labels, table heads, or nav items. Instead, keep capitals for the page title and the band titles.
- A band in the accent color. Instead, keep every band in ink. The accent marks one thing per ticket.
- A red timer with no limit from the data. Instead, keep the timer neutral until a real limit passes.
- Soft panels: a large radius, a blur shadow, a tinted body. Instead, keep square tickets with the 2 px bottom edge.
- Thin lines and slim bars. Instead, use the 3 px knob stroke and thick square bars.

## Check
- Is every panel a ticket: a dark ink band with light capitals over a white body?
- Are the page title and the band titles heavy condensed capitals, and everything else sentence case?
- Does the accent mark one thing per ticket, and no band?
- Do open items show an elapsed timer that turns red only past a real limit?
- Are the bars thick, square, and in ink, with a target line only when the data has a target?
- With no rows, do the tickets keep their bands, their zeros, and dashed empty slots?
