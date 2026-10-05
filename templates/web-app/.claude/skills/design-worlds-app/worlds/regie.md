# Régie — the dispatch floor at five in the morning

`regie` · medium · dark · compact · best for: logistics, dispatch, delivery ops, courier,
field service, fleet, warehouse, moving company · avoid for: beauty, wellness, kids, school,
clinic, events

## 1. Feel

The dispatch floor before the first van leaves: slate walls, a row of screens, and one
safety-orange lamp that lights when a job has no driver. The app answers three questions at a
glance: what has no driver, what is late, and when each stop arrives. Saira Condensed carries the
minutes and the states, tall and narrow like a departure board. The board stays calm until a
person must act.

Voice: dispatch radio. State first, then time ("Late · 14:32"). A verb on each button. Numbers
before words ("3 unassigned"). No exclamation marks, no emoji.

## 2. World law and client choices

World law, the same in every Régie app:

- Shell: `DashboardShell variant="rail" density="compact"`, with 4 to 6 labeled modules.
- Dark only. Delete the `.dark` block of `tokens.css`: `:root` holds the one dark treatment.
- Safety orange (`primary`) means "a person must act": the main action, the UNASSIGNED state,
  the now line, focus, and the active rail item. It never fills a card, a header, or a chart.
- Tint means act. Only UNASSIGNED, LATE, and FAILED rows get a tint and a start edge.
- Saira Condensed for headings, numerals, and badges; Saira for text; JetBrains Mono for IDs.
- Corners 6 px (`--radius: 0.375rem`). In `button.tsx` and `badge.tsx`, replace `rounded-full`
  in the base class with `rounded-md`. Only the live dot is round.
- Hairlines, not shadows: remove `shadow-sm` from the `card.tsx` base class.

Client choices, decided fresh for each app:

- The sign-in (A1 or A2) and the first run (F1 or F2).
- The words of the trade: job, delivery, stop, visit, or move; vehicle, driver, or crew.
- The board span: one day (the depot hours, else 06:00 to 22:00) or one week for moves.
- `contentWidth`: `full` (default), or `centered` for an app of forms.

Two Régie apps never share the same sign-in and first-run composition.

## 3. Tokens

```css
:root {
	--background: #0d1015;
	--foreground: #e7ecf3;
	--card: #141920;
	--card-foreground: #e7ecf3;
	--popover: #1a2029;
	--popover-foreground: #e7ecf3;
	--primary: #ff6f1a;
	--primary-foreground: #0d1015;
	--secondary: #1e252f;
	--secondary-foreground: #e7ecf3;
	--muted: #181e26;
	--muted-foreground: #94a0b0;
	--accent: #222a35;
	--accent-foreground: #f2f5f9;
	--destructive: #d93636;
	--destructive-foreground: #ffffff;
	--border: #ffffff17;
	--input: #ffffff26;
	--ring: #ff6f1a;
	--radius: 0.375rem;
	--sidebar: #090c10;
	--sidebar-foreground: #c9d1dc;
	--sidebar-accent: #1b222c;
	--sidebar-accent-foreground: #ff8640;
	--sidebar-border: #ffffff12;
	--sidebar-ring: #ff8640;
	--chart-1: #ff6f1a;
	--chart-2: #4d9fff;
	--chart-3: #2fc6b8;
	--chart-4: #b18cff;
	--chart-5: #d8cba4;
	--success: #3ccf7f;
	--success-foreground: #0d1015;
	--warning: #f5c542;
	--warning-foreground: #0d1015;
}

@theme {
	--font-sans: "Saira", ui-sans-serif, system-ui, sans-serif;
	--font-display: "Saira Condensed", "Saira", ui-sans-serif, system-ui, sans-serif;
	--font-mono: "JetBrains Mono", ui-monospace, monospace;
}

html:lang(ar) {
	--font-sans: "Noto Sans Arabic", ui-sans-serif, system-ui, sans-serif;
	--font-display: "Cairo", "Noto Sans Arabic", ui-sans-serif, system-ui, sans-serif;
}
```

`destructive` stays dark enough for the `text-white` of the kit Button and Badge. `chart-2` is
the EN ROUTE blue, and `chart-3` is the ON SITE teal.

In `__root.tsx`, keep `tokensCss` and replace the three font entries of `head().links` with:

```ts
{ rel: "preconnect", href: "https://fonts.googleapis.com" },
{ rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
{
	rel: "stylesheet",
	href: "https://fonts.googleapis.com/css2?family=Saira+Condensed:wght@500;600;700&family=Saira:wght@400;500;600&family=JetBrains+Mono:wght@400;500&family=Cairo:wght@600;700&family=Noto+Sans+Arabic:wght@400;500;600&display=swap",
},
```

## 4. Type

Write these role strings once as constants in the workspace feature:

- `label`: `font-display text-[11px] font-semibold uppercase tracking-wider text-muted-foreground
  rtl:tracking-normal`. Table headers, state bar labels, and Sheet field labels.
- `numeral`: `font-display font-semibold tabular-nums leading-none`: `text-2xl` in a row,
  `text-5xl` in a count, `text-7xl` for the ETA in the Sheet.
- `code`: `font-mono text-xs slashed-zero`. Plates and phones also get `dir="ltr"`.
- `kbd`: `inline-flex h-5 min-w-5 items-center justify-center rounded-sm border bg-muted px-1
  font-mono text-[10px] text-muted-foreground`, only for a shortcut that works.
- Body: Saira `text-sm`; table cells `text-[13px]`.
- Arabic: Cairo replaces Saira Condensed, and Noto Sans Arabic replaces Saira. Arabic has no
  capitals, and `rtl:tracking-normal` removes the tracking.

## 5. Signatures

1. **The ETA numeral.** Every job shows its ETA as a `numeral`: `text-2xl` at the end of a row,
   with the window under it in `code text-muted-foreground`, and `text-7xl` in the Sheet. The
   ETA is the stored `eta_at` (set by dispatch or the driver), else the window end. Never
   compute it from a guessed distance. Past the window end, it turns `text-warning`.
2. **The state rows.** Store one state per job: `unassigned`, `assigned`, `en_route`,
   `on_site`, `done`, `failed`. LATE is derived: the ETA is past the window end on an open job.
   Map each shown state to full class strings in one `as const` object:
   - `unassigned`: row `bg-primary/10 border-s-primary`, badge `bg-primary text-primary-foreground`.
   - `late`: row `bg-warning/10 border-s-warning`, badge `bg-warning text-warning-foreground`.
   - `failed`: row `bg-destructive/10 border-s-destructive`, badge `bg-destructive text-white`.
   - Calm rows: `border-s-transparent`. Badges: `assigned` `border-border text-muted-foreground`,
     `en_route` `bg-chart-2/15 text-chart-2`, `on_site` `bg-chart-3/15 text-chart-3`, `done`
     `bg-success/15 text-success`.

   Every row has `border-s-2`. The badge is `<Badge variant="outline">` with `h-5 rounded-sm
   px-1.5`, the `label` type in its own color, and `border-transparent` on a fill. It always
   shows the translated state word.
3. **The live state bar.** The last child of the page: `sticky bottom-0 z-20 -mx-4 -mb-4 mt-auto
   flex h-12 items-center gap-1 overflow-x-auto border-t bg-card px-4`. A `h-0.5` top strip
   shows the share of each state. Start: a `bg-success` dot with an `animate-ping` copy, and
   "Live". Then one `button` per state (`aria-pressed`): its count in `numeral text-xl` over its
   `label`. It sets the same filter as the Jobs `Tabs`. End: the vehicles on shift ("4/6") in
   `numeral text-xl`. The query has `refetchInterval: 15_000`. After a failed refetch, the dot
   is still and `bg-warning`, and the label reads "Stale · 14:32".

## 6. Screens

**Sign-in** (`features/auth/components/login-page.tsx`). Keep its form logic and sign-up toggle.
Email and password only.

- A1 Yard at night: `grid min-h-svh lg:grid-cols-2`. Start: `flex flex-col justify-between p-8`,
  the app name in `font-display text-xl uppercase`, the form in `mx-auto w-full max-w-sm`. End
  (`hidden lg:block`): `relative m-3 overflow-hidden rounded-xl border` with `/signin-yard.png`
  (`absolute inset-0 size-full object-cover`) under an `absolute inset-0` scrim
  (`bg-linear-to-t from-background to-transparent`), and one line in `font-display text-5xl
  uppercase`.
- A2 Departure board: no image. `grid min-h-svh place-items-center p-4`, under a hazard band:
  `fixed inset-x-0 top-0 h-1.5
  bg-[repeating-linear-gradient(135deg,var(--color-primary)_0_10px,transparent_10px_20px)]`.
  A `w-full max-w-sm` column: the app name in `font-display text-6xl uppercase leading-none`,
  the form in a `Card` with `p-6`, then the lane art.

**First run** (no vehicles, no jobs). Real zeros only, and the live state bar shows them. The
getting-started device has 3 steps: add a vehicle or a driver, create the first job, assign it.
Each step opens the real create Dialog and turns done from data, with a `text-success` check.

- F1 Board first: `DashboardBody layout="workbench"`. `primary`: a `Card` "Set up dispatch" with
  3 rows (`h-14 border-t px-4`: the step number in `code`, the text, a `size="sm"` button).
  `secondary`: the lane canvas with the axis, the now line, and one hatched lane with "Add vehicle".
- F2 First job on the board: `DashboardBody layout="operations"`. `primary`: the lane canvas at
  `min-h-96`, all hatch, with an inline `Card` form (`max-w-md`): pickup, drop-off, date, window,
  "Create job". `secondary`: a checklist (add vehicles, add drivers, set the depot hours).

**Dispatch board** (`/app`). `DashboardPageHeader`: the date as `eyebrow`, "Dispatch", and day
buttons (previous, Today, next; chevrons get `rtl:rotate-180`). `DashboardBody
layout="workbench"`: `primary` is the queue (UNASSIGNED and LATE first, then by ETA) as
`divide-y` rows in a `Card` with `p-0`. `secondary` is the lane canvas:

- A `Card` with `p-0` and an inner `overflow-x-auto` around a `min-w-[56rem]` grid.
- Axis: `h-8 border-b`, hour ticks in `code`, placed with an inline `insetInlineStart` percent.
  In Arabic, time runs right to left.
- Lanes: `relative h-12 border-b`, one per vehicle, with a `sticky start-0 w-40 border-e bg-card`
  head (name and plate). Off-shift time gets the hatch
  `bg-[repeating-linear-gradient(135deg,var(--color-border)_0_1px,transparent_1px_7px)]`.
- Job block: a `button`, `absolute inset-y-1.5 min-w-16 rounded-sm border-s-2 px-2 text-xs`,
  with the state tint, the ID, and the ETA.
- Now line: `absolute inset-y-0 w-px bg-primary` with a time pill on the axis.
- No fake map. Add a map provider only when the user asks.

A row or a block opens the job Sheet. Rail items (`pnpm add lucide-react`): Dispatch
`RadioTower`, Jobs `Package`, Fleet `Truck`, Settings `Settings`; Reports `ChartColumn` only when
built. `header`: the depot name, the search (`kbd` "/"), the clock, and "New job" (`kbd` "N").
One `keydown` listener (with its `// effect:` comment) handles both keys. `sidebarFooter`: the
user initials in a `size-9 rounded-md bg-secondary` square, and "Sign out".

**Jobs** (`/app/jobs`). Add `src/shared/ui/table.tsx` (plain HTML), `checkbox.tsx`, and
`tabs.tsx` (both on `radix-ui`), with tokens only.

- Toolbar: state `Tabs` with counts, a driver `Select`, a date `Input`, the search.
- Header `sticky top-0 h-8 bg-muted`, `label` cells: checkbox, ID, state, stop, window, driver,
  ETA (`text-end`). Rows: `h-10 border-s-2 text-[13px]`, the state classes, `hover:bg-accent/60`.
- Selection bar, above the state bar: `fixed inset-x-0 bottom-16 z-30 mx-auto w-fit rounded-lg
  border bg-popover px-3 py-2 shadow-lg`: the count, Assign, Reschedule, Mark failed, Clear.
- Footer (`tfoot`, `h-9 bg-muted`): the shown, late, and done counts. 50 rows, then "Load more".

**Fleet** (`/app/fleet`): the same table for vehicles and drivers: name, plate, type, shift
hours, and an On shift / Off badge. A row opens an edit Sheet.

**Job detail**: `SheetContent side="end" className="w-full gap-0 p-0 sm:max-w-md"`. Header
`border-b p-4`: the ID, the badge, the stop as `SheetTitle`. ETA block: `numeral text-7xl`, the
window, and "+12 min" in `text-warning` when late. Route: an `ol` with `ms-2 border-s-2 ps-4`
and a `size-2.5 rounded-full` dot per stop (done `bg-success`, next `bg-primary`). Fields:
driver, vehicle, notes. Footer `sticky bottom-0 border-t bg-popover p-4`: the next step as the
primary button (Assign, Mark picked up, Mark delivered). "Mark failed" asks the reason in a Dialog.

**Reports** (only when the brief asks): `layout="analytics"`. Show done jobs per day as inline
SVG bars, on time `fill-chart-2` and late `fill-chart-5`, with labels and a legend. Under 7 days
of data, show the hatch and "Not enough data yet".

**Settings**: `Tabs` for Depot (name, time zone, hours), Fleet types, Team, and Account. Each tab
is a `Card` with a "Save" footer. Deletes sit in a `border-destructive/50` card.

**Empty state art**: an inline SVG (`aria-hidden`, 160 × 96): three lanes in `stroke-border`, a
dashed route, one `fill-primary` dot. Then one sentence and one action.

**375 px**: the rail becomes the kit Sheet menu. The queue comes first; the lanes scroll inside
their card, never the page. Rows become two lines: ID, badge, and ETA; then the stop and the
window. The state bar keeps the dot and 3 counts. The Sheet is full width.

## 7. Motion

Fast and mechanical, like a split-flap board.

- Rows: `transition-colors duration-100`. Buttons: `transition-transform active:scale-[0.98]`.
- A state change: the badge gets `key={state}` and `animate-in fade-in-0 zoom-in-95 duration-150`.
- The live dot pings. The now line moves once a minute, from a clock read with
  `useSyncExternalStore`. No other loop.
- Each animation class gets `motion-reduce:animate-none` or `motion-reduce:transition-none`.
- Never: count-up numbers, a bouncing badge, a radar sweep, a page spinner.

## 8. Imagery

SVG art by default (the lane art). A1 only: one `generate_image`, aspect `4:5`, saved to
`public/signin-yard.png` and used as `/signin-yard.png`. At most 2 images in the first build.

Prompt model: "Aerial night photograph of [a parcel depot yard with rows of vans / a warehouse
dock / a lot of moving trucks], sodium lights, wet asphalt, light trails, slate blue shadows,
a few safety-orange highlights, no faces, no text, no logos, no readable plates."

Never a stock map, a globe, a smiling courier, or a 3D truck icon.

## 9. Bans

- No light mode, no theme picker, no second accent color, no pills.
- No orange decoration: no orange card, header, chart background, or icon without a meaning.
- No color without a word. No fake map, ETA, distance, driver, or on-time rate.
- No KPI grid above the board. No pie or radar chart. No page spinner.
- No soft shadows on cards. No gradient, except the A1 scrim, the hazard band, and the hatch.

## 10. Self-check

1. The shell is `DashboardShell variant="rail" density="compact"`, and every route is dark.
2. Orange marks only the main action, UNASSIGNED, the now line, focus, and the active rail item.
3. Every ETA is a Saira Condensed numeral from stored data. A late ETA is `text-warning`.
4. Only UNASSIGNED, LATE, and FAILED rows are tinted. Every state shows its uppercase word.
5. The live state bar shows real counts, filters the board, and reads "Stale" after a failure.
6. The first run uses F1 or F2, with real zeros and 3 working steps.
7. Buttons and badges have 6 px corners. At 375 px the page never scrolls sideways.
8. In Arabic, Cairo loads, time runs right to left, and labels have no tracking.
