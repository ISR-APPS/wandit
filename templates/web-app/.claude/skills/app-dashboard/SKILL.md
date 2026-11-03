---
name: app-dashboard
description: Design system of the area behind sign-in of an app - a SaaS, a dashboard, a back office, a management tool, a CRM, or an internal tool. It explains the app recipe of your session instructions, the theme, the design brief, and the data, table, state, and check rules. Load it before every screen behind login.
---

# App dashboard

The people who use this app work in it every day. It must look like a finished product, not a demo.
The recipe in your session instructions makes each app different. This file tells you how to apply it.
The theme file gives the look, and the kit draws it. The home, kpi, and chart files give specs, not code.
Write new code for this app. data.md and tables.md give tested code: keep its logic.
Name features, tables, and messages after the user's business.

## Scope

- This skill applies to `/app` and its child routes. `CLAUDE.md` comes first.
  On these screens, the theme replaces the design worlds.
  The Design brief below applies the `frontend-design` method to this area.
- Both (public pages and an app area): one theme serves both areas. `CLAUDE.md` "Design" says how the host sets it.

## Public pages

- An internal tool: replace `src/routes/index.tsx` with the file below. Delete `src/features/landing/`,
  and the `landing` and `nav` groups of `messages.ts`. Keep `/login`.
- Keep the route `/`. The build crawls links from `/`. A redirect builds. A missing `/` breaks the publish.
- A public product: one short page at `/` in the app theme, with no world. It has a hero, three facts
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

The host derives the recipe from the project id. Do not replace it with your own choice. Its shape:
`home=<h1>|<h2>|<h3> kpi=<id> chart=<id>`

- `home` gives three options in order. Take the first option that fits.
  Skip an option only for a fact, never for taste: the tables and the user's words do not meet its Needs.
- No ranked home fits: follow the Fallback of the first ranked home, then the next Fallback, until a home fits.
  kpi-band ends every chain. The home table gives each Fallback, so the chain needs no other file.
- `kpi` and `chart` give one form each. A form that the data cannot feed: use the fallback of its file.
- Later turns keep the home, the kpi form, and the chart form. Only a redesign of the home picks again.

## The theme

- `src/styles/theme.json` gives the whole look: colors, fonts, corners, borders, shadows, the sidebar, and the header.
- The host writes it. The user picks a look from 3 cards, and can change it later in the builder with no turn.
- Never edit `src/styles/theme.json`, `theme.ts`, `theme-options.ts`, or `engine.css`. Never change them with a script.
- Build every screen with the kit parts and the token classes only. The kit draws the theme.
- Rounded cards with a soft shadow are good. Every panel keeps the `Card` look of the kit.
- Never write a color, a fixed corner, a thick border, a fixed shadow, a font, or a letter spacing in a page.
- No capital titles or labels, and no ink bands (a dark fill in the text color).
- The user asks for another look in words: one `mcp__harness-tools__set_theme` call with only the changed fields.
  `CLAUDE.md` "Design" gives the fields. Never change the look in the code of a page.
- The final answer names the look in plain words: the name in "Theme set: <name>" of the tool result or the answer.

## Homes

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
| home | `homes/<id>.md` |
| kpi | `kpis/<id>.md` |
| chart | `charts/<id>.md` |
| data | `data.md` |
| list and detail pages | `tables.md` |

Choose the home from the table first. Then read these five files in ONE message, in parallel.
Do not read other option files. When a table can pass 1,000 rows, also read `tables-paging.md`.
Read with the Read tool, then write with Write or Edit. The hook blocks `cp` from `.claude/`.

## Design brief

Write the brief in the plan, before any code. Keep each part short.

1. Subject: the business, its users, their daily job, and the vernacular of the trade:
   the objects, the materials, the words.
2. Look: the theme name (`name` in `src/styles/theme.json`). Do not plan colors or fonts: the theme gives them.
3. Home sketch: ASCII of the home at lg. Name the data of each slot.

## Order of work (first build)

1. Plan the kind (app, internal tool, public product, or Both) and the recipe line with your choices.
2. Theme: the host wrote it after the theme question (`CLAUDE.md` "Design"). Write its name in the plan.
3. Write the design brief. Then plan the nav map (3 to 7 items, one level), the entities, and the event table of each chart.
4. The five reads, in one message.
5. Data: one `apply_migration` for all tables, policies, and read functions (`data.md`).
   Then `src/features/overview/lib/series.ts` and `src/features/overview/api/overview.queries.ts`.
6. Shell: only `src/features/app-shell/lib/nav-items.ts`. The kit renders the shell, the nav, and the header.
7. Home, in `src/features/overview/`:
   - `overview-page.tsx` places the slots of the home file. Each panel is one component, named after its data.
   - Draw the page header, the panels, the KPIs, the charts, and the tables with the kit and the role utilities.
     The kpi and chart files give the parts and the rules.
   - Replace `src/routes/app/index.tsx` with the home route. It is a thin file with a loader, a `pendingComponent`,
     and an `errorComponent`, like the list route of `tables.md`. Add `src/features/overview/index.ts`.
     The home is the first nav item (`to: "/app"`).
8. One list page and one detail or form page per main entity (`tables.md`).
9. The public page or the redirect.
10. The checklist below.

## Shell and navigation

- `AppShell` renders the shell of the theme: the sidebar style, the collapse mode, the nav color, the active item,
  the header, and the place of the user menu. Do not edit its files or `~/shared/ui/sidebar` for the look.
- Write the nav map in `src/features/app-shell/lib/nav-items.ts`. The sidebar reads `NAV_ITEMS`.
- 3 to 7 items, one level, no sub-menus. The home comes first. Profile stays the last item.
  Keep each label to one or two short words: the rail mode shows each label under its icon.
- Each item opens a real route under `/app`. `to` has the route type, so a wrong path fails typecheck.
- Below 48rem, the sidebar opens in a Sheet. A nav click closes it. Sign-out stays in the user menu.
- The shell and the login page render `<LocaleSwitcher />`. Keep it in both. It renders nothing for one language.
- Each page starts with `PageHeader` from `~/features/app-shell`.
  The home can draw its own header when the home file asks for it.

## Icons

- Import nav and page icons from `@phosphor-icons/react`, with the `Icon` suffix (`StorefrontIcon`).
  The name without the suffix is deprecated.
- Kit pieces come from `~/shared/ui/icons`: the carets, close, search, check, and sign-out.
- Never set `weight` on an icon. The theme sets the weight of every icon.
  The only exception is `weight="fill"` for an on state: a filled star of a rating, a filled heart of a favorite.
  Write the off state as `weight={isFavorite ? "fill" : undefined}`, so it keeps the theme weight.
  Also mark the on state with a color: `text-primary` when on, `text-muted-foreground` when off.
  A theme weight of `fill` fills the off state too, so the color is the only difference then.
- Use no other icon package and draw no SVG icon.
- Never use the SSR icons (`@phosphor-icons/react/ssr`, the `SSR` namespace), and never add an `IconContext` provider: both hide the theme weight.
  `pnpm run typecheck` fails on these, on another icon package, and on a weight other than `fill`.
- The root hides every icon from screen readers (`aria-hidden`).
  An icon that carries meaning alone gets `role="img"`, `aria-label`, and `aria-hidden={false}`. `alt` alone stays hidden.
- Do not draw a tile, a ground, or a color behind a nav icon. The theme draws it.
- Name the icon after the business object. Never `SquaresFourIcon` for the home by reflex.
  The home icon names what the business watches: a storefront, a calendar, a gauge, a ticket.
- Type a map of icons with `KitIcon` from `~/shared/ui/icons`.
- A directional icon gets `rtl:rotate-180`. A trend arrow mirrors with `rtl:-scale-x-100`.

The kpi files and tables.md use these names. Import them so:

- `import { TrendDownIcon, TrendUpIcon } from "@phosphor-icons/react";`
- `import { DotsThreeIcon } from "@phosphor-icons/react";`

## Quality bar

- Numbers:
  - `tabular-nums` on every number. KPI values use `font-numeric`, the numeral face of the theme.
  - Format with `Intl` and the `locale` of `useT()`. A unit or a currency comes only from the data or the user.
  - A delta compares with the same length of time just before. It has a sign (`signDisplay: "exceptZero"`),
    an arrow icon, and a color. A trend arrow mirrors with `rtl:-scale-x-100`, not `rtl:rotate-180`.
  - `goodWhen: "down"` for costs, delays, scrap, downtime, late items. No previous data: no delta, never "0%".
  - A signed number sits in `<bdi dir="ltr">`, so the sign stays in front in Arabic.
  - Name the period once, not under every KPI.
- Surfaces and colors:
  - A panel is a `Card`: the theme draws its border, corners, and shadow.
  - Other page parts use the role utilities: `rounded-surface`, `shadow-surface`, `rounded-control`,
    `rounded-field`, `bg-canvas`, `label-text` (small labels), and `font-numeric` (figures).
  - Colors come only from the semantic tokens: `background`, `foreground`, `card`, `muted`, `primary`, `secondary`,
    `accent`, `destructive`, `border`, `success`, `warning`, `info`, `chart-1` to `chart-5`, and `canvas`.
  - Never a Tailwind palette color (`bg-blue-500`), `black`, `white`, a raw color (`#`, `rgb(`, `oklch(`),
    or `shadow-sm`, `shadow-md`, `shadow-lg`. `pnpm run typecheck` runs `scripts/check-theme.mjs`. It fails on them.
  - check-theme also fails on `uppercase`, `tracking-wide`, `rounded-none`, `rounded-[...]`, `border-2` and wider,
    `font-[...]`, `bg-foreground`, `bg-contrast`, `text-background`, and a `bg-` class on `CardHeader`.
  - Body text, links, and figures never use `text-primary`: a light accent fails 4.5:1 on the page.
    On a `bg-primary` fill, text uses `text-primary-foreground`.
- Charts:
  - `ChartContainer`, `ChartTooltip`, `ChartTooltipContent` from `~/shared/ui/chart`.
    Colors only `var(--chart-1)` to `var(--chart-5)`, in the `ChartConfig`.
  - The chart file gives the curve, the grid, the axes, and the fill.
    `ChartContainer` sets the line width and the fill opacity.
  - A Y axis on the main chart only, with compact `Intl` numbers. A tooltip on every chart.
  - Heights by role: main `h-56` to `h-80`, side `h-44` to `h-56`, mini `h-10` to `h-16`.
    A home file can set the height of its slot. The home file wins.
  - At most 5 series.
  - A breakdown has 2 to 5 parts plus Other. Bars are square on radius=none.
  - Arabic (`dir` is `rtl`): `reversed` on the time XAxis and `orientation="right"` on the YAxis.
    Give the chart a margin on that side, so the ticks do not touch the plot.
  - A period control (7, 30, 90 days) changes the query key.
  - `role="img"` and an `aria-label` with the last value and its change.
- Tables: `DataTable`. Numbers at the end. A status is a word plus a color, never a color alone.
  Use a `Badge` (`success`, `warning`, `info`, `destructive`, `secondary`).
- Layout:
  - Keep the spans of the home file. The panels of one row have equal heights.
    Use `@container/main` queries (`@xl/main:`), not window breakpoints.
  - A page grid has `grid-cols-1` at the base size, so a wide table cannot widen the page.
  - At 375 px: number grids have 1 or 2 columns, charts keep the heights above, tables scroll in their panel.
- Hierarchy:
  - One h1 per page. Body text uses `text-sm`. Panel titles use `CardTitle`.
  - `primary` marks the main action, the active nav item, and chart-1. Never fill a large area with it.
  - Text keeps 4.5:1 on its surface. A tint that you add keeps it too.
  - No hover style on a panel that a user cannot click.

## States

- A route has a `pendingComponent` with Skeletons in the final shape.
- A route has an `errorComponent`: what failed, and Try again (`router.invalidate()`).
- A panel whose query key changes after a click reads with `useQuery`, with its own Skeleton and error.
- The first visit (no rows yet) keeps the home. Every panel stays in place, drawn with the kit.
  It shows real zeros and empty frames (the Empty state of the home file).
  A slim setup strip gives 2 to 4 real first actions. Never replace the home with one setup card.
- An empty frame is the panel at its full size: its title, its head (the table head, the axis, the slots),
  one muted sentence, and the action that fills it.
- Zero events in the period is real data. Show the zero.
- Never insert sample rows. Sample data only when the user asks: `run_sql_write` for the test account.

## Never

- A theme, color, or layout picker, or a light/dark switch, unless the user asks for it.
- A change to the theme files, or CSS in `tokens.css` that sets a theme token.
- A control that does nothing: a search, a bell, a date picker, an export, a filter.
- An upsell card, a Pro badge, a team switcher, a credits meter, invented people, lorem ipsum, invented numbers.
- A home made of copies of one panel. The same comparison sentence under every KPI.
- Capital labels, wide letter spacing, or ink bands.
- A feature named after the skill example (work orders, factory, machines) when the business has no such thing.
- Rainbow charts, a legend under every chart.
- Gradient washes, gradient text, glass blur on a panel, emoji icons, animation on page load.
- A landing page for an internal tool.

## Checklist before Done

1. The theme name is in the plan. You did not edit `src/styles/theme.json`, `theme.ts`, `theme-options.ts`, or `engine.css`.
   A change to `theme.json` from `set_theme` or the theme question comes from the host, and it is correct.
2. check-theme passes in `pnpm run typecheck`.
3. The design brief is in the plan.
4. The home matches its spec, not a KPI row of equal cards unless home=kpi-band.
   The KPIs and the charts match their form files, or their fallback.
5. The shell comes from `AppShell`. Every nav item opens a real page.
6. Every chart reads an event table through a SQL function. A day with no event shows 0.
7. Every panel has a loading, an empty, and an error state. The first visit keeps every panel in place.
8. Every number uses `Intl` with the app locale, and `tabular-nums`.
9. No hardcoded color. No `left`, `right`, `pl`, `pr`, `ml`, or `mr` class.
10. 375 px works. Arabic works when the app has Arabic.
11. `/` exists. Every link points to a route that exists.
12. `pnpm run typecheck` and `pnpm run lint` pass.
