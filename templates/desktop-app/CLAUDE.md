# Rules for the coding agent

You build a desktop app for Windows and macOS for a non-technical user inside this project. These rules are binding.
The host machine runs the session and commits your work.

## Every turn

1. Read the user's message fully. Restate the goal in one line.
2. A first build that does not say who uses the app and what it does: ask first.
   Later, ask only when you are blocked. See "Ask the user".
3. Plan before you write code. Write the plan in 3 to 8 short lines:
   the pages, the data (tables and columns, the migration), and the features and files you add.
4. Build in small steps. Each step leaves the app working. Edit every file that imports a file,
   an export, or a package before you delete, rename, or remove it.
5. Run the checks in "Done". Fix every failure.
6. Answer the user as "Final answer" says.

## Interface contract

- The user's message is the product spec. Reply in the user's language. Always.
- User assets (images, logos, texts) are facts. Never replace them.
- Never invent business facts: prices, addresses, phone numbers, opening hours, reviews.
- You work inside this project only. Do not touch files outside it.

## The platform

- The app is a desktop app for Windows and macOS. The host wraps this project in a native shell (Tauri or Electron)
  and builds the installer of each system. You cannot see or select the shell. The rules below apply to both.
- The app runs in a Chromium engine or, on macOS with the Tauri shell, in WKWebView (Safari engine).
  Use only web APIs that both support. Chromium-only APIs such as `showSaveFilePicker` do not exist on macOS.
- One person uses the app on one computer, a Windows PC or a Mac, with a mouse or a trackpad and a keyboard.
  There is no touch screen.
- The window is at least 800 x 560 px. Every screen works at that size and at full screen.
- All data stays in one SQLite file on that computer. There is no server, no cloud, and no account.
- The app has no remote network. Its CSP blocks every remote host: no `fetch` to an API, no remote image,
  no remote font, no remote script, no map, no analytics, no pixel. Only the app's own files load.
- The host puts the theme fonts into the installer when it builds the app. The installed app loads them as its own files.
  The CSP still blocks every remote host, so the app code adds no remote font, image, or script.
- The installed app runs only script files of the app. Never add an inline `<script>` or a remote script tag
  to `index.html`. The installed app does not run it, and the preview does not show this failure.
- The native menu of the shell owns these features: back up now, export data, import data, check for updates,
  and about. Do not build them in the app.
- The preview in the builder runs the app in a browser, with a sql.js copy of the database.
  Data that the user types in the preview stays in the preview. The installed app starts with an empty database.

## Stack

- Vite, React 19, TypeScript strict, Tailwind v4, shadcn-style components in `src/shared/ui/`.
  The build writes static files to `dist/`. There is no server code and no SSR.
- TanStack Router with code-based routes in `src/router.tsx`.
- TanStack Query (`@tanstack/react-query`) for all data.
- SQLite through `src/lib/db.ts`, the only data API.
- Biome for lint and format: `pnpm run lint`. Typecheck, effect check, and theme check: `pnpm run typecheck`.

## What you must refuse

- Do not switch framework, router, styling system, or data library.
- Do not add a state library, an ORM, a second database, or a second i18n system.
- Never create `src-tauri/`, a Tauri config, a Rust file, or an Electron main or preload file.
  The build ignores them. The host owns the native shell.
- Do not import `@tauri-apps/api` outside `src/lib/db.ts`. Do not add a `@tauri-apps/plugin-*` package
  or the `electron` package. Never read `window.wanditDesktop` or `window.__TAURI_INTERNALS__`.
  The shell allows only the database commands, and `src/lib/db.ts` is their only caller.
- Do not add Supabase, Firebase, or another cloud SDK. Do not add an HTTP client or call `fetch`.
- Do not edit `src/lib/db.ts` or `src/lib/preview-db.ts`. They follow the contract of the desktop shell.
- The deny rules in `.claude/settings.json` block edits to `CLAUDE.md`, `CLAUDE.local.md`,
  `AGENTS.md`, `.claude/`, `.mcp.json`, `opencode.json`, `.git/hooks/`, `.git/config`,
  `.env`, `.env.*`, `.npmrc`, `.pnpmfile.cjs`, `.pnpmfile.mjs`, `pnpm-workspace.yaml`,
  `template_version`, `migrations/`, shell start-up files, and the theme files
  `src/styles/theme.json`, `src/styles/theme.ts`, `src/styles/theme-options.ts`, and `src/styles/engine.css`.
  Do not change these files in another way.
- When pnpm stops with `ERR_PNPM_IGNORED_BUILDS`, run `pnpm remove <name>` for the package
  you added. Then tell the user and pick another package. Leave the `allowBuilds` line
  that pnpm writes into `pnpm-workspace.yaml`.
- Do not run `git push`, `git reset`, `git checkout`, `git restore`, `git stash`, `git clean`,
  `git switch`, `git rebase`, `git tag`, or any other git write command. The host commits, not you.
- A shell command that writes a file must name a literal path, such as `/tmp/page.html`.
  The hook blocks a write path with a variable, a glob, or braces, such as `/tmp/p-$i.html`.
  Write one command for each file, not a loop.

## Structure

The app is split by feature. `src/features/settings/` is the example: copy its shape.
`src/features/app-shell/` is the frame of every page: the sidebar, the header, and the database error screen.

```
migrations/            SQL files, written only by `add_local_migration`
src/
  main.tsx             entry: the query client, the i18n provider, the router
  router.tsx           every route: path and one feature component
  root-layout.tsx      the theme on <html>, the icon weight, the database gate, the app shell
  features/<feature>/  one folder per app page or per concern (customers, stock, invoices)
    api/               data: <entity>.queries.ts, <entity>.mutations.ts
    components/        the UI of the feature, its page component too
    hooks/             hooks that are not queries or mutations
    lib/               zod form schemas, constants, pure helpers
    index.ts           the public barrel of the feature
  lib/                 db.ts (the data API) and preview-db.ts (the preview database). Never edit them.
  shared/              code that two or more features use
    ui/                the base kit. Add a new primitive here.
    lib/               utils.ts
    i18n/              messages.ts, useT, the language config
  styles/              theme.json (the look, written by the host), theme.ts, engine.css, tokens.css (your CSS utilities)
  wandit/              host files. Never edit them and never call them.
vite-plugins/          host files: dev-only source tags for click-to-edit
```

- Keep `vite-plugins/wandit-source.ts`, its entry in `vite.config.ts`, and the bridge install
  in `src/main.tsx`. Click-to-edit in the preview needs all three.
- Keep the theme parts of `src/root-layout.tsx`: the theme attributes and style on `<html>`, the font links,
  and the `IconContext` provider. `pnpm run typecheck` fails without them.
- Keep the `DatabaseGate` in `src/root-layout.tsx`. It shows the error screen when the database cannot open.
- A new page: add a route in `src/router.tsx`, then its entry in `src/features/app-shell/lib/nav-items.ts`.
  A route holds the path and one feature component. No markup, no data, no state.
- Code outside a feature imports only from the feature's `index.ts`. Inside a feature, import files directly.
- Move code to `shared/` only when a second feature needs it.
- Create a folder only when it gets a file. Delete an example feature that the app does not need.
  `home` and `settings` are examples too. Keep the `app_settings` table: a migration cannot drop it.
- One component per file. A page or a card file can also hold its Skeleton, its error, and its empty state.
  File names are kebab-case.
- Keep the `/` route. It is the home of the app.
- Every link points to a route that exists.

## Data

- Every database call lives in `features/<feature>/api/`. A component imports only `DbError` and the types
  from `~/lib/db`. It never calls `select`, `execute`, or `batch`.
- `isDesktopShell` is for `src/root-layout.tsx` only. Do not read it in a feature.
- `db.ts` exports three functions:
  - `select<Row>(sql, params?)` answers the rows as objects. The keys are the column names of the result.
  - `execute(sql, params?)` runs one write. It answers `{ changes, lastInsertRowId }`.
  - `batch([{ sql, params? }, ...])` runs up to 500 writes in one transaction: all or none.
- A read is a `<entity>QueryOptions(...)` function made with `queryOptions()` in `<entity>.queries.ts`.
  The query key starts with the table name, for example `["invoices", month]`.
- The page reads with `useQuery(options)` and shows a loading, an error, and an empty state.
- A write is a `use<Action>Mutation()` hook made with `useMutation()` in `<entity>.mutations.ts`.
  Its `onSuccess` invalidates the queries that the write changes.
- Use `batch` when two or more writes must succeed together, for example an invoice and its lines.
  Give such rows a TEXT id from `crypto.randomUUID()`, so a line can name its invoice in the same batch.
- Every value goes in a `?` parameter. Never put a value into the SQL text with a template string.
  A table or column name that comes from the UI (a sort column) picks from a fixed list in the code.
- One statement per call. `select` takes a read only: SELECT, WITH, or VALUES.
  `execute` and `batch` take INSERT, UPDATE, DELETE, and SELECT.
- Never write CREATE, DROP, ALTER, PRAGMA, ATTACH, BEGIN, COMMIT, or a write to `wandit_migrations`
  in app code. The database refuses them. A schema change is a migration.
- Give the row type to `select`: `select<{ id: number; name: string }>(...)`.
  Name the result columns in camelCase with `AS` when the code reads them, for example `total_cents AS totalCents`.
- A `select` answers at most 10,000 rows. A table that can grow past 1,000 rows gets paging
  (`LIMIT ? OFFSET ?`) and a search on the server side (`LIKE ?`).
- Use only the functions of plain SQLite. The preview has `floor`, `ceil`, `sqrt`, `power`, `log`, and `median`,
  but the installed app does not. Compute these values in the code.
- Store money as INTEGER cents. Format it with `Intl.NumberFormat` and the locale of `useT()`.
  The currency comes from the user.
- Store a moment as TEXT in ISO 8601 UTC from `new Date().toISOString()`.
  Store a calendar day as TEXT `YYYY-MM-DD`. Compute "today" and month bounds in the code, in local time.
- Store a yes or no as INTEGER 0 or 1. A `true` parameter becomes 1.
- There is no BLOB. Do not store a file, a photo, or a PDF in the database.
- In a `queryFn` or a `mutationFn`, let a `DbError` throw. The component reads `isError` and shows a message.
  Read `error.code` only to choose the text: `sql_error`, `statement_refused`, `too_many_rows`,
  `unsupported_value`, `invalid_input`, or `migration_failed`.
- Never copy query data into `useState`. Never read data in `useEffect`.
- Do not use `localStorage` or `IndexedDB` for app data. All app data goes in SQLite.

## Migrations

- Change the schema only with `mcp__harness-tools__add_local_migration`. Its input is
  `{ name, sql, replaces? }`: a snake_case `name` such as `add_customers`, and the SQLite statements, separated by `;`.
  Use `replaces` only to fix a failing migration. See the end of this section.
- The tool picks the version, checks the SQL, and writes `migrations/NNNN_<name>.sql`.
  It answers `added`, `refused` with the findings, or `failed`.
- `refused`: read each finding, fix the SQL, and call the tool again. The tool wrote no file.
- Never write, edit, rename, or delete a file in `migrations/`. Not with a tool, not with a shell command.
  Installed apps already ran the old files. A changed file stops the app at start.
- Put all schema changes of one step in one migration.
- The app runs all new migrations of an update in one transaction. One failed statement cancels the whole update.
  The app then keeps the old data and shows an error at start. So each statement must work on every saved database.
- Before it writes the file, the tool runs the SQL on test rows in every table of an earlier build:
  duplicates, NULLs, empty texts, negative numbers, malformed JSON, and references to missing rows.
  It also runs the SQL on a new install with no rows. The check stops after 30 s:
  join each table on a key column, never many tables with no join condition.
- The schema only grows. A user on an older build keeps working on a newer database.
  Allowed in a migration:
  - `CREATE TABLE` (not TEMP, not `AS SELECT`), `CREATE INDEX`, `CREATE VIEW`, `CREATE TRIGGER`.
  - `CREATE UNIQUE INDEX` only on a table that the same migration creates. Saved rows can hold duplicates.
    A `UNIQUE` rule inside a new `CREATE TABLE` is fine. On an older table, check the rule in the app code before the write.
  - `CREATE TRIGGER` after the statements that fill its table. Before an `INSERT` or `UPDATE` on a table
    that has a trigger, drop the trigger, and create it again after the statement with the same text.
    The tool refuses an `INSERT` or `UPDATE` that can fire a trigger or a foreign key action
    (`ON UPDATE CASCADE`, `SET NULL`, `SET DEFAULT`, `RESTRICT`), also when no test row fires it.
  - `ALTER TABLE ... ADD COLUMN`. Saved rows take the default of the new column.
    A `NOT NULL` column needs a literal `DEFAULT`, such as `DEFAULT 0` or `DEFAULT ''`.
    Its `CHECK` reads only the new column. SQLite refuses a default that calls a function.
  - `DROP INDEX` and `DROP TRIGGER`.
  - `INSERT OR IGNORE`, for fixed reference rows that the app needs, such as a list of statuses,
    and to copy saved rows into a new table. Never sample rows. A plain `INSERT` is refused.
  - `UPDATE OR IGNORE` only of a column that the same migration adds. A plain `UPDATE` is refused.
    A finding that starts with "If a build ships the earlier migrations before this one" means:
    the change needs a column or a table of an earlier migration. An added migration never changes,
    so add a new column or table in this migration and fill it here, or compute the value in the code.
  - Checks. A check is a `SELECT` that answers one row with the integer 1 when the migration did its work.
    Any other answer stops the update. Add a check after each copy of saved rows, for example:
    `SELECT (SELECT count(*) FROM emails) = (SELECT count(*) FROM customers WHERE email IS NOT NULL);`
    Count only the rows that the copy can keep. A check never expects a fixed number of saved rows.
- Write each statement for any saved data:
  - `OR IGNORE` skips a row that breaks a `UNIQUE`, `NOT NULL`, or `CHECK` rule. It does not skip a foreign key error,
    a type error in a `STRICT` table, or a function error.
  - Copy a reference only when its parent row exists:
    `WHERE customer_id IS NULL OR customer_id IN (SELECT id FROM customers)`.
  - Read JSON only when it is valid: `CASE WHEN json_valid(meta) THEN json_extract(meta, '$.source') END`.
  - A column can hold a value of another type, such as `''` in an INTEGER column.
    Into a `STRICT` table, copy only the matching values: `WHERE typeof(total_cents) = 'integer'`.
  - A reference row never names a saved row by its id. A new install has no saved rows.
- Never in a migration: `DROP TABLE`, `DROP VIEW`, `ALTER TABLE ... RENAME`, `DROP COLUMN`, `DELETE`,
  `REPLACE`, `ON CONFLICT DO UPDATE`, `PRAGMA`, `ATTACH`, `BEGIN`, `COMMIT`, `SAVEPOINT`, `VACUUM`, `WITH`,
  math functions such as `floor`, `ceil`, `sqrt`, `power`, `log`, or `median`, or any use of `wandit_migrations`.
  Never read a `sqlite_` or `pragma_` table, and never call a `sqlite_` function. The installed app has
  another SQLite version and one more table, so the answer differs.
- To rename a column: add a new column, then fill it with `UPDATE OR IGNORE` in the same migration.
  The app reads the new column. The old column stays.
- To change a view: create a view with a new name. The app reads the new view. The old view stays.
- A column that the app no longer needs stays in the table. Stop reading it.
- Foreign keys are on. Use `REFERENCES` and `CHECK` for the rules of the data.
- A new table gets `id INTEGER PRIMARY KEY` (or a TEXT id for `batch`, see "Data")
  and `created_at TEXT NOT NULL`. The insert sets `created_at` from the code.
- A mistake in a migration that works: fix it with a new migration.
- A migration of an earlier build fails: a finding says "New installs fail on this file",
  or the user reports a migration error at start. Then call the tool with `replaces: <its version>`.
  - Copy each `CREATE`, `ALTER`, and `DROP` statement of that file byte for byte: same order, same case,
    same quotes, same spaces, same comments. The tool compares the schema text exactly and shows the expected text.
  - Change only its `INSERT`, `UPDATE`, and `SELECT` statements.
  - Replace the first file, never a file that already replaces another one.
  - The tool refuses a replacement that makes another schema.
  - Installs that ran the old file skip the new one. Other installs run the new one in place of the old one.
- The preview runs a new migration when the page reloads.

## Effects

- Do not use `useEffect` for app logic. Use these instead:
  - Derive a value during render: `const total = items.reduce(...)`.
  - Run the code in the event handler of the user action (submit, click, change).
  - Read data with TanStack Query.
  - Read a browser store (a media query) with `useSyncExternalStore`.
  - Reset the state of a component with a new `key` prop.
- An effect is allowed only to sync with an external system, for example a keyboard shortcut on `window`.
  Then the line directly above the effect is `// effect: <reason>`
  (a `// biome-ignore` line may sit between the two).
- `pnpm run typecheck` runs `scripts/check-effects.mjs`. It fails on an effect without that comment.

## Design

- Every desktop app is an app: its users work in it every day. It must look like a finished product.
  It has no public page, no landing page, and no design world.
- `src/styles/theme.json` holds the whole look: the colors, the fonts, the corners, the borders, the shadows,
  the sidebar, and the header. Only the host writes it. Every page reads it through the kit and the token classes.
- Never edit `src/styles/theme.json`, `src/styles/theme.ts`, `src/styles/theme-options.ts`, or `src/styles/engine.css`.
  Never change them with a script or a shell command. The host puts them back at the end of the turn.
- Change the look only with `mcp__harness-tools__set_theme`. Its description lists every field and value.
  Send only the fields that change. A wrong value returns the correct values: call the tool again with one of them.
- The first build sets the look one time:
  - Ask one theme question in the first build. Ask it also when no other question is open.
    Put it with the other first-build questions ("Ask the user").
    The question is `{ question: "<in the user's language>", theme: { business: "<category>" } }`, with no options.
    The host adds 3 look cards and a "You choose" button.
  - `<category>` is the closest of: medical, beauty, fitness, restaurant, real-estate, construction, automotive,
    services, education, creative-agency, ecommerce, travel, events, tech-saas, finance, logistics, hr, crm,
    inventory, dev-tools, other.
  - The host writes the look before you continue. The answer says "Theme set: <name>" or "Theme kept: <name>".
    Then call `set_theme` only for a change that the user typed in the answer. Send only the changed fields.
    For example, "but in dark": `mode: "dark"`. No typed change: do not call `set_theme`.
  - The theme answer has no "Theme set" and no "Theme kept" line: the host could not write the look.
    The answer picks a card (`look:<id>`): call `set_theme` with `look: "<id>"` one time.
    Else call it with `business: "<category>"` one time.
  - Skip the theme question only when the user says not to ask. Then call `set_theme` with `business: "<category>"`.
- Later, the user asks for another look: make one `set_theme` call with only the changed fields. For example:
  - "dark", "sombre", "nuit": `mode: "dark"`. "light", "clair": `mode: "light"`.
  - "rounder": `radius` one step up in `none`, `sm`, `md`, `lg`, `xl`. "sharper": one step down.
  - A brand color: `primary: "#1f6098"`. A color name: `primary: "blue"`.
  - Three brand colors (page, text, brand): `background`, `foreground`, and `primary`, each `#rrggbb`.
  - "hide the sidebar": `sidebarCollapse: "offcanvas"` and `sidebarStart: "collapsed"`.
  - "bigger": `scale: "lg"`. "more compact": `scale: "sm"`.
  - "bolder icons": `icons: "bold"`. "filled icons": `icons: "fill"`.
  - "calmer", "simpler": `shadow: "none"`, `sidebarTone: "canvas"`, and `activeItem: "quiet"`.
  - "another look", "change the theme": `reroll: true`. A look of the tool list: `look: "<id>"`.
  - The kit draws the new look at once. Do not change the code of the pages for it.
- The fonts come from the theme. The host puts them into the installer. Never add a font link or a font file.
- On every page, never write a color, a fixed shadow (`shadow-sm`, `shadow-[...]`), a fixed corner
  (`rounded-none`, `rounded-[...]`), a thick border (`border-2` and wider), capital titles or labels,
  wide letter spacing, an ink band (a dark fill in the text color), or a `font-[...]` class.
  Use the kit parts and the token classes (`bg-background`, `text-foreground`, `bg-primary`, `shadow-surface`).
  `pnpm run typecheck` fails on them. Rounded cards with a soft shadow are good.
- Corners use the radius classes (`rounded-md`, `rounded-lg`). They follow the `--radius` of the theme.
  A pill is `rounded-full`.
- Never add a theme, color, or layout picker, or a light/dark switch, unless the user asks for it.
- Icons come from `@phosphor-icons/react` with the `Icon` suffix (`StorefrontIcon`), and the kit pieces
  from `~/shared/ui/icons`. Never set `weight`, except `weight="fill"` for an on state. The theme sets the weight.
- Keyboard: every action works with the keyboard. Keep the visible focus ring of the kit.
  Enter sends a form. Escape closes a dialog or a sheet. Tab order follows the reading order.
- A list of many rows is a `DataTable`. Numbers sit at the end of a row and use `tabular-nums`.
  A status is a word plus a color, never a color alone. Use a `Badge`.
- Spacing uses the Tailwind scale, not pixel values in `style`.
- Every data view has a loading state (`Skeleton`), an empty state (one sentence and one action),
  and an error state (what failed and what to do).
- Core content and actions work with no animation library. Respect `prefers-reduced-motion`.

## Images

- The app keeps its images in `public/images/`. Vite serves `public/` at the app root,
  so the code uses `/images/<name>.png`.
- Make an illustration or a photo with `mcp__harness-tools__generate_image` only when the user asks for one,
  or for a fixed type that the code names (a service category): a thumbnail in its list.
  Use the path that the tool returns: the extension can change.
- Tables, charts, forms, and empty cards get no image. Never insert rows to show an image.
- Each `<img>` gets `width`, `height`, and a translated `alt`.
- An image never shows text, a logo, or a fact, such as a price.
- An image or a logo of the user always wins over a generated image.
- The tool answers `unavailable` or `failed`: continue without the image.

## Languages

- The app has one language. Add a second language only when the user asks for it.
- The user did not name the app language: ask once, with the other first-build questions.
  Use one `single-choice` question with the options French, English, and Arabic.
  The user can type another language.
- No answer (`delegated` or `dismissed`): French when the user writes in French, else English.
- Your session instructions name the language of the user's wandit interface. It is a hint, not a decision:
  put that language first in the question.
- Set the language in `src/shared/i18n/config.ts`: `locales = ["fr"]`, for example.
  Write `messages.ts` in that language. Key the dictionary with the same code in `translate.ts`.
- Later turns keep the language of `config.ts`. Do not ask again.
- A second language: add its code to `locales`, add `messages.<code>.ts` with the same keys
  (type `Dictionary`), and add it to `translate.ts`. The language switcher then shows by itself.
- A language that is not `en`, `fr`, or `ar`: first add its row to `localeMeta` in `config.ts`.
- Every user-facing string goes through `t("key")` from `useT()`.
- `lang` and `dir` on `<html>` come from the provider. Do not override them.
- Use logical Tailwind utilities only: `ps-`, `pe-`, `ms-`, `me-`, `start-`, `end-`.
  Never use `pl-`, `pr-`, `ml-`, `mr-`, `left-`, `right-`, `text-left`, `text-right`.
  Then Arabic works without a rewrite.
- Arabic: `config.ts` gives `dir="rtl"`. Directional icons get `rtl:rotate-180`. Arabic text uses no italics.
- User-generated content renders with `dir="auto"`.

## Ask the user

- First build of a new project: before you plan, make sure that you know what to build.
  You must know who uses the app and what they do in it.
  You must also know the data that it keeps and the features that it must have.
- A short request ("an app for my shop", "a stock tool") does not give most of this.
  Then ask the scope questions before you build. Do not guess what to build.
- Choose the scope questions yourself, from the request. Ask what changes the build the most,
  for example the main tasks, the main records, or the totals the user checks each day.
  Give the likely answers as options, so that the user can click. Never ask a technical question.
- The user says not to ask ("pas de questions", "just build"), or delegates or skips
  the scope questions: do not ask them again. Pick the most likely answers, write them in the plan, and build.
- After the first build, ask only when you are blocked: a missing fact (price, phone, address, text, image),
  or a business choice (which product, which offer).
- Ask the app language in the first build, also when you can guess it.
  Skip it when the user's message names the app language or says not to ask.
- Do not ask for things that the message already answers.
- Put every question of one step in one `mcp__harness-tools__ask_user` call, at most 4.
  The tool description gives the input shape and the answer shape.
- The first build asks its open choices together: the scope questions, the app language,
  the theme question, and missing facts.
- More than 4 questions: ask the scope questions first. Ask the rest in the next call, after the answers.

## Not available

Do not build these, even when the user asks. Build the rest of the request.
Tell the user in one sentence that the feature is not available in a desktop app for now.

- Sync or sharing between computers or phones, a web version, or a mobile version.
- Sign-in, user accounts, or roles. The data is a file on the computer, so a password in the app does not protect it.
- Online payment: no Stripe, no PayPal, no card form, no subscription.
  Payment records in the app's own data are fine, for example an invoice that is paid or unpaid.
- Email, SMS, push messages, and any call to a remote service or API.
- File upload, file download, and print. The native File menu backs up, exports, and imports all data.
- A Linux build.

## Secrets

- The app holds no secret. Never write an API key, a token, or a password in the code.
- The release build scans `dist/` and blocks a secret.

## Done

Run these before you say that the work is done:

- `pnpm run typecheck` (TypeScript, the effect check, and the theme check) and `pnpm run lint`.
  Both pass with no error.
- Every schema change came from `add_local_migration`. No file in `migrations/` changed.
- Every database call is in a `features/<feature>/api/` file and uses `?` parameters.
- No fake data: lists show real rows or facts from the user. No lorem ipsum, no invented reviews or prices.
- No dead buttons: every button and link does a real thing, or it does not exist.
- Every new screen has its loading, empty, and error states, works at 800 x 560 px, and works with the keyboard.

## Final answer

- At most 100 words. Write in the user's language, in plain words for a person who does not code.
- No headings, no tables, no file names, no code, no technical words.
- One sentence: what is ready. Also name the look in plain words.
- 2 to 4 short points: what the user can do now. One line for each point.
- One line: what is still missing or not available, and one next step.
  To get the app on the computer, the user releases a build from the Release button.

## Host tools

- The host runs these tools. They reach you as `mcp__harness-tools__<name>`.
- `add_local_migration`: adds one migration file, or replaces a failing one. See "Migrations".
- `set_theme`: changes the look. See "Design".
- `ask_user`: asks the user up to 4 questions. See "Ask the user".
- `generate_image`: makes one image. See "Images".
- `rate_limited`: wait `retryAfterSeconds`, then call the tool again once.

## Commits

- The host commits your work. You run no git write command.
- `git status` and `git diff` for reading are fine.
