# Home status-board
A wall of asset tiles with a live status opens the page. The header counts the assets per status. Events and alerts sit below.

## Needs

- Judge these needs on the tables and the user's words, never on rows. The first build has no rows.
- The business has 4 to 24 assets with a live status: machines, rooms, vehicles, devices.
  The user's words or the trade give the number. Each asset has one live number.
- Examples: a factory (machines; units this hour against the hourly target; stops per day; machines down).
  A hotel (rooms; guests in the room; check-ins per day; rooms out of order).
- Fallback: focus-queue. The business has fewer than 4 assets, or its assets have no live status.

## Silhouette

```text
lg (main 64rem or wider)                     375 px
Machines                      [Add machine]  Machines   [Add]
* 9 running  * 2 down  * 1 idle              * 9  * 2  * 1
+-----+-----+-----+-----+-----+-----+        +-----+-----+
| A1  | A2  | A3  | A4  | A5  | A6  |        | A1  | A2  |
| run | down| run | idle| run | run |        | run | down|
| 42  | 0   | 38  | -   | 40  | 41  |        +-----+-----+
+-----+-----+-----+-----+-----+-----+        | A3  | A4  |
| A7  | A8  | A9  | ... at most 24  |        +-----+-----+
+-----+-----+-----+-----+-----------+        | ...       |
| Events per day 2/3    | Alerts 1/3|        +-----------+
| 2 figures in header   |           |        | Events    |
+-----------------------+-----------+        | Alerts    |
                                             +-----------+
```

## Slots

| Slot | Data kind | Form |
|---|---|---|
| Status line | The count of assets per status, from the asset list. | The PageHeader description: one dot, the count, and the status word per status that has assets. |
| Asset tile | One asset: `name`, `status`, `reading` (the live number), `target` (a number or null). | A tile: the name, the status as a dot and a word, the reading with its unit. A real `target` adds a thin bar: reading of target. |
| More tile | The assets after the first 23, when there are more than 24. | The last tile: "+8 more", a link to the list page. |
| Events per day | `dailySeriesQueryOptions(days)`: status events or output per day. | The trend part of the chart file, side height. Its header holds the first 2 `KpiItem` rows in the kpi form, value and delta only. `KPI_COUNT` is 2. |
| Alerts | Assets in an alert status now (`down`, `maintenance`), newest change first, at most 6. | A list: the name, the status, and the time since `changed_at`. |

## Behavior

- The asset entity is built like the work orders of tables.md: `assets` with `id`, `name`, `status`, `reading`,
  `target`, and `changed_at` (ISO time of the last status change). The feature exports `assetsQueryOptions`,
  `Asset`, `ASSET_STATUSES`, and `ASSET_STATUS_BADGE`. Rename them and the `/app/assets` routes for your entity.
- Live: the asset query and the KPI query refresh every 30 s (`refetchInterval`).
  Write the reason above the constant: a status changes during the shift.
- The tiles keep the order of the list query, so each asset keeps its place on the wall.
- Assets with a zone column: one wall per zone, each with its zone name and at most 24 tiles.
- Period: a control (7, 30, 90 days) in the Events panel header. It changes that query key only.
- The page sets `DEFAULT_DAYS` to 30.
- Links: a tile and an alert row open `/app/assets/$id`. The More tile opens `/app/assets`.
- Loader: `overviewKpisQueryOptions()`, `dailySeriesQueryOptions(DEFAULT_DAYS)`, and the asset list query.
- Selection: none.

## Empty state

The asset list returns no row: this is the first visit.

- Setup strip: under the status line, above the wall.
- Status line: "0 machines", in the words of the app.
- Wall: 6 empty tile slots in the empty frame of the style (4 at 375 px). The first slot holds the add action.
- Events per day: the empty frame of the chart file. The 2 header figures show 0.
- Alerts: "No alert." This is also the healthy state on later visits.

## Rules

- Tiles: `grid grid-cols-2 gap-2 @2xl/main:grid-cols-4 @5xl/main:grid-cols-6`. Each tile is one `Link` with a focus ring.
- A status shows a dot and a word. Never color alone.
- Bottom row: `grid grid-cols-1 gap-4 @3xl/main:gap-6 @4xl/main:grid-cols-3`. The events panel spans 2.
- 375 px: 2 tile columns. The status line wraps under the title. The events chart keeps its side height.
- The skeleton draws the wall with 12 tiles (6 at 375 px) and the bottom row.
- This home differs: the wall of assets opens the page. The counts sit in the header line. No figure panels.
