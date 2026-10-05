# Coulisses — backstage, ten minutes before doors

`coulisses` · loud · dark · comfortable · best for: events, ticketing, venues, promoters,
festivals, club nights, concerts, theater, conferences · avoid for: clinic, finance, school,
kids, logistics, B2B records

## 1. Feel

Backstage before doors: a violet-black corridor, a box of wristbands, the bass through the wall.
One hot light cuts the dark, magenta into tangerine, like a stage wash through haze. Event titles
are Syne, wide and strange, like a gig poster. Ticket facts are mono capitals, like the print on
a stub. Loud, never messy.

Voice: the door staff. Short and present ("Doors 22:00", "142 in"). Facts before hype. No
exclamation marks, no emoji, no "selling fast".

## 2. World law and client choices

World law, the same in every Coulisses app:

- Shell: `DashboardShell variant="inset" density="comfortable"`. The panel floats on the darker
  sidebar tone.
- Dark only. Delete the `.dark` block of `tokens.css`: `:root` holds the one dark treatment.
- One gradient, magenta (`primary`) to tangerine (`chart-2`): `bg-linear-to-r from-primary
  to-chart-2 rtl:bg-linear-to-l`. It fills the sell-through bars, the live counter numeral, and
  the one main button per view (plus `text-primary-foreground shadow-lg shadow-primary/25`).
- Magenta alone marks focus, links, the active nav item, and the pulse dot.
- Syne for titles and big numbers, Golos Text for UI text, Azeret Mono for codes and facts.
- `--radius: 0.875rem`: cards 18 px, stubs `rounded-2xl` (22 px). Buttons and badges stay pills.
- Depth from surfaces, not shadows: remove `shadow-sm` from the `card.tsx` base class.

Client choices, decided fresh for each app:

- The sign-in (A1 or A2) and the first run (F1 or F2).
- The words: event, night, show, or session; ticket, pass, or wristband; guest or attendee.
- The home name: "Tonight" (weekly nights) or "Next up" (festivals, conferences).
- `contentWidth`: `full` (default), or `centered` for one venue with few events.

Two Coulisses apps never share the same sign-in and first-run composition.

## 3. Tokens

```css
:root {
	--background: #0f0a17;
	--foreground: #f6f1ff;
	--card: #171024;
	--card-foreground: #f6f1ff;
	--popover: #1f1630;
	--popover-foreground: #f6f1ff;
	--primary: #ff3d9a;
	--primary-foreground: #14081c;
	--secondary: #241a36;
	--secondary-foreground: #f6f1ff;
	--muted: #1b1329;
	--muted-foreground: #ab9fc2;
	--accent: #2a1f3f;
	--accent-foreground: #f6f1ff;
	--destructive: #d63031;
	--destructive-foreground: #ffffff;
	--border: #ffffff17;
	--input: #ffffff29;
	--ring: #ff3d9a;
	--radius: 0.875rem;
	--sidebar: #08050d;
	--sidebar-foreground: #d9cfe9;
	--sidebar-accent: #1f1530;
	--sidebar-accent-foreground: #ff7ab8;
	--sidebar-border: #ffffff12;
	--sidebar-ring: #ff3d9a;
	--chart-1: #ff3d9a;
	--chart-2: #ff8a3d;
	--chart-3: #8b7bff;
	--chart-4: #3ed6c5;
	--chart-5: #f2e05a;
	--success: #3ddc97;
	--success-foreground: #0f0a17;
	--warning: #ffc53d;
	--warning-foreground: #0f0a17;
}

@theme {
	--font-sans: "Golos Text", ui-sans-serif, system-ui, sans-serif;
	--font-display: "Syne", "Golos Text", ui-sans-serif, system-ui, sans-serif;
	--font-mono: "Azeret Mono", ui-monospace, monospace;
}

html:lang(ar) {
	--font-sans: "Alexandria", ui-sans-serif, system-ui, sans-serif;
	--font-display: "Reem Kufi", "Alexandria", ui-sans-serif, system-ui, sans-serif;
}
```

`chart-2` is the tangerine end of the gradient. `destructive` stays dark enough for the
`text-white` of the kit Button and Badge.

In `__root.tsx`, keep `tokensCss` and replace the three font entries of `head().links` with:

```ts
{ rel: "preconnect", href: "https://fonts.googleapis.com" },
{ rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
{
	rel: "stylesheet",
	href: "https://fonts.googleapis.com/css2?family=Syne:wght@600;700;800&family=Golos+Text:wght@400;500;600&family=Azeret+Mono:wght@400;500&family=Reem+Kufi:wght@500;700&family=Alexandria:wght@400;500;600&display=swap",
},
```

## 4. Type

Write these role strings once as constants in the workspace feature:

- `title`: `font-display font-extrabold tracking-tight leading-[0.95]`. Event titles: `text-2xl`
  on a stub, `text-5xl` on the event page, with `line-clamp-2` (Syne is wide).
- `facts`: `font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground
  rtl:font-sans rtl:tracking-normal`. The facts line ("Room 2 · Doors 22:00"), table headers.
- `count`: `font-display font-extrabold tabular-nums leading-none`: `text-7xl` for the live
  counter, `text-3xl` in a stub.
- `code`: `font-mono text-sm uppercase slashed-zero`, with `dir="ltr"`. Ticket and order codes.
- Body: Golos Text `text-sm`. Page titles come from `DashboardPageHeader` (its `h1` is Syne).
- Arabic: Reem Kufi replaces Syne, and Alexandria replaces Golos Text. Codes stay mono, but
  `facts` switches to the sans: the mono has no Arabic glyphs. No italics, no tracking.

## 5. Signatures

1. **The ticket stub.** Every event card is a ticket. Add this utility after `@layer base` in
   `tokens.css`. It cuts two half-circle notches at the perforation, on both edges, so RTL needs
   no change:

   ```css
   /* The mask color only sets opacity. */
   @utility ticket-notch {
   	mask:
   		radial-gradient(circle at 0 var(--notch-y, 70%), transparent 0.625rem, #000 0.66rem) 0 0 / 51% 100% no-repeat,
   		radial-gradient(circle at 100% var(--notch-y, 70%), transparent 0.625rem, #000 0.66rem) 100% 0 / 51% 100% no-repeat;
   }
   ```

   Markup: `<article className="ticket-notch [--notch-y:calc(100%_-_4.5rem)] flex flex-col
   rounded-2xl border bg-card">`. The body (`flex gap-4 p-5`) starts with a date tile (`w-14
   rounded-lg bg-muted py-2 text-center`, the day in `count text-3xl`). Then the `title`, the
   facts line, and the status badge. The stub (`h-18 border-t-2 border-dashed px-5`) holds
   sold / capacity in `code`, the sell-through bar, and the percent. A user poster sits above
   the body.
2. **The sell-through bar.** One per ticket tier: a track `h-2 overflow-hidden rounded-full
   bg-muted` with `role="progressbar"`. The fill is the gradient with an inline `width` percent.
   Above it: the tier name, the price (`Intl.NumberFormat`, the user's currency), and `sold /
   capacity` in `code`. Sold counts valid and checked-in tickets. A full tier gets a stamp:
   `-rotate-3 rounded-md border-2 border-primary px-2 font-mono text-xs uppercase text-primary`.
3. **The live check-in counter.** A `Card` with `p-6`: checked-in tickets in `count text-7xl`,
   painted with the gradient (`bg-clip-text text-transparent`), then "/ sold" in `text-3xl
   text-muted-foreground`. Above it: a `bg-primary` pulse dot with an `animate-ping` copy, and
   "Doors open" in `facts`. The pulse runs only between `doors_at` and `ends_at`. Before that,
   the dot is still and muted, with "Doors 22:00". The query has `refetchInterval: 10_000`.

## 6. Screens

**Sign-in** (`features/auth/components/login-page.tsx`). Keep its form logic and sign-up toggle.
Email and password only.

- A1 Poster split: `grid min-h-svh lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]`. Start:
  `flex flex-col justify-center gap-8 p-8`, the app name and "Sign in" in `title`, the fields,
  and the gradient submit. End (`hidden lg:block`): `relative m-3 overflow-hidden rounded-2xl`
  with `/signin-stage.png` (`absolute inset-0 size-full object-cover`) under an `absolute
  inset-0` scrim (`bg-linear-to-t from-background to-transparent`). A stub at its bottom holds
  the app name and "Staff entrance" in `facts`.
- A2 Admit one: no image. `grid min-h-svh place-items-center p-4` over a glow (`fixed inset-0
  -z-10 bg-radial-[at_50%_0%] from-primary/25 to-transparent to-60%`). The form is the ticket:
  `ticket-notch [--notch-y:calc(100%_-_5.5rem)] w-full max-w-md rounded-2xl border bg-card`.
  Body `p-8`: "Admit one · Staff" in `facts`, the app name in `title text-5xl`, the fields.
  Stub `h-22 border-t-2 border-dashed px-8`: the gradient submit button, full width.

**First run** (no event yet). Real zeros only. The getting-started device has 3 steps: create
an event, add ticket tiers, open check-in. Each step opens the real form (Sheet or route) and
turns done from data: a `text-success` check, and the text in `line-through text-muted-foreground`.

- F1 Ghost stub: `DashboardBody layout="analytics"`. `primary`: one ghost stub (`ticket-notch
  rounded-2xl border-2 border-dashed`, no fill). It holds an empty date tile and "Your first
  event" in `title text-muted-foreground`. Its stub holds the gradient "Create event".
  `secondary`: a `Card` "Before doors" with the 3 steps (a Syne number, a line, a button).
- F2 Box office: `DashboardBody layout="operations"`. `metrics`: 3 `DashboardMetric` with real
  zeros (events, tickets sold, checked in) in `count text-4xl`. `primary`: the events grid with
  one dashed "New event" tile (`button`, `min-h-56 rounded-2xl border-2 border-dashed`).
  `secondary`: the 3 steps as an `ol` with `border-s-2 border-dashed ps-4`.

**Tonight** (`/app`, the home). `DashboardPageHeader`: `eyebrow` = the home name, the title =
the next event, actions = "Open check-in" and "Edit". `DashboardBody layout="analytics"`:
`primary` is the event as a large stub, then a `Card` of tiers with sell-through bars.
`secondary` is the live counter, then the last 5 check-ins (name, tier, time in `code`).

Nav (`pnpm add lucide-react`), only routes that exist: Tonight `MoonStar`, Events
`CalendarDays`, Guests `Ticket`, Check-in `ScanLine`, Settings `Settings`. `header`: a guest
search and an outline "Check-in" link. `sidebarFooter`: a small stub that links to the next
event, else "Create event". Under it: the account email and "Sign out".

**Events** (`/app/events`): `Tabs` Upcoming / Drafts / Past with counts, a search, and the
gradient "New event". A `grid gap-4 sm:grid-cols-2 xl:grid-cols-3` of stubs, by date. Edit in a
`Sheet side="end"`: title, venue, times, and a tier repeater (name, price, quantity). The event
page has the large stub, then `Tabs` Overview / Guests / Settings. Overview adds tickets sold
per day as inline SVG bars (`fill-chart-1`) with day labels. With no orders, show the hatch
`bg-[repeating-linear-gradient(135deg,var(--color-border)_0_1px,transparent_1px_8px)]`.

**Guests** (`/app/guests`, the records view). Add `src/shared/ui/table.tsx` (plain HTML),
`checkbox.tsx`, and `tabs.tsx` (both on `radix-ui`), with tokens only.

- Toolbar: an event `Select`, status `Tabs` (All, Valid, In, Void) with counts, and a search.
- Header `h-10 bg-muted/50` with `facts` cells: checkbox, code, guest, tier, status, bought,
  price (`text-end tabular-nums`). A tier shows a `size-2 rounded-full` dot in its chart color.
  Rows: `h-12 hover:bg-accent/50`.
- Status: `<Badge variant="outline">` plus Valid `border-transparent bg-secondary`, In
  `border-transparent bg-success/15 text-success` with a `Check` icon, Void `text-muted-foreground
  line-through`.
- Selection: a pill bar `fixed inset-x-0 bottom-6 z-30 mx-auto flex w-fit gap-2 rounded-full
  border bg-popover px-4 py-2 shadow-lg`: the count, Check in, Export CSV, and Void.
- Footer (`tfoot`, `facts` cells): guests, checked in, and the gross from stored prices.

**Guest detail**: `SheetContent side="end" className="w-full sm:max-w-md"`: the code in
`font-mono text-3xl`, the guest, the tier, the order, and the check-in history. Footer: Check
in, Undo check-in, and Void (a Dialog confirms).

**Check-in** (`/app/check-in`, the door screen): `mx-auto flex w-full max-w-xl flex-col gap-6`.
The live counter, then the code `Input` (`h-14 rounded-full text-center font-mono text-2xl
uppercase`, `autoFocus`), sent on Enter. A result card (`rounded-2xl p-6`, a `key` per scan)
follows. It reads Admitted (`bg-success text-success-foreground`), Already in (`bg-warning
text-warning-foreground`, with the first time), or Not valid (`bg-destructive text-white`).
Then the last 10 check-ins. One RPC sets `checked_in_at` only where it is null, so two doors
never admit one ticket twice. Manual codes only, until the user asks for a camera scanner.

**Settings**: `Tabs` for Organization (name, time zone, currency), Venues, Team, and Check-in
rules. Each tab is a `Card` with a "Save" footer. Deletes sit in a `border-destructive/50` card.

**Empty state art**: an inline SVG (`aria-hidden`, 160 × 96): a stub outline in
`stroke-border`, two notch arcs, a dashed perforation, and one `fill-primary` star. Then one
sentence and one action.

**375 px**: the panel goes full width (kit). Stubs stack in one column. Table rows become two
lines: code and status; then name and tier. The selection bar is `inset-x-4 w-auto`. The door
screen keeps the input full width and the counter at `text-5xl`.

## 7. Motion

Stage light, not fireworks.

- Stubs: `transition duration-150 hover:-translate-y-0.5 hover:border-primary/40
  motion-reduce:transition-none motion-reduce:hover:translate-y-0`.
- Bars: `transition-[width] duration-700 ease-out motion-reduce:transition-none`.
- Counter and scan result: a new `key` with `animate-in fade-in-0 zoom-in-95 duration-200`.
- The pulse dot pings only while doors are open, with `motion-reduce:animate-none`.
- Never: confetti, a looping gradient, a marquee, a glitch, a parallax.

## 8. Imagery

A1: one `generate_image`, aspect `4:5`, saved to `public/signin-stage.png` and used as
`/signin-stage.png`. An empty state may add `public/empty-ticket.png`. At most 2 images.

Prompt model: "Photograph of [a crowd seen from the DJ booth / an empty stage in haze / a
festival gate at dusk], magenta and tangerine light, violet-black shadows, film grain, no
readable faces, no text, no logos."

Never stock smiles, confetti, or a 3D ticket icon. A user poster always wins over generated art.

## 9. Bans

- No light mode, no theme picker, no second gradient.
- No gradient on a card, a header, or a text longer than one number. Only scrims and the A2
  glow fade a background.
- No fake sales, attendees, scarcity ("12 left"), or countdown pressure.
- No neon text-shadow, no emoji, no pie or donut chart for tiers.
- No seat map unless the user asks.

## 10. Self-check

1. The shell is `DashboardShell variant="inset" density="comfortable"`, and every route is dark.
2. The gradient fills only the bars, one main button per view, and the counter numeral.
3. Every event card is a stub with two notches at the perforation, in LTR and in RTL.
4. Sold, capacity, and check-in numbers come from real tickets and tiers.
5. The dot pulses only while doors are open. A second scan of one code reads "Already in".
6. The first run uses F1 or F2, with real zeros and 3 working steps.
7. At 375 px the page never scrolls sideways.
8. In Arabic, Reem Kufi and Alexandria load, and no label has tracking.
