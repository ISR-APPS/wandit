# Coffre — a bank vault after hours

`coffre` · medium · dark · comfortable · best for: personal finance, wealth, budgeting, crypto
portfolio, treasury, investor portal, fintech dashboard · avoid for: kids, food, clinic, school, beauty

## 1. Feel

Black steel, a cold blue status light, numbers that glow in the dark: a quiet instrument panel
for money. Big balances sit in a sharp grotesk. Amounts, labels, and dates are in a thin mono,
like the engraving on a safe deposit box. One electric blue draws the main line and the main
action. Gains are green, losses are red, nothing else has color.

Voice: a private banker, precise and discreet: "Net worth", "Over budget by 42,00 €". Every
change has a sign. No hype words, no emoji.

## 2. World law and client choices

World law, the same in every Coffre app:

- Near-black ground, steel cards with a 7 % white hairline. One blue marks the main button, the
  chart line, the focus ring, and the brand dot.
- Kit shell: `variant: "sidebar"`, `density: "comfortable"`. The sidebar has the ground tone with
  a hairline (flush). Under the navigation, it lists the accounts (signature 4).
- Dark only. `:root` holds the dark values. Delete the `.dark` block of `tokens.css`.
- Type: Schibsted Grotesk for text, titles, and balances. Fragment Mono (one weight, never bold)
  for every list amount, eyebrow, date, and period chip.
- Corners: `--radius: 0.75rem`. Cards 16 px, fields 10 px. Buttons and chips keep the kit pills.
- Cards: `shadow-[inset_0_1px_0_var(--color-border)]` in place of `shadow-sm`: a top highlight.
- Gain is `success`, loss is `destructive`. A change shows a sign and an arrow, never a color alone.
- In `button.tsx` and `badge.tsx`, replace `text-white` in the `destructive` variant with
  `text-destructive-foreground`. White fails contrast on the loss red.

Client choices, decided fresh for each app:

- `contentWidth`: `centered` for personal finance, `full` for treasury and investor tables.
- The sign-in composition: V1 or V2. The first-run home: N1 or N2 (section 6).
- The account types, the currency (ask it; never guess), and the default period (1M or 1Y).

Two Coffre apps never share the same sign-in and the same first-run composition.

## 3. Tokens

```css
:root {
	color-scheme: dark;
	--background: #07090c;
	--foreground: #e9eef5;
	--card: #0e1218;
	--card-foreground: #e9eef5;
	--popover: #141a22;
	--popover-foreground: #e9eef5;
	--primary: #2b6be6;
	--primary-foreground: #ffffff;
	--secondary: #161c25;
	--secondary-foreground: #e9eef5;
	--muted: #121820;
	--muted-foreground: #8b97a8;
	--accent: #18202b;
	--accent-foreground: #e9eef5;
	--destructive: #ff5d5d;
	--destructive-foreground: #07090c;
	--border: #ffffff12;
	--input: #ffffff1f;
	--ring: #3d8bff;
	--radius: 0.75rem;
	--sidebar: #07090c;
	--sidebar-foreground: #c9d2de;
	--sidebar-accent: #151b24;
	--sidebar-accent-foreground: #f2f5f9;
	--sidebar-border: #ffffff12;
	--sidebar-ring: #3d8bff;
	--chart-1: #3d8bff;
	--chart-2: #2fd3e0;
	--chart-3: #9b8cff;
	--chart-4: #d6c08a;
	--chart-5: #7f91a8;
	--success: #2ecc8f;
	--success-foreground: #04120b;
	--warning: #ffb547;
	--warning-foreground: #1a1205;
}

@theme {
	--font-sans: "Schibsted Grotesk", ui-sans-serif, system-ui, sans-serif;
	--font-display: "Schibsted Grotesk", ui-sans-serif, system-ui, sans-serif;
	--font-mono: "Fragment Mono", "Noto Kufi Arabic", ui-monospace, monospace;
}

html:lang(ar) {
	--font-sans: "Noto Kufi Arabic", ui-sans-serif, system-ui, sans-serif;
	--font-display: "Alexandria", "Noto Kufi Arabic", ui-sans-serif, sans-serif;
}
```

Write `World: coffre` in the header comment. Keep `@theme inline`. `chart-1` is the bright line
blue; `primary` is a deeper blue that holds white text.

In `__root.tsx` `head().links`, keep the `tokensCss` entry. Replace all other font links
(preconnect and stylesheets) with exactly these:

```ts
{ rel: "preconnect", href: "https://fonts.googleapis.com" },
{ rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
{
	rel: "stylesheet",
	href: "https://fonts.googleapis.com/css2?family=Schibsted+Grotesk:wght@400;500;600;700&family=Fragment+Mono&family=Alexandria:wght@500;600&family=Noto+Kufi+Arabic:wght@400;500;600&display=swap",
},
```

## 4. Type

- Hero balance: `font-display text-4xl font-semibold tabular-nums tracking-tight
  rtl:tracking-normal sm:text-5xl`. Split it with `Intl.NumberFormat(...).formatToParts()`: the
  decimals go in a `text-2xl text-muted-foreground` span.
- Eyebrow: `font-mono text-[11px] uppercase tracking-[0.12em] text-muted-foreground
  rtl:tracking-normal`.
- Amount in a list: `font-mono text-sm tabular-nums text-end`. Use `signDisplay: "exceptZero"`.
  Income is `text-success`, spending stays `text-foreground`.
- Body: `text-sm`. Card title: `text-base font-medium`.
- Arabic: Noto Kufi Arabic for text, Alexandria for display. Digits keep Fragment Mono. No italics.

## 5. Signatures

1. **The mono eyebrow with a chevron.** Every card opens with one eyebrow that links to its full
   view: `Link className="group inline-flex items-center gap-1"`, the eyebrow text, and
   `ChevronRight className="size-3 rtl:rotate-180"`. Examples: "NET WORTH", "BUDGETS".
2. **The glowing balance line.** A Card: eyebrow, hero balance, and a change pill (`h-6
   rounded-full px-2 font-mono text-xs bg-success/10 text-success`, `ArrowUpRight
   rtl:-scale-x-100`). A loss uses `destructive` and `ArrowDownRight`. The chart is a `relative
   h-48 sm:h-56` box with `dir="ltr"` and an SVG `viewBox="0 0 100 40" preserveAspectRatio="none"`.
   Area: a `linearGradient` of `var(--color-chart-1)`, opacity 0.28 to 0. Line: `stroke-chart-1`,
   `strokeWidth={1.75}`, `vectorEffect="non-scaling-stroke"`. The end dot is an HTML span, so it
   stays round: `absolute size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-chart-1 ring-4
   ring-chart-1/20 shadow-[0_0_12px_var(--color-chart-1)]`, at `insetInlineStart` and `top` in
   percent. Under it: period chips 1W 1M 3M YTD 1Y ALL in `toggle-group.tsx` (`h-7 rounded-full
   px-3 font-mono text-xs data-[state=on]:bg-secondary`). Each chip changes the real query. On
   pointer move, a `w-px bg-border` crosshair and a `bg-popover` mono label show date and value.
   Under 2 points, the box is hatched:
   `bg-[repeating-linear-gradient(135deg,var(--color-border)_0_1px,transparent_1px_7px)]`.
3. **The spending heatmap and budget bars.** Heatmap: `grid grid-cols-7 gap-1` of day buttons
   (`aspect-square rounded-md`), weekday heads from `Intl.DateTimeFormat(locale, { weekday:
   "narrow" })`. Zero spend `bg-muted`; four steps from the month's own quartiles: `bg-chart-1/15`,
   `/35`, `/60`, `/90`. Today `ring-1 ring-foreground/60`. Future days `border border-dashed
   bg-transparent`. Each cell has an `aria-label` (date and sum) and opens that day's
   transactions. Budget bars: per category, a dot, the name, and "spent / budget" in mono. The
   track is `h-1.5 rounded-full bg-muted`; the fill uses the category chart token. At 90 % the fill
   is `bg-warning` with "Close to limit". Over budget it is full `bg-destructive`, with "Over by
   42,00 €" in `text-destructive` and `TriangleAlertIcon`.
4. **The accounts list** (in the sidebar). After the nav items: an eyebrow "ACCOUNTS" with the
   total in mono at the end. Then one row per account: `flex min-h-9 items-center gap-2.5
   rounded-md px-3 text-sm hover:bg-sidebar-accent`. It holds a `size-2 rounded-full` dot, the
   name (`truncate`), and the balance (`ms-auto font-mono text-xs`, negative in `text-destructive`).
   Dots: `bg-chart-1` cash, `-2` savings, `-3` investments, `-4` credit, `-5` other.
   Each row links to that account's real view. No account: one line and an "Add account" button.

## 6. Screens

Add to `src/shared/ui/`, with tokens only: `table.tsx` (plain HTML), `toggle-group.tsx`,
`checkbox.tsx`, `dropdown-menu.tsx` (from `radix-ui`). Icons: `pnpm add lucide-react`, then
`LayoutDashboard`, `ArrowLeftRight`, `Wallet`, `Target`, `ChartColumn`, `Settings`, `Search`,
`Plus`, `ChevronRight`, `ArrowUpRight`, `ArrowDownRight`. Stroke 1.75, size 16.

**Shell.** `brand`: a `size-2 rounded-full bg-chart-1 shadow-[0_0_10px_var(--color-chart-1)]` dot
and the app name. `header`: a transaction search form (`flex-1 max-w-sm`) and, at `ms-auto`,
"Add transaction" (primary). `sidebarFooter`: the user email and a DropdownMenu (Settings,
Sign out). Nav lists only routes that exist.

**Sign-in.** Keep the auth logic, the email and password fields, and the sign-up toggle. Pick one:

- V1 Vault door: `grid min-h-svh lg:grid-cols-2`. Start: the form in `max-w-sm`, with an eyebrow
  and a `text-3xl font-semibold` title. End (`lg` only): an inset panel `m-3 rounded-2xl border
  overflow-hidden relative` with `/sign-in-vault.png` and one promise line at the bottom.
- V2 Night glow: one centered column on `bg-radial-[at_50%_0%] from-primary/20 via-background
  to-background`. The brand dot and the app name, then the form in a `Card max-w-sm w-full`.

**First run** (no rows yet). Pick one:

- N1 Net worth: `DashboardPageHeader` (date as `eyebrow`, action "Add account"), then
  `DashboardBody layout="analytics"`. `primary`: the balance line card with a real 0 and the
  hatched chart box. `secondary`: "Set up your vault".
- N2 The month: `DashboardPageHeader` with the month name, then `DashboardBody layout="workbench"`.
  `primary`: "SPENT THIS MONTH" with a real 0, then "Set up your vault". `secondary`: the heatmap,
  all cells `bg-muted`, today ringed, and "No spending recorded yet" with "Add transaction".
- "Set up your vault": three rows with mono numbers 01 02 03: "Add an account", "Record a
  transaction", "Set a monthly budget". Each opens its real Dialog. A step is done when its data
  exists. A 3-segment bar on top (`h-1 flex-1 rounded-full`, done `bg-primary`, else `bg-muted`).

**Records view** (transactions). `DashboardPageHeader` with account and category Selects and the
period chips. A `Card py-0 overflow-hidden` with the table.

- Day group rows: `h-9 bg-background`, the date as an eyebrow, the day net in mono at the end.
- Rows `h-12 border-b hover:bg-accent/60`. Columns: checkbox, payee (`font-medium`), category chip
  (`h-6 rounded-full bg-secondary px-2 text-xs` with its dot), account (muted), amount.
- Pending rows: `Badge variant="outline"` with `border-dashed font-mono uppercase text-[10px]`.
- Aggregate: a `tfoot` row with "In", "Out", and "Net" in mono.
- Selection: a floating bar `fixed bottom-6 inset-x-4 sm:inset-x-0 mx-auto w-fit rounded-full
  border bg-popover px-4 py-2 shadow-lg`: count, sum, "Change category", "Delete" (confirm Dialog).

**Record detail.** `Sheet side="end"`, `w-full sm:max-w-md`: date eyebrow, payee title, the
signed amount as a hero. Then a `dl` with eyebrow labels: Account, Category (Select), Date, Note
(Textarea). Footer: "Save" and "Delete" (confirm). An account page reuses the balance line card
and the filtered table.

**Analytics** (spending). `DashboardBody layout="analytics"`. `primary`: the budget bars. Then a
cumulative line of this month (`stroke-chart-1`) over last month (`stroke-muted-foreground`,
`strokeDasharray="3 3"`), with a word legend. `secondary`: the heatmap. Investments: a
holdings table and one allocation bar (stacked `chart-*` segments with a mono legend). No pie.

**Settings.** One `max-w-3xl` column of Cards: Profile, Currency, Accounts, Budgets, Danger zone
(`border-destructive/40`). Rows: an eyebrow label, the value, an "Edit" button with a Dialog.

**Empty state art.** An inline SVG vault dial, `w-36`: an outer `stroke-border` circle, 24 short
ticks, and an inner ring. One 90° arc in `stroke-chart-1` gets
`drop-shadow-[0_0_6px_var(--color-chart-1)]`. No words. Under it: one sentence and one action.

**Loading and error.** Skeletons copy the grid: hero line, chart box, eight `h-12` rows. Error:
a Card that says what failed, with "Try again".

**375 px.** The kit Sheet holds the nav and the accounts list. The hero is `text-4xl`. Period
chips scroll (`overflow-x-auto`). The heatmap keeps 7 columns (`gap-0.5`). The table hides
checkbox and account; the category chip moves under the payee.

## 7. Motion

- Chart: key the SVG by period. Area `animate-in fade-in-0 duration-500`; end dot `animate-in
  zoom-in-50 fade-in-0 duration-300 delay-300`. Add `motion-reduce:animate-none` to both.
- Budget fills `transition-[width] duration-700 ease-out`; heatmap cells `transition-colors`.
- Link cards `transition-colors hover:border-foreground/15`. Buttons `active:scale-[0.98]`.
- Every transition adds `motion-reduce:transition-none`.
- Never: count-up numbers, a pulsing dot, a ticker, parallax.

## 8. Imagery

SVG first: the dial and the balance line. Use `generate_image` only for sign-in V1: one image,
path `public/sign-in-vault.png`, used as `/sign-in-vault.png`, aspect 4:5.

Prompt model: "Macro photograph of a brushed dark steel vault door wheel in near darkness, one
thin cold blue rim light along the metal edge, deep black background, shallow depth of field,
subtle grain, no numbers, no engraving, no text, no logos, no watermark."

Never coins, cash, charts, tickers, or people.

## 9. Bans

- No light mode, no theme picker, no white card, no gradient button, no second accent.
- Glow only on the chart end dot, the brand dot, the dial arc, and sign-in V2.
- No pie or donut. No KPI card with an icon in a colored circle.
- No market price, quote, or return without a real data source. No fake balances or demo growth.
- No gain or loss without a sign and an arrow. No bold mono. No uppercase or tracking in Arabic.

## 10. Self-check

1. `tokens.css` has these values, `color-scheme: dark`, no `.dark` block, and the world id.
2. `DashboardShell` has `variant="sidebar"`, `density="comfortable"`, and the accounts list.
3. Every list amount is Fragment Mono, `text-end`, with a sign. Balances split the decimals.
4. Each card opens with a mono eyebrow that links to a real view.
5. The home is N1 or N2, with real zeros and a working "Set up your vault".
6. The balance line has a glowing end dot and working period chips, or the hatched box.
7. Destructive variants use `text-destructive-foreground`. All text uses `t()`.
8. At 375 px, nothing scrolls sideways, and the accounts list is in the nav Sheet.
