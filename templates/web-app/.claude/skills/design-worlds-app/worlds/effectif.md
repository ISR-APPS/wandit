# Effectif — the team wall in a sunlit office

`effectif` · medium · light · comfortable · best for: HR, staff directory, payroll, recruiting,
time off, employee portal, team admin · avoid for: nightlife, kids, crypto, dev tools, restaurant

## 1. Feel

A bright office on a Monday morning: warm paper walls, a deep green felt board, a band of
lilac light on each page. People are the content: names, roles, places, days away. The app is
kind and organized, never cute, never a bank.

Voice: a calm HR partner. Use first names. Put the verb first ("Approve", "Add a person").
Write dates as people say them ("Mon 3 Jun – Fri 7 Jun", "3 days"). No exclamation marks, no emoji.

## 2. World law and client choices

World law, the same in every Effectif app:

- Shell: `DashboardShell` with `variant="inset"` and `density="comfortable"`. The deep green
  canvas (`--sidebar`) frames the warm white panel. The `header` prop holds the pill tabs.
- The lilac band: each page opens with one `bg-secondary` band that holds `DashboardPageHeader`.
- Pills: keep the `rounded-full` base of Button and Badge. Cards and inputs use 12 px.
- Green decides: primary action, approve, brand mark. Lilac and violet mean people: the band,
  the "away" ring, the secondary button. No third brand color.
- Light only. No `.dark` block, no theme picker.

Client choices, decided fresh for each app:

- Sign-in A1 or A2. First-run home F1 or F2 (section 6).
- `contentWidth`: `full` for an HR admin, `centered` for a self-service portal.
- The areas: Home, People, Time off, Payroll, Hiring, Settings. Build only those of the brief.

Two Effectif apps never share the same sign-in and first-run composition.

## 3. Tokens

```css
:root {
	--background: #fbf8f3;
	--foreground: #1d2a24;
	--card: #ffffff;
	--card-foreground: #1d2a24;
	--popover: #ffffff;
	--popover-foreground: #1d2a24;
	--primary: #1f5a43;
	--primary-foreground: #ffffff;
	--secondary: #ece8ff;
	--secondary-foreground: #2f2659;
	--muted: #f2eee6;
	--muted-foreground: #5a6560;
	--accent: #e7f0ea;
	--accent-foreground: #1d2a24;
	--destructive: #b3261e;
	--destructive-foreground: #ffffff;
	--border: #e5dfd3;
	--input: #d6cfc1;
	--ring: #1f5a43;
	--radius: 0.75rem;
	--sidebar: #173a2d;
	--sidebar-foreground: #e6eee8;
	--sidebar-accent: #23503e;
	--sidebar-accent-foreground: #ffffff;
	--sidebar-border: #2b5545;
	--sidebar-ring: #c8bdff;
	--chart-1: #6346c9;
	--chart-2: #0c697c;
	--chart-3: #a23762;
	--chart-4: #85552a;
	--chart-5: #b23c0b;
	--success: #1e7a4a;
	--success-foreground: #ffffff;
	--warning: #f4c45a;
	--warning-foreground: #3d2c05;
}

@theme {
	--font-sans: "Nunito Sans", ui-sans-serif, system-ui, sans-serif;
	--font-display: "Familjen Grotesk", "Nunito Sans", ui-sans-serif, system-ui, sans-serif;
	--font-mono: "Azeret Mono", ui-monospace, monospace;
}

html:lang(ar) {
	--font-sans: "Noto Sans Arabic", ui-sans-serif, system-ui, sans-serif;
	--font-display: "Alexandria", "Noto Sans Arabic", ui-sans-serif, system-ui, sans-serif;
}
```

Header comment of `tokens.css`: `World: effectif.` Delete the `.dark` block. Set the `html`
letter-spacing of the base layer to `-0.01em`. In `__root.tsx`, the font links become:

```ts
{ rel: "preconnect", href: "https://fonts.googleapis.com" },
{ rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
{
	rel: "stylesheet",
	href: "https://fonts.googleapis.com/css2?family=Alexandria:wght@600;700&family=Azeret+Mono:wght@400;500&family=Familjen+Grotesk:wght@500;600;700&family=Noto+Sans+Arabic:wght@400;600;700&family=Nunito+Sans:wght@400;600;700&display=swap",
},
```

## 4. Type

- Titles: Familjen Grotesk. `DashboardPageHeader` sets it already. h2: `font-display text-lg font-semibold`.
- Big number: `font-display text-4xl font-semibold tabular-nums`, passed as the `DashboardMetric` value.
- Body: Nunito Sans, `text-sm` in lists, `text-base` in forms.
- Label: `text-xs font-semibold text-muted-foreground`, sentence case. Never uppercase.
- Data: `font-mono text-xs tabular-nums` for employee IDs, table dates, pay. Format with `Intl`.
- Arabic: Alexandria titles, Noto Sans Arabic text. Keep `font-mono` for IDs only.

## 5. Signatures

1. **The letter rail directory.** Sort with `Intl.Collator(locale)`, group by first letter.
   Each group opens with a sticky divider: `sticky top-0 z-10 flex items-center gap-3
   bg-card/95 px-4 py-1.5 backdrop-blur`. It holds the letter (`font-display text-sm
   font-semibold text-primary`), a hairline (`h-px flex-1 bg-border`), and the count. From `md`,
   a jump strip sits on the end side (`sticky top-4 hidden md:flex flex-col gap-0.5`). Each letter
   is a `size-6 rounded-full text-[11px]` button that scrolls to its group. An empty letter is
   `disabled`. An Arabic app builds the strip from the letters of its data.
2. **The people row.** A Link: `flex h-16 items-center gap-3 px-4 hover:bg-muted/60`. Avatar
   `size-10` (`avatar.tsx`); initials `bg-chart-N/12 text-chart-N`, N from a hash of the id.
   Write the five class strings in a static array: Tailwind cannot see `bg-chart-${n}`. Then
   name (`text-sm font-semibold`) over role and team (`text-xs text-muted-foreground truncate`).
   Then the place: an ISO code chip (`rounded-sm border px-1 font-mono text-[11px]`) and the city.
   Then the status pill (`rounded-full border px-2.5 py-0.5 text-xs`) with a `size-1.5` dot:
   Active `bg-success`, Away `bg-chart-1`, Onboarding `bg-warning`, Left `bg-muted-foreground`.
   Last, `ChevronRight` with `rtl:rotate-180`. Away today adds `ring-2 ring-chart-1 ring-offset-2` to the avatar.
3. **The half-moon request.** Each request state is this 16 px SVG plus a word:

   ```tsx
   <svg viewBox="0 0 16 16" className="size-4 shrink-0 rtl:-scale-x-100" aria-hidden="true">
     <circle cx="8" cy="8" r="7" fill="none" stroke="currentColor" strokeWidth="1.5" />
     {state === "pending" && <path d="M8 3.5a4.5 4.5 0 0 1 0 9Z" fill="currentColor" />}
     {state === "approved" && <circle cx="8" cy="8" r="4.5" fill="currentColor" />}
     {state === "declined" && <path d="M5 11 11 5" stroke="currentColor" strokeWidth="1.5" />}
   </svg>
   ```

   Chips: Requested `border text-muted-foreground`, Pending `bg-warning text-warning-foreground`,
   Approved `bg-success text-success-foreground`, Declined `bg-destructive/10 text-destructive`.
   A pending row shows Approve (`size="sm"`, `Check`) and Decline (`variant="outline"`, `X`)
   to a user who can decide. A toast confirms, and its Undo restores the old state.

## 6. Screens

**Shell.** `const dashboardDesign = { variant: "inset", density: "comfortable", contentWidth: "full" } as const;`
`brand`: a `size-7 rounded-lg bg-secondary text-secondary-foreground` square with the first
letter, then the app name. Icons: `pnpm add lucide-react`; `House`, `Users`, `TreePalm`,
`Wallet`, `BriefcaseBusiness`, `Settings`. Time off shows its pending count above 0 in a
`ms-auto rounded-full bg-secondary px-1.5 text-[11px] text-secondary-foreground` pill.
`sidebarFooter`: the user and a Sign out ghost pill (`hover:bg-sidebar-accent`).
`header`: the tabs (`flex min-w-0 flex-1 gap-1 overflow-x-auto`), then the search. Each tab is
a `Link`: `h-9 rounded-full px-4 text-sm data-[status=active]:bg-foreground
data-[status=active]:text-background`. A tab is a child route or a zod-parsed `view` param.
Search: `Input` with `ps-9 rounded-full bg-muted sm:w-64`. The band: `-mx-4 -mt-4 bg-secondary
px-4 py-6 lg:-mx-8 lg:-mt-8 lg:p-8`.

**Sign-in** (`login-page.tsx`, email and password only):

- A1 Felt board: `grid min-h-svh lg:grid-cols-2`. Start: `flex flex-col justify-center px-6
  sm:px-12`, brand, h1 `font-display text-4xl`, one muted line, the form (`max-w-sm`, inputs
  `h-11`, full-width `size="lg"` pill). End: `m-3 hidden rounded-3xl bg-sidebar p-10 lg:flex
  flex-col justify-between`. The team wall SVG fills the top. A lilac card (`rounded-2xl
  bg-secondary p-6 font-display text-2xl`) holds one product sentence.
- A2 Lilac morning: a `h-[42svh] bg-secondary` band holds the generated image (`size-full
  object-cover`). The form card overlaps it: `relative mx-auto -mt-24 max-w-md rounded-2xl border bg-card p-8`.

**First-run home.** The band shows the date (`Intl`, weekday long) and "Good morning, {first name}".
Real zeros only. Every string, chip word, and label goes through `t()`.

- F1 Setup bench: `DashboardBody layout="workbench"`. `primary`: a "Get started" card with a
  `h-1.5 rounded-full bg-muted` track and a `bg-primary` fill. Then 3 or 4 step rows
  (`rounded-xl p-3 hover:bg-muted`): half-moon from real data, title, hint, chevron. Each row
  opens its real Dialog or route. `secondary`: the empty directory card ("People 0", the empty
  seat art, "Add person").
- F2 Today board: `layout="analytics"`. `metrics`: People, Away today, Pending requests, each a
  real count. `primary`: a "This week" card, `grid grid-cols-7 divide-x`, with the avatars of
  people away each day. An empty day shows a `size-8 rounded-full border border-dashed` circle.
  Closed days (from company settings) get the hatch
  `bg-[repeating-linear-gradient(135deg,var(--color-border)_0_1px,transparent_1px_7px)]`.
  `secondary`: the request queue, empty, with "Request time off". The steps sit in the band as
  half-moon pills and go away when all are done.

**Directory** (main list): `Card` with `gap-0 p-0`. Toolbar `flex flex-wrap gap-2 border-b
px-4 py-3`: "People" and its count, then `rounded-full` Select filters (Team, Location, Status).
"Clear" shows when a filter is on. "Add person" sits at `ms-auto`. An admin app adds
`checkbox.tsx` (Radix Checkbox) at the row start. Selection opens a bulk bar: `fixed inset-x-4
bottom-6 z-40 mx-auto flex w-fit gap-2 rounded-full bg-foreground py-2 ps-4 pe-2
text-background shadow-lg`. It holds the count, "Change team", "Export CSV" (a real Blob), and
close. Footer: `border-t px-4 py-2.5 text-xs text-muted-foreground`, "12 people · 2 away today".

**Requests** (table): add `table.tsx` (plain HTML). Saved-view pills: Pending (count),
Upcoming, Past, All. Header `h-10 bg-muted/60 text-xs font-semibold text-muted-foreground`;
rows `h-14 border-b`. Columns: person (avatar `size-8`), type chip (`bg-chart-N/12
text-chart-N`, one N per leave type), dates (`font-mono`), days (`text-end`), half-moon chip,
decision. Footer: pending count, approved days this month. A row opens a `Sheet` (`side="end"`)
with the details and the decision in `SheetFooter`.

**Person page** (`/app/people/$personId`): the band is `flex items-end gap-4`. It holds a
`size-20` avatar (`ring-4 ring-card`) and `DashboardPageHeader`: the name, role and team as
eyebrow, and the actions "Request time off" and "Edit". Below:
`tabs.tsx` on Radix Tabs; `TabsList` `rounded-full bg-muted p-1`, triggers `h-8 rounded-full
px-4 data-[state=active]:bg-card`. Profile: a `dl` in `grid grid-cols-[9rem_minmax(0,1fr)]
gap-3 text-sm`, plus manager and reports on the side. Time off: one card per leave type. The days
left are a big number over a two-tone bar (`bg-muted` track, `bg-chart-N` used part).

**People report** (only with real rows): `layout="analytics"`. Headcount by team as `div` bars
(`h-2.5 rounded-full bg-chart-1` at width %, label, count). Under 2 months of data, show the
hatch band and one sentence.

**Settings**: `grid gap-8 lg:grid-cols-[12rem_minmax(0,1fr)]`. Start: a vertical pill nav
(Company, Teams, Leave types, Members). Content: cards, each with a Save pill in a footer
`flex justify-end border-t bg-muted/40 px-6 py-3`. A leave type has a name, a chart tint, and
a yearly allowance. Company settings also hold the closed days of the week. The danger card (`border-destructive/30`) confirms "Delete workspace" in a Dialog.

**Empty state art**: "the empty seat", an inline SVG (`viewBox="0 0 160 96"`). It shows two
round silhouettes (`fill-secondary`) and a dashed one with a plus (`stroke-primary`,
`strokeDasharray="4 4"`). Under it: one sentence and one pill.

**375 px**: the nav moves into the kit Sheet. Tabs scroll sideways; search takes a full row.
People rows drop the city and keep the status word. The jump strip hides; dividers stay. Request
rows become `rounded-xl border p-4` cards with both pills in `grid grid-cols-2 gap-2`.

## 7. Motion

Calm: 150 to 250 ms, ease-out, CSS and tw-animate-css only.

- Rows `transition-colors duration-150`. Pills `active:scale-[0.98]`.
- A changed request chip mounts with `animate-in fade-in-0 zoom-in-95 duration-200`.
- Tab content `animate-in fade-in-0`. Bulk bar `animate-in slide-in-from-bottom-2`.
- No count-up. Add `motion-reduce:animate-none motion-reduce:transition-none` everywhere.
- Never: confetti, bouncing avatars, a looping pulse.

## 8. Imagery

SVG first. `generate_image` only for the A2 band (at most 2 images per first build):
`public/effectif-office.png`, `16:9`, used as `/effectif-office.png`.

Prompt model: "Flat paper-cut illustration of a bright office corner, [subject: a long shared
desk / a reception bench / a small meeting room], tall plant, window light, deep green #1f5a43,
soft lilac #ece8ff, warm paper #fbf8f3, small amber accents, no people, no faces, no text, no logos."

Team wall SVG (A1): 18 circles (24 to 64 px) in a loose grid, `fill-chart-1` to `fill-chart-5`
at `/25` and `/60`. Never a face.

## 9. Bans

- No dark mode, no theme picker, no gradient on a button or a band.
- No square buttons or chips. No flag emoji: use the ISO code chip.
- No invented people, salaries, or org charts. No stock photos of smiling teams.
- No sample rows unless the user asks. Then label each one "Sample".
- No status by color alone. No KPI icon in a colored circle. No headcount pie chart.

## 10. Self-check

1. A deep green canvas frames a warm white panel, and each page opens with one lilac band.
2. Titles and big numbers are Familjen Grotesk, text is Nunito Sans, IDs and pay are Azeret Mono.
3. Actions, tabs, and chips are pills. Cards and inputs use the 12 px radius.
4. The directory groups people by letter with sticky dividers. Rows show a place and a status word.
5. Each request shows a half-moon and a word. A manager decides in one click, and Undo works.
6. The first run is F1 or F2 with real zeros. Sign-in is A1 or A2, email and password only.
7. At 375 px, nothing scrolls sideways. In Arabic, the twin fonts load and directional icons flip.
