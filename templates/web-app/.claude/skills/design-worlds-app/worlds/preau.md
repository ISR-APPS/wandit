# Préau — the covered yard where the week hangs on the wall

`preau` · loud · light · comfortable · best for: school portal, tutoring center, language school,
academy, online courses, parent portal, training center · avoid for: clinic, finance, legal,
nightlife, logistics, dev tools

## 1. Feel

A covered schoolyard on a bright morning: sky-blue paper, cobalt ink, and one sunflower sticker on
the thing that matters today. The workspace is a wall chart. Subject tiles show the week, rings
show each student, and cobalt bars show each objective. The color is loud, the layout is calm.

Voice: a kind head teacher. A verb first: "Add a class", "Record a level". Praise is a fact:
"12 of 18 at Secure". No exclamation marks, no emoji, never red for the level of a child.

## 2. World law and client choices

World law, the same in every Préau app:

- Kit shell: `variant: "inset"`, `density: "comfortable"`, in one module-level `const` with
  `contentWidth`. The sky canvas (`bg-sidebar`) frames a pale panel with white cards.
- Two voices. Cobalt (`primary`) marks the main action, the active pill tab, and progress.
  Sunflower (`secondary`, `sidebar-accent`) marks the celebrated thing: the active nav item,
  today, now, Mastered. Sunflower is always a fill under ink text, never text or a line.
- Gabarito for headings and big numbers, Lexend for text, Atkinson Hyperlegible Mono for times,
  rooms, and student numbers.
- Corners: `--radius: 1rem` (cards 20 px, fields 14 px). Buttons and badges stay pills.
- Mastery is one cobalt ramp in four steps. `destructive` is only for errors and absences.
- Each `subjects` row stores `color_slot` (1 to 5), picked in settings. Map each slot to full
  class strings in one object.

Client choices, decided fresh for each app:

- Sign-in S1 or S2, first run F1 or F2 (section 6). Two Préau apps never share both.
- `contentWidth`: `full` for a school, `centered` for a small tutoring center.
- The nouns of the user (classes or groups, students or learners) and the art (section 8).

## 3. Tokens

Replace the `:root`, `@theme`, and `html:lang(ar)` blocks of `src/styles/tokens.css`:

```css
:root {
	--background: #f8faff;
	--foreground: #13213c;
	--card: #ffffff;
	--card-foreground: #13213c;
	--popover: #ffffff;
	--popover-foreground: #13213c;
	--primary: #2457ff;
	--primary-foreground: #ffffff;
	--secondary: #ffc533;
	--secondary-foreground: #13213c;
	--muted: #eef3fc;
	--muted-foreground: #4a5878;
	--accent: #e6eeff;
	--accent-foreground: #13213c;
	--destructive: #d42a3c;
	--destructive-foreground: #ffffff;
	--border: #d9e3f5;
	--input: #c5d3ee;
	--ring: #2457ff;
	--radius: 1rem;
	--sidebar: #e4ecff;
	--sidebar-foreground: #13213c;
	--sidebar-accent: #ffc533;
	--sidebar-accent-foreground: #13213c;
	--sidebar-border: #c9d7f5;
	--sidebar-ring: #2457ff;
	--chart-1: #2457ff;
	--chart-2: #0b8a7f;
	--chart-3: #8b3ee0;
	--chart-4: #d6336c;
	--chart-5: #a86a12;
	--success: #1a7f45;
	--success-foreground: #ffffff;
	--warning: #ff9f1c;
	--warning-foreground: #13213c;
}

@theme {
	--font-sans: "Lexend", ui-sans-serif, system-ui, sans-serif;
	--font-display: "Gabarito", "Lexend", ui-sans-serif, system-ui, sans-serif;
	--font-mono: "Atkinson Hyperlegible Mono", ui-monospace, monospace;
}

html:lang(ar) {
	--font-sans: "Readex Pro", ui-sans-serif, system-ui, sans-serif;
	--font-display: "Alexandria", "Readex Pro", ui-sans-serif, system-ui, sans-serif;
}
```

Delete the `.dark` block. Write `World: preau` and the fonts in the file header comment. In the
`@layer base` `html` rule, set `letter-spacing: 0`: Lexend needs its own spacing to read well.

In `__root.tsx` `head().links`, keep the `tokensCss` entry first. Replace all other font links
(preconnect and stylesheets) with exactly these, and update the comment above them:

```ts
{ rel: "preconnect", href: "https://fonts.googleapis.com" },
{ rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
{
	rel: "stylesheet",
	href: "https://fonts.googleapis.com/css2?family=Gabarito:wght@600;700;800&family=Lexend:wght@400;500;600&family=Atkinson+Hyperlegible+Mono:wght@400;500&family=Readex+Pro:wght@400;500;600&family=Alexandria:wght@600;700;800&display=swap",
},
```

## 4. Type

- Page title: `DashboardPageHeader`. On the home page, it is the greeting ("Good morning, Sara").
- Big number: `font-display text-5xl font-extrabold tabular-nums ltr:tracking-tight` over a label.
- Card title: `font-display text-lg font-bold ltr:tracking-tight`.
- Body: `text-base leading-7` to read, `text-sm leading-6` in tables. Labels: `text-xs
  font-medium text-muted-foreground`, sentence case, never uppercase.
- Mono: `font-mono text-xs tabular-nums` for `08:30`, room `B12`, student numbers.
- Arabic: Alexandria and Readex Pro replace the Latin pair. Write `ltr:tracking-tight`, never
  `tracking-tight`, so Arabic keeps a spacing of 0. No italics.

## 5. Signatures

1. **The mastery bar.** One row per objective: the text (`text-sm font-medium`), then
   `<div className="flex h-3 w-full gap-0.5 overflow-hidden rounded-full">`. Each level is one
   `basis-0` segment with `style={{ flexGrow: count }}`; skip a level with 0 students. Classes:
   Emerging `bg-primary/25`, Developing `bg-primary/50`, Secure `bg-primary/75`, Mastered
   `bg-primary`, Not assessed
   `bg-[repeating-linear-gradient(135deg,var(--color-border)_0_2px,transparent_2px_6px)]`.
   Under it, a legend (`flex flex-wrap gap-x-4 text-xs`): swatch, word, count in mono. Each
   segment has a Tooltip; the bar has an `sr-only` sentence with all counts. Counts use the
   latest level of each student. With no students, the bar is all hatch: "No students yet".
2. **The ring avatar.** A `relative grid size-11 place-items-center` wrapper holds an
   `<svg viewBox="0 0 44 44" className="absolute inset-0 -rotate-90" aria-hidden="true">` with two
   circles (`cx=22 cy=22 r=20 fill="none" strokeWidth=3`): the track `stroke-muted`, and the value
   `stroke-primary`, `strokeLinecap="round"`, `strokeDasharray={125.66}`,
   `strokeDashoffset={125.66 * (1 - share)}`. The Avatar (`size-9`) shows the initials on the
   subject tint. The share is objectives at Secure or above, divided by the objectives of the
   class. No assessment: track only. Share 1: a star sticker, `absolute -bottom-1 -end-1 grid
   size-5 place-items-center rounded-full bg-secondary text-secondary-foreground` with `Star`.
   Add an `sr-only` text ("Secure on 6 of 9 objectives"). Detail pages use `size-20` and
   `strokeWidth=4`.
3. **The subject timetable.** `grid grid-cols-[4.5rem_repeat(5,minmax(0,1fr))] gap-2`. Columns
   are the school days from settings; rows are the bell times (`periods`: label, start, end).
   Today's header is the sticker pill `rounded-full bg-secondary px-3 py-1 font-display
   font-bold`. A lesson tile is `min-h-20 rounded-xl border-s-4 p-3` plus its slot classes
   (`{ 1: "border-chart-1 bg-chart-1/10", ... }`): subject in `font-display text-sm font-bold`,
   class and room in `font-mono text-xs text-muted-foreground`. The lesson now adds `ring-2
   ring-primary ring-offset-2 ring-offset-card` and a "Now" Badge (`bg-secondary
   text-secondary-foreground -rotate-2`). An empty cell is `min-h-20 rounded-xl border
   border-dashed` with a ghost `+` that opens "Add lesson" for that day and period. With no bell
   times: one dashed `col-span-full` row with "Add bell times".

## 6. Screens

Add to `src/shared/ui/` on `radix-ui` (`import { Tabs } from "radix-ui"`): `tabs.tsx`,
`avatar.tsx`, `checkbox.tsx`, `tooltip.tsx`, `dropdown-menu.tsx`; and `table.tsx` in plain HTML.
Run `pnpm add lucide-react`. Icons: `House`, `BookOpen`, `Users`, `CalendarDays`, `Settings`,
`Star`, `Plus`, `Search`, `Check`, `ChevronRight` (`rtl:rotate-180`).

**Pill tabs.** Sub-pages are Radix Tabs under `DashboardPageHeader`, valued by the search param
`tab` (zod in `validateSearch`). List: `inline-flex h-11 gap-1 rounded-full border bg-card p-1`.
Trigger: `h-9 rounded-full px-4 text-sm font-medium text-muted-foreground transition-colors
data-[state=active]:bg-primary data-[state=active]:text-primary-foreground`.

**Shell.** `brand`: a `grid size-9 place-items-center rounded-xl bg-secondary font-display
font-extrabold` tile with the first letter, then the name (a user logo replaces the tile).
`navigation`: Today, Classes, Students, Timetable, Settings, if the route exists. `header`: a
class Select (`w-56`) that sets the search param `class`. Then a term Badge ("Week 3 of 12", from
the term dates) and the account DropdownMenu at `ms-auto` with Sign out. `sidebarFooter`: while
setup is open, a `rounded-2xl bg-card p-4` card "Setup 2 of 4" with four `h-2 flex-1
rounded-full` segments (done `bg-primary`, open `bg-muted`) and a "Continue" link. After setup,
it shows the term card.

**Sign-in** (restyle `login-page.tsx`; keep its email and password logic and the sign-up mode):

- S1 Sky split: `grid min-h-svh lg:grid-cols-2`. Start: `mx-auto flex w-full max-w-md flex-col
  justify-center gap-8 px-6 py-12`: brand tile, `font-display text-4xl font-extrabold` title,
  `h-11` fields, a full-width primary button, the mode link. End: `hidden p-3 lg:block`, a
  `size-full overflow-hidden rounded-[2rem] bg-sidebar` panel with the art.
- S2 Timetable wall: a `bg-sidebar` page. Behind the form, an `aria-hidden` grid of empty tiles
  (`grid grid-cols-6 gap-3`, `h-16 rounded-2xl bg-chart-N/15`, one tile `bg-secondary
  -rotate-3`). The form is a centered Card, `w-full max-w-sm rounded-[1.75rem] p-8 shadow-lg`.

**First run** (no rows: real zeros, working actions):

- F1 Setup board: `DashboardBody layout="workbench"`. `primary`: "Set up your school" with 4
  rows: Add a term, Add a class, Add students, Add bell times. A row has a `size-8 rounded-full`
  number (`bg-muted`; done `bg-secondary` and `Check`), a title, and an outline button. The
  button opens the real Dialog. `secondary`: the empty subject timetable.
- F2 Today board: `layout="analytics"`, four `DashboardMetric` (Classes, Students, Lessons today,
  Levels recorded), each a real 0 in the big-number class. `primary`: "Today's lessons" with the
  empty state art and "Build the timetable". `secondary`: the setup card of F1.

**Students** (records view). Action "Add student". Pill tabs as saved views: All, Needs support
(an objective at Emerging), Not assessed; a search Input (`ps-9`). Header row: `h-10 bg-muted/60
text-xs font-medium text-muted-foreground`, end cells `rounded-s-xl` and `rounded-e-xl`. Rows:
`h-16 border-b transition-colors hover:bg-accent/60`. Columns: Checkbox, student (ring avatar,
name, mono number), class, a `w-40` mastery bar without legend, last level date, status (outline
Badge, `size-1.5` dot and word: Active `bg-success`, Left `bg-muted-foreground`). Selection opens
a floating bar, `fixed inset-x-0 bottom-6 mx-auto flex w-fit gap-1 rounded-full bg-foreground
px-2 py-1.5 text-background shadow-lg`: "3 selected", Move to class, Export CSV, Clear. Footer
row: "24 students · 18 assessed · 6 need support", numbers in mono.

**Student detail** (`/app/students/$studentId`): the `size-20` ring avatar, the name in
`font-display text-3xl font-extrabold`, class chips, an outline "Edit". Pill tabs: Overview,
Progress, Timetable, Notes. Progress: per objective, 4 steps (`grid grid-cols-4 gap-1`, `h-2
rounded-full`, the ramp up to the level), the word, the date. "Record level" opens a Sheet
(`side="end"`) with 4 large radio cards.

**Progress** (the analytics view, a class tab). One `divide-x` Card shows three big numbers:
Students, Objectives, Levels this term. Under it, the mastery bars by unit, most Emerging first.

**Settings.** A `max-w-3xl` column of Cards, Save in `CardFooter justify-end border-t`: School,
Terms (`<input type="date">`), Bell times, School days, Subjects (5 swatches `size-8 rounded-full
bg-chart-N` as a radio group), Level words (the user renames the four levels), Account.

**Empty state art.** An `aria-hidden` SVG (`w-40`): a 3 by 2 grid of `fill-chart-N/15` rounded
tiles, and one `fill-secondary` tile turned -6 degrees. Under it, one sentence in `font-display
text-lg font-bold` and one primary action. Skeletons copy the final shape (rings, bars, tiles).

**375 px.** The nav opens in the kit Sheet. Pill tabs scroll in one row (`overflow-x-auto`). The
timetable shows one day: day pills on top (today `bg-secondary`), then the tiles as a list. The
table becomes a list (avatar, name, class, status; the bar under the name). The selection bar
uses `inset-x-4 w-auto`.

## 7. Motion

- Blocks: `animate-in fade-in-0 slide-in-from-bottom-2 duration-300`, the 2nd and 3rd with
  `delay-75 fill-mode-backwards` and `delay-150 fill-mode-backwards`. Each adds
  `motion-reduce:animate-none`.
- Ring `transition-[stroke-dashoffset] duration-700` and segments `transition-[flex-grow]
  duration-500` move when a level is saved, never on load; add `motion-reduce:transition-none`.
- The star sticker enters once: `animate-in zoom-in-50 fade-in-0 duration-300`.
- Buttons `transition-transform active:scale-[0.97]`; rows `transition-colors duration-100`.
- Never: confetti, bounce, a loop, a count-up on each render.

## 8. Imagery

`generate_image` only for the S1 panel and one empty state: at most 2 in the first build. Save as
`public/sign-in-art.png`, show `<img src="/sign-in-art.png" alt="">` with `size-full
object-cover`. Aspect 4:5 for the panel, 4:3 for an empty state.

Prompt model: "Flat paper-cut collage illustration of [subject of the app: coats on hooks under a
covered schoolyard roof / a stack of books beside a globe and a pencil cup / a bright classroom
window with a potted sunflower], cobalt blue, sky blue, and sunflower yellow on white paper, soft
paper grain, simple shapes, no people, no text, no letters, no numbers, no logos, no watermark."
Never photos of children, faces, or a board with writing.

## 9. Bans

- No traffic-light mastery, no red on the level of a child, no invented level or grade.
- No sunflower text or line, no two sunflower items in one card.
- No KPI card with an icon in a colored circle; no pie, donut, or radar chart.
- No mascot, emoji, stock photo, uppercase label, italics, or shadow on a data card.
- No invented students or classes. Sample rows only on request, labeled "Sample".
- No Google or Apple sign-in, no dead button, no `pl-`, `pr-`, `ml-`, `mr-`, `left-`,
  `right-`, `text-left`, or `text-right`.

## 10. Self-check

1. Shell `inset` and `comfortable`; the active nav item is the sunflower sticker.
2. Gabarito headings and big numbers, Lexend text, mono times and rooms.
3. Each mastery bar uses the four cobalt steps and the hatch, with counts in words.
4. Each student has the ring avatar; a full ring has the star sticker.
5. Tiles take the `color_slot` color; today has the sunflower pill.
6. The first run is F1 or F2 with real zeros; each setup action opens a real form.
7. At 375 px: no horizontal scroll, one timetable day, the table as a list.
8. Arabic mirrors the layout, uses Alexandria and Readex Pro, and flips chevrons.
