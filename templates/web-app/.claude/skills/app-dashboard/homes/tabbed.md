# Home tabbed
Page tabs in the header. The overview tab gives one wide row per entity on one time axis; each other tab belongs to one entity.

## Needs

- Judge these needs on the tables and the user's words, never on rows. The first build has no rows.
- 2 to 4 main entities, each with its own event table for a daily series. One page would be too long for all of them.
- Examples: a school (students: enrollments per day; fees: payments per day). A rental agency
  (leases: leases signed per day; repairs: requests per day).
- Fallback: bento. The app has one main entity, or only one entity has an event table.

## Silhouette

```text
lg (main 56rem or wider)                     375 px
Overview  [Overview][Students 412][Fees 9]   Overview
                                [7|30|90]    [Overview][Stu>
+---------------------------------------+    [7|30|90]
| Students  412  +3%  ~~~~~~~~~~~~~~~ > |    +-----------+
+---------------------------------------+    | Students  |
| Fees      9 due     ~~~~~~~~~~~~~~~ > |    | 412  +3%  |
+-------------------+-------------------+    | ~~~~~~~~~ |
| Breakdown 1/2     | Figures 1/2       |    +-----------+
|                   | Label ....... 42  |    | Fees ...  |
+-------------------+-------------------+    | Breakdown |
Tab "students":                              | Figures   |
+-------------------+-------------------+    +-----------+
| Students per day  | Newest students   |
+-------------------+-------------------+
```

## Slots

| Slot | Data kind | Form |
|---|---|---|
| Tabs | Overview first, then one tab per entity. | The `TabsList` in the PageHeader actions. An entity tab shows the count of its rows, or of its open rows when it has a status. |
| Entity row (overview, one per entity) | The headline `KpiItem` of the entity, and its daily series over the shared period. | A wide row: the entity name, the value and delta of the kpi form, and a link to its tab. Between them: a mini chart, the trend part of the chart file at mini height, no axes. |
| Breakdown (overview) | `breakdownQueryOptions(days)`. The page translates the codes. | The breakdown part of the chart file. |
| Figures (overview) | The `KpiItem` rows that no entity row shows, at most 3. | The kpi form as a ruled list. No row left: the breakdown spans the full width. |
| Entity trend (entity tab) | The daily series of that entity. | The trend part of the chart file, main height (h-64 to h-72). |
| Entity rows (entity tab) | The newest 8 rows of that entity's list query. | A table: the name cell with two lines, the status Badge, and the relative time. |

## Behavior

- The URL keeps the open tab, so a reload or a shared link opens the same tab:

```ts
// ?tab= of /app. A missing or unknown tab opens the overview, so an old shared link still works.
// Name the ids after the entities of the app.
export const overviewTabSchema = z.enum(["overview", "students", "fees"]);

export const overviewSearchSchema = z.object({
	tab: overviewTabSchema.default("overview").catch("overview"),
});
// Route: validateSearch: overviewSearchSchema. Page: Route.useSearch(), and navigate({ search: { tab } }).
```

- Each entity needs its own daily read function (data.md, section 3). Its query options go in `overview.queries.ts`,
  in the shape of `dailySeriesQueryOptions(days)`. The first entity can use that function.
- Period: one control (7, 30, 90 days) at the top of the tab content, at the end side. One `days` state serves every tab.
- The page sets `DEFAULT_DAYS` to 30.
- chart=heat: the mini chart of an entity row is the strip of heat.md.
  The entity trend follows heat.md: 7 days give the strip, 30 or 90 days give the calendar.
- Each entity tab names the `id` of its headline `KpiItem` in the tab list of the page.
- An entity row links to its tab: `<Link to="/app" search={{ tab: "students" }}>`.
- Links: an entity table row opens `/app/<entity>/$id`. "See all" opens `/app/<entity>`.
- Loader: `overviewKpisQueryOptions()`, `breakdownQueryOptions(DEFAULT_DAYS)`, each daily query with `DEFAULT_DAYS`,
  and each entity list query. A tab change then shows no spinner.
- Selection: the tab, in the URL.

## Empty state

Every entity list returns no row: this is the first visit.

- Setup strip: under the tabs, in the overview tab only. One action per entity, 2 to 4.
- Tabs: every tab stays, with the count 0.
- Entity rows: each shows 0, "No earlier data", and a flat mini chart at 0.
- Breakdown: the empty frame of the chart file. Figures: each shows 0.
- An entity tab: the empty frame of its chart, the empty table frame of the style, and its add action.

## Rules

- Radix renders only the open tab panel.
- Entity row: `grid grid-cols-1 items-center gap-3 @2xl/main:grid-cols-[12rem_minmax(0,1fr)_auto]`.
  Every mini chart uses the same period and the same height, so the rows compare at a glance.
- Overview bottom row and entity tab: `grid grid-cols-1 gap-4 @3xl/main:gap-6 @4xl/main:grid-cols-2`.
- 375 px: the `TabsList` scrolls sideways (`overflow-x-auto`) and never wraps.
  An entity row stacks: the name and the figure, then the mini chart.
- The skeleton draws the overview tab: the tabs, one row per entity, and the bottom row.
- This home differs: tabs split the home, and the overview is a stack of small multiples, one per entity.
