# Fiche — an index card for every person, typed and dated

`fiche` · quiet · light · compact · best for: CRM, sales pipeline, contacts, agency clients,
recruiting pipeline, partner lists · avoid for: kids, nightlife, meditation, restaurants, events

## 1. Feel

A card file on a white desk. Each record is an index card: typed fields, dated changes, and a
few soft tags. The chrome almost disappears. Black ink, hairlines, and 13 px text carry the
app. It feels exact and fast, like a spreadsheet that knows people.

Voice: plain and exact. A verb first ("Add person", "Save view"). Counts follow nouns, in mono
("People 0"). No exclamation marks, no emoji, no sales words.

## 2. World law and client choices

World law, the same in every Fiche app:

- Shell: `DashboardShell variant="sidebar" density="compact"`. The sidebar is one step off white,
  flush, with one hairline. Never dark, never colored.
- Black is the only action color: one black button per view, its main create action. Other
  actions are `outline` or `ghost`. Color appears only in tags (signature 1).
- Instrument Sans for all text. Martian Mono for IDs, amounts, dates, counts, and key hints.
- `--radius: 0.375rem`. Pass `className="rounded-md"` to every `Button`. Tags are `rounded-sm`.
  Circles only for people avatars; company avatars are `rounded-md` squares.
- Hairlines, not shadows: `shadow-none` on every `Card`. Only overlays get `shadow-lg`.
- Rows are 34 px (`h-8.5`). Cell text is 13 px (`text-[0.8125rem]`).

Client choices, decided fresh for each app:

- `contentWidth`: `full` when tables lead (default), `centered` when forms lead.
- The lead table of `/app`: People, Companies, Deals, Candidates, or Clients.
- The sign-in (A1 or A2) and the first run (F1 or F2), section 6.
- The hue of each tag option. A pipeline board exists only for an entity with stages.

Two Fiche apps must never share the same sign-in and first-run pair.

## 3. Tokens

```css
:root {
	--background: #ffffff;
	--foreground: #18181b;
	--card: #ffffff;
	--card-foreground: #18181b;
	--popover: #ffffff;
	--popover-foreground: #18181b;
	--primary: #18181b;
	--primary-foreground: #fafaf9;
	--secondary: #f4f4f5;
	--secondary-foreground: #18181b;
	--muted: #f4f4f5;
	--muted-foreground: #5c5c66;
	--accent: #f1f1f2;
	--accent-foreground: #18181b;
	--destructive: #dc2626;
	--destructive-foreground: #ffffff;
	--border: #e7e7e9;
	--input: #dcdce0;
	--ring: #18181b;
	--radius: 0.375rem;
	--sidebar: #fafaf9;
	--sidebar-foreground: #3f3f46;
	--sidebar-accent: #efefee;
	--sidebar-accent-foreground: #18181b;
	--sidebar-border: #ececea;
	--sidebar-ring: #18181b;
	--chart-1: #e11d48;
	--chart-2: #b45309;
	--chart-3: #4d7c0f;
	--chart-4: #0369a1;
	--chart-5: #7c3aed;
	--success: #15803d;
	--success-foreground: #ffffff;
	--warning: #f5c04a;
	--warning-foreground: #3a2a06;
}

@theme {
	--font-sans: "Instrument Sans", ui-sans-serif, system-ui, sans-serif;
	--font-display: "Instrument Sans", ui-sans-serif, system-ui, sans-serif;
	--font-mono: "Martian Mono", ui-monospace, monospace;
}

html:lang(ar) {
	--font-sans: "Noto Sans Arabic", ui-sans-serif, system-ui, sans-serif;
	--font-display: "Noto Sans Arabic", ui-sans-serif, system-ui, sans-serif;
}
```

Static light: delete the `.dark` block. In `@layer base`, set the `html` letter-spacing to
`-0.011em`. In `__root.tsx`, the font part of `head().links` becomes:

```tsx
// World fiche: Instrument Sans, Martian Mono, and the Arabic twin Noto Sans Arabic.
{ rel: "preconnect", href: "https://fonts.googleapis.com" },
{ rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
{
	rel: "stylesheet",
	href: "https://fonts.googleapis.com/css2?family=Instrument+Sans:wght@400;500;600;700&family=Martian+Mono:wght@400;500&family=Noto+Sans+Arabic:wght@400;500;600;700&display=swap",
},
```

## 4. Type

- Cells and body: `text-[0.8125rem] leading-5`. The name in a row: `font-medium`.
- Column header and sidebar group label: `text-xs font-medium text-muted-foreground`.
- Title bar of a records view: `text-sm font-semibold`, then the count in mono.
- Record title: `font-display text-xl font-semibold tracking-tight`.
- Mono: `font-mono text-[0.6875rem] tracking-normal tabular-nums slashed-zero`. Amounts:
  `font-mono text-xs tabular-nums text-end`, with `Intl.NumberFormat` and the stored currency.
- Key hint: `<kbd>` with `inline-grid h-5 min-w-5 place-items-center rounded-sm border bg-muted
  px-1 font-mono text-[0.625rem]`.
- Arabic: Noto Sans Arabic carries all text. No `uppercase` and no tracking on Arabic labels.

## 5. Signatures

1. **The typed table.** Add `src/shared/ui/table.tsx` in plain HTML (`Table`, `TableHeader`,
   `TableBody`, `TableFooter`, `TableRow`, `TableHead`, `TableCell`). Wrap it in `-mx-4
   max-h-[calc(100dvh-12rem)] overflow-auto border-y`, flush to the shell edges, so the sticky
   header and footer stick. The `thead` is `sticky top-0 z-20 bg-background`. Each `TableHead` is
   `h-8 border-e px-2 text-start` with a type icon (`size-3.5 text-muted-foreground`) before the label: `Type`,
   `Hash`, `Coins`, `AtSign`, `Phone`, `Calendar`, `CircleDot` (stage), `Tags`, `UserRound`
   (owner), `Link2` (relation). A header click sorts. The first column is sticky (`sticky start-0
   z-10 bg-background`): checkbox, avatar chip, name. The `tfoot` is the aggregate row (`sticky
   bottom-0 h-8 border-t bg-background`): "{n} records" in mono, `Sum` under amounts, and a
   `Select` with a ghost trigger "+ Calculate" under other columns (Count filled, Count empty).
   Compute each aggregate over the full filtered set with a count or sum query, not the page.
   - Tag chip: `<span>` with `inline-flex h-5 items-center gap-1 rounded-sm bg-chart-4/12 px-1.5
     text-xs font-medium text-foreground` and a dot `size-1.5 rounded-full bg-chart-4`. Hues 1-5
     are `chart-1` to `chart-5`; hue 6 is `bg-muted` with a `bg-muted-foreground` dot. Store
     `color smallint` (1-6) on the option row. Write the six class pairs as full strings in one
     constant: Tailwind does not see built class names.
   - Avatar chip: two initials, `size-5 font-mono text-[0.625rem]`, on a hue tint from the id.
2. **Filter tokens and saved views.** Row 1, view tabs: `flex h-10 items-end gap-4
   overflow-x-auto border-b`, one `Link` per view (`view` search param), the active one with
   `-mb-px border-b-2 border-foreground pb-2 font-medium`. Row 2:
   `flex flex-wrap items-center gap-1.5 py-2`. A token is one chip, `inline-flex h-7
   items-stretch divide-x rounded-md border bg-card text-xs`: field (icon, muted), operator ("is",
   "contains"), value (`font-medium`, a tag chip for tags), and an `X` with an `aria-label`. Each
   part opens a Popover to edit it. "+ Filter" (`ListFilter`, `ghost`) opens the field list.
   Filters live in the URL through a zod `validateSearch`. When they differ from the view, show
   "Save view" (`outline`) and "Reset" (`ghost`). A view is a `saved_views` row, RLS by owner.
3. **The diff timeline.** The Activity tab lists events, newest first, on a hairline
   (`ms-2.5 border-s`). Each event is `relative ps-5`: an avatar chip on the line (`absolute
   -start-2.5 top-0`), "{actor} changed {field}", and the relative time in mono at the end. A
   change shows a card (`mt-1.5 inline-flex flex-wrap items-center gap-2 rounded-lg border
   bg-card px-3 py-2 text-xs`): old value (`text-muted-foreground line-through`), `ArrowRight`
   (`size-3 rtl:rotate-180`), new value. Data: a `record_events` table (record id, field,
   old_value, new_value, actor default `auth.uid()`, created_at). A `security definer` trigger
   `after update` adds one row per tracked column that `is distinct from` its old value. RLS:
   members read only.

## 6. Screens

Run `pnpm add lucide-react`. Add `checkbox.tsx`, `popover.tsx`, and `tabs.tsx` to
`src/shared/ui` on `Checkbox`, `Popover`, and `Tabs` from "radix-ui".

**Shell.** `brand`: a `size-6 rounded-md bg-primary` square with the initial in mono, then the
name. `navigation`: group "Records" (icon, name, mono count at `ms-auto`), group "Views" (only
when a saved view exists), then Settings. A records view puts its `h1` title bar in `header`
(icon box, name, mono count), with quick find (`outline size="sm"`, `<kbd>⌘K</kbd>`) and the
black button at `ms-auto`. It skips `DashboardPageHeader`, so the table starts high.
`sidebarFooter`: the setup meter while steps remain ("Set up 2/4" in mono over 4 `h-1
rounded-full` segments, done `bg-foreground`), then the account row with sign-out. Quick find is
a `Dialog` (`max-w-xl gap-0 p-0`): an `h-11` input, results by entity in `h-9` rows, arrow keys
and Enter. Its key listener is an effect with `// effect: listen for the ⌘K shortcut.`

**Sign-in.** Email and password only, with the logic of `login-page.tsx`. Pick one:

- A1 Card stack: `grid min-h-svh place-items-center bg-sidebar px-4`, the brand on top. The form
  card (`relative rounded-xl border bg-card p-6`) lies on two blank cards (`absolute inset-0
  rounded-xl border bg-card`, one `translate-y-2 -rotate-2`, one `translate-y-1 rotate-1`).
- A2 Ghost table: `grid min-h-svh lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]`. Start: the form,
  `max-w-sm`, no card. End (`hidden lg:flex items-center overflow-hidden border-s bg-sidebar
  ps-12`, `aria-hidden`): the app's own table, bleeding off the end edge, with real column names
  through `t()`, six ghost rows (bars `h-2 rounded-sm bg-border`, one blank tag), no names.

**First run.** Real zeros and a working path. Pick one:

- F1 Table first: `/app` opens the lead table, `DashboardBody layout="operations"`. Primary: the
  real headers, the tab "All people", the footer "0 records", and one `colSpan` cell, `h-56`,
  with the empty state. Secondary: "Get started", 4 rows `h-11 border-b`: `Circle` or
  `CircleCheck` (`text-success`), the step, an `outline size="sm"` action. Steps use real counts
  and existing actions: first record, a related record, a saved view, the workspace name.
- F2 Pipeline first (an entity with stages): `layout="workbench"`. Primary: the setup list, each
  row with a mono category (`uppercase tracking-wider`: RECORDS, PIPELINE, VIEWS), a title, and
  "Start" or "Done". Secondary: the board of real stages (`flex gap-3 overflow-x-auto`, columns
  `w-64`). A header shows the stage tag, count `0`, and sum `0` in mono. A body is a dashed zone
  (`h-32 rounded-lg border border-dashed`) with a ghost "+ Add".

**Records view.** Rows `h-8.5 border-b hover:bg-muted/60`, cells `max-w-64 truncate border-e
px-2`; an empty cell stays empty. A `w-8` checkbox column; a selected row is `bg-accent`. Then a
bar appears: `fixed inset-x-0 bottom-6 z-40 mx-auto flex w-fit items-center gap-1 rounded-lg
bg-foreground p-1.5 text-background shadow-lg`: mono count, change stage, add tag, delete (a
`Dialog` confirm), `X`. Under the table: "1–50 of 0" in mono and chevrons (`rtl:rotate-180`).
A row click opens the peek. Loading: 8 `Skeleton` rows `h-8.5` under the real headers. Error:
one band row with the failure and "Retry". A "Board" tab reuses the F2 columns.

**Record detail.** Peek: `SheetContent side="end" className="sm:max-w-md"`. Page
`/app/<entity>/$id`: `grid lg:grid-cols-[minmax(0,1fr)_20rem]`. Main: avatar chip `size-10`,
title, tags, then Note, Task, and Email (`mailto:`) as `outline size="sm"`, then Tabs in the
view-tab style: Activity, Notes, Tasks. End panel `lg:border-s lg:ps-6`: groups General, Contact, System; rows `grid min-h-8
grid-cols-[7rem_minmax(0,1fr)] items-center`. A click edits a value in an `Input h-7`.

**Analytics**, only on request: a stage funnel of inline SVG bars in the stage hues, mono values.

**Settings.** `max-w-3xl`, `DashboardPageHeader`, a `w-44` section nav on `lg`. Cards
`shadow-none gap-0 py-0 divide-y`, rows `min-h-12 px-4`, Save in a `border-t` footer: Workspace,
Stages (order, hue swatches), Tags, Account, and a Danger card (`border-destructive/40`).

**Empty state art.** Inline SVG `viewBox="0 0 160 100"`, `w-40`, `aria-hidden`: an index card
(`fill="var(--color-card)" stroke="var(--color-border)"`), three ghost rows
(`fill="var(--color-muted)"`), one tag (`fill="var(--color-chart-4)" fill-opacity="0.15"`). Then
a `text-sm font-medium` title, one muted sentence, one action.

**375 px.** The kit Sheet holds the sidebar. Quick find and create become `size="icon"`. Only
the table wrapper scrolls sideways; the first column stays sticky. Tokens wrap. The selection
bar is `inset-x-3 w-auto`. The record page stacks header, fields, then tabs.

## 7. Motion

Quiet and short. Tables have no entry animation.

- Rows: `transition-colors duration-100`. Buttons: `active:scale-[0.98] transition-transform`.
- Popovers, selects, quick find: `data-[state=open]:animate-in fade-in-0 zoom-in-95 duration-100`.
- Selection bar: `animate-in fade-in-0 slide-in-from-bottom-2 duration-150`. A new timeline
  event: `animate-in fade-in-0 duration-200`.
- Add `motion-reduce:transition-none` and `motion-reduce:animate-none` to each of these.
- Toasts: `<Toaster position="bottom-center" />` in `__root.tsx`.
- Never: count-up numbers, bounce, page fades, a page spinner.

## 8. Imagery

No photo by default: the art is SVG and HTML in tokens. When the user asks for a sign-in
picture, call `generate_image` once (4:5), save `public/signin-cards.png`, and show
`/signin-cards.png` in the A2 end panel.

Prompt model: "Top-down photograph of a neat stack of blank white index cards and a black pen on
a pale grey desk, soft side daylight, faint paper texture, one small pastel paper tab, minimal,
no text, no writing, no logos, no watermark."

Never portraits, stock offices, or a fake CRM screen.

## 9. Bans

- No dark or colored sidebar, no gradient, no second action color, no colored links.
- No shadow on cards, rows, or tables. No zebra rows.
- No KPI tiles on the home. No chart unless the user asks for reports.
- No status by color only: every tag shows its word.
- No amount in the sans face, no amount aligned to the start.
- No `rounded-full` buttons, no pill tags.
- No invented people, deals, avatars, or activity. Sample rows only on request, labeled "Sample".
- No Google, Apple, or magic-link button on the sign-in.

## 10. Self-check

1. The sidebar is near white and flush, with one hairline. No dark surface exists.
2. Each view has one black button. All other color is in tags.
3. Each column header has a type icon. Footer aggregates cover the filtered set.
4. Filters are URL tokens. A saved view reopens with the same tokens.
5. A record change shows in Activity as old value, arrow, new value.
6. IDs, amounts, dates, and counts are mono with `tabular-nums`. Amounts align to the end.
7. The first run shows real zeros, the card art, and a working setup list (F1 or F2).
8. At 375 px only the table wrapper scrolls sideways.
9. In Arabic the layout mirrors, arrows rotate, and no label is uppercase.
