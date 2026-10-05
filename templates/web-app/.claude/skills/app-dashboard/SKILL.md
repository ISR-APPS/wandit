---
name: app-dashboard
description: Design system of the area behind sign-in of an app - a SaaS, a dashboard, a back office, a management tool, a CRM, or an internal tool. It explains the app recipe in your session instructions (theme, mode, sidebar, shell, density, cards, home, KPI and chart styles) and gives the data, table, state, and check rules. Load it before every screen behind login.
---

# App dashboard

The people who use this app work in it every day. It must look like a finished product, not a demo.
The recipe in your session instructions makes each app different. This file tells you how to apply it.

## Scope

- This skill applies to `/app` and its child routes. `CLAUDE.md` comes first.
  On these screens, this skill replaces `frontend-design` and the design worlds.
- Both (public pages and an app area): the app area keeps the world palette and fonts. Skip `theme`.
  Use mode=light when the world has no `.dark` block, and sidebar=tinted in place of inverse. Apply every other axis.

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

- The host picks the recipe from the project id. Do not replace it with your own taste.
- `theme` and `home` give three options in order (`a|b|c`). Take the first option that fits.
- Skip an option only for a fact. Theme: the business is on its avoid list, or the user names a clashing color
  or mood. Home: the data cannot fill its main block (see the Needs column).
- Taste is not a reason. "Safer" is not a reason.
- Every other axis gives one option. A kpi or chart style that the data cannot feed: use the fallback of its file.
- The first build writes line 1 of `src/styles/tokens.css`:
  `/* App recipe: theme=<id> mode=<id> sidebar=<id> shell=<id> density=<id> cards=<id> home=<id> kpi=<id> chart=<id> */`
- Later turns keep that line. Only a redesign reads the session recipe again.
- The user's words win, axis by axis:
  - "dark", "sombre", "nuit" give mode=dark. "light", "clair" give mode=light.
  - A brand color: keep the theme neutrals. Set `--primary`, `--ring`, `--sidebar-primary`, `--sidebar-ring`,
    and `--chart-1` in `:root` and `.dark`. Set `--primary-foreground` and `--sidebar-primary-foreground`
    near white or near black for 4.5:1. With sidebar=inverse, set `--sidebar-primary`, `--sidebar-primary-foreground`,
    and `--sidebar-ring` in `:root:not(.dark)` too, with their `.dark` values.
  - A named product style changes the theme and the mode only.
  - A named Google font replaces `--font-sans` or `--font-display`.
- A redesign that names no style takes the next theme of the session recipe and keeps the other axes.
  After the third theme, take the first again. Write the new theme id in line 1.
- The final answer names the look in plain words, never the ids.

| Theme | Family | Mood | Fits | Avoid |
|---|---|---|---|---|
| zinc-cobalt | cool | exact | software, B2B, logistics, finance | food, beauty, kids |
| linen-navy | cool | trusted, formal | finance, legal, insurance, consulting | kids, food, beauty |
| basalt-cyan | cool | cool, high-tech | IoT, monitoring, telecom, mobility | food, beauty, farming |
| slate-teal | green | calm, clinical | health, labs, energy, services | beauty, events |
| sand-forest | green | grounded | farming, outdoor, garden, wood | tech, events |
| clay-olive | green | earthy, artisanal | farms, crafts, cafes, interiors | tech, finance, health |
| graphite-lime | ink | technical, sharp | dev tools, monitoring, fitness, energy | health, beauty, food, kids |
| stone-rust | warm | warm, solid | industry, construction, workshops, real estate | health, beauty, kids |
| chalk-ochre | warm | sunny, practical | food, delivery, schools, retail | finance, health |
| oat-cocoa | warm | warm, cozy | cafes, bakeries, restaurants, hotels | industry, tech, health, finance |
| ivory-plum | berry | refined | beauty, fashion, wine, events | industry, tech, farming |
| ash-fuchsia | berry | vivid, social | salons, events, media | industry, finance, health, farming |

| Home | Needs |
|---|---|
| kpi-band | 3 or 4 numbers and one trend. It fits every app. |
| split | one strong trend and 4 numbers |
| bento | a trend, a breakdown, a ranked list, and recent events |
| main-rail | an attention list: late, blocked, or under a threshold |
| focus-queue | an entity with a status and a due date |
| status-board | 4 to 24 assets with a live status: machines, rooms, vehicles |
| briefing | items with a time today: appointments, shifts, deliveries |
| tabbed | 2 or more main entities, each with its own trend |

| Recipe part | Read, in `.claude/skills/app-dashboard/` |
|---|---|
| theme | `themes/<id>.md` |
| mode, sidebar, shell, density, cards | `frame.md`, section `### <axis>=<id>` |
| home | `homes/<id>.md` |
| kpi | `kpis/<id>.md` |
| chart | `charts/<id>.md` |
| data | `data.md` |
| list and detail pages | `tables.md` |

Read these seven files in ONE message, in parallel. Do not read other option files.
When a table can pass 1,000 rows, also read `tables-paging.md`.
Read with the Read tool, then write with Write or Edit. The hook blocks `cp` from `.claude/`.

## Order of work (first build)

1. Plan the kind (app, internal tool, public product) and the recipe line with your choices.
   Then plan the nav map (3 to 7 items, one level), the entities, and the event table of each chart.
2. The seven reads, in one message.
3. Data: one `apply_migration` for all tables, policies, and read functions (`data.md`).
   Then `src/features/overview/lib/series.ts` and `src/features/overview/api/overview.queries.ts`.
4. Tokens: the theme file, then the frame sections, then line 1.
5. Shell: the shell section of `frame.md`, then `src/features/app-shell/lib/nav-items.ts`.
6. Home, in `src/features/overview/`, one component per card:
   - The home file: `overview-page.tsx`, the cards of this home only, and `index.ts`.
   - The kpi file: `kpi-row.tsx`. The chart file: `trend-card.tsx` and `breakdown-card.tsx`.
   - Replace `src/routes/app/index.tsx` with the route of the home file. The home is the first nav item (`to: "/app"`).
7. One list page and one detail or form page per main entity (`tables.md`).
8. The public page or the redirect.
9. The checklist below.

## Shell and navigation

- Use the parts of `~/shared/ui/sidebar`. Do not rewrite that file.
- 3 to 7 items, one level, no sub-menus. The home comes first.
- Each item opens a real route under `/app`. `to` has the route type, so a wrong path fails typecheck.
- Each icon comes from `~/shared/ui/icons` and names the thing. Add a missing one there as a Lucide path.
  A directional icon gets `rtl:rotate-180`.
- Profile stays the last item. Sign-out stays in the user menu.
- The app header and the login page already render `<LocaleSwitcher />`. Keep it in both.
  It renders nothing for one language. In shell=topbar it sits before the user menu.
- `SidebarMenuBadge` shows only a real count.
- Each page starts with `PageHeader` from `~/features/app-shell`. The home file gives the home header.
- Inside the sidebar, use only sidebar tokens.

## Quality bar

- Numbers:
  - `tabular-nums` on every number. KPI values use `font-display`.
  - Format with `Intl` and the `locale` of `useT()`. A unit or a currency comes only from the data or the user.
  - A delta compares with the same length of time just before. It has a sign, an arrow icon, and a color.
  - `goodWhen: "down"` for costs, delays, scrap, downtime, late items. No previous data: no delta.
  - A signed number gets `dir="ltr"` on its element, so the sign stays in front in Arabic.
  - Name the period once, not under every KPI.
- Charts:
  - `ChartContainer`, `ChartTooltip`, `ChartTooltipContent` from `~/shared/ui/chart`.
    Colors only `var(--chart-1)` to `var(--chart-5)`, in the `ChartConfig`.
  - `<CartesianGrid vertical={false} />`. Axes: `tickLine={false} axisLine={false} tickMargin={8}`.
    A Y axis on the main chart only, with compact `Intl` numbers. A tooltip on every chart, with `cursor={false}`.
  - Lines are `monotone`, with no dots and `strokeWidth={2}`.
  - Heights: main `h-64` to `h-72`, side `h-52`, mini `h-14`. At most 5 series.
  - A breakdown has 2 to 5 parts plus Other. Bar radius 0 when `--radius` is 0, else 4.
  - Arabic (`dir` is `rtl`): `reversed` on the time XAxis and `orientation="right"` on the YAxis.
    Give the chart a margin on that side, so the ticks do not touch the plot.
  - A period control (7, 30, 90 days) changes the query key.
  - `role="img"` and an `aria-label` with the last value and its change.
- Tables: `DataTable`. Numbers at the end. A status is a `Badge` (`success`, `warning`, `info`,
  `destructive`, `secondary`) plus a word.
- Layout:
  - Keep the spans of the home file. The cards of one row have equal heights.
    Use `@container/main` queries (`@xl/main:`), not window breakpoints.
  - A page grid has `grid-cols-1` at the base size, so a wide table cannot widen the page.
  - At 375 px: KPI grids have 1 or 2 columns, charts stay `h-52` or taller, tables scroll in their card.
- Hierarchy:
  - One h1 per page. Card titles use `text-sm font-medium`. Body text uses `text-sm`.
  - `primary` is only for the main action, the active nav item, and chart-1. Never a large primary background.
  - No hover style on a card that a user cannot click.

## States

- A route has a `pendingComponent` with Skeletons in the final shape.
- A route has an `errorComponent`: what failed, and Try again (`router.invalidate()`).
- A card whose query key changes after a click reads with `useQuery`, with its own Skeleton and error.
- The first visit (no rows yet) shows a setup card in place of the KPI band.
  It gives 2 to 4 real first actions ("Add your first machine").
- An empty card keeps its size. It shows one muted sentence and the action that fills it.
- Zero events in the period is real data. Show the zero.
- Never insert sample rows. Sample data only when the user asks: `run_sql_write` for the test account.

## Never

- A theme, color, or layout picker, or a light/dark switch, unless the user asks for it.
- A control that does nothing: a search, a bell, a date picker, an export, a filter.
- An upsell card, a Pro badge, a team switcher, a credits meter, invented people, lorem ipsum, invented numbers.
- A home made of copies of one card. The same comparison sentence under every KPI.
- Rainbow charts, a legend under every chart, vertical grid lines.
- Gradient washes, gradient text, glass blur, emoji icons, animation on page load.
- A landing page for an internal tool.

## Checklist before Done

1. Line 1 of `tokens.css` has the App recipe line. The theme is in `:root` and `.dark`. The fonts link is in `__root.tsx`.
2. The shell matches its section. Every nav item opens a real page. The mobile sheet closes on a nav click.
3. The home matches the home, kpi, and chart files, or their fallback.
4. Every chart reads an event table through a SQL function. A day with no event shows 0.
5. Every card has a loading, an empty, and an error state.
6. Every number uses `Intl` with the app locale, and `tabular-nums`.
7. No hardcoded color. No `left`, `right`, `pl`, `pr`, `ml`, or `mr` class.
8. 375 px works. Arabic works when the app has Arabic.
9. `/` exists. Every link points to a route that exists.
10. `pnpm run typecheck` and `pnpm run lint` pass.
