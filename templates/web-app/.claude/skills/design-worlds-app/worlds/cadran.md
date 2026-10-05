# Cadran — the dial face of a precision instrument

`cadran` · medium · light · comfortable · best for: SaaS analytics, product metrics, subscriptions,
marketing analytics, AI usage, revenue dashboards · avoid for: clinic, kids, restaurant, booking
desk, CRM pipeline

## 1. Feel

A clean instrument face under cool light. White panels sit on a pale grey canvas; hairlines do
the work of shadows. One electric violet-blue needle marks the selected metric, the lead series,
and the main action. Numbers are large, tabular, and calm. The chart is the hero.

Voice: a precise chart caption. Name the metric and the period: "Active subscriptions, last 30
days". A verb first on buttons. No hype, no exclamation marks, no emoji.

## 2. World law and client choices

World law, the same in every Cadran app:

- Kit shell: `variant: "inset"`, `density: "comfortable"`.
- One accent: violet-blue `--primary`. It marks the active KPI tab, the lead series, the focus
  ring, and one primary button per view. It never fills a large area.
- Hairlines, not shadows: in `card.tsx`, remove `shadow-sm` from the Card base class.
- Corners: `--radius: 0.5rem` (cards 12 px, controls 6 px). In `button.tsx`, replace
  `rounded-full` in the base class with `rounded-md`. Badges stay pills.
- Geist for words and numbers. Geist Mono for ids, timestamps, axis ticks, and keys.
- Time runs from left to right in every chart, also in Arabic: wrap charts in `<div dir="ltr">`.
- Three signatures: the KPI tab strip, the small multiples, the hatched band.
- One static light treatment. Remove the `.dark` block. Add no theme picker.

Client choices, decided fresh for each app:

- `contentWidth`: `full` for chart and table apps, `centered` for at most 4 metrics.
- The sign-in composition S1 or S2, and the first-run composition F1 or F2 (section 6).
- The lead metric of the strip, from the real data (subscriptions, events, API calls).
- The breakdown of the analytics side panel (plan, country, source), only when the data has it.

Two Cadran apps never share the same sign-in and the same first-run composition.

Dark twin, only on request: ground `#0e0f12`, card `#15161b`, ink `#ececf1`, muted text
`#9b9eab`, border `#ffffff14`, primary `#8579ff` with `#0e0f12` text.

## 3. Tokens

```css
:root {
	--background: #fcfcfd;
	--foreground: #101114;
	--card: #ffffff;
	--card-foreground: #101114;
	--popover: #ffffff;
	--popover-foreground: #101114;
	--primary: #5b4bff;
	--primary-foreground: #ffffff;
	--secondary: #f1f1f4;
	--secondary-foreground: #1d1f26;
	--muted: #f3f3f6;
	--muted-foreground: #5d6170;
	--accent: #efeff3;
	--accent-foreground: #101114;
	--destructive: #d42a1f;
	--destructive-foreground: #ffffff;
	--border: #e6e6ec;
	--input: #dadae2;
	--ring: #5b4bff;
	--radius: 0.5rem;
	--sidebar: #f2f2f5;
	--sidebar-foreground: #3c3f4a;
	--sidebar-accent: #ffffff;
	--sidebar-accent-foreground: #101114;
	--sidebar-border: #e2e2e8;
	--sidebar-ring: #5b4bff;
	--chart-1: #5b4bff;
	--chart-2: #2e2499;
	--chart-3: #8579ff;
	--chart-4: #4032c8;
	--chart-5: #7465f5;
	--success: #11774f;
	--success-foreground: #ffffff;
	--warning: #b54708;
	--warning-foreground: #ffffff;
}

@theme {
	--font-sans: "Geist", ui-sans-serif, system-ui, sans-serif;
	--font-display: "Geist", ui-sans-serif, system-ui, sans-serif;
	--font-mono: "Geist Mono", ui-monospace, monospace;
}

html:lang(ar) {
	--font-sans: "Noto Sans Arabic", ui-sans-serif, system-ui, sans-serif;
	--font-display: "Alexandria", "Noto Sans Arabic", ui-sans-serif, system-ui, sans-serif;
}
```

The chart series are one hue: mid, deep, light. Use them in order, each with a direct label.
Status colors mark states only, never a series. In `@layer base`, set the `html` letter-spacing
to `-0.01em`. In `head().links` of `src/routes/__root.tsx`, replace the old font links:

```ts
// World cadran: Geist + Geist Mono, Arabic twins Noto Sans Arabic + Alexandria.
{ rel: "preconnect", href: "https://fonts.googleapis.com" },
{ rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
{
	rel: "stylesheet",
	href: "https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600&family=Geist+Mono:wght@400;500&family=Noto+Sans+Arabic:wght@400;500;600&family=Alexandria:wght@500;600&display=swap",
},
```

## 4. Type

- Titles: the kit h1. KPI value: `text-2xl font-semibold tabular-nums tracking-tight`. Labels:
  `text-xs font-medium text-muted-foreground`, sentence case. Mono ids: `font-mono text-xs`.
- `Intl.NumberFormat` with the app locale; `notation: "compact"` above 10,000, the full value in
  `title`. In Arabic, add `-u-nu-latn`, so digits stay in Geist. Currency comes from the data.

## 5. Signatures

1. **The KPI tab strip.** Add `src/shared/ui/tabs.tsx` on `Tabs` from `radix-ui`. The strip
   opens the main chart Card (`gap-0 overflow-hidden py-0`) and holds 3 to 5 metrics. List:
   `flex overflow-x-auto border-b sm:grid sm:auto-cols-fr sm:grid-flow-col`. Trigger: `relative
   flex min-w-40 flex-1 flex-col items-start gap-1 border-e px-5 py-4 text-start last:border-e-0
   data-[state=inactive]:bg-muted/40 before:absolute before:inset-x-0 before:top-0 before:h-0.5
   data-[state=active]:before:bg-primary`: label, value, delta pill. Each `Tabs.Content` holds the
   chart of its metric. Delta pill: a `span` (`inline-flex items-center gap-0.5 rounded-full
   px-1.5 text-xs font-medium tabular-nums`) with `ArrowUp` or `ArrowDown`. The kit `Badge`
   changes color on hover, so chips are spans. The arrow follows the sign. The color follows the
   good direction: `bg-success/10 text-success` or `bg-destructive/10 text-destructive` (churn up
   is bad). No previous period: `bg-muted` and a dash.
2. **The small multiples.** A hairline grid: `grid gap-px overflow-hidden rounded-xl border
   bg-border sm:grid-cols-2 xl:grid-cols-3`. Each cell is a `button` (`flex flex-col gap-2
   bg-card p-4 text-start`) that selects its metric in the strip: label, value (`text-xl`),
   delta pill, mini chart. Mini chart: inline SVG, `viewBox="0 0 100 32"`,
   `preserveAspectRatio="none"`, `className="h-12 w-full text-chart-1"`. Draw a `currentColor`
   polyline (`strokeWidth={1.5}`, `vectorEffect="non-scaling-stroke"`). Under it, fill the area
   with a `linearGradient` (id from `useId()`, opacity 0.18 to 0).
3. **The hatched band and the range control.** A period without data gets
   `bg-[repeating-linear-gradient(135deg,var(--color-border)_0_1px,transparent_1px_7px)]`. In the
   main chart, add a `ReferenceArea` with an SVG `pattern` of the same lines and "No data".
   A real zero is data: draw it as a line at zero.
   Range control: `inline-flex gap-0.5 rounded-md border bg-muted p-0.5`. Segment: `h-7 rounded-sm
   px-2.5 text-xs text-muted-foreground aria-pressed:bg-card aria-pressed:text-foreground
   aria-pressed:ring-1 aria-pressed:ring-border`: 7D, 30D, 3M, 12M. Each ends with `<Kbd
   className="hidden xl:inline-flex">` 1 to 4. Add `kbd.tsx`: `inline-flex h-5 min-w-5
   items-center justify-center rounded-sm border px-1 font-mono text-[0.625rem]`. One effect
   reads the keys: `// effect: listen to document keys 1 to 4 for the range.` Skip keys with a
   modifier or in a field. The URL keeps the range:
   `z.enum(["7d", "30d", "3m", "12m"]).catch("30d")`.

## 6. Screens

**Shell parts.** `brand`: a dial glyph (SVG, `size-5 text-primary`) and the app name. Nav group
labels: `px-3 pb-1 pt-4 text-xs font-medium text-muted-foreground`. `pnpm add lucide-react`:
`ChartArea`, `Users`, `Settings`, `RefreshCw`, `Search`, `Copy`, `ArrowUp`, `ArrowDown`,
`ChevronLeft` and `ChevronRight` (`rtl:rotate-180`). `header`: "Updated 14:32" in
mono (from `dataUpdatedAt`) and a refresh button (`queryClient.invalidateQueries()`). At
`ms-auto`, the account menu: add `dropdown-menu.tsx` on `DropdownMenu` from `radix-ui`.
`sidebarFooter`: while setup is open, a `rounded-lg border bg-background p-3` card with "Setup
1/3" and the F1 meter.

**Sign-in** (email and password only; keep the auth feature and its sign-up switch):
- S1 Dial split: `grid min-h-dvh bg-sidebar lg:grid-cols-2`. Start: `flex flex-col justify-center
  gap-8 px-6 py-12 sm:px-12`: brand, h1 (`text-3xl font-semibold`), one muted line, the form
  without a Card (`max-w-sm`, fields `h-10`). End: `m-3 hidden items-center justify-center
  rounded-2xl border bg-background lg:flex` with the dial art.
- S2 Hatched desk: a `bg-sidebar` page with the hatch over all of it. A centered `Card` (`w-full
  max-w-sm px-8 py-8`) holds the dial glyph (`size-8`), the title, and the form.

**First run** (real zeros, a getting-started device with working actions):
- F1 Strip first: `DashboardBody layout="analytics"`. Primary: the strip with real `0` values
  and dash pills, over one full hatched band with "No data yet". Secondary: a "Get started" Card
  with "0 of 3", a meter (`grid grid-cols-3 gap-1`, segments `h-1 rounded-full`, done
  `bg-primary`, open `bg-muted`), and 3 rows. Each row has a step circle, a label, and a real
  action: the create Dialog, the import page, or settings.
- F2 Grid first: `DashboardBody layout="workbench"`. Primary: the 3 steps as tall rows with mono
  numbers `01` to `03`. Secondary: the small multiples with the real metric names, `0` values,
  and hatched mini charts, under one line: "Charts fill in after the first record."

**Analytics view**: the range control and Export go in the `actions` of `DashboardPageHeader`.
`DashboardBody layout="analytics"`: the strip and the main chart, with the breakdown beside.
Main chart: `pnpm add recharts`, an `AreaChart` at `h-72`, `CartesianGrid vertical={false}`,
axes without lines, mono ticks in `--muted-foreground`. The series is `--chart-1`, width 2, with
the gradient. The previous period is a dashed `Line` (`4 4`) in `--muted-foreground`. Tooltip:
`rounded-md border bg-popover px-3 py-2 text-xs shadow-md`. Breakdown: name, end-aligned value,
and a bar `h-1.5 rounded-full bg-chart-1` on a `bg-muted` track; the top 6, then "Other". Under
the body: the small multiples.

**Records view** (subscriptions, customers, events): `DashboardBody layout="operations"`.
- Toolbar: a status filter in the range-control style with real counts, a search `Input` (`h-8
  w-64 ps-8`), and Export CSV (`outline`, `sm`). The URL keeps the filters.
- Add `table.tsx` (plain HTML) and `checkbox.tsx` (`Checkbox` from `radix-ui`) to
  `src/shared/ui`. Card `gap-0 overflow-hidden py-0`. Header `h-9 bg-muted/60 text-xs
  text-muted-foreground`. Rows `h-11 border-b hover:bg-muted/40 data-[state=selected]:bg-primary/5`.
  Numbers `text-end tabular-nums`; ids in mono.
- Status chip: a `span` (`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs
  font-medium`), a `size-1.5 rounded-full bg-current` dot, and the word. Active `bg-success/10
  text-success`, trialing `bg-primary/10 text-primary`, past due `bg-warning/10 text-warning`,
  canceled `bg-muted text-muted-foreground`.
- Selection: a checkbox column. With rows selected, a `bg-primary/5` bar replaces the toolbar:
  "3 selected", the real bulk actions, Clear.
- A `tfoot` row (`h-10 bg-muted/40 text-xs`): the filtered count and the sum of each money
  column, from the query, not from the visible page. Then "1–50 of 128" in mono and two buttons.

**Record detail**: a row opens `Sheet` (`side="end"`, `className="w-full gap-0 sm:max-w-md"`).
Header (`border-b p-5`): name, status chip, mono id, copy button. Body (`flex flex-col gap-6
p-5`): a mini chart when the record has a series, a `dl` (`grid grid-cols-[minmax(0,9rem)_1fr]
gap-y-2.5 text-sm`), the activity. Footer: the real actions, with a confirm Dialog when destructive.

**Settings**: `mx-auto w-full max-w-3xl`, underline tabs (list `border-b`, the `before:` bar at
`before:bottom-0`). Each section is a Card: title, one muted line, fields in `grid gap-4
sm:grid-cols-2`, a `border-t bg-muted/40` footer with Save, disabled until a change. A danger Card
with `border-destructive/30` and a confirm Dialog.

**Loading and errors**: skeletons copy the grid (strip `h-16`, chart `h-72`, rows `h-11`). An
error stays in its panel: what failed, and Retry (`refetch`).

**Empty state art**: an inline SVG (`h-20 w-32`): a `stroke-border` frame, two hatched columns,
a flat `text-chart-1` baseline with an end dot. Then a title, one sentence, one button.

**375 px**: the strip scrolls (`snap-x snap-mandatory`). The range control fills the width
(`grid w-full grid-cols-4 sm:inline-flex sm:w-auto`). The chart is `h-56`. The table keeps name,
status, and amount; other cells are `hidden md:table-cell`. The Sheet is full width.

## 7. Motion

Quiet and exact. CSS transitions and tw-animate-css only.

- Tab switch: key the chart by metric, `animate-in fade-in-0 duration-200
  motion-reduce:animate-none`.
- Recharts: `animationDuration={400}`, and `isAnimationActive={false}` under reduced motion
  (read `matchMedia` with `useSyncExternalStore`).
- Rows `transition-colors duration-100`; buttons `active:scale-[0.98] motion-reduce:transform-none`.
- Never: count-up numbers, bouncing charts, loops, parallax.

## 8. Imagery

Default: SVG art. The S1 dial: inline SVG, `viewBox="0 0 400 400"`, `size-96`, `aria-hidden`.
Draw 61 ticks on a 300° arc (`Array.from`, `rotate`) in `stroke-border`, every fifth one longer
in `stroke-muted-foreground`. Add a 70° arc in `stroke-primary` (width 6), a hatched sector, and
a needle. No numbers, no words.

Optional `generate_image`, at most 1: `public/cadran-signin.png`, used as `/cadran-signin.png` in
the S1 end column. Prompt model: "Macro photograph of a brushed aluminium
dial with fine tick marks and no numerals, one thin violet-blue needle, cool soft light, pale
grey ground, no text, no logos, no watermark."

## 9. Bans

- No pie, donut, radar, gauge, or 3D chart. No rainbow palette, no second accent.
- No KPI card with an icon in a colored circle. No metric without its period.
- No invented trend, growth, revenue, or customer. A delta needs a real previous period.
- No shadow on a data card, no gradient, no start-aligned numbers, no color-only status.
- No full-page spinner, no uppercase eyebrows, no theme picker, no third-party sign-in button.

## 10. Self-check

1. The shell is `inset` and `comfortable`; the nav lists only real routes.
2. Each view has one violet lead: the active KPI tab or the lead series.
3. The strip swaps the chart; values come from real queries; empty periods are hatched.
4. Keys 1 to 4 set the range, and the URL keeps it.
5. A first run shows real zeros and a getting-started device with working actions.
6. Table numbers are end-aligned and tabular; footer sums come from the query.
7. At 375 px, the strip scrolls and nothing overflows; strings use `t()` and logical classes.
