# Chevet — a lamp left on by the bed for the next patient

`chevet` · quiet · light · comfortable · best for: clinic, dentist, physiotherapy, therapy
practice, patient portal, pharmacy, vet clinic, lab results · avoid for: nightlife, gym, kids
games, marketplace, e-commerce, dev tools

## 1. Feel

Porcelain, linen, and a pine-green door: the practice at 7:55, before the first patient. The day
is a short column of soft cards, one patient at a time. Results are plain numbers against their
normal range. Names and headings use a book serif, like a typed file label. Nothing blinks, and
one thing at a time asks for action.

Voice: a calm nurse at the desk. Plain words that a patient also understands. Facts first:
"09:30 · Room 2 · Follow-up". No exclamation marks, no emoji, no alarm word for a normal event.

## 2. World law and client choices

World law, the same in every Chevet app:

- Kit shell: `variant: "inset"`, `density: "comfortable"`, in one module-level `const` with
  `contentWidth`. A porcelain canvas (`bg-sidebar`) frames a warm white panel. The active nav item
  is a white chip with pine text.
- Pine (`primary`) is the only strong color. The content of a screen has one filled pine element:
  the main button, or the Next patient card. Other actions are `outline` or `ghost`.
- Source Serif 4 for headings, patient names, and the date. Public Sans for text. Source Code Pro
  for times, values, units, and record numbers.
- Corners: `--radius: 0.625rem` (cards 14 px, fields 8 px). Buttons and badges stay pills. Data
  cards get `shadow-none` and a hairline border.
- `destructive` (coral) marks only an out-of-range value, an allergy, a cancellation, an error.
- Each `visit_types` row stores `color_slot` (1 to 5), picked in settings. Map each slot to full
  class strings in one object.
- Privacy: a toast, a page title, and the tab title never show a patient name or a result. RLS:
  practice staff read the practice rows; a portal patient reads only their own rows.

Client choices, decided fresh for each app:

- Sign-in C1 or C2, first run F1 or F2 (section 6). Two Chevet apps never share both.
- `contentWidth`: `full` for a practice with rooms, `centered` for a solo therapist.
- The nouns: patient, client, or pet and owner. A portal shows Next visit, not Next patient.
- Results only for a practice that records lab values. The art (section 8).

## 3. Tokens

Replace the `:root`, `@theme`, and `html:lang(ar)` blocks of `src/styles/tokens.css`:

```css
:root {
	--background: #fcfbf8;
	--foreground: #14302b;
	--card: #ffffff;
	--card-foreground: #14302b;
	--popover: #ffffff;
	--popover-foreground: #14302b;
	--primary: #1f6f5c;
	--primary-foreground: #ffffff;
	--secondary: #dbe8f5;
	--secondary-foreground: #14302b;
	--muted: #f2efe8;
	--muted-foreground: #56655f;
	--accent: #ebf1ed;
	--accent-foreground: #14302b;
	--destructive: #c03c38;
	--destructive-foreground: #ffffff;
	--border: #e4dfd4;
	--input: #d3cdbf;
	--ring: #1f6f5c;
	--radius: 0.625rem;
	--sidebar: #f1eee6;
	--sidebar-foreground: #14302b;
	--sidebar-accent: #ffffff;
	--sidebar-accent-foreground: #1f6f5c;
	--sidebar-border: #e0dacd;
	--sidebar-ring: #1f6f5c;
	--chart-1: #1f6f5c;
	--chart-2: #2f6690;
	--chart-3: #7e4a8c;
	--chart-4: #946200;
	--chart-5: #a4523a;
	--success: #2f7a45;
	--success-foreground: #ffffff;
	--warning: #f0b43c;
	--warning-foreground: #2b2006;
}

@theme {
	--font-sans: "Public Sans", ui-sans-serif, system-ui, sans-serif;
	--font-display: "Source Serif 4", ui-serif, Georgia, serif;
	--font-mono: "Source Code Pro", ui-monospace, monospace;
}

html:lang(ar) {
	--font-sans: "Noto Sans Arabic", ui-sans-serif, system-ui, sans-serif;
	--font-display: "Noto Naskh Arabic", "Noto Sans Arabic", ui-serif, serif;
}
```

Delete the `.dark` block. Write `World: chevet` and the fonts in the file header comment. In the
`@layer base` `html` rule, set `letter-spacing: 0`.

In `__root.tsx` `head().links`, keep the `tokensCss` entry first. Replace all other font links
(preconnect and stylesheets) with exactly these, and update the comment above them:

```ts
{ rel: "preconnect", href: "https://fonts.googleapis.com" },
{ rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
{
	rel: "stylesheet",
	href: "https://fonts.googleapis.com/css2?family=Source+Serif+4:opsz,wght@8..60,400;8..60,500;8..60,600&family=Public+Sans:wght@400;500;600&family=Source+Code+Pro:wght@400;500&family=Noto+Naskh+Arabic:wght@500;600;700&family=Noto+Sans+Arabic:wght@400;500;600&display=swap",
},
```

## 4. Type

- Page title: `DashboardPageHeader` (serif through `h1`). Serif weights stay 400 to 600.
- Patient name: `font-display text-lg leading-6` in cards, `text-base` in tables.
- Body: `text-base leading-7`; tables `text-sm leading-6`. Labels: `text-xs font-medium
  text-muted-foreground`, sentence case, never uppercase.
- Mono: `font-mono text-sm tabular-nums` for `09:30`, `4.2 mmol/L`, and record numbers.
- Use `Intl.DateTimeFormat(locale)` and `Intl.RelativeTimeFormat` ("in 12 min").
- No italics in any language. Arabic: Noto Naskh Arabic for names and headings.

## 5. Signatures

1. **The agenda card.** A visit is an `li`: `grid grid-cols-[4.5rem_minmax(0,1fr)_auto]
   items-start gap-4 rounded-lg border-s-4 px-4 py-3` plus its slot classes (`{ 1:
   "border-chart-1 bg-chart-1/8", ... }`). Start column: the time in mono, the duration in
   `text-xs text-muted-foreground`. Middle: the patient in `font-display text-lg`, the visit type
   in `text-sm text-muted-foreground`. End: a room Badge (`outline`, `DoorOpen` icon) over the
   status, a `size-1.5 rounded-full` dot and a word (Booked, Arrived, In room, Done, No-show).
   States: past `opacity-60`; now `ring-1 ring-primary/40`; cancelled: name `line-through` and a
   coral "Cancelled". A free span between visits (at least the shortest visit type) is a row:
   `flex items-center gap-3 text-xs text-muted-foreground`, a `h-px flex-1 border-t border-dashed`
   line, "Free 10:30–11:15" in mono, and a ghost `sm` "Add visit" for that slot.
2. **The range bar.** A result row holds the analyte, the value and unit in mono (`text-end`),
   the bar, and a flag Badge: Low, In range, or High. Bar: `relative h-2 w-full rounded-full
   bg-muted`, `role="img"` with a full `aria-label`. The normal band is `absolute inset-y-0
   rounded-full bg-success/25`. The marker is `absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2
   rtl:translate-x-1/2 rounded-full ring-2 ring-card`, `bg-foreground` in range, `bg-destructive`
   out of range. Place them with `insetInlineStart` and `width` in percent in `style`. Domain:
   `low - (high - low) / 2` to `high + (high - low) / 2`; clamp the marker to 0 to 100. The
   range comes from the lab report that staff enter. No range: no bar, only "No range".
3. **The Next patient card.** `Card className="gap-4 border-0 bg-primary px-6 py-6
   text-primary-foreground shadow-none"`. It holds "Next patient" (`text-sm
   text-primary-foreground/80`), the name (`font-display text-3xl font-medium`), and a mono line
   "09:30 · Room 2 · Follow-up". Then the countdown "in 12 min" (`font-display text-xl`) and ONE
   `Button variant="secondary"` ("Open chart") with `focus-visible:ring-primary-foreground/60`. A
   minute clock store, read with `useSyncExternalStore`, drives the countdown. After the start:
   "Started 3 min ago". No visit left: "No more visits today" and "Book a visit".

## 6. Screens

Add to `src/shared/ui/` on `radix-ui` (`import { Tabs } from "radix-ui"`): `tabs.tsx`,
`checkbox.tsx`; and `table.tsx` in plain HTML. Run `pnpm add lucide-react`.
Icons: `Sun`, `Users`, `NotebookPen`, `FlaskConical`, `Settings`, `DoorOpen`, `Search`, `Plus`,
and `ArrowLeft`, `ChevronLeft`, `ChevronRight` (each with `rtl:rotate-180`).

**Underline tabs.** List: `flex h-10 gap-6 border-b`. Trigger: `relative h-10 text-sm
text-muted-foreground data-[state=active]:text-foreground`; the active one draws a `h-0.5
bg-primary` bar at `-bottom-px` with `after:` classes. The value is the search param `tab` (zod
in `validateSearch`).

**Shell.** `brand`: a `size-9 rounded-full bg-primary` serif initial, then the practice name in
`font-display text-lg` (a user logo replaces the initial). `navigation`: Today, Patients,
Notes, Results, Settings, if the route exists. `header`: the date in `font-display
text-lg` (`hidden sm:block`), then a patient search Input (`max-w-xs ps-9`); Enter opens
`/app/patients?q=`. `sidebarFooter`: the signed-in person (initials, name, role), ghost "Sign out".

**Sign-in** (restyle `login-page.tsx`; keep its email and password logic and the sign-up mode):

- C1 Letter: `grid min-h-svh place-items-center bg-sidebar px-6`, a `w-full max-w-sm` column, no
  Card: the practice name in `font-display text-4xl font-medium`, a `h-px w-12 bg-primary` rule,
  one muted line, `h-11 bg-card` fields, a full-width primary button, the mode link. Under it,
  the address or phone, only when the user gave it.
- C2 Window: `grid min-h-svh lg:grid-cols-2`. Start: the form, `mx-auto flex w-full max-w-sm
  flex-col justify-center gap-6 px-6`. End: `relative hidden p-4 lg:block`, a `size-full
  overflow-hidden rounded-2xl bg-muted` panel with the image (section 8) and an `absolute bottom-8
  start-8 rounded-full bg-card px-4 py-2 font-display` chip with the practice name.

**Today.** `layout="workbench"`. `primary`: the Next patient card, then the open tasks of the day.
`secondary`: the agenda under a day bar (previous, "Today", next) that sets the search param `day`.

**First run** (no rows: real zeros, working actions):

- F1 Calm day: the Today layout. `primary`: the empty Next patient card ("No visits today", "Book
  a visit"). Under it, "Get the practice ready" has 3 rows: Set opening hours, Add a visit type,
  Add a patient. Each row has a check when done and an outline button that opens the real
  Dialog. `secondary`: the agenda, with the open hours as one free span. Before hours exist, it
  shows one dashed block with "Set opening hours".
- F2 Register: `layout="operations"`. `primary`: the Patients table, its header row, and one
  full-width row with the empty state art, one sentence, and "Add a patient". `secondary`: "Today
  · 0 visits" and the setup card of F1.

**Patients** (records view). Action "Add patient". Toolbar: search, toggle chips (Visit this
week, Not seen in 6 months). Header row: `h-10 border-b text-xs font-medium
text-muted-foreground`, no fill. Rows: `h-14 border-b hover:bg-accent/70`. Columns:
Checkbox, patient (serif name, mono record number and age, a coral dot and "Allergy" when one is
recorded), phone, last visit (relative), next visit (or "None"), status: New (`secondary`),
Active (outline, `bg-success` dot), Archived (outline, `bg-muted-foreground` dot). Selection
replaces the toolbar: "3 selected", Export CSV, Archive, Clear. Footer: "128 patients · 9 seen
this week", numbers in mono.

**Patient record** (`/app/patients/$patientId`, `grid gap-8 lg:grid-cols-[minmax(0,1fr)_20rem]`).
Main: the name in `font-display text-3xl`, a mono line (record number, birth date, age), tabs:
Overview, Visits, Notes, Results, Files. Overview: Allergies (coral outline chips, or "No known
allergies"), Medications, last results as range bars. Aside: the next visit as an agenda card,
`tel:` and `mailto:` links. A table row opens a quick-look Sheet (`side="end"`) with Overview.

**Notes** (three panes): `grid overflow-hidden rounded-xl border bg-card
lg:grid-cols-[16rem_minmax(0,1fr)_18rem] lg:divide-x`. List: today's visits and drafts (mono
time, serif name, Draft or Signed); active row `bg-accent border-s-2 border-primary`. Note: serif
title, a `Textarea` (`min-h-96 resize-none border-0 text-base leading-7 shadow-none
focus-visible:ring-0`), "Saved 10:42", and "Sign note" (primary). A signed note is read-only.
Tasks: Checkbox rows `min-h-11` with a due chip and an "Add a task" Input; done is `line-through`.

**Results.** Reports by date; each analyte is a range bar row (`grid
grid-cols-[minmax(0,1fr)_7rem_minmax(0,10rem)_6rem] items-center gap-4 border-b py-3`). A row
opens a Sheet with the trend: inline SVG, a `stroke-chart-1` line over real points, the normal
band as a `fill-success/10` rect, date labels. One point: "The trend shows after the second
result." A practice report only when the user asks: one inline SVG bar chart.

**Settings.** A `max-w-3xl` column of Cards, Save in `CardFooter justify-end border-t`. Cards:
Practice (name, address, phone), Opening hours (per day: a closed Checkbox, two `<input
type="time">`), Visit types (name, minutes, a radio group of 5 `bg-chart-N` swatches), Rooms,
Account.

**Empty state art.** An `aria-hidden` SVG (`w-36`): a folded card in `fill-card stroke-border`,
three short `stroke-muted-foreground/40` lines, one small `fill-primary` circle. Then one serif
sentence and one action. Skeletons copy the agenda cards and table rows.

**375 px.** The nav opens in the kit Sheet; the search fills the header. Agenda cards put the
time over the name. Notes show one pane at a time with a back button. A range row wraps: name and
value, then bar and flag. The table becomes a list: name, next visit, status.

## 7. Motion

- Page blocks: `animate-in fade-in-0 duration-200 motion-reduce:animate-none`. No slide, no zoom.
- Rows and chips: `transition-colors duration-150`. Buttons do not scale.
- Sheet and Dialog keep the kit animations. The countdown changes text only.
- Never: a pulse, a loop, a count-up, a shake on error.

## 8. Imagery

`generate_image` only for the C2 panel and one empty state: at most 2 in the first build. Save as
`public/sign-in-art.png`, show `<img src="/sign-in-art.png" alt="">` with `size-full
object-cover`. Aspect 4:5 for the panel.

Prompt model: "Soft natural-light photograph of [subject of the practice: a linen curtain at a
tall window / a wooden windowsill with a glass of water and a small plant / a folded wool blanket
on a simple chair], porcelain white and muted pine green, morning light, shallow depth of field,
fine film grain, calm, no people, no text, no logos, no medical instruments, no watermark."
Never syringes, blood, X-rays, hospital corridors, or a smiling doctor.

## 9. Bans

- No patient name or result in a toast, a page title, or a notification.
- No invented range, dose, diagnosis, or patient. Sample rows only on request, labeled "Sample".
- No red countdown, no alarm color for a normal event, no color without a word.
- No gauge, dial, pie chart, gradient, bold serif, italics, uppercase label, emoji, or stock
  doctor photo. No shadow on a data card.
- No Google or Apple sign-in, no dead button, no `pl-`, `pr-`, `ml-`, `mr-`, `left-`,
  `right-`, `text-left`, or `text-right`.

## 10. Self-check

1. Shell `inset` and `comfortable`; the active nav item is a white chip with pine text.
2. Serif names and headings, Public Sans text, mono times and values; no italics.
3. The agenda shows tinted cards with a `color_slot` start bar, and free spans with "Add visit".
4. Each result with a range shows the range bar and a flag word.
5. The Next patient card is the one pine element of Today and has exactly one action.
6. The first run is F1 or F2 with real zeros; each setup action opens a real form.
7. No toast or title shows a patient name.
8. At 375 px: no horizontal scroll, one notes pane at a time. Arabic mirrors the layout.
