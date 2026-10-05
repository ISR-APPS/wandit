# Sonde — a probe on the live wire

`sonde` · quiet · dark · compact · best for: developer platform, API dashboard, AI agent ops,
observability, internal infra, job queues, webhooks, status admin · avoid for: beauty, kids, food,
education, clinic, retail

## 1. Feel

A graphite console at two in the morning. Thin borders, small type, long quiet rows. Every machine
fact is mono: hashes, durations, timestamps, regions, keys. One green signal means "alive", and
nothing moves unless something runs. The user scans for a red dot, acts, and leaves.

Voice: a log line. The state first, then the object: "Failed: api build". Exact units: "840 ms",
"1.24 s". No exclamation marks, no emoji, no apology.

## 2. World law and client choices

World law, the same in every Sonde app:

- Kit shell: `variant: "rail"`, `density: "compact"`. The rail is darker than the content.
- The rail bar: each nav `Link` adds `relative before:absolute before:inset-y-3 before:start-0
  before:w-0.5 data-[active=true]:before:bg-primary` (the kit item passes `data-active`).
- The `header` holds a breadcrumb: org / project / env, with the environment badge.
- One signal: green `--primary` equals `--success`. It marks the live dot, a healthy state, the
  rail bar, and one primary button per view. All else is greyscale.
- Mono law: IBM Plex Mono for machine values, IBM Plex Sans for words. Hashes, keys, URLs, and
  paths get `dir="ltr"`, also in Arabic.
- Corners: `--radius: 0.375rem` (cards 10 px, controls 4 px). In `button.tsx`, replace
  `rounded-full` in the base class with `rounded-md`. State badges use `rounded-sm`.
- Hairlines: in `card.tsx`, remove `shadow-sm` from the Card base class.
- The red is light. In `badge.tsx` and `button.tsx`, replace `text-white` in the destructive
  variant with `text-destructive-foreground`.
- Dark only: one static treatment in `:root`, with `color-scheme: dark`. Remove the `.dark`
  block. Add no theme picker.
- Three signatures: the status-dot row, the status bar, the tinted state card.

Client choices, decided fresh for each app:

- `contentWidth`: `full` for logs and runs, `centered` for a small API dashboard.
- The sign-in S1 or S2, and the first run F1 or F2 (section 6).
- The rail items: 4 to 7 real routes (runs, services, keys, logs, settings).
- The environment badge and the region: only when the data stores them.

Two Sonde apps never share the same sign-in and the same first-run composition.

## 3. Tokens

```css
:root {
	color-scheme: dark;
	--background: #0b0c0e;
	--foreground: #e6e8eb;
	--card: #121418;
	--card-foreground: #e6e8eb;
	--popover: #171a1f;
	--popover-foreground: #e6e8eb;
	--primary: #3dd68c;
	--primary-foreground: #04130b;
	--secondary: #1b1e24;
	--secondary-foreground: #e6e8eb;
	--muted: #1a1d22;
	--muted-foreground: #8b929d;
	--accent: #1f2329;
	--accent-foreground: #f2f4f6;
	--destructive: #ff6b63;
	--destructive-foreground: #1a0504;
	--border: #ffffff14;
	--input: #ffffff1f;
	--ring: #3dd68c;
	--radius: 0.375rem;
	--sidebar: #08090b;
	--sidebar-foreground: #9aa1ab;
	--sidebar-accent: #181b20;
	--sidebar-accent-foreground: #f2f4f6;
	--sidebar-border: #ffffff12;
	--sidebar-ring: #3dd68c;
	--chart-1: #7cacf8;
	--chart-2: #b392f0;
	--chart-3: #56d4dd;
	--chart-4: #f69ac1;
	--chart-5: #c8ccd2;
	--success: #3dd68c;
	--success-foreground: #04130b;
	--warning: #f5a524;
	--warning-foreground: #1a1000;
}

@theme {
	--font-sans: "IBM Plex Sans", ui-sans-serif, system-ui, sans-serif;
	--font-display: "IBM Plex Sans", ui-sans-serif, system-ui, sans-serif;
	--font-mono: "IBM Plex Mono", ui-monospace, monospace;
}

html:lang(ar) {
	--font-sans: "IBM Plex Sans Arabic", ui-sans-serif, system-ui, sans-serif;
	--font-display: "IBM Plex Sans Arabic", ui-sans-serif, system-ui, sans-serif;
}
```

The chart series are cool and distinct from the green, amber, and red states. In `@layer base`,
set the `html` letter-spacing to `0`: Plex needs its own spacing at 13 px. In `head().links` of
`src/routes/__root.tsx`, replace the old font links:

```ts
// World sonde: IBM Plex Sans + IBM Plex Mono, Arabic twin IBM Plex Sans Arabic.
{ rel: "preconnect", href: "https://fonts.googleapis.com" },
{ rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
{
	rel: "stylesheet",
	href: "https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans+Arabic:wght@400;500;600&display=swap",
},
```

## 4. Type

- Titles: the kit h1. Body `text-sm`; table cells `text-[0.8125rem]`.
- Machine values: `font-mono text-xs tabular-nums slashed-zero`. Hashes show 7 characters.
- Micro labels (table headers, state badges): `font-mono text-[0.6875rem] uppercase
  tracking-wider rtl:tracking-normal`. Arabic has no case; only the tracking needs the reset.
- Durations: under 1 s in ms, else seconds with 2 decimals. Relative times use
  `Intl.RelativeTimeFormat`; the exact UTC time goes in `title`. Add `-u-nu-latn` to the locale.

## 5. Signatures

1. **The status-dot row.** Runs, deploys, requests, and jobs are rows, not cards. A Card
   (`gap-0 overflow-hidden py-0`) holds a `ul` with `divide-y`. Row: `grid h-10
   grid-cols-[6rem_minmax(0,1fr)_auto] items-center gap-3 px-3 hover:bg-accent/60
   md:grid-cols-[6rem_minmax(0,1fr)_5rem_5rem_6rem]`. Cells: state, name (`truncate`), hash
   (`dir="ltr"`), duration, time. The state is a `size-2 rounded-full` dot and the word in
   `font-mono text-xs`. Hash and duration are `hidden md:block`. Dots: ready `bg-success`,
   running `bg-warning animate-pulse`, failed `bg-destructive`, queued `bg-muted-foreground`. The
   word takes the same color. While a row runs, the query polls:
   `refetchInterval: (query) => (query.state.data?.some(isRunning) ? 5000 : false)`.
2. **The status bar.** The workspace frame puts it after the page content, inside the shell
   (compact `main` has `p-4`): `sticky bottom-0 z-10 -mx-4 -mb-4 mt-auto flex h-8 items-center
   gap-4 border-t bg-sidebar px-4 font-mono text-[0.6875rem] text-muted-foreground`. Start: the
   live dot, a `relative flex size-2` wrapper with a halo (`absolute size-full animate-ping
   rounded-full bg-success/60 motion-reduce:animate-none`) over a `size-2 rounded-full bg-success`
   core. Then the real state: "All systems normal", "2 failing" (`text-destructive`, red dot), or
   "No services yet". Then counts and the region (`hidden sm:inline`). At `ms-auto`: `14:32:07
   UTC`. The clock is a store: `useSyncExternalStore`, a `subscribe` with a 1000 ms
   `setInterval`, `getSnapshot = () => Math.floor(Date.now() / 1000)`, and `Intl.DateTimeFormat`
   with `timeZone: "UTC"`.
3. **The tinted state card.** Services, agents, and endpoints are cards in `grid gap-3
   sm:grid-cols-2 xl:grid-cols-3`. A card (`gap-3 py-4`) takes the tint of its state: active
   `border-success/25 bg-success/5`, deploying `border-warning/25 bg-warning/5`, failed
   `border-destructive/30 bg-destructive/5`, stopped plain. Top row: the name and the badge. The
   kit `Badge` changes color on hover, so the badge is a `span`: `rounded-sm bg-success/15 px-1.5
   py-0.5 text-success` plus the micro label style. Other states swap the color. Under it: 2 or 3
   mono lines of real facts (region, version hash, last change).

## 6. Screens

**Shell parts.** `brand`: a probe glyph (SVG ring and stem, `size-5 text-primary`) over a short
name. `pnpm add lucide-react`: `Activity`, `Boxes`, `KeyRound`, `ScrollText`, `Settings`,
`Search`, `Copy`, `Check`, `ChevronLeft` and `ChevronRight` (`rtl:rotate-180`). `header`: an `ol`
breadcrumb (`flex min-w-0 items-center gap-1.5 text-sm`) with the org (muted), an `aria-hidden`
slash, the project, and the env badge. The project is a kit `Select` (`h-7 border-0`) when there
are several. Production badge: `border-warning/40 bg-warning/10 text-warning`; others are muted.
At `ms-auto`: a `relative` search `Input` (`h-8 w-56 bg-card ps-8 pe-8`), a `Kbd` "/" at `end-2`:
`// effect: listen to the "/" key to focus the search.` Skip it in a field. `sidebarFooter`: an initials button
(`size-9 rounded-md bg-sidebar-accent font-mono text-xs`) for the account menu. Add `kbd.tsx`
(`inline-flex h-5 min-w-5 items-center justify-center rounded-sm border px-1 font-mono
text-[0.625rem]`) and `dropdown-menu.tsx` (`DropdownMenu` from `radix-ui`).

**Sign-in** (email and password only; keep the auth feature and its sign-up switch):
- S1 Scope split: `grid min-h-dvh lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]`. Start: `flex
  flex-col justify-center gap-8 px-6 py-12 sm:px-16`: brand, h1 (`text-2xl font-semibold`), one
  muted line, the form (`max-w-sm`, fields `h-9`). End: `hidden flex-col justify-between border-s
  bg-sidebar p-8 lg:flex`: the scope trace, and at the bottom the live dot and the UTC clock.
- S2 Console card: a dot-grid page (`bg-[radial-gradient(var(--color-border)_1px,transparent_1px)]
  bg-[size:1.25rem_1.25rem]`). A centered `max-w-sm` column stacks a mono pill (`rounded-sm border
  px-2 py-1 text-xs`) with the live dot and the app name. Under it: the form `Card`, then the clock.

**First run** (real zeros, a getting-started device with working actions):
- F1 Board: `DashboardBody layout="operations"`. Primary: the card grid with one dashed tile
  (`rounded-xl border border-dashed p-6`): the empty art and the primary "Create service" button.
  Under it, "Recent activity" with "0 events" in mono. Secondary: a "Get started" Card with 3
  steps and mono ids `01` to `03`. Each step has one real action and shows `Check` when done.
- F2 Quickstart, only when the app has an API or a CLI: `DashboardBody layout="workbench"`.
  Primary: the 3 steps. Secondary: a Card with a `pre` (`dir="ltr" overflow-x-auto rounded-md
  border bg-sidebar p-4 font-mono text-xs leading-6`) and a copy button. It holds the real first
  request: the real endpoint and an `<API_KEY>` placeholder. Under it, the empty status-dot list
  polls every 5 s until the first event.

**Records view** (runs, deploys, requests, logs): `DashboardBody layout="operations"`.
- Toolbar: a state filter (`inline-flex rounded-md border bg-card p-0.5`, segments `h-7 px-2.5
  font-mono text-xs aria-pressed:bg-accent`) with real counts, and an env `Select`. The URL keeps
  the filters.
- Add `table.tsx` (plain HTML) and `checkbox.tsx` (`Checkbox` from `radix-ui`) to
  `src/shared/ui`. Header `h-8` in the micro label style. Rows `h-8 text-[0.8125rem]
  hover:bg-accent/60 data-[state=selected]:bg-primary/5`. Columns: checkbox, state, name, hash,
  env, duration, time; numbers are `text-end`.
- Selection: the header row turns into "3 selected", the real bulk actions, and Clear (`Kbd` Esc).
- Footer row (`h-8 font-mono text-xs text-muted-foreground`): "248 runs", "p50 1.20 s", "p95
  3.41 s", from SQL `percentile_cont` over the filtered set. Then Older and Newer.

**Record detail**: `Sheet` (`side="end"`, `className="w-full gap-0 bg-card sm:max-w-xl"`).
Header (`border-b p-4`): state badge, name, mono id with copy. Add `tabs.tsx` (`Tabs` from
`radix-ui`): Overview and Logs. Overview: a `dl` (`grid grid-cols-[minmax(0,8rem)_1fr] gap-y-2`)
with mono values. Logs: an `ol` (`dir="ltr" max-h-[60vh] overflow-auto rounded-md border
bg-sidebar p-3 font-mono text-xs leading-5`). Each line: `grid grid-cols-[auto_auto_minmax(0,1fr)]
gap-3` with the time (muted), the level (`WARN` `text-warning`, `ERROR` `text-destructive`), and
the message (`whitespace-pre-wrap break-all`). Footer: the real actions.

**Analytics view**, only when the app stores checks or requests. Uptime strip: `flex h-8 gap-px`
in `dir="ltr"`, one `flex-1 rounded-sm` cell per day for 90 days: `bg-success` passed,
`bg-warning` partial, `bg-destructive` down, `bg-muted` no data. A `title` gives the date and the
word. Under it: the computed uptime in mono. Requests: inline SVG bars in
`fill-chart-1`, failures stacked in `fill-destructive`. Latency: a p95 polyline in `stroke-chart-2`.

**Settings**: `grid gap-8 lg:grid-cols-[11rem_minmax(0,1fr)]`: a sticky anchor nav, then Cards.
Keys table: name, preview (real prefix and last 4 characters, `dir="ltr"`), created, last used,
and Revoke (`ghost`, `text-destructive`). To revoke, the user types the key name. A new key shows
once, in a `pre` with copy. A danger Card has `border-destructive/40`.

**Loading and errors**: skeletons copy the rows (`h-8`, a dot and 4 bars). An error stays in its
panel: what failed, the status code, and Retry (`refetch`).

**Empty state art**: an inline SVG (`h-16 w-40`): a dot grid in `fill-border`, a flat line in
`stroke-muted-foreground`, an end dot in `fill-primary`. Then a title, one sentence, one button.

**375 px**: the rail becomes the kit Sheet menu. The breadcrumb keeps the project and the env
badge. Rows show the state, the name, and the time. The table hides hash and env (`hidden
md:table-cell`). The status bar keeps the state and the clock. The Sheet is full width.

## 7. Motion

Almost still. CSS transitions and tw-animate-css only.

- The live dot halo is the only loop, and a running dot pulses. Both use
  `motion-reduce:animate-none`.
- A new row: `animate-in fade-in-0 slide-in-from-top-1 duration-200 motion-reduce:animate-none`.
- Rows `transition-colors duration-100`. Menus `data-[state=open]:animate-in fade-in-0 zoom-in-95`.
- Never: count-up numbers, chart draw-in, page fades, parallax.

## 8. Imagery

Default: SVG art. The S1 scope trace: inline SVG, `viewBox="0 0 480 240"`, `w-full max-w-lg`,
`aria-hidden`. Draw fine grid lines every 24 units in `stroke-border`. Draw a flat trace in
`stroke-muted-foreground` with one sharp pulse in `stroke-primary` (width 2). No text.

Optional `generate_image`, at most 1: `public/sonde-signin.png`, used as `/sonde-signin.png` in
the S1 end panel. Prompt model: "Macro photograph of a thin steel probe tip on a dark circuit
board, one small green LED glow, low-key light, graphite tones, no text, no logos, no screens,
no watermark."

## 9. Bans

- No light surface, no gradient, no glow except the live dot halo, no colored rail.
- No machine value in sans, no state as color only.
- No invented hash, log line, uptime, latency, or region. Every value comes from a real row.
- No icon in a colored circle, no pie, no chart on a record list, no full-page spinner.
- No emoji, no theme picker, no third-party sign-in button.

## 10. Self-check

1. The shell is `rail` and `compact`, and the active item shows the green bar.
2. The app stays dark on a light OS, with dark scrollbars and fields.
3. Green marks only alive, healthy, the rail bar, and one primary action.
4. Machine values are Plex Mono; each hash, key, and path is `dir="ltr"`.
5. Every state shows a word next to its dot, tint, or badge.
6. The status bar shows the real state and a ticking UTC clock.
7. A first run shows real zeros and a getting-started device with working actions.
8. At 375 px, nothing overflows; strings use `t()` and logical classes; Arabic has no tracking.
