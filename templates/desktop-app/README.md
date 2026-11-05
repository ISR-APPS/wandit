# desktop-app template

Vite + React starter for generated wandit Windows and macOS desktop apps (docs/v2/desktop-apps.md).
React 19, TanStack Router, TanStack Query, Tailwind v4, shadcn-style UI, a local SQLite
database through `src/lib/db.ts`, and i18n with one language by default (more on request, RTL ready).
The theme system and the UI kit are the same as in web-app 1.1.0. There is no Supabase and no Cloudflare.

The project holds only the frontend and `migrations/`. The trusted Tauri shell is in
`templates/desktop-shell/`. The release build puts `dist/` and `migrations/` next to it.
The build ignores any `src-tauri/` folder in the project.

## How the template reaches the sandbox

1. `pnpm run pack` writes `desktop-app-<version>.tar.gz` next to this folder.
   `templates/pack-all.mjs` runs it for the server build and the Trigger deploy.
2. The sandbox init uploads the archive and extracts it into the workspace, as for web-app.
3. `pnpm install --frozen-lockfile --offline` runs inside the sandbox. It falls back to the npm registry
   when the image has no warm pnpm store.

## Source layout

- `migrations/`: the SQLite migrations, `NNNN_snake_name.sql`. `0001_init.sql` creates `app_settings`.
  Only the `add_local_migration` host tool writes here. The deny rules block a direct write.
- `src/main.tsx`: the entry. It installs the preview bridge in dev, then creates the router,
  the query client, and the i18n provider.
- `src/router.tsx`: code-based routes on browser history, so the builder address bar shows the page path.
  A reload on a page path loads `index.html`: Vite dev and the Tauri asset resolver both fall back to it.
- `src/root-layout.tsx`: the theme on `<html>`, the icon weight, the `DatabaseGate`, and the app shell.
- `src/lib/db.ts`: the only data API (`select`, `execute`, `batch`, `DbError`). In the Tauri shell it calls
  the `db_*` commands with `invoke`. In the browser it loads `preview-db.ts`.
- `src/lib/preview-db.ts`: the preview database. sql.js in the browser, the same migration ledger,
  the same limits and error codes, and the bytes in IndexedDB.
- `src/features/app-shell/`: the sidebar, the header, `PageHeader`, the database gate, and the
  `migration_failed` error screen. The nav items are in `lib/nav-items.ts`; their `to` has the route type,
  so a wrong path fails typecheck.
- `src/features/settings/`: the example feature. It reads and writes `app_settings` through `db.ts`.
- `src/features/home/`: the example home. It shows the saved business name or an empty state.
- `src/shared/`: the UI kit (`ui/`), `utils.ts` (`lib/`), and i18n (`i18n/`).
- `src/styles/`: the theme engine of web-app 1.1.0 (see the web-app README, "Theme engine").
- `src/wandit/`: host files (the dev-only preview bridge).

## Commands

- `pnpm run dev`: the browser preview on `0.0.0.0:5173`, strict port.
- `pnpm run build`: the static files of `dist/` for the Tauri shell. The production build has no sql.js:
  outside the shell, `db.ts` answers `migration_failed`.
- `pnpm run typecheck`: `tsc6 --noEmit`, then `scripts/check-effects.mjs` and `scripts/check-theme.mjs`.
- `pnpm run lint`: `biome check --error-on-warnings .`
- `pnpm run pack`: write the distributable archive.

## Preview database

- The migrations come from `import.meta.glob("/migrations/*.sql")`. They run in version order,
  all pending files in one `BEGIN IMMEDIATE` transaction, with the `wandit_migrations` ledger of the shell.
- The database bytes live in IndexedDB, in the store `databases` of `wandit-preview-db`,
  under the key `wandit-preview-db:<location.host>`. Each preview host is one project.
- A changed migration file, a pending version below the highest ledger version, unreadable stored bytes,
  or a pending file that fails on the stored rows restart the preview database from empty.
  The desktop shell stops with `migration_failed` there. The preview answers `migration_failed` only when
  a file also fails on the empty database.
- The statement rules are an approximation by the first keyword. The SQLite authorizer of the shell
  enforces the real rules.

## Environment

- `WANDIT_PREVIEW_HOST`: set by the sandbox in dev. Used for `server.allowedHosts` and the HMR socket.
- The app reads no other variable. It has no backend and no secret.

## Notes for the coding agent

Read `CLAUDE.md` first. The deny rules live in `.claude/settings.json`;
`.claude/hooks/pre-tool-use.mjs` (a copy of the web-app hook) enforces them before every tool call.
