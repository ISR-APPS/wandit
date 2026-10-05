# Brigade — the pass at eight on a Saturday night

`brigade` · loud · light · compact · best for: restaurant, cafe, bakery, catering, food truck,
ghost kitchen back office (menus, shifts, stock, orders) · avoid for: finance, clinic, dev tools, legal, kids

## 1. Feel

Saturday night, the pass is full: heat lamps, a rail of paper tickets, a board of who works
tonight. The app is kitchen paper and burnt ink with one tomato red. Headings and numbers are
tall condensed capitals, like the stencil on a tomato crate. Service is loud; each screen does one job.

Voice: the chef at the pass. Short, verb first: "Bump", "Mark 86", "Publish the week". Numbers
before words ("4 open tickets"). A kitchen word always comes with its plain word ("86 · Out").
No exclamation marks, no emoji.

## 2. World law and client choices

World law, the same in every Brigade app:

- Shell: `DashboardShell` with `variant="rail"` and `density="compact"`: a kraft rail with
  labels. The `header` holds the location switcher, the service date, and a live clock.
- Big Shoulders Display for every heading and number, in capitals. Work Sans for text.
  Courier Prime only on tickets: it is the printer face.
- Corners: 8 px. In `button.tsx` and `badge.tsx`, change `rounded-full` to `rounded-md` in the
  base class. Brigade has no pills.
- Tomato is the brand: primary action, active icon, POPULAR chip. It never marks a state.
  States are herb (`success`), mustard (`warning`), and wine (`destructive`), with a word.
- Ink bands (`bg-foreground text-background`) open each group.
- Light only. No `.dark` block, no theme picker.

Client choices, decided fresh for each app:

- Sign-in B1 or B2. First-run home F1 or F2 (section 6).
- The signatures the brief needs: the pass rail only with orders, the roster only with shifts.
- `contentWidth`: `full` for a roster or a pass; `centered` for a small menu and stock app.

Two Brigade apps never share the same sign-in and first-run composition.

## 3. Tokens

```css
:root {
	--background: #faf3e6;
	--foreground: #1f1410;
	--card: #ffffff;
	--card-foreground: #1f1410;
	--popover: #ffffff;
	--popover-foreground: #1f1410;
	--primary: #d9381e;
	--primary-foreground: #ffffff;
	--secondary: #f1e4c9;
	--secondary-foreground: #1f1410;
	--muted: #f3eadb;
	--muted-foreground: #6b5446;
	--accent: #f8e9d2;
	--accent-foreground: #1f1410;
	--destructive: #a1162a;
	--destructive-foreground: #ffffff;
	--border: #e8dcc6;
	--input: #d8c8ab;
	--ring: #d9381e;
	--radius: 0.5rem;
	--sidebar: #efe2c6;
	--sidebar-foreground: #2a1d15;
	--sidebar-accent: #1f1410;
	--sidebar-accent-foreground: #fff4e2;
	--sidebar-border: #ddcba8;
	--sidebar-ring: #d9381e;
	--chart-1: #d9381e;
	--chart-2: #9a7000;
	--chart-3: #2f5f8f;
	--chart-4: #7b3f7a;
	--chart-5: #1f6f68;
	--success: #3f7d3a;
	--success-foreground: #ffffff;
	--warning: #f2b631;
	--warning-foreground: #1f1410;
}

@theme {
	--font-sans: "Work Sans", ui-sans-serif, system-ui, sans-serif;
	--font-display: "Big Shoulders Display", "Work Sans", ui-sans-serif, system-ui, sans-serif;
	--font-mono: "Courier Prime", ui-monospace, monospace;
}

html:lang(ar) {
	--font-sans: "Cairo", ui-sans-serif, system-ui, sans-serif;
	--font-display: "Kufam", "Cairo", ui-sans-serif, system-ui, sans-serif;
}
```

Header comment of `tokens.css`: `World: brigade.` Delete the `.dark` block. In the base layer,
set the `html` letter-spacing to `-0.01em` and add `h1, h2, h3, h4 { @apply uppercase
tracking-wide; }`. The existing `:lang(ar)` rule resets the tracking for Arabic.
In `__root.tsx`, the font links become:

```ts
{ rel: "preconnect", href: "https://fonts.googleapis.com" },
{ rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
{
	rel: "stylesheet",
	href: "https://fonts.googleapis.com/css2?family=Big+Shoulders+Display:wght@600;700;800;900&family=Cairo:wght@400;600;700&family=Courier+Prime:wght@400;700&family=Kufam:wght@600;700;800&family=Work+Sans:wght@400;500;600;700&display=swap",
},
```

## 4. Type

- Section titles: `font-display text-2xl font-extrabold`; the base rule sets the capitals.
- Numerals: `font-display font-extrabold tabular-nums leading-none`. Metric value `text-5xl`,
  ticket number `text-3xl`, price `text-xl`. Pass a numeral as the `DashboardMetric` value.
- Label: `text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground`.
- Body: Work Sans `text-sm`. Money and counts: `tabular-nums`, with `Intl`.
- Ticket body: `font-mono text-[13px] leading-5`. Quantities are `font-bold`.
- Arabic: Kufam replaces the capitals, Cairo the text. Drop `uppercase` and tracking on
  labels. Ticket bodies use `font-sans`: Courier Prime has no Arabic letters.

## 5. Signatures

1. **The pass rail.** Open orders hang on a rail: `flex snap-x gap-3 overflow-x-auto border-t-2
   border-foreground bg-muted p-3`, oldest first. An ink band above it says "OPEN 4 · LATE 1".
   A ticket: `w-64 shrink-0 snap-start border-x border-t bg-card pb-4` with a zigzag bottom:
   `[mask:conic-gradient(from_-45deg_at_bottom,transparent,black_1deg_89deg,transparent_90deg)_50%/12px_100%]`.
   Head: `flex items-start justify-between px-3 py-2`, the table or order number (`font-display
   text-3xl`), the channel label, and the timer (`font-display text-2xl tabular-nums`, mm:ss since
   `created_at`). The head color follows age: under the first target `bg-card`, then
   `bg-warning text-warning-foreground`, then `bg-destructive text-destructive-foreground` and the
   word "LATE". Lines: "2×" and the item; modifiers `ps-6 text-muted-foreground`; an allergy in
   `font-bold text-destructive`. Foot: a full-width "Bump" button. One shared clock hook ticks
   each second (`// effect:` comment above its interval).
2. **The brigade roster.** A week grid in an `overflow-x-auto` frame: `grid
   grid-cols-[11rem_repeat(7,minmax(7rem,1fr))]`. Day head: weekday `font-display text-lg`, date,
   planned hours. Today gets `border-t-2 border-primary bg-primary/5`. Each department opens with
   an ink band (`col-span-full bg-foreground px-3 py-1.5 font-display text-sm text-background`):
   "KITCHEN · 6 · 212 H". Roles sit on `bg-muted` sub-bands. The name cell is `sticky start-0
   z-10 bg-card`. A shift chip: `rounded-md border border-s-4 border-s-chart-N bg-card px-2 py-1`,
   time `text-xs font-semibold tabular-nums` over the role. N is the department color, from a
   static class array. An open shift is `border-dashed` "OPEN". Time off gets the hatch
   `bg-[repeating-linear-gradient(135deg,var(--color-border)_0_1px,transparent_1px_7px)]` and "OFF".
   The footer row sums hours per day. "Publish week" is the page action.
3. **The menu board.** Rows `h-14`: thumbnail `size-10 rounded-md object-cover` from the app
   storage. With no photo, a `bg-secondary` tile shows the first letter in `font-display`. Name
   over category, price `font-display text-xl text-end`, availability `switch.tsx` (Radix Switch,
   `data-[state=checked]:bg-success`). An item out of stock gets the 86 stamp: `-rotate-6
   rounded-sm border-2 border-destructive px-1.5 font-display font-extrabold text-destructive`
   "86", then "Out" in `text-xs`. With sales data, the board adds a rank ("01", `font-display
   text-2xl`), the sold count, and a share bar (`h-1.5 bg-chart-1`). The top 3 get POPULAR:
   `rounded-sm bg-primary px-1.5 font-display text-xs text-primary-foreground`.

## 6. Screens

**Shell.** `const dashboardDesign = { variant: "rail", density: "compact", contentWidth: "full" } as const;`
`brand`: the app name, `font-display text-xl font-extrabold uppercase leading-none`.
`pnpm add lucide-react`. Nav: `ClipboardList` (Pass), `CalendarDays` (Roster), `UtensilsCrossed`
(Menu), `Package` (Stock), `ChartColumn` (Reports), `Settings`. Labels `uppercase tracking-wide`.
Each Link adds `[&[data-active=true]_svg]:text-primary`. `sidebarFooter`: the user initials and
a `LogOut` button (`rtl:rotate-180`). `header`: a location `Select` with a `Store` icon. It sets
a zod-parsed `location` search param; one location shows plain text. Then the service date
(`hidden font-display text-lg sm:block`) and the clock (`ms-auto font-display text-2xl`).

**Sign-in** (`login-page.tsx`, email and password only):

- B1 Ticket wall: `grid min-h-svh lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]`. Start: the app
  name as an h1 (`text-6xl font-extrabold leading-[0.85]`), one line, the form (`max-w-sm`,
  inputs `h-11`, full-width `size="lg"`). End: `hidden place-items-center bg-foreground lg:grid`.
  A tomato rail line holds three blank tickets (zigzag, `w-56 bg-card`, `-rotate-3`, `rotate-2`).
  Each ticket holds `h-2 bg-muted` bars, never words.
- B2 Pass photo: `relative grid min-h-svh place-items-center`. The image fills it (`absolute
  inset-0 size-full object-cover`) under a `bg-foreground/60` scrim. On top: the form card
  `relative w-full max-w-sm rounded-lg bg-card p-8`, with the app name as a `font-display` h1.

**First-run home.** Real zeros only. The eyebrow is the date, the title "SERVICE". Every
string, chip word, and label goes through `t()`.

- F1 Before service: `DashboardBody layout="operations"`. `primary`: the pass rail, "OPEN 0 ·
  LATE 0", and one dashed ticket with "No open orders" and "New order". `secondary`: "Kitchen
  setup", steps "01 02 03" in `font-display text-3xl text-primary`: menu, team, this week. Each
  step links to its page. A done step shows `CircleCheck` (`text-success`) and its real count.
- F2 Week on the wall: `layout="analytics"`. `metrics`: Open tickets, Items 86'd, Shifts today,
  Open shifts, only those the app stores. `primary`: this week's roster frame. One ink band says
  "NO DEPARTMENTS YET" and holds "Add department". `secondary`: a prep list of the setup steps.
  Each row is a Link with a read-only `checkbox.tsx`, checked from data.

**Menu board** (main records view): `table.tsx` (plain HTML parts). Toolbar: category tabs from
real categories (`h-8 rounded-md px-3 font-display`, active `bg-foreground text-background`).
Then search, a "Low stock" toggle (`aria-pressed`), and "New item" at `ms-auto`. Header row
`h-9 bg-muted` with label classes. A stock column (only with stock) shows `6 / 10` over a
`h-1.5 w-20 bg-muted` bar: `bg-success` fill at par, `bg-warning` below. Selection uses
`checkbox.tsx` and a bulk bar: `fixed inset-x-4 bottom-6 z-40 mx-auto flex w-fit gap-2
rounded-lg bg-foreground px-3 py-2 text-background`. It holds the count, "Mark 86", "Back on",
and "Move category". Footer: `bg-muted font-display text-sm`, "32 ITEMS · 4 LOW · 2 OUT".

**Item detail**: `Sheet` (`side="end"`, `sm:max-w-lg`): photo or letter tile (`aspect-[4/3]`),
name (`font-display text-3xl`), price (`font-display text-4xl`). Fields: category, price, par,
allergens as toggle chips, notes. `SheetFooter`: Delete (confirm Dialog) and Save. A ticket
click opens a `Dialog` with the full ticket and its status times.

**Service report** (only with real orders): `layout="analytics"`. Metrics: orders, sales,
average ticket, items sold. `primary`: sales by hour, an inline SVG (`viewBox="0 0 240 80"`)
of 24 `fill-chart-1` bars, labeled every 3 hours. `secondary`: the top 10 of the menu board.

**Settings**: `grid gap-6 lg:grid-cols-[13rem_minmax(0,1fr)]`. Nav: Locations, Service hours,
Ticket timers, Departments, Categories. Ticket timers: two minute inputs (default 10 and 15)
and a preview of the three ticket heads. A department has a name and one of 5 swatch radios
(`size-7 rounded-md bg-chart-N`). Location names and addresses come from the user only.

**Empty state art**: "the empty rail", an inline SVG (`viewBox="0 0 200 96"`). A rail line
(`stroke-foreground`) holds three dashed tickets with zigzag feet (`stroke-border`). The first is
`stroke-primary` with a plus. Under it: one sentence and one action.

**375 px**: the kit moves the rail into its Sheet. The header keeps the location and the clock.
Tickets are `w-[80vw] max-w-72` and snap. The roster becomes a day strip (`grid grid-cols-7`)
over that day's shifts under ink bands. Menu rows become `flex gap-3 border-b p-3` cards. Only
the pass rail and the roster frame scroll sideways.

## 7. Motion

Fast and physical: 120 to 200 ms, CSS and tw-animate-css only.

- A new ticket: `animate-in fade-in-0 slide-in-from-top-2 duration-200`.
- Ticket head: `transition-colors duration-700`: the change of state shows calmly.
- Buttons `active:scale-95`. A bumped ticket leaves at once; a toast offers Undo.
- The 86 stamp mounts with `animate-in zoom-in-125 fade-in-0 duration-150`, like a stamp press.
- Add `motion-reduce:animate-none motion-reduce:transition-none` to every animated element.
- Never: a blinking LATE, a shaking ticket, a loop, a sound nobody asked for.

## 8. Imagery

SVG first. `generate_image` only for the B2 photo, at most 2 images per first build:
`public/brigade-pass.png`, aspect `16:9`, used as `/brigade-pass.png`.

Prompt model: "Documentary photograph of a restaurant kitchen pass during service, steel shelf
under warm heat lamps, blank paper tickets on a metal rail, [subject of the app: wood-fired
pizzas / pastry trays / noodle bowls] in soft focus, tungsten light, tomato red and mustard
accents, 35 mm, shallow depth of field, no faces, no readable text, no logos, no watermark."

Menu photos come from the user only. Never generate a dish: it shows food the kitchen does not make.

## 9. Bans

- No pills, no dark mode, no theme picker. No tomato on a state, no state by color alone.
- No emoji food icons.
- No invented dishes, prices, covers, sales, or staff. No weather in day heads.
- No sample rows unless the user asks. Then label each one "Sample".
- No mixed-case display text in Latin. No Courier Prime outside tickets.
- No pie or donut chart for the product mix.

## 10. Self-check

1. Headings and numbers are Big Shoulders Display capitals, text is Work Sans, tickets are Courier Prime.
2. Buttons and chips have 8 px corners. No pill is left after the base edit.
3. The kraft rail has labels. The active tile is ink with a tomato icon.
4. Tomato marks actions and the brand only. Each state is herb, mustard, or wine, with a word.
5. Tickets have a zigzag edge and a live timer. They turn mustard, then wine, at the settings targets.
6. The roster opens each department with an ink band and sums the hours.
7. The first run is F1 or F2 with real zeros. Sign-in is B1 or B2, email and password only.
8. At 375 px, no page scrolls sideways. In Arabic, Kufam and Cairo load and icons flip.
