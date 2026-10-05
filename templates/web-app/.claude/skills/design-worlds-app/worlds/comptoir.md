# Comptoir — the shop counter before the doors open

`comptoir` · medium · light · compact · best for: e-commerce admin, COD order desk, inventory,
shop back office, marketplace seller · avoid for: clinic, therapy, school, kids, meditation

## 1. Feel

A shop counter at eight in the morning. The canvas is stockroom grey, the cards are white order
slips, and a dark counter slab holds the search. Cash green marks money in and work done. Amber
marks orders that still wait. Order numbers are mono, like printed labels. Every amount is
tabular. Each screen answers one question: what leaves the shop today?

Voice: a shop manager. A verb starts each action ("Print labels", "Mark as packed"). Titles carry
their real count ("Orders 12"). No exclamation marks, no emoji. Amounts use `Intl.NumberFormat`
with the shop currency.

## 2. World law and client choices

World law, the same in every Comptoir app:

- Shell: `DashboardShell` with `variant: "sidebar"` and `density: "compact"`. The sidebar is flush
  grey. The active item is a white row (`--sidebar-accent`).
- The counter slab: the shell header has no background, so the `header` prop renders it.
  Slab: `flex h-11 min-w-0 flex-1 items-center gap-2 rounded-lg bg-foreground px-2 text-background`.
  Start: the shop name (`ps-2 text-sm font-semibold`). Center: a search button (`mx-auto flex h-8
  w-full max-w-md items-center gap-2 rounded-md border border-background/15 bg-background/10 px-3
  text-sm text-background/70`) with `Search` and a `⌘K` kbd. End: the account menu. The button
  and ⌘K (one `// effect:` keydown listener on `window`) open a `Dialog` that searches real rows.
- White cards on grey, hairline borders, `shadow-none` on data cards.
- Albert Sans for all text. Spline Sans Mono only for order numbers, SKUs, and tracking codes.
- Green (`primary`, `success`) means money in or work done. Amber (`warning`) means work that
  waits. Never use them as decoration.
- `--radius: 0.5rem`: cards 12 px, fields 6 px. Buttons and badges keep the kit pill shape.

Client choices, decided fresh for each app:

- Sign-in A1 or A2, first run F1 or F2 (section 6).
- The five till metrics, from real tables. A card shop: Sales, Orders, To fulfill, Average
  order, Returns. A COD desk: Orders today, To confirm, To ship, Delivered, Returned.
- The rail steps: Pick > Print > Pack > Done, or Confirm > Pack > Ship > Delivered for COD.
- The currency, from the shop settings. Ask when the brief does not name it.
- `contentWidth`: `full` for a large catalog, `centered` for a small shop.

Two Comptoir apps never share the same sign-in and first-run composition.

## 3. Tokens

In `src/styles/tokens.css`, replace the `:root` values, the `@theme` font block, and
`html:lang(ar)`. Delete the `.dark` block. Write `comptoir` in the header comment. In
`@layer base`, set `letter-spacing: -0.01em` on `html`.

```css
:root {
	--background: #f1f1f0;
	--foreground: #1c1c1b;
	--card: #ffffff;
	--card-foreground: #1c1c1b;
	--popover: #ffffff;
	--popover-foreground: #1c1c1b;
	--primary: #0a6b37;
	--primary-foreground: #ffffff;
	--secondary: #e6e6e3;
	--secondary-foreground: #1c1c1b;
	--muted: #ebebe8;
	--muted-foreground: #5c5c58;
	--accent: #e9e9e6;
	--accent-foreground: #1c1c1b;
	--destructive: #c8321e;
	--destructive-foreground: #ffffff;
	--border: #deded9;
	--input: #cbcbc6;
	--ring: #0a6b37;
	--radius: 0.5rem;
	--sidebar: #ebebe9;
	--sidebar-foreground: #2b2b29;
	--sidebar-accent: #ffffff;
	--sidebar-accent-foreground: #1c1c1b;
	--sidebar-border: #dcdcd8;
	--sidebar-ring: #0a6b37;
	--chart-1: #2560c9;
	--chart-2: #7a4bc0;
	--chart-3: #0e7490;
	--chart-4: #b4436c;
	--chart-5: #5c5c58;
	--success: #12a150;
	--success-foreground: #03200e;
	--warning: #f5b400;
	--warning-foreground: #2b1d00;
}

@theme {
	--font-sans: "Albert Sans", ui-sans-serif, system-ui, sans-serif;
	--font-display: "Albert Sans", ui-sans-serif, system-ui, sans-serif;
	--font-mono: "Spline Sans Mono", ui-monospace, monospace;
}

html:lang(ar) {
	--font-sans: "Mada", ui-sans-serif, system-ui, sans-serif;
	--font-display: "Mada", ui-sans-serif, system-ui, sans-serif;
}
```

No chart series is green, amber, or red. `chart-5` is the previous period. In `head().links`
of `src/routes/__root.tsx`, keep `tokensCss`. Remove the old font links. Add:

```ts
{ rel: "preconnect", href: "https://fonts.googleapis.com" },
{ rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
{
	rel: "stylesheet",
	href: "https://fonts.googleapis.com/css2?family=Albert+Sans:wght@400;500;600;700&family=Spline+Sans+Mono:wght@400;500&family=Mada:wght@400;500;600;700&display=swap",
},
```

## 4. Type

- Page title: the kit `DashboardPageHeader`, with the real count: `t("orders.title", { count })`.
- Card title `text-sm font-semibold`. Label `text-xs text-muted-foreground`, never uppercase.
- Table text `text-[13px]`. KPI value `text-xl font-semibold tabular-nums`. Amounts
  `tabular-nums text-end`. Order number, SKU, tracking code: `font-mono text-[13px]`.
- Arabic: Mada, a geometric twin of Albert Sans, for text and titles. No italics.

Icons: `pnpm add lucide-react`, size `size-4`: `House`, `Inbox` (orders), `Package`, `Users`,
`ChartColumn`, `Settings`, `Search`, `Printer`, `Truck`, `Check`, `CircleCheck`, `ArrowUp`,
`ArrowDown`, `ImageOff`. `ChevronRight` and `ArrowLeft` get `rtl:rotate-180`.

## 5. Signatures

1. **The till strip.** Five real metrics in ONE card, above the orders: `<Card
   className="gap-0 overflow-hidden py-0 shadow-none">` around `<dl className="flex snap-x
   divide-x overflow-x-auto">`. A cell (`min-w-40 flex-1 snap-start p-4`) holds the label, the
   value, a delta pill, and a sparkline. The sparkline is an SVG (`viewBox="0 0 100 24"`,
   `preserveAspectRatio="none"`, `className="mt-2 h-6 w-full"`) with one `polyline`:
   `className="stroke-chart-1" fill="none" strokeWidth="1.5" vectorEffect="non-scaling-stroke"`.
   Delta pill: `rounded-full bg-success/15 px-1.5 text-xs` with `ArrowUp` in `text-success`, or
   `bg-destructive/10` with `ArrowDown` in `text-destructive`. A period `Select` sits above. With
   fewer than 2 points, draw a dashed flat line (`stroke-border`) and show "—" as the delta.

2. **The fulfillment rail.** Four steps in `<ol className="flex flex-wrap items-center gap-1">`.
   Each step is a button `h-7 rounded-full border px-2.5 text-xs` with its real count.
   Done: `border-transparent bg-success text-success-foreground` with `Check`. Current:
   `border-foreground bg-card`. Later: `border-dashed text-muted-foreground`. A `ChevronRight`
   (`size-3.5 text-muted-foreground rtl:rotate-180`) sits between steps. Each step runs its real
   action on the selected orders: Pick opens a printable pick list, Print calls `window.print()`
   on the labels view, Pack and Done write the status. Show only steps that the app supports.

3. **The order pills.** Three pill classes on `Badge`, each with its word from `t()`:
   - To do (unpaid, unfulfilled, to confirm): `variant="outline"` with `border-warning
     bg-warning/10 text-foreground` and a hollow dot `size-2 rounded-full border border-warning`.
   - Done (paid, fulfilled, delivered): `border-transparent bg-success text-success-foreground`
     with `Check`.
   - Closed (cancelled, refunded, returned): `border-transparent bg-muted text-muted-foreground
     line-through`. The order number and the total of the row are struck through too.
   - Shipped is the one neutral pill: `variant="outline"` with `Truck`.

   Rows show up to three product thumbnails before the customer: `size-8 rounded-md border
   bg-muted object-cover`, each after the first with `-ms-3 ring-2 ring-card`. More items show
   `+N` in a muted square. A product with no photo shows `ImageOff`.

## 6. Screens

Add first, with tokens only: `src/shared/ui/table.tsx` (plain HTML; `TableHead` is `h-9 px-3
text-start text-xs font-medium text-muted-foreground`), `checkbox.tsx` (`Checkbox` from
`radix-ui`), `dropdown-menu.tsx` (`DropdownMenu` from `radix-ui`), and `kbd.tsx` (`inline-flex
h-5 min-w-5 items-center justify-center rounded border px-1 font-mono text-[0.6875rem]`).

**Sign-in** (`/login`, email and password only). Pick one:

- A1 Counter photo: `grid min-h-svh lg:grid-cols-2`. Start: `mx-auto w-full max-w-sm
  self-center px-6` with the shop name in a small slab (`inline-flex h-9 items-center
  rounded-lg bg-foreground px-3 text-sm font-semibold text-background`), then the form. End (`hidden p-3
  lg:block`): the section 8 photo in `size-full rounded-2xl object-cover`.
- A2 Receipt: one card on the grey canvas, `w-full max-w-sm overflow-hidden rounded-xl border
  bg-card`. Its top is a slab (`bg-foreground px-5 py-4 text-background`) with the shop name and
  the date of today in `font-mono text-xs text-background/70`. A tear line (`border-t
  border-dashed`) separates it from the form (`grid gap-4 p-5`).

**First run** (no orders, no products). Pick one:

- F1 Counter at zero: the till strip with real zeros, then `DashboardBody layout="operations"`.
  `primary`: the orders card with its header row and the empty state. `secondary`: the "Open the
  shop" card with 3 numbered row buttons. They open real flows: add a product (`Sheet`), set the
  currency and zones (settings), create an order (`Dialog`). A done step gets `CircleCheck` in
  `text-success` and struck-through muted text.
- F2 Rail first: no till strip before the first order. `DashboardBody layout="workbench"`.
  `primary`: the same 3 steps with a meter "0 of 3" (`h-1.5 rounded-full bg-muted`, fill
  `bg-success`). `secondary`: the rail as four lanes (`grid gap-3 sm:grid-cols-2
  xl:grid-cols-4`). Each lane card shows its step, a real `0`, and one line on what lands there.

In both, `sidebarFooter` shows the meter ("Setup 1 of 3") until every step is done.

**Orders** (`layout="operations"`):

- `DashboardPageHeader` actions: Create order, and Export only when it works.
- One card `gap-0 overflow-hidden py-0 shadow-none`. Top row `flex flex-wrap items-center gap-2
  border-b p-2`: saved views as links on a URL search param (All, To fulfill, Unpaid). The active
  view is `rounded-md bg-muted px-2.5 font-semibold`. Then a search `Input` (`h-8 max-w-60`) and
  a Filter `DropdownMenu` with checkbox items.
- Table: header row `bg-muted/60`. Rows `h-12 border-b text-[13px] hover:bg-muted/50`. Columns:
  checkbox, Order, Date, Products and customer, Total, Payment, Fulfillment. A row opens its page.
- Selection: the header row becomes the batch row: "{count} selected", the rail, and a ghost Clear.
- `TableFooter` (`bg-muted/40 text-xs`): the shown count and the sum of totals. Pagination:
  "1–50 of {total}" and two icon buttons with `rtl:rotate-180`.
- Loading: `Skeleton` rows with the same height and columns. Error: one line and Retry.

**Order page** (`/app/orders/$orderId`): `DashboardPageHeader` with the date as `eyebrow`, the
order number as `title`, the pills in `actions`. Then `grid gap-4
lg:grid-cols-[minmax(0,1fr)_20rem]`. Main: line items (thumbnail, name, SKU, quantity × price),
totals, the rail, the timeline. Side: customer, address (`dir="auto"`), note.

**Analytics** (`layout="analytics"`): the till strip with its period. `primary`: an SVG area
chart with a `stroke-chart-1` line and a `fill-chart-1/10` area. The previous period is a dashed
`stroke-chart-5` line. Add 3 gridlines (`stroke-border`) with `text-xs` labels. "Show as table"
gives exact values. `secondary`: Top products, each with a bar `h-1.5 rounded-full bg-chart-2`.

**Settings**: a section nav (`w-48`) with only built sections (Store, Payments, Delivery zones),
and one card per section. On a change, a save bar covers the slab: `fixed inset-x-0 top-0 z-50
flex h-16 items-center gap-3 bg-foreground px-4 text-background shadow-lg`. It holds "Unsaved
changes", a ghost Discard, and Save (`bg-success text-success-foreground`).

**Empty state art**: an inline SVG parcel (`h-24 w-32`). Box strokes `stroke-muted-foreground`,
the tape `stroke-primary` at width 3, a label `fill-warning/40 stroke-warning`. Under it: one
sentence and one action.

**375 px**: the sidebar is the kit `Sheet`. The slab search becomes an icon button. The till
strip scrolls inside its card. Below `md`, each order is a `grid
grid-cols-[auto_minmax(0,1fr)_auto] gap-3 p-3` row: thumbnails; number, customer, pills; total.
The batch row becomes `fixed inset-x-3 bottom-3 rounded-xl shadow-lg`.

## 7. Motion

Quick and practical, never playful.

- Rows and nav items: `transition-colors duration-100`.
- A pill that changes state: `animate-in fade-in-0 zoom-in-95 duration-150`.
- A completed rail step: its `Check` enters with `animate-in zoom-in-50 duration-200`.
- Batch row and save bar: `animate-in fade-in-0 slide-in-from-top-2 duration-200`.
- Each class has a `motion-reduce:animate-none` or `motion-reduce:transition-none` twin. No loop.

## 8. Imagery

At most one image in the first build: the A1 photo. `generate_image` with aspect `4:5`, path
`public/counter.png`, used as `/counter.png`.

Prompt model: "Overhead photograph of a wooden shop counter in soft morning light, [the goods of
the shop: folded linen shirts / glass skincare jars / phone cases] beside kraft parcels and a roll
of paper tape, muted natural colors, shallow depth of field, no text, no logos, no labels, no
people."

The goods come from the brief. A2 and the empty states use no photo. Product thumbnails are
always the real product images.

## 9. Bans

- No dark mode, no theme picker, no third accent color, no green sidebar.
- No colored icon in a circle on a metric. No pie or donut chart. No shadow on a data card.
- No start-aligned amounts, no proportional order numbers. No status by color alone.
- No invented orders, products, customers, revenue, or trends. Sample rows only on request,
  with a "Sample" badge.
- No page spinner. No Google or Apple sign-in button.
- No `pl-`, `pr-`, `ml-`, `mr-`, `left-`, `right-`, `text-left`, `text-right`.

## 10. Self-check

1. The dark slab holds the centered search, and ⌘K opens it.
2. The till strip is one card with five real metrics, or real zeros on the first run.
3. Pills follow the three classes. A cancelled row is struck through.
4. Each rail step runs a real action.
5. Sign-in is A1 or A2. The first run is F1 or F2 with working setup steps.
6. Order numbers are mono. Amounts are tabular and end-aligned.
7. At 375 px, the page has no horizontal scroll. Arabic mirrors with no italics.
8. With reduced motion, no element animates.
