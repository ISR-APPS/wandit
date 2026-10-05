# Créneau — the appointment book, open at today

`creneau` · medium · light · compact · best for: salon, barber, spa, studio classes, gym classes,
tutoring, rentals, clinic front desk, coaching · avoid for: finance, dev tools, e-commerce, CRM
pipelines, analytics

## 1. Feel

The front desk at 9:58. The day is a grid of time, and each person on the team owns a column.
Closed hours are hatched, like a blocked page in a paper diary. A thin aubergine line marks now
and moves down the day. Warm white paper, a dark aubergine rail, round friendly type. One look
tells who comes next; one click checks them in.

Voice: warm and short, like a good receptionist. A verb first ("Book", "Check in", "Mark
no-show"). Times in mono ("09:30–10:15"). No exclamation marks, no emoji.

## 2. World law and client choices

World law, the same in every Créneau app:

- Shell: `DashboardShell variant="rail" density="compact"`: a dark aubergine rail with a label
  under each icon, on a warm white page. The calendar toolbar goes in the shell `header`.
- Aubergine (`--primary`) marks the main action, the now line, and today. It never fills a block.
- Status owns the block colors, never the service or the staff member.
- Urbanist for all text, extra bold for day numbers. DM Mono for every time, duration, and price.
- `--radius: 0.5rem`: blocks `rounded-md`, cards `rounded-xl`. Buttons and chips keep the pill.
- Hatch means closed. It shows only on hours that a saved schedule closes.

Status palette, as full class strings in one constant (Tailwind does not see built names):

| Status | Block fill | Bar and dot | Word |
| --- | --- | --- | --- |
| booked | `bg-chart-2/12` | `bg-chart-2` | Booked |
| arrived | `bg-success/12` | `bg-success` | Arrived |
| done | `bg-muted` | `bg-chart-5` | Done |
| no-show | `bg-chart-4/12` | `bg-chart-4` | No-show |
| request (online) | `bg-warning/20` | `bg-warning` | Request |
| cancelled | not on the grid | `bg-muted-foreground`, name `line-through` | Cancelled |

Client choices, decided fresh for each app:

- The resource of the columns: staff, teacher, coach, room, chair, court, or vehicle.
- The service icon: `Scissors`, `Dumbbell`, `GraduationCap`, `Stethoscope`, or `KeyRound`.
- `contentWidth`: `full` with the day grid; `centered` only for an app without one.
- The sign-in (A1 or A2), the first run (F1 or F2), and the photo subject.

Two Créneau apps must never share the same sign-in and first-run pair.

## 3. Tokens

```css
:root {
	--background: #fbfaf8;
	--foreground: #1d1b26;
	--card: #ffffff;
	--card-foreground: #1d1b26;
	--popover: #ffffff;
	--popover-foreground: #1d1b26;
	--primary: #5b2a86;
	--primary-foreground: #ffffff;
	--secondary: #f1edf5;
	--secondary-foreground: #3b1d58;
	--muted: #f3f1ee;
	--muted-foreground: #67626f;
	--accent: #efe9f5;
	--accent-foreground: #3b1d58;
	--destructive: #c2412d;
	--destructive-foreground: #ffffff;
	--border: #e6e2dc;
	--input: #d9d4cc;
	--ring: #5b2a86;
	--radius: 0.5rem;
	--sidebar: #231a30;
	--sidebar-foreground: #d8d0e4;
	--sidebar-accent: #3b2b52;
	--sidebar-accent-foreground: #ffffff;
	--sidebar-border: #33284a;
	--sidebar-ring: #c9a8f0;
	--chart-1: #5b2a86;
	--chart-2: #2f6fe0;
	--chart-3: #0d8f80;
	--chart-4: #e0583f;
	--chart-5: #78716c;
	--success: #0f766e;
	--success-foreground: #ffffff;
	--warning: #f2b544;
	--warning-foreground: #2b1d05;
}

@theme {
	--font-sans: "Urbanist", ui-sans-serif, system-ui, sans-serif;
	--font-display: "Urbanist", ui-sans-serif, system-ui, sans-serif;
	--font-mono: "DM Mono", ui-monospace, monospace;
}

html:lang(ar) {
	--font-sans: "Alexandria", ui-sans-serif, system-ui, sans-serif;
	--font-display: "Alexandria", ui-sans-serif, system-ui, sans-serif;
}
```

Static light: delete the `.dark` block. In `@layer base`, set the `html` letter-spacing to
`-0.01em`. In `__root.tsx`, the font part of `head().links` becomes:

```tsx
// World creneau: Urbanist, DM Mono, and the Arabic twin Alexandria.
{ rel: "preconnect", href: "https://fonts.googleapis.com" },
{ rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
{
	rel: "stylesheet",
	href: "https://fonts.googleapis.com/css2?family=Urbanist:wght@400;500;600;700;800&family=DM+Mono:wght@400;500&family=Alexandria:wght@400;500;600;700;800&display=swap",
},
```

## 4. Type

- Body `text-sm`; client names `font-semibold`; toolbar date `text-lg font-bold`.
- Date block: day `font-display text-2xl font-extrabold leading-none tabular-nums`, month
  `text-[0.625rem] font-semibold uppercase tracking-widest text-muted-foreground`.
- Time, duration, price: `font-mono text-xs tabular-nums tracking-normal`. Format with
  `Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit" })`.
- Status micro caps: `text-[0.625rem] font-semibold uppercase tracking-wider`.
- Arabic: Alexandria carries all text. Month and status words lose `uppercase` and tracking.

## 5. Signatures

1. **The day grid.** CSS grid in a feature component, no calendar library. A `rounded-xl border
   bg-card` card, `h-[calc(100dvh-8rem)] overflow-auto`. Columns: a `3.5rem` gutter, then one
   `minmax(10rem,1fr)` per resource (`gridTemplateColumns` in `style`). The sticky header row
   (`sticky top-0 z-20 h-14 border-b bg-card`) shows an initials circle (`size-7 bg-secondary`),
   the name, and the day count in mono. One hour is `h-16` with a `border-t`; the half hour is
   dashed. The gutter is `sticky start-0 z-10 border-e bg-card`, with muted mono hour labels.
   Closed spans from saved hours are absolute boxes with
   `bg-[repeating-linear-gradient(135deg,var(--color-border)_0_1px,transparent_1px_8px)]`. A day
   off is hatched in full, "Off" on top. Earlier hours of today get `bg-muted/40`.
   - Now line, today only: `absolute inset-x-0 z-10 h-px bg-primary`, a dot `absolute -start-1
     -top-1 size-2 rounded-full bg-primary`, and a mono time pill in the gutter (`rounded-full
     bg-primary px-1.5 text-[0.625rem] text-primary-foreground`). Read the clock with
     `useSyncExternalStore`: subscribe starts a 30 s `setInterval`; the snapshot is
     `Math.floor(Date.now() / 30000)`, stable between ticks. A ref callback scrolls to it once.
   - A click on an empty spot snaps to the slot step and opens the booking Sheet, with the
     resource and the time set.
2. **The appointment block.** A `button`: `absolute inset-x-1 overflow-hidden rounded-md ps-2.5
   pe-2 py-1 text-start`, the status fill, and `top` and `height` in `style` from the times. A
   start bar: `absolute inset-y-0 start-0 w-0.75` with the status bar class. Line 1: the time
   range in mono `text-[0.6875rem]`, and the stored price at the end. Line 2: the client,
   `text-[0.8125rem] font-bold truncate`. Line 3: the service, muted. Under 30 minutes: one line.
   Overlaps of one resource split the column into lanes (`insetInlineStart` and `width` in %).
   An exclusion constraint on (resource, `tstzrange(starts_at, ends_at)`) with `btree_gist`,
   `where status <> 'cancelled'`, refuses double bookings; a toast shows the error.
3. **Next up with stacked dates.** A `Card shadow-none gap-0 py-0`: header "Next up" and "All
   appointments". Rows `flex items-center gap-3 border-b px-4 py-2.5`. At the start, a date
   block (`w-11 shrink-0 rounded-lg border py-1 text-center`, day over month), on the first row
   of each date only. The next rows of that date keep an empty `w-11` spacer, so they stack.
   Today's block: `border-primary bg-primary text-primary-foreground`. Middle: mono time, client,
   service and resource in muted text. End: the status word in micro caps with a `size-1.5`
   dot, and the price in mono. Query: the next 8 appointments that are not done.

## 6. Screens

Run `pnpm add lucide-react`. Add `table.tsx` (plain HTML), and `checkbox.tsx`, `switch.tsx`,
and `toggle-group.tsx` on `Checkbox`, `Switch`, and `ToggleGroup` from "radix-ui".

**Shell.** `brand`: the app initial in a `grid size-10 place-items-center rounded-xl bg-primary
font-extrabold text-primary-foreground` tile. `navigation`, existing routes only, one word
each: Today (`House`), Calendar (`CalendarDays`), Appointments (`ListChecks`), Clients
(`Users`), Services, Team (`IdCard`), Settings. `sidebarFooter`: an initials circle to the
account, and sign-out. Calendar `header`: "Today" (`outline size="sm"`), previous and next
chevrons (`rtl:rotate-180`), and the date, a button that calls `showPicker()` on an `sr-only`
`<input type="date">`. At `ms-auto`: the resource `Select`, a Day or Week `ToggleGroup` (`rounded-full
bg-muted p-0.5`), and "Book". Date and view live in the URL.

**Sign-in.** Email and password only, with the logic of `login-page.tsx`. Pick one:

- A1 Desk photo: `grid min-h-svh lg:grid-cols-2`. Start: the brand tile and the form,
  `max-w-sm`, title `text-3xl font-extrabold`. End: `relative m-3 hidden overflow-hidden
  rounded-2xl bg-sidebar lg:block` with the photo (`object-cover`) and one floating card
  (`absolute bottom-8 start-8 w-64 rounded-xl bg-card p-3 shadow-lg`, `aria-hidden`): a mini
  day column with three ghost blocks in status fills and a now line.
- A2 Open diary: a hatched band across the top (`h-28 border-b`). Over its lower edge
  (`-mt-14`), today's date block in large (`w-20 rounded-2xl border bg-card py-2`, day
  `text-4xl`), from `Intl`. Then the form card, `max-w-sm rounded-xl border bg-card p-6`.

**First run.** Real zeros and a working path. Pick one:

- F1 Desk: `/app` is the day grid, `DashboardBody layout="operations"`. Primary: the setup card
  as a strip (`grid gap-2 sm:grid-cols-2 xl:grid-cols-4`, one step per cell) while steps remain,
  then the grid with its gutter, columns, and hatch. With no resource yet, one wide column holds
  the empty state and "Add a team member". Secondary: Next up.
- F2 Today: `/app` is a Today page: `DashboardPageHeader` (weekday as `eyebrow`, long date as
  `title`, "Book" in `actions`), then `layout="workbench"`. Primary: the setup card. Secondary:
  a week strip (`grid grid-cols-7 gap-1` of date blocks with the real day count in mono, closed
  days hatched, today aubergine, a click opens the day), then Next up.
- Setup card: "Set up the desk" over 4 segments (`h-1.5 rounded-full`, done `bg-primary`).
  Steps from real counts: opening hours, a service, a team member, a first booking. A row has
  `Circle` or `CircleCheck`, the title, and an `outline size="sm"` action to the real form. The
  booking step names what it needs until a service and a member exist.

**Appointments list.** A table in a `rounded-xl border bg-card overflow-x-auto` card: When (small date block,
time range), Client (initials, name, phone), Service, Resource, Duration, Price (`text-end`),
Status (pill `h-6 rounded-full border px-2 text-xs` with its dot). Rows `h-11`, for touch at the
desk. Header `h-9 bg-muted/60 text-xs text-muted-foreground`. Filters in the URL: status pills
with mono counts (`ToggleGroup`, active `bg-foreground text-background`), a range `Select`, the
resource `Select`, a client search. A selection opens a bar (`fixed inset-x-0 bottom-6 z-40
mx-auto w-fit rounded-full bg-sidebar p-1.5 text-sidebar-foreground shadow-lg`): "Mark arrived",
"Mark no-show", "Cancel" (a `Dialog` confirm). Footer row in mono: count, total duration, sum of
stored prices. Loading: 8 `Skeleton` rows. Error: a band with the failure and "Retry".

**Appointment detail.** `SheetContent side="end" className="gap-0 p-0 sm:max-w-md"`. Header
`border-b p-5`: status pill, a large date block, the time range `font-mono text-lg`. Sections
`border-b p-5`: Client (`tel:` and `mailto:` links, real visit count, notes), Service and
Resource (`Select`), Price. Status buttons "Arrived", "Done", "No-show" (`outline size="sm"`,
the current one `default`). Footer: "Reschedule" and "Cancel appointment" (`ghost
text-destructive`, a `Dialog` confirm). `/app/clients/$id` lists visits as Next up rows.

**Analytics**, only for classes, rentals, or on request: real `DashboardMetric` counts, then
occupancy per resource (track `h-2 rounded-full bg-muted`, fill `bg-chart-1`, percent in mono).

**Settings.** `max-w-3xl`, cards `shadow-none`: Business (name, time zone), Opening hours,
Booking rules (slot step, buffer), Account. Opening hours: 7 rows `grid
grid-cols-[6rem_auto_minmax(0,1fr)] items-center gap-3`: weekday, `Switch`, two `Input
type="time" step={900}`. A closed day shows a hatched bar (`h-8 rounded-md`) with "Closed".

**Empty state art.** Inline SVG `viewBox="0 0 120 120"`, `w-28`, `aria-hidden`: a day column
(`fill="var(--color-card)" stroke="var(--color-border)"`), hour lines, hatch at the top and
bottom, one dashed slot with a plus (`stroke="var(--color-primary)"`). Then a title, one
sentence, one action.

**375 px.** The rail becomes the kit Sheet, still dark. The toolbar wraps in two rows. "Book"
floats: `fixed bottom-5 end-5 z-30 size-14 rounded-full bg-primary text-primary-foreground
shadow-lg`, with an `aria-label`. The grid scrolls sideways in its card (`snap-x`, columns
`min-w-[75vw] snap-start`, gutter sticky). Under `md`, the agenda list (Next up rows by day)
replaces Week. The list hides Resource and Duration under `sm`.

## 7. Motion

Calm, with one living element: the now line.

- Date change: the grid body `animate-in fade-in-0 duration-200`, plus `slide-in-from-end-2`
  forward or `slide-in-from-start-2` back. Both follow the text direction.
- New or moved block: `animate-in fade-in-0 zoom-in-95 duration-150`.
- Status change: `transition-colors duration-200`. Now line: `transition-[top] duration-700`.
- Buttons: `active:scale-[0.97] transition-transform`. Toasts: `<Toaster position="bottom-center" />`.
- Add `motion-reduce:animate-none motion-reduce:transition-none` to each.
- Never: a looping pulse on the grid, bounce, a spinner over the calendar.

## 8. Imagery

One photo, for the A1 panel only: `generate_image` (4:5), save `public/signin-desk.png`, show
`/signin-desk.png`. The empty state art is SVG.

Prompt model: "Photograph of an empty [salon chair by a tall window / yoga studio with rolled
mats / tutoring desk with two chairs / clinic reception counter / rental counter with keys on
hooks], soft warm morning light, warm white walls, one deep aubergine object, calm and tidy,
shallow depth of field, 35 mm, no people, no text, no signage, no logos, no watermark."

Never stock smiles, a clock face, or a fake screen.

## 9. Bans

- No block colored by service or staff. No aubergine fill on a block. No gradient.
- No hatch on hours that no saved schedule closes.
- No invented appointments, clients, prices, or hours. Sample data only on request, labeled.
- No calendar library, no light rail, no Week view at 375 px, no page spinner.
- No status by color only. No Google, Apple, or magic-link sign-in.

## 10. Self-check

1. The rail is dark aubergine, with a label under each icon. The page is warm white.
2. The calendar opens on today at the now line. The line moves without a reload.
3. The hatch shows only where saved hours close the day.
4. Each block shows its status fill, its bar, a mono time, and opens the Sheet.
5. A double booking of one resource fails with a clear toast.
6. Next up stacks the rows of one date under one date block. Today's block is aubergine.
7. The first run shows real structure, real zeros, and the setup card with working steps.
8. At 375 px the toolbar wraps, "Book" floats, and only the grid scrolls sideways.
9. In Arabic the columns mirror, chevrons rotate, and no label is uppercase.
