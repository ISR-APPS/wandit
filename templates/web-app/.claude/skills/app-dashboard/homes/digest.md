# Home digest
One editorial column: a summary of the period, then 2 or 3 sections. Each has a heading, a chart, and a list.

## Needs

- Judge these needs on the tables and the user's words, never on rows. The first build has no rows.
- 2 or 3 topics, each with its own tables. Topic 1 is the main activity: an event table.
  Topic 2 is the work to do: an entity with a status. Topic 3 (optional) is a second entity with events.
- A person reads the page once a day or once a week, from top to bottom.
- Examples: a cafe (sales per day with the best items; open supplier orders; staff hours).
  A consultancy (hours per day by client; open invoices; new leads).
- Fallback: hero. The app has only one topic: no entity with a status, and no second entity with events.

## Silhouette

```text
lg (main 56rem or wider)                     375 px
       Last 7 days             [7|30]        Last 7 days
       Sales 48,250 (+12%). Open             [7|30]
       invoices: 12.                         Sales 48,250
       -------------------------------       (+12%). Open...
       Sales                      48,250     -------------
       [chart, full column, side height]     Sales   48,250
       1  Name ................... 1,200     [chart .....]
       2  Name ...................   900     1 Name   1,200
       3  Name ...................   640     2 Name     900
       -------------------------------       -------------
       Open invoices                  12     Open invoices
       [share bar per status ..........]     [share bar ..]
       -  Name ............ late 9 days      - Name  late 9d
       -  Name ............ late 4 days      -------------
       -------------------------------       (section 3)
       (section 3, when a third topic exists)
```

## Slots

| Slot | Data kind | Form |
|---|---|---|
| Header | The period of the page. | The PageHeader: the title names the period ("Last 7 days", "Last 30 days"). The period control sits in the actions. |
| Summary | One clause per section: a label and its figure, with the delta when it exists. | One paragraph under the header, in the display face, larger than body text. Each delta in `<bdi dir="ltr">`. |
| Section 1: main activity | `dailySeriesQueryOptions(days)` and `breakdownQueryOptions(days)`. | An h2 with the period total. The trend part of the chart file, side height. The top 3 to 5 parts as a ranked list. |
| Section 2: work to do | The open rows of the main entity list query, by status. | An h2 with the open count. A share bar per status (plain divs). The 3 to 5 oldest open rows. |
| Section 3 (optional) | A second entity with its own daily read function (data.md, section 3). | An h2 with its total, a mini trend (h-24 to h-32), and its 3 to 5 newest rows. |

## Behavior

- Period: 7 or 30 days. The control changes the summary, section 1, and section 3. Their query keys hold `days`.
- The page sets `DEFAULT_DAYS` to 7: a digest reads a week.
- chart=heat: section 1 follows heat.md. 7 days give the strip. 30 days give the calendar.
  The mini trend of section 3 is always the strip.
- Totals: the sum of `current` over the period. The delta is `changeRatio(sum of current, sum of previous)`.
- chart=stacked: the section 1 chart reads the `CategoryPoint[]` series (`dailyOutputQueryOptions` in the example).
  Its total, its delta, and its summary clause read the `DailyPoint[]` series (`dailyProductionQueryOptions`).
  Section 3 reads `DailyPoint[]` only, so its mini trend draws one bar per day.
- The summary uses only facts of the drawn sections: one clause per section, with the figure of its h2.
  `t()` has no placeholders, so a clause is a message and a formatted value: "Open invoices: 12".
  Never glue words around a number in code.
- Section 2 counts the rows of the list query in the browser. Put the `LIMIT` comment of tables.md there.
  A due date that can be null: sort those rows last, and never count them as late.
- Links: each list row opens `/app/<entity>/$id`. Each section heading has "See all" to `/app/<entity>`.
- Loader: `dailySeriesQueryOptions(DEFAULT_DAYS)`, `breakdownQueryOptions(DEFAULT_DAYS)`, the list query,
  and the daily query of section 3 when it exists. This home reads no KPI query.
  chart=stacked: load both daily queries of section 1, the `DailyPoint[]` one and the `CategoryPoint[]` one.
- Selection: none.

## Empty state

The list query returns no row: this is the first visit.

- Summary: one clause, "Nothing was recorded in the last 7 days", in the words of the app.
- Setup strip: under the summary, above section 1.
- Section 1: the total 0, the empty frame of the chart file, and 3 empty ranked lines.
- Section 2: the open count 0, an empty share track, and the empty frame of the style.
- Section 3: the same frames as section 1, with its own add action.

## Rules

- One column at every width: `mx-auto flex w-full max-w-[60rem] flex-col gap-8`. The summary has `max-w-prose`.
- Sections never sit side by side. Each chart spans the column.
- The style separates the sections: a rule, a gap, or one panel per section when the style uses panels.
- Every heading is an h2 with its figure at the end of the line. The page keeps one h1: the period title.
- 375 px: the same column. The charts keep their heights, and the lists keep their values at the end.
- The skeleton draws the summary lines and two sections.
- This home differs: it is the only home with prose at the top. It reads in one column, like a letter.
