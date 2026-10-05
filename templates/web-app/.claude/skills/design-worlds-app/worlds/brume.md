# Brume — morning mist over a quiet desk

`brume` · quiet · light · comfortable · best for: AI assistant, agent console, knowledge base,
internal tool, notes, research workspace · avoid for: restaurant, kids, gym, nightlife, shop admin

## 1. Feel

Pearl light through a window at dawn. A lavender and peach haze sits behind one floating card
where the user writes. Everything else is calm paper, hairlines, and space. The serif greets;
the grotesk works. The app feels like a careful colleague, not a machine.

Voice: calm and plain. Questions invite ("What do you want to find?"). An answer names its
sources. No hype words, no exclamation marks, no emoji.

## 2. World law and client choices

World law, the same in every Brume app:

- Shell: `DashboardShell variant="inset" density="comfortable"`. The pearl canvas holds the
  nav; the work sits in the white inset panel.
- Command first: the home is a greeting and a composer, never a grid of numbers.
- Pearl, white, and ink. The primary is ink. Color appears only in the mist, the summary label,
  and status chips.
- The mist shows only on the home hero, the sign-in, and the empty art, never behind data.
- Instrument Serif (weight 400 only) for the greeting, page titles, and empty titles. Hanken
  Grotesk for all other text. JetBrains Mono for code and key hints.
- `--radius: 1rem`: cards 20 px, fields 14 px. Buttons and chips stay pills (the kit default).
- Hairlines, and one soft lavender shadow on floating cards: `shadow-xl shadow-chart-1/10`.

Client choices, fresh for each app: `contentWidth` (`centered` for a chat assistant or notes,
`full` for a knowledge base with many sources); sign-in S1 or S2 and first run F1 or F2
(section 6); the lead object (chats, notes, sources, agents); the greeting, by time of day
("Good morning, Sam") or as a question ("What do you want to find?").

Two Brume apps never share the same sign-in and first-run composition.

## 3. Tokens

```css
:root {
	--background: #fcfbfd;
	--foreground: #1b1a22;
	--card: #ffffff;
	--card-foreground: #1b1a22;
	--popover: #ffffff;
	--popover-foreground: #1b1a22;
	--primary: #1b1a22;
	--primary-foreground: #ffffff;
	--secondary: #f2eff7;
	--secondary-foreground: #1b1a22;
	--muted: #f2f0f6;
	--muted-foreground: #646070;
	--accent: #ece8fb;
	--accent-foreground: #1b1a22;
	--destructive: #c4352b;
	--destructive-foreground: #ffffff;
	--border: #e7e4ee;
	--input: #dcd8e5;
	--ring: #8b7cf6;
	--radius: 1rem;
	--sidebar: #f4f2f7;
	--sidebar-foreground: #1b1a22;
	--sidebar-accent: #e7e3f1;
	--sidebar-accent-foreground: #1b1a22;
	--sidebar-border: #e2dfe9;
	--sidebar-ring: #8b7cf6;
	--chart-1: #6d5bd0;
	--chart-2: #b85a35;
	--chart-3: #2b7f7a;
	--chart-4: #3d68c9;
	--chart-5: #94467f;
	--success: #1e7b4f;
	--success-foreground: #ffffff;
	--warning: #f2c14e;
	--warning-foreground: #2a1d05;
	/* Mist colors. Only the mist SVG and the avatar use them. */
	--glow-1: #d9d2ff;
	--glow-2: #ffd9c2;
}

@theme {
	--font-sans: "Hanken Grotesk", ui-sans-serif, system-ui, sans-serif;
	--font-display: "Instrument Serif", ui-serif, Georgia, serif;
	--font-mono: "JetBrains Mono", ui-monospace, monospace;
}

html:lang(ar) {
	--font-sans: "Noto Sans Arabic", ui-sans-serif, system-ui, sans-serif;
	--font-display: "Markazi Text", ui-serif, serif;
	--font-mono: "JetBrains Mono", "Noto Sans Arabic", ui-monospace, monospace;
}
```

Remove the `.dark` block. Add `--color-glow-1: var(--glow-1);` and `--color-glow-2:
var(--glow-2);` to the `@theme inline` block: they make `fill-glow-1` and `from-glow-1`. In the
`@layer base` rule for `h1, h2, h3, h4`, add `font-synthesis: none;`. Instrument Serif has one
weight, so a kit `font-semibold` heading then stays at 400 instead of a fake bold.

Dark twin, only on request, still one static `:root`: background `#121018`; foreground and
primary `#ece9f3`; primary-foreground `#121018`; card and popover `#1a1722`; muted and secondary
`#221e2b`; muted-foreground `#a29cb0`; accent `#2a2536`; border `#ffffff14`; sidebar `#0d0b12`;
chart-1 `#9d8cff`; chart-2 `#e08a62`; glows `#3b2f6e` and `#5a3426`.

In `__root.tsx` `head().links`, keep `tokensCss`. Replace the old preconnect and font links with:

```tsx
{ rel: "preconnect", href: "https://fonts.googleapis.com" },
{ rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
{
	rel: "stylesheet",
	href: "https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Hanken+Grotesk:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&family=Markazi+Text:wght@400;500;600;700&family=Noto+Sans+Arabic:wght@400;500;600;700&display=swap",
},
```

## 4. Type

- Greeting: `font-display text-4xl sm:text-5xl text-balance`. The name sits in
  `text-muted-foreground italic rtl:not-italic`, passed as a message parameter.
- Page title: the `DashboardPageHeader` h1. Section title: an h2 `font-display text-2xl`.
- Reading text (answers, notes): `text-[15px] leading-7 max-w-prose`. UI text `text-sm`.
- Label: `text-xs font-medium text-muted-foreground`, sentence case.
- Key hint: `<kbd className="rounded-md border bg-muted px-1.5 font-mono text-[11px] text-muted-foreground">`.
- Code in an answer: `dir="ltr"` block `overflow-x-auto rounded-xl bg-muted p-4 font-mono text-[13px]`.
- Arabic: Markazi Text takes the serif roles, Noto Sans Arabic the text. No italics.

## 5. Signatures

1. **The mist and the composer.** A `relative isolate overflow-hidden` hero holds the mist:
   ```tsx
   <svg aria-hidden="true" viewBox="0 0 800 400" preserveAspectRatio="xMidYMid slice" className="absolute inset-0 -z-10 size-full">
     <defs><filter id="mist-blur" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="60" /></filter></defs>
     <g filter="url(#mist-blur)">
       <ellipse cx="250" cy="150" rx="230" ry="120" className="fill-glow-1" />
       <ellipse cx="560" cy="190" rx="250" ry="120" className="fill-glow-2" />
       <ellipse cx="420" cy="70" rx="170" ry="80" className="fill-accent" />
     </g>
   </svg>
   ```
   A `-z-10 h-32 bg-linear-to-b from-transparent to-background` strip at the bottom fades it into
   the page. One mist per screen: the filter id is fixed. The composer floats on it: `w-full
   rounded-2xl border bg-card p-3 text-start shadow-xl shadow-chart-1/10
   focus-within:border-ring`, with `Textarea className="min-h-20 resize-none border-0
   bg-transparent text-base shadow-none focus-visible:ring-0"` and, at the end of a bottom row,
   the send `Button size="icon"` (`ArrowUp`), disabled while empty or busy. Enter sends,
   Shift+Enter breaks the line, and a kbd hint says so. It calls the real ask flow (a
   `createServerFn`). Never fake an answer.
2. **The summary block.** Every AI output: `rounded-2xl border bg-card p-5`. Label row:
   `Sparkles` (`size-4 text-chart-1`) and "Summary" or "Answer" in `text-sm font-medium
   bg-linear-to-r from-chart-1 to-chart-2 bg-clip-text text-transparent`. Then the reading text.
   Footer `mt-4 flex items-center gap-1 border-t pt-3`: numbered source chips (`h-6 rounded-full
   bg-muted px-2 font-mono text-[11px]`, links to the real sources), then ghost icon buttons
   Copy, `ThumbsUp`, `ThumbsDown` (`aria-pressed`). A rating saves to a real column; no feedback
   store, no thumbs.
3. **Suggestions and recents.** Under the composer, 3 or 4 outline `Button size="sm"` chips with
   `bg-card/70 text-muted-foreground` and an icon. A chip fills the composer with a starter
   prompt for a real feature. Then "Recent": `divide-y rounded-2xl border bg-card`, rows `flex
   h-12 items-center gap-3 px-4` with a type icon, the title `truncate`, and the time at the end
   (`text-xs text-muted-foreground`, from `Intl.RelativeTimeFormat` with `numeric: "auto"`).

## 6. Screens

**Shell.** `navigation`: an outline `Button asChild className="mb-2 justify-start bg-card"`
with `Plus` and "New chat", the `DashboardNavItem` links, then the label "Recent" (`px-3 pt-6
pb-1`) and up to 5 recent items. `header`: a breadcrumb in `text-sm text-muted-foreground`
(workspace, `ChevronRight`, the page in `text-foreground`), then `ms-auto` actions.
`sidebarFooter`: a `size-8 rounded-full bg-linear-to-br from-glow-1 to-glow-2` avatar with
initials, the email `truncate text-sm`, and a ghost icon sign-out.

Icons: `pnpm add lucide-react`, `strokeWidth={1.75}`: `Plus`, `House`, `Library`, `Workflow`,
`MessageSquare`, `FileText`, `Search`, `Settings`, `ArrowUp`, `Copy`, `ThumbsUp`, `ThumbsDown`,
`Sparkles` (AI output only), `ChevronRight` and `ArrowLeft` (both `rtl:rotate-180`).

**Sign-in** (email and password only; sign-up adds confirm password):

- S1 Mist panel: `grid min-h-dvh lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]`. Start: a
  `max-w-sm` form, centered: the brand in `font-display text-2xl`, h1 `font-display text-4xl`,
  one muted line, `Input className="h-11"`, a full-width `h-11` primary button, the switch link.
  End (`hidden lg:block`): `relative isolate m-3 overflow-hidden rounded-3xl bg-sidebar` with the
  mist and, centered, a static composer outline (`aria-hidden`, `pointer-events-none`) that
  shows only its translated placeholder.
- S2 Veil: the mist fills the page (`fixed inset-0`). A centered card `w-full max-w-sm
  rounded-3xl border bg-card/85 p-8 shadow-xl shadow-chart-1/10` holds a centered serif title,
  the fields, and the switch link.

**First run** (no rows yet):

- F1 Mist home: no page header. The mist hero bleeds to the panel edges (`-mx-4 -mt-4 px-4
  pt-16 pb-10 lg:-mx-8 lg:-mt-8 lg:px-8 lg:pt-24`) and centers the greeting, the composer, and
  the chips in `mx-auto flex max-w-2xl flex-col items-center gap-6`. Then `DashboardBody
  layout="analytics"`: `primary` is the Recent card with one muted line; `secondary` is "Get
  started", 3 rows with a step circle `size-6 rounded-full border text-xs` (done: `bg-success
  text-success-foreground` and `Check`) and a real action (add a source; ask a first question
  focuses the composer).
- F2 Desk: `DashboardPageHeader` (serif "Library", a description, an "Add source" primary
  action). `DashboardBody layout="workbench"`: `primary` is a compact composer card (no mist)
  with the chips and a 3-step line under it; `secondary` is the library list whose body holds
  the empty art. When asking needs a source, send stays disabled and a line under the composer
  says why, with an "Add source" link.

**Records view** (library, notes, or chats). Filters: a search `Input` (`h-9 max-w-xs
rounded-full ps-9`, `Search` at `start-3`) and type chips (active `bg-foreground
text-background`). List `rounded-2xl border bg-card`: a column row `h-9 border-b px-4 text-xs
text-muted-foreground`, rows `h-14 px-4` with a checkbox (add `src/shared/ui/checkbox.tsx` on
radix-ui `Checkbox`), a `size-8 rounded-lg bg-muted` type tile, the title over a one-line
snippet, the status, and the time.
Status chips hold a word: Ready `bg-success/10 text-success`, Indexing `bg-warning/25
text-warning-foreground` with an `animate-pulse` dot, Failed `bg-destructive/10
text-destructive` with Retry. Selection swaps the filters for a `h-10 rounded-full bg-foreground
px-4 text-background` bar ("2 selected", Move, Delete with a confirm `Dialog`). Footer: real
counts in `text-xs text-muted-foreground` ("12 items · 3 indexing").

**Record detail.** A reading page: `mx-auto w-full max-w-3xl`, a back link with `ArrowLeft`, the
serif title `text-4xl`, a meta line, the summary block (or a "Summarize" button that runs the
real flow), then the body in reading text. A chat thread: user turns `ms-auto max-w-[85%]
rounded-2xl bg-secondary px-4 py-2.5` with `dir="auto"`, answers as summary blocks, and the
composer docked `sticky bottom-4`. "Details" opens `Sheet side="end"` (`sm:max-w-md`) with a
`divide-y` `dl` of facts.

**Analytics.** None by default. Usage figures go in Settings as plain labeled numbers.

**Settings.** `mx-auto max-w-2xl`. Each section: an h2 `font-display text-2xl`, then a
`divide-y rounded-2xl border bg-card` box of rows `flex items-center justify-between gap-6 px-5
py-4` (label, muted description, control at the end). Add `src/shared/ui/switch.tsx` (radix-ui
`Switch`; thumb `rtl:data-[state=checked]:-translate-x-4`). A switch saves at once with a toast.

**Empty state art.** `relative isolate overflow-hidden rounded-2xl border bg-card px-6 py-12
text-center`: a small mist, two ghost cards (`h-10 w-56 rounded-xl border bg-card/80`, tilted
`-rotate-3` and `rotate-2`, with `h-2 rounded-full bg-muted` lines), a serif title `text-2xl`,
one muted sentence, and one action.

**375 px.** The kit Sheet holds the nav. The hero uses `pt-10`. Chips scroll in one line
(`flex-nowrap overflow-x-auto snap-x`). List rows hide the time column and show it under the
title. The Details Sheet takes the full width.

## 7. Motion

Slow, soft, and rare.

- The composer: `animate-in fade-in-0 slide-in-from-bottom-2 duration-500`; chips `fade-in-0
  duration-700`; a new answer `fade-in-0 duration-300`.
- Thinking: three `size-1.5 rounded-full bg-muted-foreground animate-pulse` dots, delayed with
  `[animation-delay:150ms]` and `[animation-delay:300ms]`.
- Rows and chips: `transition-colors duration-150`. Every `animate-*` gets
  `motion-reduce:animate-none`. The mist never moves.

## 8. Imagery

The SVG mist is the main art. `generate_image` is optional, at most 2 in the first build:
`public/signin-art.png` (S1 panel, 4:5) and `public/empty-art.png` (4:3), used as
`/signin-art.png` and `/empty-art.png`.

Prompt model: "Soft abstract haze of lavender and peach light on a pearl white background,
[mood: dawn through a window / mist over still water / light on folded paper], very blurred,
fine grain, calm, airy, no objects, no people, no text, no letters, no logos, no watermark."

Never robots, brains, circuit boards, or glowing orbs.

## 9. Bans

- No radial gradient, canvas, or moving blob: the mist is SVG blur and linear gradients only.
- No gradient on a button. Gradient text only on the summary label.
- No bold serif, no serif in tables or body text, no uppercase labels.
- No robot icon, no wand. `Sparkles` marks AI output only.
- No fake answers, sample chats, invented sources, or usage numbers. No KPI tiles on the home.

## 10. Self-check

1. The shell is `inset` and `comfortable`; the pearl canvas frames the white panel.
2. The home leads with the greeting and the composer on the mist. No mist shows behind data.
3. Serif text renders at weight 400, with no fake bold.
4. Every AI output is a summary block with its sources.
5. Chips fill the composer; recent rows show real items with relative times.
6. The first run is F1 or F2, and every getting-started action works.
7. Arabic uses Markazi Text and Noto Sans Arabic, without italics.
8. At 375 px the composer fills the width and chips scroll on one line.
