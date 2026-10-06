# Style carnet
An appointment book: warm white pages, a dark aubergine cover, big serif dates, and a line that marks now.
Mode: light only. Fits: salons, studios, classes, rentals, coaching, clinics' front desks, restaurants with bookings. Avoid: dev tools, industry.
Radius 0.75rem. Controls: matched. Shell: recipe. Density: recipe.

## Identity
- Ground: a warm white page, L 0.985 at hue 60, chroma 0.009. It is lighter and less yellow than cream.
- Sidebar: dark aubergine, the one dark surface. Panels are outline pages with no shadow. A margin rule marks each body.
- Dates lead. A date block puts the serif day number over the weekday. A line marks now on a day grid.
- KPIs: one panel per period, with the figures under a date head. Charts: thin bars per day, with the weekend days tinted.
- This is not the cream, serif, and terracotta default. The page is near white, the sidebar is aubergine, and no accent is clay.

## Fonts
Each block gives the link for `__root.tsx`, the roles, and the CSS for `tokens.css`. Name the four families in the font note.
Set no italics: Arabic has none, and a date stays upright.
### fonts=1
Display, dates, and figures: Fraunces 400 to 600. Body: Mulish 400 to 700. Arabic display: Reem Kufi. Arabic body: Tajawal.
`https://fonts.googleapis.com/css2?family=Fraunces:wght@400;500;600&family=Mulish:wght@400;500;600;700&family=Reem+Kufi:wght@400;500;600;700&family=Tajawal:wght@400;500;700&display=swap`
```css
/* Not in @theme inline: utilities emit var(--font-*), so html:lang(ar) can swap in the Arabic twins. */
@theme {
	--font-sans: "Mulish", ui-sans-serif, system-ui, sans-serif;
	--font-display: "Fraunces", ui-serif, Georgia, serif;
}
html:lang(ar) {
	--font-sans: "Tajawal", ui-sans-serif, system-ui, sans-serif;
	--font-display: "Reem Kufi", "Tajawal", ui-sans-serif, system-ui, sans-serif;
}
```
### fonts=2
Display, dates, and figures: Alegreya 400 to 700 (old-style figures by default: keep `lining-nums`). Body: Alegreya Sans 400, 500, and 700. Arabic display: Scheherazade New. Arabic body: Noto Sans Arabic.
`https://fonts.googleapis.com/css2?family=Alegreya:wght@400;500;600;700&family=Alegreya+Sans:wght@400;500;700&family=Scheherazade+New:wght@400;500;600;700&family=Noto+Sans+Arabic:wght@400;500;600;700&display=swap`
```css
/* Not in @theme inline: utilities emit var(--font-*), so html:lang(ar) can swap in the Arabic twins. */
@theme {
	--font-sans: "Alegreya Sans", ui-sans-serif, system-ui, sans-serif;
	--font-display: "Alegreya", ui-serif, Georgia, serif;
}
html:lang(ar) {
	--font-sans: "Noto Sans Arabic", ui-sans-serif, system-ui, sans-serif;
	--font-display: "Scheherazade New", "Noto Sans Arabic", ui-serif, Georgia, serif;
}
```

## Palette
The block holds accent=1, aubergine rose. `--card` equals the ground: the border alone draws a page.
### Light
Replace the `:root` block. This style is light only: leave the `.dark` block as it is.
```css
/* Lowest text contrast 4.63:1 (warning badge text on its tint). Input border 3.52:1 on card. */
:root {
	--background: oklch(0.985 0.009 60);
	--foreground: oklch(0.24 0.03 330);
	--card: oklch(0.985 0.009 60);
	--card-foreground: oklch(0.24 0.03 330);
	--popover: oklch(0.995 0.003 60);
	--popover-foreground: oklch(0.24 0.03 330);
	--primary: oklch(0.47 0.14 355);
	--primary-foreground: oklch(0.985 0.008 60);
	--secondary: oklch(0.95 0.014 345);
	--secondary-foreground: oklch(0.32 0.05 340);
	--muted: oklch(0.948 0.012 60);
	--muted-foreground: oklch(0.5 0.025 330);
	--accent: oklch(0.94 0.025 350);
	--accent-foreground: oklch(0.33 0.09 350);
	--destructive: oklch(0.53 0.19 27);
	--destructive-foreground: oklch(0.985 0.008 60);
	--border: oklch(0.875 0.014 50);
	--input: oklch(0.62 0.025 330);
	--ring: oklch(0.47 0.14 355);
	--sidebar: oklch(0.27 0.06 330);
	--sidebar-foreground: oklch(0.9 0.02 340);
	--sidebar-primary: oklch(0.83 0.09 355);
	--sidebar-primary-foreground: oklch(0.26 0.07 345);
	--sidebar-accent: oklch(0.35 0.065 332);
	--sidebar-accent-foreground: oklch(0.975 0.01 340);
	--sidebar-border: oklch(0.36 0.05 330);
	--sidebar-ring: var(--sidebar-primary);
	--chart-1: var(--primary);
	--chart-2: oklch(0.37 0.06 330);
	--chart-3: oklch(0.6 0.06 345);
	--chart-4: oklch(0.55 0.03 60);
	--chart-5: oklch(0.6 0.09 85);
	--success: oklch(0.49 0.11 155);
	--warning: oklch(0.52 0.11 60);
	--info: oklch(0.5 0.1 230);
	--radius: 0.75rem;
	--control-radius: calc(var(--radius) * 0.8);
}
```

## Accents
Each row keeps 4.5:1 for `--primary-foreground` and 3:1 for the ring on the page. `--chart-1` follows `--primary`.
`--sidebar-ring` reads `--sidebar-primary`, because `--ring` has 2.09:1 on the dark sidebar.
Marigold is light: 3.06:1 on the page. So no row paints text or a thin line in `--primary`. These use the ink.

| accent | name | --primary | --primary-foreground | --ring | --sidebar-primary | --sidebar-primary-foreground |
|---|---|---|---|---|---|---|
| accent=1 | aubergine rose | oklch(0.47 0.14 355) | oklch(0.985 0.008 60) | oklch(0.47 0.14 355) | oklch(0.83 0.09 355) | oklch(0.26 0.07 345) |
| accent=2 | petrol blue | oklch(0.47 0.08 215) | oklch(0.985 0.008 60) | oklch(0.47 0.08 215) | oklch(0.82 0.07 210) | oklch(0.25 0.04 215) |
| accent=3 | marigold yellow | oklch(0.66 0.14 70) | oklch(0.22 0.04 60) | oklch(0.66 0.14 70) | oklch(0.83 0.13 78) | oklch(0.25 0.05 60) |

## Knobs
Put this block after the palette block. Strokes and icons are 1.5 px. Labels take 500: Alegreya Sans has no 600.
```css
/* Style knobs of carnet: outline pages, serif titles and dates, thin strokes, a start bar on the active item. */
:root {
	--surface-border-width: 1px;
	--surface-shadow: 0 0 #0000;
	--surface-radius: var(--radius);
	--heading-weight: 500;
	--heading-tracking: -0.015em;
	--heading-case: none;
	--title-weight: 600;
	--title-case: none;
	--title-tracking: 0em;
	--label-weight: 500;
	--label-case: none;
	--label-tracking: 0em;
	--numeral-font: var(--font-display);
	--icon-stroke: 1.5;
	--chart-stroke: 1.5;
	--chart-fill-opacity: 0.12;
	--chart-grid-dash: none;
	--table-stripe: transparent;
	--table-head-bg: transparent;
	--nav-active-bg: var(--sidebar-accent);
	--nav-indicator-width: 3px;
}
```

## Anatomy
- Page header: `PageHeader`. On the home, the date block of today (Signature 1) sits before it, in `flex items-end gap-4`.
- Panel: a `Card`, `className="gap-4 py-5"`, with the 1 px kit outline. Title: `<CardTitle className="font-display text-base">`.
  A count or a date range goes in `CardAction`, `text-muted-foreground text-sm tabular-nums`.
  The body has a margin rule under the start of the title: `<CardContent className="ms-6 border-s-2 border-s-primary/30 ps-4">`.
- KPI: one panel per period, never one outline card per figure. The panel head is the period: the date block for a day,
  or `new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", timeZone: "UTC" }).formatRange(start, end)`.
  `start` and `end` are `` new Date(`${day}T12:00:00Z`) `` of the first and last day. UTC in and out keeps each date.
  The body holds `grid @3xl/main:grid-cols-4 grid-cols-2 gap-x-6 gap-y-5`. Each figure: the label
  `label-text text-muted-foreground text-sm`, then the value `font-medium font-numeric text-4xl lining-nums tabular-nums leading-none`.
  - kpi=number: label and figure. kpi=icon: the same, with the icon `size-4 text-muted-foreground` before the label.
  - kpi=delta: the delta after the figure, `text-sm tabular-nums`, in `text-success` or `text-destructive` by `goodWhen`.
  - kpi=spark: thin day bars `h-10` with the weekend tint of the charts. Not a line.
  - kpi=meter: the kit `Progress`, `className="h-1 bg-muted *:data-[slot=progress-indicator]:bg-foreground"`, then the part
    and the whole in words. The bar is ink for every accent: marigold has 2.74:1 on the track.
  - kpi=strip: the period panel with `overflow-hidden`. The `kpis/strip.md` grid follows the head, outside `CardContent`. Rules: 1 px, `border-border`.
- Charts: bars per day, `maxBarSize={14}`, `radius={[3, 3, 0, 0]}`, in `var(--chart-1)`, with the weekend tinted behind.
  Lines and areas: the knobs give the 1.5 px line and the faint fill. `<CartesianGrid vertical={false} />`.
  The X axis shows the day number. Heights: main `h-60`, side `h-44`. Breakdowns: horizontal bars, `radius={3}`.
  - heat: cells `size-[14px] rounded-[3px]`, `gap-[3px]`. The margin rule takes 18 px: 16 px cells overflow at 375 px.
- Weekend: one rule, never the opening days. The days come from the `Intl.Locale` week data, else Saturday and Sunday.

```tsx
/** Week data of Intl.Locale. Some browsers have getWeekInfo(), some have weekInfo, some have neither. */
type LocaleWeekInfo = { getWeekInfo?: () => { weekend: number[] }; weekInfo?: { weekend: number[] } };
/** ISO weekdays of the weekend in `locale`, 1 (Monday) to 7 (Sunday). Many Arabic regions give [5, 6]. */
function weekendDays(locale: string): number[] {
	const intlLocale: Intl.Locale & LocaleWeekInfo = new Intl.Locale(locale);
	return intlLocale.getWeekInfo?.().weekend ?? intlLocale.weekInfo?.weekend ?? [6, 7];
}

// Before the Bar, with `const weekend = weekendDays(locale)`. Noon UTC keeps the day. getUTCDay gives 0 for Sunday, ISO 7.
{points.map((point) =>
	weekend.includes(new Date(`${point.day}T12:00:00Z`).getUTCDay() || 7) ? (
		<ReferenceArea key={point.day} x1={point.day} x2={point.day} fill="var(--muted)" fillOpacity={1} />
	) : null,
)}
```

- Tables: diary rows, `TableBody className="[&>tr]:border-dashed"`. A dated row starts with the serif day number
  (`font-numeric text-xl lining-nums`) over the weekday. Amounts `text-end tabular-nums`. Rows `hover:bg-accent/40`.
- Navigation: the aubergine sidebar. The active item takes the knob fill and the 3 px start bar. Keep the kit brand mark.
- Badges, buttons, inputs, links: matched corners. A status is a `Badge` plus the word: confirmed `success`, waiting `warning`,
  cancelled `destructive`. Inputs keep the kit 1 px `--input` line, 3.52:1 on the page.
  Links: `text-foreground underline decoration-2 decoration-primary underline-offset-4`, never `text-primary`.
- Motion: the now line moves once a minute, with no transition. Nothing moves on load.

## Signature
1. The date block: the serif day number over the short weekday. It heads the home, each dated row, and each KPI day.
   Bind it to the trade: the day of the booking, the class, or the rental start.

```tsx
type DateBlockProps = {
	/** Day to show, YYYY-MM-DD in the user time zone, for example the day of a booking. */
	day: string;
	/** True for the current day. The block fills with the accent, so its text keeps 4.5:1 with every accent. */
	isToday?: boolean;
};

/** A diary date: the day number in the serif over the short weekday, in the app language. */
function DateBlock({ day, isToday = false }: DateBlockProps) {
	const { locale } = useT();
	// Noon UTC keeps the same calendar day in every time zone.
	const date = new Date(`${day}T12:00:00Z`);
	const format = (options: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat(locale, { ...options, timeZone: "UTC" }).format(date);
	return (
		<time dateTime={day} className={cn("flex w-14 shrink-0 flex-col items-center rounded-md border py-1.5", isToday && "border-primary bg-primary text-primary-foreground")}>
			<span className="font-medium font-numeric text-3xl lining-nums tabular-nums leading-none">{format({ day: "numeric" })}</span>
			<span className={cn("mt-1 text-xs", !isToday && "text-muted-foreground")}>{format({ weekday: "short" })}</span>
		</time>
	);
}
```

2. The now line on the day grid of today. Hours: the opening hours in the data, else the first and last item, rounded out.

```tsx
type NowLineProps = {
	/** First hour of the grid, 0 to 23, in the user time zone. */
	openHour: number;
	/** Hour where the grid ends, 1 to 24, after `openHour`. */
	closeHour: number;
};

/** The current time as a line across the hour rows. Put it in their `relative` column. */
function NowLine({ openHour, closeHour }: NowLineProps) {
	const [now, setNow] = useState(() => new Date());
	// effect: the wall clock is an external system. One tick per minute moves the line.
	useEffect(() => {
		const timer = window.setInterval(() => setNow(new Date()), 60_000);
		return () => window.clearInterval(timer);
	}, []);
	const minutesOpen = (closeHour - openHour) * 60;
	const minutesIn = now.getHours() * 60 + now.getMinutes() - openHour * 60;
	// Before opening, after closing, or with no hours, the line has no place.
	if (minutesOpen <= 0 || minutesIn < 0 || minutesIn > minutesOpen) {
		return null;
	}
	return (
		<div aria-hidden className="pointer-events-none absolute inset-x-0 flex items-center" style={{ top: `${(minutesIn / minutesOpen) * 100}%` }}>
			{/* The 2 px line is ink: marigold has 3.06:1 at most. The dot shows the accent. */}
			<span className="-ms-1 size-2 rounded-full bg-primary" />
			<span className="h-0.5 flex-1 bg-foreground" />
		</div>
	);
}
```

## Empty state
- Every panel keeps its place and outline. The day grid keeps its hour rows, and the now line still moves.
- KPI figures show real zeros under their date heads. Day bars sit at 0, over the weekend tint.
- Lists show three ruled empty lines, `h-10 border-b border-dashed`, then one muted sentence.
- Setup strip: under the page header, one slim outline strip, `flex flex-wrap items-center gap-3 rounded-surface border px-5 py-3`.
  It holds one sentence and 2 to 4 `size="sm"` buttons with the first real actions, named after the trade.

## Do not
- A fill or a shadow on a panel. Instead, draw outline pages on the warm white ground.
- A light sidebar, a cream ground, or a clay accent. Instead, keep the aubergine sidebar, the warm white, and the three accents.
- Opening hours that the data does not give. Instead, take the hours from the data, or from the first and last item.
- Four equal outline cards for the KPIs. Instead, put the figures of one period in one panel, under its date head.
- Text or a thin line in `--primary`. Instead, use the ink with an accent underline or dot: marigold is too light.

## Check
- Is the sidebar dark aubergine, and is the page near white with a warm hint?
- Does the home show the date block of today, with the serif day number over the weekday?
- Where the home has a day grid, does a line mark the current time?
- Are the panels outline pages with a margin rule in the body, and no shadow?
- Do the KPI figures sit in one panel per period, under a date head?
- With no rows, do the panels keep their ruled empty lines and their zeros?
