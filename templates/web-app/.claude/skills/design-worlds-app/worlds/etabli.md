# Établi — the workbench under one lamp

`etabli` · quiet · dark · compact · best for: project management, task tracker, issue tracker,
agency ops, content calendar, sprint planning · avoid for: clinic, beauty, kids, restaurant, school

## 1. Feel

A workbench at night. One lamp, a graphite top, every tool on its hook. The app is near black
with one tangerine light. The work sits in tight grouped rows, and the keyboard runs them. Every
action has a key, and the key shows next to the action. The interface stays quiet, so the work
is the loud part.

Voice: short and exact, like a commit message. A verb first ("Create issue", "Assign to me").
No exclamation marks, no emoji, no "Oops".

## 2. World law and client choices

World law, the same in every Établi app:

- Shell: `DashboardShell` with `variant: "sidebar"` and `density: "compact"`. The sidebar is one
  step darker than the canvas, with a hairline edge.
- The command palette is the main navigation. ⌘K (Ctrl K off Mac) opens it on every screen.
- Dark only, one static treatment: the dark values live in `:root` with `color-scheme: dark`.
- Inter for all text. Fira Code only for record IDs, kbd keys, and durations.
- One accent, tangerine `primary`. It marks the primary button, the done icon, the focus ring,
  and the active palette row. It never fills an area larger than a button.
- `--radius: 0.375rem`: buttons 6 px, cards 10 px. In `src/shared/ui/button.tsx`, replace the
  base `rounded-full` with `rounded-lg`. This is the one kit edit. Badges stay pills for labels.
- Hairlines, no shadows, except on the palette, menus, and the bulk bar (`shadow-lg`).

Client choices, decided fresh for each app:

- Sign-in A1 or A2, first run F1 or F2 (section 6).
- The record noun: issue, task, post, or request. All copy uses it.
- The team key that prefixes IDs (`ENG-14`), made from the team name the user gives. The
  number is a per-team sequence from the database.
- The status set. Default: Backlog, Todo, In progress, In review, Done, Canceled. Each status
  maps to one circle state (signature 1).
- `contentWidth`: `full` by default, `centered` for a team of one.

Two Établi apps never share the same sign-in and first-run composition.

## 3. Tokens

In `src/styles/tokens.css`, replace the `:root` block, the `@theme` font block, and
`html:lang(ar)`. Delete the `.dark` block. Write `etabli` in the header comment. In
`@layer base`, set `letter-spacing: -0.01em` on `html`.

```css
:root {
	color-scheme: dark;
	--background: #0f0f11;
	--foreground: #e8e8ea;
	--card: #141417;
	--card-foreground: #e8e8ea;
	--popover: #1b1b20;
	--popover-foreground: #ededef;
	--primary: #ff7a1a;
	--primary-foreground: #1a0d03;
	--secondary: #222228;
	--secondary-foreground: #e8e8ea;
	--muted: #1c1c21;
	--muted-foreground: #9a9aa3;
	--accent: #26262c;
	--accent-foreground: #f0f0f2;
	--destructive: #c9343a;
	--destructive-foreground: #ffffff;
	--border: #ffffff14;
	--input: #ffffff1f;
	--ring: #ff7a1a;
	--radius: 0.375rem;
	--sidebar: #0b0b0d;
	--sidebar-foreground: #b4b4bc;
	--sidebar-accent: #1c1c21;
	--sidebar-accent-foreground: #f0f0f2;
	--sidebar-border: #ffffff12;
	--sidebar-ring: #ff7a1a;
	--chart-1: #5b8def;
	--chart-2: #b58cf0;
	--chart-3: #ef6f9a;
	--chart-4: #4cc3d9;
	--chart-5: #a3a3ad;
	--success: #3fb68b;
	--success-foreground: #04160f;
	--warning: #f2c14b;
	--warning-foreground: #1d1503;
}

@theme {
	--font-sans: "Inter", ui-sans-serif, system-ui, sans-serif;
	--font-display: "Inter", ui-sans-serif, system-ui, sans-serif;
	--font-mono: "Fira Code", ui-monospace, monospace;
}

html:lang(ar) {
	--font-sans: "Vazirmatn", ui-sans-serif, system-ui, sans-serif;
	--font-display: "Vazirmatn", ui-sans-serif, system-ui, sans-serif;
}
```

Chart colors give label dots, project colors, and team squares. None looks like a status. In
`head().links` of `src/routes/__root.tsx`, keep `tokensCss`. Remove the old font links. Add:

```ts
{ rel: "preconnect", href: "https://fonts.googleapis.com" },
{ rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
{
	rel: "stylesheet",
	href: "https://fonts.googleapis.com/css2?family=Inter:opsz,wght@14..32,400..700&family=Fira+Code:wght@400;500&family=Vazirmatn:wght@400;500;600;700&display=swap",
},
```

## 4. Type

- Rows, menus, palette: `text-[13px]`. Record body text: `text-sm leading-relaxed`.
- Group header and card title: `text-[13px] font-medium`.
- ID: `font-mono text-xs text-muted-foreground tabular-nums`, in a fixed `w-16 shrink-0` column.
- Sidebar group label: `px-3 pb-1 pt-4 text-xs text-muted-foreground`, sentence case.
- Arabic: Vazirmatn. IDs and keys stay in Fira Code. No italics.

Icons: `pnpm add lucide-react`, `size-4` with `strokeWidth={1.75}`: `Inbox`, `CircleUserRound`,
`FolderKanban`, `Search`, `Plus`, `ListFilter`, `SlidersHorizontal`, `SignalLow`,
`SignalMedium`, `SignalHigh`, `TriangleAlert` (urgent), `Ellipsis` (no priority), `Keyboard`,
`X`, `Trash2`. `ChevronRight` and `ArrowLeft` get `rtl:rotate-180`.

## 5. Signatures

1. **The grouped list.** Records sit in rows under tinted group headers. Group header: `sticky
   top-0 z-10 flex h-9 items-center gap-2 bg-muted px-4 text-[13px] font-medium`. It holds the
   status circle, the name, the real count, and a ghost `+` that adds a record there. Row:
   `group flex h-9 items-center gap-3 border-b px-4 text-[13px] hover:bg-accent`. In order:
   checkbox, priority icon, ID, status circle, title (`truncate`, `dir="auto"`), label pills,
   assignee initials (`size-5 rounded-full bg-secondary text-[0.625rem]`), due date. The list
   card is `gap-0 overflow-clip py-0 shadow-none`, so the sticky headers work. Status circles
   are SVG (`viewBox="0 0 14 14"`, `className="size-3.5 shrink-0"`, `fill="none"`). Each one
   has an `sr-only` word.
   - Backlog, `text-muted-foreground`: `<circle cx="7" cy="7" r="6" stroke="currentColor"
     strokeWidth="1.5" strokeDasharray="1.6 1.6"/>`.
   - Todo, `text-muted-foreground`: the same circle, solid.
   - In progress, `text-warning`: the solid circle and `<path d="M7 7V3a4 4 0 0 1 0 8z"
     fill="currentColor"/>`.
   - In review, `text-success`: the solid circle and `<path d="M7 7V3a4 4 0 1 1-4 4z"
     fill="currentColor"/>`.
   - Done, `text-primary`: `<circle cx="7" cy="7" r="7" fill="currentColor"/>` and the check
     path `m4.5 7.2 1.7 1.7 3.3-3.6` in `stroke-primary-foreground`, `strokeWidth="1.5"`.
   - Canceled, `text-muted-foreground`: the filled circle and the path `m5 5 4 4m0-4-4 4` in
     `stroke-background`, `strokeWidth="1.5"`.

2. **The floating bulk bar.** It appears when one row or more is selected: `fixed inset-x-3
   bottom-4 z-40 mx-auto flex w-fit items-center gap-1 rounded-lg border bg-popover p-1 text-sm
   shadow-lg`, with `role="toolbar"`. It holds "{count} selected" (`px-2 tabular-nums`), a vertical
   `Separator`, then ghost buttons with keys: Status `S`, Assignee `A`, Priority `P`, Delete. A
   close icon button with `Esc` clears the selection. Each action writes all selected rows in
   one mutation, then shows one `toast`. Delete asks in a `Dialog` first.

3. **Keys everywhere.** A `Kbd` shows the key in buttons, menu items (`ms-auto`), tooltips,
   empty states, and the palette footer. The workspace frame has one `// effect:` keydown
   listener on `window` for ⌘K, `C`, and `?`. The record page adds one for `S`, `P`, `A`, `L`.
   Both skip keys typed in a field, except ⌘K. The list uses `onKeyDown` with a roving
   `tabIndex`: `J`/`K` move, `X` selects, `Enter` opens, `Space` peeks. With a selection, `S`,
   `A`, and `P` open the bulk bar menus.

## 6. Screens

Add first, with tokens only: `checkbox.tsx`, `dropdown-menu.tsx`, `tooltip.tsx`, and
`collapsible.tsx` in `src/shared/ui/` (`Checkbox`, `DropdownMenu`, `Tooltip`, `Collapsible` from
`radix-ui`), and `kbd.tsx` (`inline-flex h-5 min-w-5 items-center justify-center rounded border
bg-muted px-1 font-mono text-[0.6875rem] text-muted-foreground`).

**Command palette** (`command-palette.tsx` in the workspace feature, on the kit `Dialog`, no
command library). `DialogContent` gets `top-[12vh] start-0 end-0 mx-auto w-[calc(100%-2rem)]
max-w-xl translate-x-0 translate-y-0 gap-0 overflow-hidden p-0`, which also centers it in
Arabic. Add an `sr-only` `DialogTitle`. Input row `flex h-12 items-center gap-3 border-b ps-4
pe-12` (the kit close button sits at the end): `Search` and an input with `role="combobox"` and
`aria-activedescendant`. List `role="listbox"` `max-h-96 overflow-y-auto p-1.5`, with groups
Actions, Go to (existing routes), and Recent (real rows).
Row: `relative flex h-9 items-center gap-3 rounded-md px-2.5 text-[13px] aria-selected:bg-accent`,
key at the end. The selected row adds a start bar: `aria-selected:before:absolute
aria-selected:before:inset-y-2 aria-selected:before:start-0 aria-selected:before:w-0.5
aria-selected:before:bg-primary`. Footer `flex h-9 items-center gap-3 border-t px-3 text-xs
text-muted-foreground`: `↑↓`, `↵`, `esc`, and the result count.

**Shell content**: `header` holds a breadcrumb (team › view, `text-[13px]
text-muted-foreground`, last part `text-foreground`, `ChevronRight` with `rtl:rotate-180`). At
its end, a ghost Search button with `⌘K` opens the palette. `brand` is the workspace name.
`navigation` starts with a New issue button (`C`). Then come links to existing routes (Inbox,
My issues) and the label "Teams". Each team is a `Collapsible`: a `size-4 rounded bg-chart-N`
square, the name, a chevron, and its existing routes as links (`ps-7`). `sidebarFooter`: a
Keyboard button (`?`) for the key list, and the account menu.

**Sign-in** (`/login`, email and password only). Pick one:

- A1 Lamp: `grid min-h-svh place-items-center bg-background bg-radial-[at_50%_0%]
  from-primary/15 to-transparent to-60% px-6`. A `w-full max-w-xs grid gap-6` column: an initial
  mark (`grid size-9 place-items-center rounded-lg bg-primary font-semibold
  text-primary-foreground`), the title `text-lg font-semibold`, the fields, and the submit
  button with a `↵` kbd.
- A2 Ghost list: `grid min-h-svh lg:grid-cols-[26rem_minmax(0,1fr)]`. Start: the form,
  `self-center p-8`. End (`hidden border-s bg-card p-10 lg:flex lg:items-center`): an
  `aria-hidden` ghost of the grouped list. It has three group headers and nine rows, with real
  status circles and `h-2 rounded-full bg-muted` bars. No words, no numbers.

**First run** (no records). Pick one:

- F1 Open groups: `DashboardPageHeader` with New issue (`C`) in `actions`. `DashboardBody
  layout="operations"` with no `secondary`. The list card shows every status header with a real
  `0`. The first group holds the empty state. Under it, a "Get started" card has 3 row buttons
  with keys: Create an issue, Open the command menu, Create a project. A done row shows the done
  circle and struck-through muted text.
- F2 Key map: `DashboardBody layout="workbench"`. `primary`: the same 3 steps with a meter "0 of
  3" (`h-1 rounded-full bg-muted`, fill `bg-primary`). `secondary`: "Keys of this workspace", a
  `grid sm:grid-cols-2` of rows `flex h-9 items-center justify-between border-b px-3
  text-[13px]`. Each row names a real action, shows its key, and runs it on click.

**Records view**: `DashboardPageHeader` with the team name as `eyebrow` and the record noun as
`title`. `actions` holds view links on a URL search param (Active, Backlog, All) and a Filter
menu. It also holds a Display menu (group by status, priority, assignee) and New issue (`C`).
Then the grouped list. A row checkbox shows on hover, on focus, or while a selection exists.
Loading: `Skeleton` rows of `h-9` under real headers. Error: one line and Retry. A content
calendar groups by publish week, not by status.

**Record page** (`/app/issues/$issueId`): `grid gap-6 lg:grid-cols-[minmax(0,1fr)_16rem]`. Main:
the mono ID, the title (`text-xl font-semibold`, `dir="auto"`), the description, sub-items, and
the activity. An activity line (`text-xs text-muted-foreground`) shows the actor, the change
("Todo → In progress"), and a relative time. Side (`lg:border-s lg:ps-6`): property rows Status
`S`, Priority `P`, Assignee `A`, Labels `L`, each a `DropdownMenu`. `Space` in the list shows the
same content in a `Sheet` (`side="end"`).

**Settings**: one column `mx-auto w-full max-w-2xl`. Rows `flex items-center justify-between
gap-6 border-b py-3`: the label and one muted line at the start, the control at the end. A change
saves at once and shows one `toast`.

**Empty state art**: three ghost rows in a `w-64 opacity-60` stack. Each row has a status
circle, an ID bar (`h-2 w-10 rounded-full bg-muted`), and a title bar. The middle circle is in
progress. Under it: one sentence, the action button, and its key.

**375 px**: the sidebar is the kit `Sheet`, and the palette stays the fast path. Rows hide labels
and dates (`hidden md:flex`). The bulk bar keeps `inset-x-3` and shows icons only, with
`aria-label`. The record page stacks its properties under the body.

## 7. Motion

Fast and silent. Nothing bounces.

- Rows `duration-75`, buttons `duration-100`, both `transition-colors`. Palette: `duration-150`.
- Bulk bar: `animate-in fade-in-0 slide-in-from-bottom-2 duration-150`.
- A status change: the new circle enters with `animate-in fade-in-0 zoom-in-75 duration-150`.
- Each class has a `motion-reduce:animate-none` or `motion-reduce:transition-none` twin. No loop.

## 8. Imagery

No photos and no `generate_image` calls. Tokens draw all the art: the status circles, the
ghost rows, and the lamp glow of A1. Avatars show initials or a real uploaded photo.

## 9. Bans

- No light mode, no theme picker, no second accent color.
- No tangerine fill larger than a button. No card grid for records. A board only on request.
- No key hint for a shortcut that does not work: it is a dead button.
- No status by color alone: each circle has its shape and an `sr-only` word.
- No invented records, people, or progress. Sample rows only on request, with a "Sample" badge.
- No page spinner. No Google or Apple sign-in button.
- No `pl-`, `pr-`, `ml-`, `mr-`, `left-`, `right-`, `text-left`, `text-right`.

## 10. Self-check

1. The app opens dark with any system theme.
2. ⌘K opens the palette from every screen, and each palette row runs.
3. Records sit in grouped rows with status circles and mono IDs.
4. Selecting rows shows the bulk bar, and `Esc` clears it.
5. Every visible key hint works.
6. Sign-in is A1 or A2. The first run is F1 or F2 with real zeros and working steps.
7. At 375 px, the page has no horizontal scroll. Arabic mirrors with no italics.
8. With reduced motion, no element animates.
