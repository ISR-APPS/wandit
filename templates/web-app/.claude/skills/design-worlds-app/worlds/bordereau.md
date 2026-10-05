# Bordereau — a statement slip on a clean desk

`bordereau` · quiet · light · comfortable · best for: invoicing, quotes, accounting, freelancer
business, expenses, cash book, agency billing · avoid for: kids, nightlife, fitness, events, games

## 1. Feel

White paper, black ink, a steel ruler: the ledger of a careful freelancer, exact to the cent.
A serif speaks the greeting and the totals. A plain sans does the work. Every amount is mono, so
columns line up like a bank statement. Color has one job, the money state: green paid, vermilion
overdue, ochre due soon. All else is ink on paper, with hairlines and no shadows.

Voice: a calm bookkeeper. A verb first: "Create invoice", "Record payment". Dates come with a
relative line: "Due 12 Mar" over "in 6 days". No exclamation marks, no emoji.

## 2. World law and client choices

World law, the same in every Bordereau app:

- Paper ground, white sheets, black ink, warm hairlines. Data cards get `shadow-none`. Only
  Dialog, Sheet, Select, and menus keep a shadow.
- Kit shell: `variant: "rail"`, `density: "comfortable"`. The rail is a paper tone with a
  hairline. The `header` holds the search field and today's date.
- Primary is black. One black button per screen: the main action. Other actions are `outline`.
- Corners: `--radius: 0.25rem`. Cards are 8 px, fields 2 px. In `button.tsx` and `badge.tsx`,
  replace `rounded-full` in the base class with `rounded-lg` (4 px). The ledger has no pills.
- Type: Newsreader for the greeting, page titles, and totals. Karla for all text. Red Hat Mono
  for every amount, document number, and table date.
- Money states: `success` is paid, `destructive` is overdue, `warning` is due within 7 days.
  Each state shows a word or a dot plus a word, never a color alone.

Client choices, decided fresh for each app:

- `contentWidth`: `centered` for one freelancer with few columns, `full` for an accountant.
- The sign-in composition: A1 or A2. The first-run home: H1 or H2 (section 6).
- The records and the rail destinations (4 to 6): invoices, quotes, customers, expenses, entries.
- The currency and the default period of the stat grid (month, quarter, or year).

Two Bordereau apps never share the same sign-in and the same first-run composition.

## 3. Tokens

```css
:root {
	--background: #fbfbf8;
	--foreground: #111111;
	--card: #ffffff;
	--card-foreground: #111111;
	--popover: #ffffff;
	--popover-foreground: #111111;
	--primary: #111111;
	--primary-foreground: #fbfbf8;
	--secondary: #f3f2ee;
	--secondary-foreground: #111111;
	--muted: #f3f2ee;
	--muted-foreground: #64625b;
	--accent: #eeede8;
	--accent-foreground: #111111;
	--destructive: #c2401f;
	--destructive-foreground: #ffffff;
	--border: #e7e5e0;
	--input: #d9d6cf;
	--ring: #111111;
	--radius: 0.25rem;
	--sidebar: #f6f5f1;
	--sidebar-foreground: #111111;
	--sidebar-accent: #e9e7e1;
	--sidebar-accent-foreground: #111111;
	--sidebar-border: #e7e5e0;
	--sidebar-ring: #111111;
	--chart-1: #111111;
	--chart-2: #2f5d8a;
	--chart-3: #8a8578;
	--chart-4: #6b4f8a;
	--chart-5: #3f7480;
	--success: #1e7f4f;
	--success-foreground: #ffffff;
	--warning: #9a5f00;
	--warning-foreground: #ffffff;
}

@theme {
	--font-sans: "Karla", ui-sans-serif, system-ui, sans-serif;
	--font-display: "Newsreader", ui-serif, Georgia, serif;
	--font-mono: "Red Hat Mono", "Almarai", ui-monospace, monospace;
}

html:lang(ar) {
	--font-sans: "Almarai", ui-sans-serif, system-ui, sans-serif;
	--font-display: "Markazi Text", "Almarai", ui-serif, serif;
}
```

Delete the `.dark` block. Write `World: bordereau` in the header comment. Keep `@theme inline`.
Chart tokens draw series only; money states use `success`, `destructive`, and `warning`.

In `__root.tsx` `head().links`, keep the `tokensCss` entry. Replace all other font links
(preconnect and stylesheets) with exactly these:

```ts
{ rel: "preconnect", href: "https://fonts.googleapis.com" },
{ rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
{
	rel: "stylesheet",
	href: "https://fonts.googleapis.com/css2?family=Newsreader:opsz,wght@6..72,400;6..72,500;6..72,600&family=Karla:wght@400;500;700&family=Red+Hat+Mono:wght@400;500&family=Markazi+Text:wght@400;500;600&family=Almarai:wght@400;700&display=swap",
},
```

## 4. Type

- Greeting (home only, its own `h1`): `font-display text-3xl font-normal tracking-tight
  rtl:tracking-normal sm:text-4xl`. The user's name follows in `text-muted-foreground`.
- Page title: the `DashboardPageHeader` `h1` (Newsreader 600). The record count goes in `description`.
- Total: `font-display text-4xl font-medium tabular-nums lining-nums tracking-tight
  rtl:tracking-normal`. Only for stat values and the invoice total.
- Amount: `font-mono text-sm tabular-nums text-end`, formatted with `Intl.NumberFormat(locale,
  { style: "currency", currency })`. The currency comes from settings. Never guess it: ask.
- Document number and table date: `font-mono text-xs text-muted-foreground`.
- Label: `text-xs font-medium text-muted-foreground`, sentence case. Body: Karla `text-sm leading-6`.
- Arabic: Markazi Text and Almarai replace Newsreader and Karla. Digits stay in Red Hat Mono.

## 5. Signatures

1. **The desk greeting.** The home opens with the greeting `h1`, an ask bar, and action chips.
   The ask bar is a `<form role="search">` with an `Input` (`h-11 ps-10 text-base`, `Search` icon
   at `start-3`). Submit opens the records route with `?q=`. It is not a chat. Under it, a
   `flex flex-wrap gap-2` row of `Button variant="outline" size="sm"` chips with an icon:
   "Create invoice", "Add customer", "Record expense". Show a chip only for a record the app has.
2. **The hairline stat grid.** One `Card` with `shadow-none gap-0 py-0`, holding
   `grid sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x`. Three cells, `p-5 sm:p-6`: Open,
   Overdue, Paid. A cell holds a label with a `size-1.5 rounded-full` dot, the sum as a Total,
   and the count in mono. Dots: `bg-foreground`, `bg-destructive`, `bg-success`. Then one relative
   line from real rows: "next due in 6 days", "oldest 14 days late" (`text-destructive`). Use
   `Intl.RelativeTimeFormat`. With no rows, show real zeros and no relative line.
3. **The money bar.** Under the grid, one bar for unpaid money: `flex h-2 overflow-hidden
   rounded-sm bg-muted`. Two segments: overdue `bg-destructive`, not yet due `bg-foreground`.
   Width comes from the real shares: ``style={{ width: `${share}%` }}``. A label row above:
   overdue sum at the start in `text-destructive`, not-due sum at the end, both mono. With nothing
   unpaid, the track is hatched: `bg-[repeating-linear-gradient(135deg,var(--color-border)_0_1px,transparent_1px_7px)]`,
   with "Nothing unpaid" in `text-muted-foreground`.

## 6. Screens

Add these parts to `src/shared/ui/` when a screen needs them, with tokens only: `table.tsx`
(plain HTML), `tabs.tsx`, `checkbox.tsx`, and `dropdown-menu.tsx` (all from `radix-ui`).
Icons: `pnpm add lucide-react`. Use `House`, `FileText`, `Users`, `Receipt`, `Settings`,
`Search`, `Plus`, `Check`, `Ellipsis`, `ChevronRight` (`rtl:rotate-180`). Stroke 1.75, size 16.

**Rail and header.** The rail lists only routes that exist (`DashboardNavItem`, icon and short
label). `brand`: the first letter of the app name in a `size-9 rounded-lg border bg-card
font-display text-lg` square. `sidebarFooter`: an initials button with a DropdownMenu (Settings,
Sign out). `header`: the search form (`flex-1 max-w-md`), then today's date in mono (`ms-auto
hidden sm:block`).

**Sign-in** (`/login`). Keep the auth logic, the email and password fields, and the sign-up
toggle. Change only the layout. Pick one:

- A1 The slip: `grid min-h-svh lg:grid-cols-2`. Start: the app name, a Newsreader `text-3xl`
  title, the form in `max-w-sm`, a black full-width button. End: `hidden lg:flex items-center
  justify-center bg-secondary border-s`, the empty-state slip at `w-72`, one serif promise line.
- A2 The desk: `grid min-h-svh lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]`. Start (`lg` only):
  an inset panel `m-3 rounded-xl overflow-hidden` with `/sign-in-desk.png`, `object-cover`. End:
  a top row with the app name and `border-b`, then the form in a `Card shadow-none max-w-sm`.

**First run** (no rows yet). Pick one:

- H1 Desk: the desk greeting, the ask bar, the chips, then the stat grid with real zeros. Then
  `DashboardBody layout="operations"`: `primary` is a "Recent invoices" Card with the empty state;
  `secondary` is the "Get started" Card.
- H2 Statement: `DashboardPageHeader` (date as `eyebrow`, actions "Create invoice" and "Add
  customer"), then `DashboardBody layout="analytics"`. `primary`: a statement Card with a period
  Select and the money bar. Under them: three hatched `h-10` ghost lines and a mono "Total" of 0.
  `secondary`: the stat grid in one column, then "Get started".
- "Get started": three rows, each a real link or form: "Add your business details", "Add a
  customer", "Create an invoice". A step is done when its data exists: a `bg-foreground` circle
  with `Check`, else a hollow `border` circle. Show "1 of 3" in mono. Hide the card when done.

**Records view** (invoices). `DashboardPageHeader`, actions: the status Select and the black
"Create invoice". Saved views as Tabs: All, Draft, Open, Overdue, Paid, each with its real count
in mono. Tabs are underlines: `border-b-2 border-transparent data-[state=active]:border-foreground`.

- Table in a `Card shadow-none py-0 overflow-hidden`. Header row: `h-10 bg-muted/40 text-xs
  font-medium text-muted-foreground`, `text-start`, amount header `text-end`.
- Rows `h-12 border-b`. Columns: checkbox, number, customer (Karla 500), issued, due (date over
  the relative line), status, amount (`text-end`). A row click opens the detail.
- Status chips on `Badge variant="outline"` with `gap-1.5 font-normal`. Draft: `border-dashed
  text-muted-foreground`. Open: dot `bg-foreground`. Overdue: dot `bg-destructive`,
  `text-destructive`. Paid: `border-transparent bg-success/10 text-success` with `Check`. Void:
  `line-through text-muted-foreground`.
- Aggregate: a `tfoot` row `h-11 bg-muted/40 font-medium` with the count and the sum in mono.
- Selection: a floating bar `fixed bottom-6 inset-x-4 sm:inset-x-0 mx-auto w-fit rounded-lg
  bg-foreground text-background shadow-lg px-3 py-2`: the count, the sum, and real actions.
  "Delete" asks in a confirm Dialog. Pagination: 25 rows, range in mono.

**Record detail.** A `Sheet side="end"`, `w-full sm:max-w-xl`, drawn as a slip: number (mono) and
status chip, the customer, the Total `text-4xl`. Then line items (numbers mono `text-end`), tax
rows with `border-t`, the total row with `border-t-4 border-double`. Then "Activity": real events
with mono times. Footer: "Record payment" (black). Full edit lives on `/app/invoices/$id`.

**Analytics** (accounting and cash book only). `DashboardBody layout="analytics"`. `primary`: a
"Cash flow" inline SVG, two bars per month: in `fill-chart-1`, out `fill-chart-3`. Gridlines
`stroke-border`, labels `font-mono text-xs fill-muted-foreground`, a legend with words.
`secondary`: the stat grid in one column.

**Settings.** One `max-w-3xl` column of Cards: "Business", "Invoices" (currency, number prefix,
payment terms in days), "Account". Each value is a row `grid grid-cols-[10rem_1fr_auto] gap-4
py-4 border-b`: muted label, value, an "Edit" ghost button that opens a Dialog. Last: a "Danger
zone" card with `border-destructive/30`.

**Empty state art.** An inline SVG slip, `w-40`: a `fill-card stroke-border` sheet with
perforations on top. Inside: four ruled lines and an empty total box with a double rule. No
words. Under it: one sentence and one black action.

**Loading and error.** Skeletons copy the final grid: the three stat cells, the table header, and
eight `h-12` rows. Error: a Card with what failed, and a "Try again" button.

**375 px.** The rail becomes the kit Sheet. The search fills the header row. The stat grid
stacks. The table hides checkbox, issued, and due (`hidden sm:table-cell`); the number moves
under the customer name.

## 7. Motion

- Rows: `transition-colors duration-100 hover:bg-muted/50 motion-reduce:transition-none`.
- Buttons: `active:scale-[0.98] transition-transform motion-reduce:transform-none`.
- Money bar segments: `transition-[width] duration-500 ease-out motion-reduce:transition-none`.
- Selection bar: `animate-in fade-in-0 slide-in-from-bottom-2 duration-200 motion-reduce:animate-none`.
- Dialog, Sheet, and Select keep the kit `animate-in` classes.
- Never: count-up numbers, bounce, loops, parallax.

## 8. Imagery

SVG first: the slip of the empty state also serves sign-in A1. Use `generate_image` only for the
A2 photo panel: one image, path `public/sign-in-desk.png`, used as `/sign-in-desk.png`, aspect 4:5.

Prompt model: "Top-down photograph of a pale oak desk with a blank sheet of cream paper, a black
fountain pen, and a steel ruler, soft north daylight, long soft shadows, warm whites, much empty
space, 35 mm, no text, no numbers, no logos, no watermark."

Never people, cash, cards, or charts.

## 9. Bans

- No shadow on data cards, no gradient, no second accent, no dark mode, no theme picker.
- No pills. No uppercase labels. No amount in a proportional font or aligned to the start.
- No pie chart. No KPI card with an icon in a colored circle. No status color without a word.
- No fake invoices, customers, or totals. Sample data only on request, with a "Sample" badge.
- No chat in the ask bar without a real assistant. No italics or letter-spacing in Arabic.

## 10. Self-check

1. `tokens.css` has these values, no `.dark` block, and the world id in its header comment.
2. The shell is `DashboardShell` with `variant="rail"` and `density="comfortable"`.
3. Greeting, titles, and totals are Newsreader. Every amount is Red Hat Mono, `text-end`.
4. Buttons and chips have 4 px corners. Data cards have no shadow.
5. The home is H1 or H2, with real zeros and a working "Get started".
6. The money bar shows real shares, or the hatched track.
7. Each status shows a word. Every chip, tab, and bar action works. All text uses `t()`.
8. At 375 px, nothing scrolls sideways, and the table keeps customer, status, and amount.
