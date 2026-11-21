# Vault

An app starter for team file storage. It shows storage per file type, quick folders, uploads, a file browser, shares, recent changes, and the trash.
The team, the clients, the files, and the numbers are fictional. They come from one sample module, not from a database.

## Shell

- The sidebar has three labeled groups: Overview, Workspace, and Account.
- "Files" in Workspace is a parent row. Its children are All files, Recent, Shared, and Trash. Each child is a route.
- The header has a page search (Cmd+K or Ctrl+K). It lists the nav pages only.
- The bell lists the shares that end within 7 days and the trashed files that Vault deletes within 7 days.
  It counts the same rows as the "Ends soon" tab of Shared and the "Deleted soon" tab of Trash.

## Pages and routes

- `/` sends the user to `/app`.
- `/app` is the overview. Four type cards (Documents, Images, Videos, Other) show the file count and the share of the live storage.
  Then three quick folders (the top folders with the newest change) and the storage card (used against the plan).
  Then the upload bars (new files and new versions, by day, week, or month) and the five newest uploads.
- `/app/files` is the file browser. The URL holds the open folder and the type filter. The search, the sort,
  the selection, and the page stay in the page. A file name opens a side panel on wide screens and the file page on narrow screens.
- `/app/files/$fileId` is one file: a profile card, its share of its folder, its labels, the latest activity,
  the versions, and who can open it. The tabs Versions and Activity show the full lists.
- `/app/recent` lists the changes of the last 30 days. Tabs filter the action. Filters: person and type.
- `/app/shared` lists every share. Tabs filter the state. Filters: audience and access.
- `/app/trash` lists the deleted files. Tabs filter the final delete (within 7 days, or later). Filters: type and person.
- `/app/profile` and `/login` are the base pages.
- Each list page has "Export CSV" (the rows of the tab and the filters) and "Export selected" for the checked rows.

## Where the code is

- `src/features/workspace/` is the shared domain. Other features import it only through its `index.ts`.
  - `lib/sample-data.ts` builds the rows: members, folders, files with their versions, contacts, and shares.
  - `lib/workspace.ts` reads the rows at one moment: `readWorkspace(now)`. It holds the share state rule,
    the trash end date, `EXPIRING_SOON_DAYS`, and `PURGE_SOON_DAYS`.
  - `lib/activity.ts` makes the feed from the uploads, the shares, and the deletes.
  - `lib/codes.ts` holds the file kinds, the 4 file categories, the teams, the share access levels, and the share states.
  - `lib/csv.ts` and `lib/clipboard.ts` hold the CSV download and the "Copy link" action.
  - `api/alerts.queries.ts` feeds the bell of the header.
- `src/features/overview/`, `files/`, `sharing/`, `recent/`, and `trash/` hold one page each, with an `api/` folder of queries.
- `src/shared/ui/record-table.tsx` is the table of the list pages: filter field, filter buttons, columns menu,
  sortable heads, row checkboxes, row menus, and pages. `src/shared/ui/checkbox.tsx` is its checkbox.
- Every text is in `src/shared/i18n/messages.ts`. Change a text there, not in a component.

## How the sample data works

- The rows are relative to today. The same day gives the same rows, so the pages agree when the clock moves.
- An event of today keeps its place in the day, scaled to the time since midnight. So no event is in the future.
- Storage is the sum of the current versions, live files and trash. Older versions do not count.
- Design files count with images in the type cards and the type filter.
- The trash keeps a file for 30 days (`WORKSPACE_PLAN.trashRetentionDays`).
- A share that ends in 7 days or less is "ends soon" (`EXPIRING_SOON_DAYS`).

## How to make each part real

1. Create the tables: `members`, `folders`, `files`, `file_versions`, `contacts`, `shares`, and `share_recipients`.
   The row types in `lib/sample-data.ts` give the columns. Put the file bytes in Supabase Storage.
2. Replace the body of each `queryFn` in the `api/*.queries.ts` files with a Supabase read.
   Keep the query keys and the return types, so the pages do not change.
3. Then delete `lib/sample-data.ts` and the cache in `lib/workspace.ts`.

## What is not built

- Upload, rename, move, and a new folder.
- Create, change, or stop a share.
- Restore from the trash and delete forever.
- File preview and download.

Each of these needs a table write. Add it as a mutation in the `api/` folder of its feature.
