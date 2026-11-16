# Vault

An app starter for team file storage. It shows storage use, a file browser, shares, recent changes, and the trash.
The team, the clients, the files, and the numbers are fictional. They come from one sample module, not from a database.

## Pages and routes

- `/` sends the user to `/app`.
- `/app` is the overview: four storage meters, uploads per day by file type, uploads by team, and recently changed files.
- `/app/files` is the file browser. The URL holds the folder, the layout (list or grid), the type filter, and the sort.
- `/app/files/$fileId` is one file: its facts, its versions, its shares, its history, and more files of its folder.
- `/app/shared` lists every share. Tabs filter the state. A select filters the audience (public link or people).
- `/app/recent` is the activity feed of the last 30 days, grouped by day, with the most active people and files.
- `/app/trash` lists the deleted files and the date of the final delete.
- `/app/profile` and `/login` are the base pages.

## Where the code is

- `src/features/workspace/` is the shared domain. Other features import it only through its `index.ts`.
  - `lib/sample-data.ts` builds the rows: members, folders, files with their versions, contacts, and shares.
  - `lib/workspace.ts` reads the rows at one moment: `readWorkspace(now)`. It holds the share state rule and the trash end date.
  - `lib/activity.ts` makes the feed from the uploads, the shares, and the deletes.
  - `lib/codes.ts` holds the file kinds, the teams, the share access levels, and the share states.
- `src/features/overview/`, `files/`, `sharing/`, `recent/`, and `trash/` hold one page each, with an `api/` folder of queries.
- Every text is in `src/shared/i18n/messages.ts`. Change a text there, not in a component.

## How the sample data works

- The rows are relative to today. The same day gives the same rows, so the pages agree when the clock moves.
- An event of today keeps its place in the day, scaled to the time since midnight. So no event is in the future.
- Storage is the sum of the current versions, live files and trash. Older versions do not count.
- The trash keeps a file for 30 days (`WORKSPACE_PLAN.trashRetentionDays`).
- A share that ends in 7 days or less is "ends soon" (`EXPIRING_SOON_DAYS`).

## How to make each part real

1. Create the tables: `members`, `folders`, `files`, `file_versions`, `contacts`, `shares`, and `share_recipients`.
   The row types in `lib/sample-data.ts` give the columns. Put the file bytes in Supabase Storage.
2. Replace the body of each `queryFn` in the `api/*.queries.ts` files with a Supabase read.
   Keep the query keys and the return types, so the pages do not change.
3. Then delete `lib/sample-data.ts` and the cache in `lib/workspace.ts`.
4. The kind facts on the file page (pages, slides, length) come from `files/lib/file-facts.ts`.
   Store them in a `files.metadata` column at upload, and read them from there.

## What is not built

- Upload, rename, move, and a new folder.
- Create, change, or stop a share.
- Restore from the trash and delete forever.
- File preview and download.

Each of these needs a table write. Add it as a mutation in the `api/` folder of its feature.
