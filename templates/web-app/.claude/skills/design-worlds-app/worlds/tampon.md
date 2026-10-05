# Tampon — a rubber stamp on cream paper

`tampon` · loud · light · comfortable · best for: creator store, digital products, newsletter,
membership community, marketplace seller, indie SaaS · avoid for: clinic, legal, luxury, finance,
kids

## 1. Feel

A print-shop counter. Cream paper, black ink, one hot pink stamp pad. Every box has a 1 px black
frame. A button lifts off the paper on hover and stamps back down on press. Labels are typed in
mono like a receipt. The app is loud through contrast and pink, never through clutter.

Voice: a friendly shop owner. A verb first ("Add a product", "Share your page"). Mono labels
state facts ("0 SALES", "DRAFT"). No exclamation marks, no emoji.

## 2. World law and client choices

World law, the same in every Tampon app:

- Shell: `DashboardShell variant="sidebar" density="comfortable"`. The sidebar is black, with a
  1 px rule between nav items (section 6).
- Cream ground, white boxes, black ink, one pink. Pink (`bg-secondary`) fills the one main action
  of a screen and the art. Pink text appears only on the black sidebar. Light pink (`bg-accent`)
  marks hover and selected rows.
- Every border is black: `--border` and `--input` are `#000000`. Cards, fields, tables, and
  separators get the frame from the token.
- One shadow: a 4 px offset with no blur. Section 3 redefines the scale: `shadow-xs` and
  `shadow-sm` are flat, `shadow-md` and `shadow-lg` are the stamp.
- Rethink Sans for text and numbers. Space Mono for labels, IDs, prices, and table headers.
- `--radius: 0.25rem`. Boxes and buttons are 4 px (`rounded-lg`). Pills only for tabs and avatars.

Kit edits, once, in the first build:

1. `src/shared/ui/button.tsx`: in the base string, replace `rounded-full` with `rounded-lg`.
   Append to the `default`, `secondary`, `outline`, and `destructive` variants:
   `hover:-translate-x-1 hover:-translate-y-1 hover:shadow-md active:translate-none active:shadow-none motion-reduce:hover:translate-none`.
   Make `secondary` `border border-foreground bg-secondary text-secondary-foreground`.
2. `src/shared/ui/card.tsx`: replace `rounded-xl` with `rounded-lg`.

Client choices, fresh for each app: `contentWidth` (`full` for many records, `centered` for a
small newsletter); sign-in S1 or S2 and first run F1 or F2 (section 6); the lead record
(products, posts, members), which names the pink action; the illustration subject (section 8).

Two Tampon apps never share the same sign-in and first-run composition.

## 3. Tokens

```css
:root {
	--background: #f4f4f0;
	--foreground: #000000;
	--card: #ffffff;
	--card-foreground: #000000;
	--popover: #ffffff;
	--popover-foreground: #000000;
	--primary: #000000;
	--primary-foreground: #ffffff;
	--secondary: #ff7ac6;
	--secondary-foreground: #000000;
	--muted: #e8e8e1;
	--muted-foreground: #5c5c55;
	--accent: #ffc2e4;
	--accent-foreground: #000000;
	--destructive: #c8281b;
	--destructive-foreground: #ffffff;
	--border: #000000;
	--input: #000000;
	--ring: #000000;
	--radius: 0.25rem;
	--sidebar: #000000;
	--sidebar-foreground: #ffffff;
	--sidebar-accent: #1c1c1c;
	--sidebar-accent-foreground: #ff7ac6;
	--sidebar-border: #ffffff38;
	--sidebar-ring: #ff7ac6;
	--chart-1: #d6297f;
	--chart-2: #0e8f84;
	--chart-3: #5b3fd6;
	--chart-4: #b07800;
	--chart-5: #000000;
	--success: #23c26b;
	--success-foreground: #000000;
	--warning: #ffc900;
	--warning-foreground: #000000;
}

@theme {
	--font-sans: "Rethink Sans", ui-sans-serif, system-ui, sans-serif;
	--font-display: "Rethink Sans", ui-sans-serif, system-ui, sans-serif;
	--font-mono: "Space Mono", ui-monospace, monospace;
	/* Flat boxes and fields. The stamp: a 4 px offset, no blur. */
	--shadow-xs: 0 0 #0000;
	--shadow-sm: 0 0 #0000;
	--shadow-md: 4px 4px 0 0 #000000;
	--shadow-lg: 4px 4px 0 0 #000000;
}

html:lang(ar) {
	--font-sans: "Rubik", ui-sans-serif, system-ui, sans-serif;
	--font-display: "Alexandria", "Rubik", ui-sans-serif, system-ui, sans-serif;
	--font-mono: "Space Mono", "Rubik", ui-monospace, monospace;
}
```

Remove the `.dark` block. Keep `0 0 #0000` for flat shadows: `none` breaks the focus ring. The
stamp stays bottom-right in Arabic: it is light, not reading direction.

In `__root.tsx` `head().links`, keep `tokensCss`. Replace the old preconnect and font links with:

```tsx
{ rel: "preconnect", href: "https://fonts.googleapis.com" },
{ rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
{
	rel: "stylesheet",
	href: "https://fonts.googleapis.com/css2?family=Rethink+Sans:wght@400;500;600;700;800&family=Space+Mono:wght@400;700&family=Alexandria:wght@600;700;800&family=Rubik:wght@400;500;600;700&display=swap",
},
```

## 4. Type

- Page title: the `DashboardPageHeader` h1, in the header band (section 6).
- Big figure: `font-display text-4xl font-bold tabular-nums tracking-tight`. Brand: the app name
  in `font-display text-xl font-extrabold`.
- Label (eyebrow, table header, chip, step number):
  `font-mono text-xs uppercase tracking-wider rtl:tracking-normal`.
- Body `text-sm`; long text `text-base leading-relaxed max-w-prose`. Prices and IDs: `font-mono`.
- Arabic: Alexandria for titles, Rubik for text and for Arabic letters in mono labels. No italics.

## 5. Signatures

1. **The stamp box.** A white `Card` with the black frame and no shadow is the base box. Things
   that float (Select, dropdown, Dialog, Sheet) carry the stamp through `shadow-md` or
   `shadow-lg`. Buttons lift with the stamp on hover and drop flat on press. A selected card
   shows the stamp at rest: `-translate-x-1 -translate-y-1 shadow-md`.
2. **The getting-started grid.** A ruled grid of real setup steps:
   `<ol className="grid gap-px overflow-hidden rounded-lg border bg-border sm:grid-cols-2">`.
   Each `<li className="flex gap-4 bg-card p-5">` holds a mono step number ("01"), the title
   `font-semibold`, one line `text-sm text-muted-foreground`, and an outline `Button size="sm"`.
   A done step: the title gets `line-through decoration-2 text-muted-foreground`, and a DONE stamp
   chip with `bg-secondary -rotate-6` replaces the button. Above the grid: an h2 and a mono
   "2/4 DONE". An odd count: the last step gets `sm:col-span-2`. Steps derive from real data (a
   product exists, the profile has a name) and open a real route or dialog. Hide the grid when
   every step is done.
3. **The dashed frame.** Every empty state:
   `flex flex-col items-center gap-4 rounded-lg border border-dashed bg-card p-6 text-center sm:p-10`.
   Inside: the art in `w-full max-w-xl overflow-hidden rounded-lg border bg-warning`, an h3
   `font-display text-xl font-semibold`, one line `text-sm text-muted-foreground`, and the pink
   `Button variant="secondary"`.

**Stamp chip** (every status): `<Badge variant="outline" className="rounded-sm border-foreground
font-mono text-[11px] uppercase tracking-wider rtl:tracking-normal">`. Published:
`bg-foreground text-background`. Draft: `border-dashed bg-card`. Paused or sold out:
`bg-warning text-warning-foreground`. Refunded: `bg-muted text-muted-foreground line-through`.

## 6. Screens

**Shell.** `navigation`: `<ul className="-mx-3 border-t border-sidebar-border">`, each
`<li className="border-b border-sidebar-border px-3 py-1">` with one `DashboardNavItem`.
Settings sits in a second ruled list with `mt-8`. `header`: `<div className="flex w-full flex-col
gap-4 py-2 lg:py-4">` with `DashboardPageHeader` (actions: an outline search icon button and the
pink action) and the view tabs. `sidebarFooter`: `flex items-center gap-3 border-t
border-sidebar-border pt-4`, initials in a `size-8 rounded-full bg-secondary` circle, the email
`min-w-0 flex-1 truncate text-sm`, and a ghost icon sign-out with `hover:bg-sidebar-accent`.

Icons: `pnpm add lucide-react`: `House`, `Package`, `Mail`, `Users`, `ChartColumn`, `Settings`,
`Search`, `Plus`, `Copy`, `Trash2`, `LogOut`, `ArrowLeft` (`rtl:rotate-180`), at `size-4`.

**Sign-in** (email and password only; sign-up adds confirm password):

- S1 Poster split: `grid min-h-dvh lg:grid-cols-2`. Start column: the brand at the top, then a
  `max-w-sm` form: h1 `font-display text-4xl font-extrabold tracking-tight`, a mono line, `Input
  className="h-11 bg-card"`, a full-width black button `h-11`, and the switch link. End column
  `hidden lg:flex items-center justify-center border-s bg-secondary p-12`: `/signin-art.png` in
  `max-w-md overflow-hidden rounded-lg border bg-card shadow-md -rotate-2`. Under `lg`, the page
  gets `border-t-8 border-secondary`.
- S2 Ticket: a centered column on a dotted ground,
  `bg-[radial-gradient(var(--color-foreground)_1px,transparent_1px)] [background-size:24px_24px]`.
  One box `w-full max-w-md overflow-hidden rounded-lg border bg-card shadow-md`: a strip
  `border-b bg-secondary px-6 py-3` with the brand and a mono "SIGN IN", the form in `p-6`, and
  a footer `border-t px-6 py-4` with the switch link.

**First run** (no rows yet):

- F1 Counter: `DashboardBody layout="analytics"`. `metrics`: 3 or 4 `DashboardMetric` with real
  zeros (sales, revenue in the currency the user gave, members). No currency fact: counts only.
  `primary`: the getting-started grid. `secondary`: an "Activity" card with a mono "0" and a
  small dashed frame.
- F2 Shelf: the getting-started grid first, full width, `sm:grid-cols-2 xl:grid-cols-4`. Then
  `DashboardBody layout="operations"`, the records table as `primary`, no `secondary`. The table
  body is one row with `colSpan` over all columns: the dashed frame and the pink create action.

**Records view.** Add `src/shared/ui/table.tsx` (plain HTML), `src/shared/ui/tabs.tsx` (radix-ui
`Tabs`), and `src/shared/ui/checkbox.tsx` (radix-ui `Checkbox`: `size-4 rounded-sm border
border-foreground data-[state=checked]:bg-foreground data-[state=checked]:text-background`).

- Frame `overflow-x-auto rounded-lg border bg-card`. Header cells `h-10 border-b bg-background
  px-4 text-start text-muted-foreground` plus the label role.
- Rows `border-b hover:bg-accent/40 data-[state=selected]:bg-accent`, cells `h-16 px-4`. First
  cell `w-16 p-0`: the thumbnail `size-16 border-e object-cover`, or the first letter on
  `bg-secondary` in `font-display text-xl font-extrabold`. Name `font-semibold`, the public link
  under it in `text-xs underline`. Numbers mono. Status: a stamp chip.
- Footer row `border-t bg-background font-semibold`: "Totals" and the sums of real columns.
- View tabs (saved views with real counts): trigger `h-8 shrink-0 rounded-full border
  border-transparent px-4 text-sm data-[state=active]:border-foreground data-[state=active]:bg-card`.
- Bulk bar on selection: `fixed inset-x-4 bottom-6 z-40 mx-auto flex w-fit items-center gap-2
  rounded-lg border bg-secondary p-2 shadow-md`: a mono "3 SELECTED", outline buttons with
  `bg-card`, a destructive Delete with a confirm `Dialog`, and a close icon.

**Record detail.** A page with "Copy link" (outline, clipboard and toast) and "Edit" (pink).
Body `grid gap-8 lg:grid-cols-[18rem_minmax(0,1fr)]`: a Card with the image (`aspect-square
border-b`), the price in `font-mono text-2xl`, and a `divide-y` `dl` (created, sales, revenue);
then the description and files. A customer opens in `Sheet side="end"` (`sm:max-w-md`).

**Analytics** (store and newsletter apps). A range `Select` in the header actions. A totals strip
`grid divide-y rounded-lg border bg-card sm:grid-cols-3 sm:divide-x sm:divide-y-0`, cells `p-5`
with a label and a big figure. Inline SVG bars `fill-chart-1 stroke-foreground`, grid lines
`stroke-foreground/10`, mono labels `fill-muted-foreground text-[10px]`, a `<title>` per bar, and
an `sr-only` table of the values. No sales in the range: the baseline and the dashed frame.

**Settings.** Header tabs per section. Each section: `Card className="gap-0 py-0"`, a strip
`border-b px-6 py-4` (title and a mono description), fields in `grid gap-5 p-6
sm:grid-cols-[12rem_minmax(0,1fr)]`, a footer `border-t bg-background px-6 py-4` with a black
Save at the end. The danger card has `border-destructive`.

**Empty state art.** `/empty-art.png`, or SVG art (`viewBox="0 0 320 140"`): burst lines
`stroke-foreground`, a stamp (handle `fill-secondary`, neck `fill-chart-2`, base `fill-card`,
all `stroke-foreground stroke-2`), and a dashed imprint `fill-none stroke-chart-1`.

**375 px.** The kit Sheet holds the black nav. Actions wrap; tabs scroll on one line. Price and
sales cells get `hidden sm:table-cell`; the price shows under the name. Grids stack.

## 7. Motion

Short and physical, like a stamp.

- Buttons: the lift of kit edit 1 (150 ms). Reduced motion keeps the shadow, not the movement.
- A new DONE chip: `animate-in fade-in-0 zoom-in-125 duration-200 motion-reduce:animate-none`.
- The bulk bar: `animate-in fade-in-0 slide-in-from-bottom-2`. Popovers keep the kit `zoom-in-95`.
- Never: slow fades, bounce, parallax, or a loop on a data screen.

## 8. Imagery

Flat illustration with thick black outlines. `generate_image`, at most 2 in the first build:
`public/signin-art.png` (S1, 4:5) and `public/empty-art.png` (16:7), used as `/signin-art.png`
and `/empty-art.png`.

Prompt model: "Flat vector illustration with thick even black outlines, flat fills of hot pink,
teal, and mustard yellow on a cream background, [subject: hands packing a parcel / a stack of
zines / a hand pressing a rubber stamp on an envelope], bold playful shapes, a few burst lines,
no shading, no gradient, no text, no letters, no logos, no watermark."

No image: draw the SVG art. Never stock photos, 3D renders, or mascots.

## 9. Bans

- No soft or blurred shadow, no glass, no gradient.
- No grey border. Frames are black; the sidebar rules are white at 22 %.
- No pink text on cream or white. One pink fill per area at most.
- No `rounded-full` button. No tinted icon circle on a metric.
- No invented sales, revenue, members, reviews, or "best seller" chips.
- No status by color alone: every stamp chip holds its word.
- Teal and yellow appear only in art, charts, and status, never in chrome.

## 10. Self-check

1. The sidebar is black, rules separate the nav items, and the active item is pink text.
2. Cards, fields, and tables have a black 1 px frame. No soft shadow shows.
3. Buttons are 4 px boxes that lift on hover and drop flat on press. One pink action per screen.
4. The first run is F1 or F2 with real zeros, and every step opens a real route or dialog.
5. Every empty state is the dashed frame with art, one line, and one pink action.
6. Labels and prices are Space Mono; Arabic uses Alexandria and Rubik with no tracking.
7. At 375 px no row scrolls sideways, and the nav opens in the Sheet.
