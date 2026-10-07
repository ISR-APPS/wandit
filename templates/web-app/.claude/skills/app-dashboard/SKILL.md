---
name: app-dashboard
description: Design system of the area behind sign-in of an app - a SaaS, a dashboard, a back office, a management tool, a CRM, or an internal tool. It explains the app recipe of your session instructions, the design brief, and the data, table, state, and check rules. Load it before every screen behind login.
---

# App dashboard

The people who use this app work in it every day. It must look like a finished product, not a demo.
The recipe in your session instructions makes each app different. This file tells you how to apply it.
The style, home, kpi, and chart files give specs, not code. Write new code for this app.
Only the token blocks of the style file (fonts, palette, accents, knobs) go in as they are.
frame.md, data.md, and tables.md give tested code: keep its logic.
Name features, tables, and messages after the user's business.

## Scope

- This skill applies to `/app` and its child routes. `CLAUDE.md` comes first.
  On these screens, the style of the recipe replaces the design worlds.
  The Design brief below applies the `frontend-design` method to this area.
- Both (public pages and an app area): the app area keeps the world palette and fonts.
  Skip the palette, the accent, and the fonts of the style. The world gives the mode:
  mode=light when the world has no `.dark` block. Skip a style whose Mode line does not allow the world scheme.
  A dark world `--background` needs a style that allows dark. A light one needs a style that allows light.
  Take the knobs, the Anatomy, and the Signature from the style.

## Public pages

- An internal tool: replace `src/routes/index.tsx` with the file below. Delete `src/features/landing/`,
  and the `landing` and `nav` groups of `messages.ts`. Keep `/login`.
- Keep the route `/`. The build crawls links from `/`. A redirect builds. A missing `/` breaks the publish.
- A public product: one short page at `/` in the app style, with no world. It has a hero, three facts
  from the brief, and a footer. The hero has the product sentence and the sign-up action.
  Load `frontend-design` for this page only. Put no chart on it: it renders on the server.

### File: src/routes/index.tsx (internal tool)

```tsx
// The / route of an internal tool. It has no page: it sends every visitor to the app area.
// The /app layout then sends a signed-out visitor to /login.
import { createFileRoute, redirect } from "@tanstack/react-router";

/** The route stays: the build crawls from /. */
export const Route = createFileRoute("/")({
	beforeLoad: () => {
		throw redirect({ to: "/app" });
	},
});
```

## The recipe

The host picks the recipe from the project id. Do not replace it with your own choice. Its shape:
`style=<s1>|<s2>|<s3> accent=<1-3> fonts=<1-2> mode=<light|dark> shell=<id> density=<id> home=<h1>|<h2>|<h3> kpi=<id> chart=<id>`

- `style` and `home` give three options in order. Take the first option that fits.
- Skip an option only for a fact, never for taste. Style: the business is on its Avoid list, the user names
  a clashing color or mood, or its mode cannot match. Home: the tables and the user's words do not meet its Needs.
- No ranked style fits: take the first style of the table that fits.
- No ranked home fits: follow the Fallback of the first ranked home, then the next Fallback, until a home fits.
  kpi-band ends every chain. The home table gives each Fallback, so the chain needs no other file.
- `accent` and `fonts` pick a row inside the chosen style file.
- `mode` applies only to a style that allows light or dark. A style with one mode uses that mode.
- `shell` and `density` apply, unless the style file fixes them (`Shell: topbar (fixed)`).
- `kpi` and `chart` give one form each. A form that the data cannot feed: use the fallback of its file.
- The first build writes line 1 of `src/styles/tokens.css`, with the values that you apply:
  `/* App recipe: style=<id> accent=<n> fonts=<n> mode=<id> shell=<id> density=<id> home=<id> kpi=<id> chart=<id> */`
- Later turns keep that line. Only a redesign reads the session recipe again.
- The user's words win, axis by axis:
  - "dark", "sombre", "nuit" give mode=dark. Keep the style when it allows dark. Else take the next
    ranked style that does, or else the first style of the table that does and fits. "light", "clair": the same.
  - A brand color is the accent. In each palette block, set `--primary`, `--ring`, `--sidebar-primary`,
    `--sidebar-ring`, and `--chart-1`. Set `--primary-foreground` and `--sidebar-primary-foreground`
    near white or near black for 4.5:1.
  - A named product look: take the style whose look line is the closest.
  - A named Google font replaces `--font-display` or `--font-sans`. Load it in the same fonts link.
- A redesign that names no look takes the next style of the session recipe that fits.
  Keep the accent and fonts indexes and the other axes. After the third style, take the first again.
  The new style replaces the fonts, the palette, the accent, and the knobs. Redraw the panels with its Anatomy.
- The final answer names the look in plain words, never the ids.

| Style | Look | Mode | Fits | Avoid |
|---|---|---|---|---|
| livre | accounting ledger on cool paper, ruled, no boxes | light | finance, invoicing, legal, wholesale, property, back offices | kids, nightlife, games, fitness |
| regie | night control room, tiled status wall, condensed figures | dark | logistics, dispatch, field service, fleet, security, monitoring, manufacturing | beauty, kids, wellness, weddings |
| cadran | precision instrument, thin dials, ruler ticks, light mono figures | light or dark | SaaS metrics, analytics, energy, labs, engineering, IoT | kids, food, beauty |
| tampon | sticker board, ink borders, hard shadows, flat colors | light | creators, shops, marketing, events, startups, studios, delivery | clinic, legal, funeral, banking |
| brume | calm morning mist, soft tonal fields, serif figures | light | wellness, beauty, therapy, coaching, hospitality, HR, education | industry, dev tools, logistics, security |
| console | terminal console, ruled sections, mono figures, key hints | dark | dev tools, APIs, IT, infra, data ops, security, AI ops | beauty, kids, food, wellness |
| porcelaine | calm clinic, outline panels, tinted headers, range bands | light | health, clinics, dental, vets, labs, pharmacy, care homes, services | nightlife, gaming |
| suisse | Swiss poster grid, no boxes, giant numerals, color block | light | agencies, media, retail, architecture, sports clubs, any business | funeral, clinic |
| coffre | vault after hours, steel panels, glowing end dots | dark | finance, wealth, real estate, luxury, legal, hotels, investors | kids, food trucks, schools |
| preau | bright schoolyard, chunky rounded panels, colored stickers | light | schools, tutoring, kids, sports clubs, camps, pets, family services | legal, banking, funeral |
| etabli | product workbench, grouped rows, status circles, hairlines | light or dark | project tracking, agencies, tasks, support, recruiting, CRM, content | kids, food, beauty |
| comptoir | shop counter, perforated order slips, receipt figures | light | shops, orders, COD, inventory, restaurants, repairs, rentals | clinic, therapy, legal |
| serre | greenhouse, sage ground, leaf corners, deep green sidebar | light | farms, gardens, food producers, cafes, eco, wellness, real estate | dev tools, nightlife, security |
| coulisses | backstage at night, ticket stubs, vivid gradient marks | dark | events, venues, music, media, nightlife, ticketing, creators, gaming | clinic, finance, legal, B2B industry |
| carnet | appointment book, date blocks, now line, aubergine sidebar | light | salons, studios, classes, rentals, coaching, front desks, bookings | dev tools, industry |
| brigade | kitchen ticket wall, ink bands, condensed capitals, timers | light | restaurants, kitchens, workshops, repair shops, print shops, warehouses, construction | clinic, legal, luxury |

Judge the Needs on the tables and the user's words, never on rows. The first build has no rows.

| Home | Needs | Fallback |
|---|---|---|
| kpi-band | 3 or 4 strong figures and one daily series. Almost every app has them. | none: every chain ends here |
| split | the daily series that the business lives by, 4 figures around it, and a category for one breakdown | kpi-band |
| bento | a main entity with a status and an amount or a quantity to rank by, and an event table for the series and the breakdown | split |
| main-rail | a main entity with an attention rule: a due date, a blocked status, or a minimum quantity | split |
| focus-queue | an entity with a status and a due date that the team works through each day: tickets, jobs, orders to ship | board |
| status-board | 4 to 24 assets with a live status and one live number each: machines, rooms, vehicles, devices | focus-queue |
| briefing | a main entity with a time of day (a start or a due time): appointments, shifts, deliveries, classes | digest |
| tabbed | 2 to 4 main entities, each with its own event table for a daily series | bento |
| ledger | a main entity with an amount or a quantity column, and 3 to 5 totals of it: invoices, orders, payments, stock | kpi-band |
| board | an entity with 3 to 6 status values in order, at most a few hundred open rows: deals, jobs, tickets | ledger |
| hero | one flow with a daily event table that the business lives by: revenue, orders, visits, check-ins | kpi-band |
| digest | 2 or 3 topics: the main activity (events), the work to do (an entity with a status), and an optional second entity with events | hero |

| Recipe part | Read, in `.claude/skills/app-dashboard/` |
|---|---|
| style (accent, fonts, mode policy, look) | `styles/<id>.md` |
| mode, shell, density | `frame.md`, section `### <axis>=<id>` |
| home | `homes/<id>.md` |
| kpi | `kpis/<id>.md` |
| chart | `charts/<id>.md` |
| data | `data.md` |
| list and detail pages | `tables.md` |

Choose the style and the home from the tables first. Then read these seven files in ONE message, in parallel.
Do not read other option files. When a table can pass 1,000 rows, also read `tables-paging.md`.
Read with the Read tool, then write with Write or Edit. The hook blocks `cp` from `.claude/`.

## Design brief

Write the brief in the plan, before any code. Keep each part short.

1. Subject: the business, its users, their daily job, and the vernacular of the trade:
   the objects, the materials, the words.
2. Style: the id, the accent, the fonts, the mode, and one line on how the style meets this business.
3. Signature: one element from the Signature section of the style, bound to real data of this business.
   Spend boldness there. Keep the rest quiet.
4. Home sketch: ASCII of the home at lg. Name the data of each slot.
5. Default check: write in one line what a generic dashboard does here. That is four equal KPI cards,
   an area chart, a recent table, and identical rounded cards with one soft shadow.
   Name each place where the plan matches it. Change that place, unless the home or the style file asks for it.

## Order of work (first build)

1. Plan the kind (app, internal tool, public product), the recipe line with your choices, and the design brief.
   Then plan the nav map (3 to 7 items, one level), the entities, and the event table of each chart.
2. The seven reads, in one message.
3. Data: one `apply_migration` for all tables, policies, and read functions (`data.md`).
   Then `src/features/overview/lib/series.ts` and `src/features/overview/api/overview.queries.ts`.
4. Tokens, from the style file. Keep every token name and the derived part of `tokens.css`.
   - Fonts (`### fonts=<n>`): in `head().links` of `src/routes/__root.tsx`, keep the `tokensCss` entry first.
     Replace the font comment, the `preconnect` entry, and every Fontshare or Google Fonts entry with its one link.
     In `tokens.css`, replace the comment above `@theme` and the `@theme` font block with its blocks.
     Also replace the font `html:lang(ar)` block of Part 1 with its block. Keep the knob reset `html:lang(ar)` block of Part 2.
     Delete every font rule of an earlier style: `font-synthesis-weight` and `font-stretch` rules.
     Update the font note of the header comment.
   - Palette: the Light block replaces `:root`. The Dark block replaces `.dark`. A style with one mode
     leaves the other block as it is.
   - Accent: the palette blocks hold accent=1. For another accent, set the tokens of its row in each block.
     Set `--sidebar-ring` like `--ring`. When the block sets `--chart-1` to the old primary, set the new one.
   - Knobs: put the Knobs block after the palette blocks. It replaces the knobs block of an earlier style.
     The kit reads the knobs. Do not edit a kit file in `src/shared/ui/` for what a knob does.
   - Then the mode and density sections of `frame.md`, then line 1.
5. Shell: the shell section of `frame.md`, then `src/features/app-shell/lib/nav-items.ts`.
6. Home, in `src/features/overview/`:
   - `overview-page.tsx` places the slots of the home file. Each panel is one component, named after its data.
   - Draw the page header, the panels, the KPIs, the charts, and the tables with the style Anatomy.
     The kpi and chart files give the parts and the rules. The style gives sizes, fonts, strokes, and surfaces.
     Put the signature of the brief on the home.
   - Replace `src/routes/app/index.tsx` with the home route. It is a thin file with a loader, a `pendingComponent`,
     and an `errorComponent`, like the list route of `tables.md`. Add `src/features/overview/index.ts`.
     The home is the first nav item (`to: "/app"`).
7. One list page and one detail or form page per main entity (`tables.md`), drawn with the style Anatomy.
8. The public page or the redirect.
9. The checklist below.

## Shell and navigation

- Use the parts of `~/shared/ui/sidebar`. Do not rewrite that file.
- 3 to 7 items, one level, no sub-menus. The home comes first.
- Each item opens a real route under `/app`. `to` has the route type, so a wrong path fails typecheck.
- Each icon comes from `lucide-react` and names the thing, for example `ClipboardListIcon`. Import it by name
  with the `Icon` suffix. Do not draw an SVG icon. A directional icon gets `rtl:rotate-180`.
- Profile stays the last item. Sign-out stays in the user menu.
- The app header and the login page already render `<LocaleSwitcher />`. Keep it in both.
  It renders nothing for one language. In shell=topbar it sits before the user menu.
- `SidebarMenuBadge` shows only a real count.
- Each page starts with `PageHeader` from `~/features/app-shell`. The home can draw the page header of the style Anatomy.
- The style Anatomy gives the sidebar look, the active item, and the brand mark.
  Inside the sidebar, use only sidebar tokens.

## Quality bar

- Numbers:
  - `tabular-nums` on every number. KPI values use `font-numeric`, the numeral face of the style.
  - Format with `Intl` and the `locale` of `useT()`. A unit or a currency comes only from the data or the user.
  - A delta compares with the same length of time just before. It has a sign (`signDisplay: "exceptZero"`),
    an arrow icon, and a color. A trend arrow mirrors with `rtl:-scale-x-100`, not `rtl:rotate-180`.
  - `goodWhen: "down"` for costs, delays, scrap, downtime, late items. No previous data: no delta, never "0%".
  - A signed number sits in `<bdi dir="ltr">`, so the sign stays in front in Arabic.
  - Name the period once, not under every KPI.
- Charts:
  - `ChartContainer`, `ChartTooltip`, `ChartTooltipContent` from `~/shared/ui/chart`.
    Colors only `var(--chart-1)` to `var(--chart-5)`, in the `ChartConfig`.
  - The style gives the curve, the grid, the axes, and the fill. The knobs give the stroke and the fill opacity.
    With no style rule: `<CartesianGrid vertical={false} />` and axes with `tickLine={false} axisLine={false}`.
  - A Y axis on the main chart only, with compact `Intl` numbers. A tooltip on every chart.
  - Heights by role: main `h-56` to `h-80`, side `h-44` to `h-56`, mini `h-10` to `h-16`.
    A home file can set the height of its slot. The home file wins.
    Next come the Heights of the style Anatomy. These role ranges come last.
  - At most 5 series.
  - A breakdown has 2 to 5 parts plus Other. Bars are square when the style radius is 0.
  - Arabic (`dir` is `rtl`): `reversed` on the time XAxis and `orientation="right"` on the YAxis.
    Give the chart a margin on that side, so the ticks do not touch the plot.
  - A period control (7, 30, 90 days) changes the query key.
  - `role="img"` and an `aria-label` with the last value and its change.
- Tables: `DataTable`. Numbers at the end. A status is a word plus a color, never a color alone.
  Use a `Badge` (`success`, `warning`, `info`, `destructive`, `secondary`) or the status mark of the style.
- Layout:
  - Keep the spans of the home file. The panels of one row have equal heights.
    Use `@container/main` queries (`@xl/main:`), not window breakpoints.
  - A page grid has `grid-cols-1` at the base size, so a wide table cannot widen the page.
  - At 375 px: number grids have 1 or 2 columns, charts keep the heights above, tables scroll in their panel.
- Hierarchy:
  - One h1 per page. Body text uses `text-sm`. Panel titles follow the style Anatomy.
  - `primary` marks the main action, the active nav item, and chart-1. A large primary area needs a style rule.
  - Text keeps 4.5:1 on its surface. A brand color or a tint that you add keeps it too.
  - No hover style on a panel that a user cannot click.

## States

- A route has a `pendingComponent` with Skeletons in the final shape.
- A route has an `errorComponent`: what failed, and Try again (`router.invalidate()`).
- A panel whose query key changes after a click reads with `useQuery`, with its own Skeleton and error.
- The first visit (no rows yet) keeps the home. Every panel stays in place, drawn in the style.
  It shows real zeros and empty frames (the Empty state of the style and of the home file).
  A slim setup strip gives 2 to 4 real first actions. Never replace the home with one setup card.
- An empty panel keeps its size. It shows its empty frame, one muted sentence, and the action that fills it.
- Zero events in the period is real data. Show the zero.
- Never insert sample rows. Sample data only when the user asks: `run_sql_write` for the test account.

## Never

A style file can allow an item of this list that it names.

- A theme, color, or layout picker, or a light/dark switch, unless the user asks for it.
- A control that does nothing: a search, a bell, a date picker, an export, a filter.
- An upsell card, a Pro badge, a team switcher, a credits meter, invented people, lorem ipsum, invented numbers.
- A home made of copies of one panel. The same comparison sentence under every KPI.
- The SaaS-card kit: identical rounded cards with one soft shadow everywhere.
- Caps eyebrow labels over every heading.
- A feature named after the skill example (work orders, factory, machines) when the business has no such thing.
- Rainbow charts, a legend under every chart.
- Gradient washes, gradient text, glass blur, emoji icons, animation on page load.
- A landing page for an internal tool.

## Checklist before Done

1. Line 1 of `tokens.css` has the App recipe line with style, accent, and fonts.
2. The tokens hold the style palette, the accent, the fonts, and all 21 knobs. The fonts link is in `__root.tsx`.
   Both: the world palette and fonts stay, and the knobs come from the style.
3. The design brief is in the plan. The signature of the style is on the home, bound to real data.
4. The home matches its spec, not a KPI row of equal cards unless home=kpi-band.
   The KPIs and the charts match their form files, or their fallback.
5. The shell matches its section. Every nav item opens a real page. The mobile sheet closes on a nav click.
6. Every chart reads an event table through a SQL function. A day with no event shows 0.
7. Every panel has a loading, an empty, and an error state. The first visit keeps every panel in place.
8. Every number uses `Intl` with the app locale, and `tabular-nums`.
9. No hardcoded color. No `left`, `right`, `pl`, `pr`, `ml`, or `mr` class.
10. 375 px works. Arabic works when the app has Arabic.
11. `/` exists. Every link points to a route that exists.
12. `pnpm run typecheck` and `pnpm run lint` pass.
