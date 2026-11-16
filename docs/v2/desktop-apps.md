# Desktop apps (V2)

A user builds a desktop app for Windows or macOS in the chat. The app is a
native shell with a local SQLite database. The shell is Tauri v2. A project
of the app type "Desktop app 2" uses the experimental Electron shell
(section 13). One build makes the files of one platform. The user downloads an installer (Windows) or a disk image
(macOS). Installed apps update themselves when the owner releases a newer
build of their platform. An update never loses saved data.

Decisions: D30 to D37 in `DECISIONS.md`. Security notes: section 14 of
`security.md`. This file is the contract between the parts below. When you
change a contract here, change every part in the same diff.

Sections 3, 4, 9, and 10 give the Tauri engine. Section 13 gives each
difference of the Electron engine. Every rule that section 13 does not
name is the same for both engines.

## 1. Parts and trust

| Part | Folder | Trust | Who changes it |
|---|---|---|---|
| Project template | `templates/desktop-app/` | Untrusted after create | The agent, in the sandbox |
| Native shell | `templates/desktop-shell/` | Trusted | Wandit engineers only |
| Native shell, Electron engine | `templates/desktop-shell-electron/` | Trusted | Wandit engineers only |
| Migration gate | `apps/server/.../domain/desktop-migrations.ts`, `.../infrastructure/sqlite/desktop-migration-gate.ts` | Trusted | Wandit engineers only |
| Build task | `apps/server/src/trigger/desktop-build.*` | Trusted | Wandit engineers only |
| Desktop CI | Private GitHub repo `DESKTOP_BUILD_REPO`, from `tooling/desktop-builder/`: `build.yml` (Windows), `build-macos.yml` (macOS), and for the Electron engine `build-electron.yml`, `build-electron-macos.yml` | Trusted | Wandit engineers only |
| Updater keys | `desktop_apps` table, encrypted | Secret | The API only |

Rules:

1. The sandbox never holds the native shell, a signing key, or a CI token.
2. The project repo holds only the frontend and the `migrations/` folder.
   The build ignores any `src-tauri/` or `shell/` folder in the project.
3. CI compiles only the trusted shell. The user files reach CI as data:
   static frontend files and SQL text. CI runs no user JavaScript and no
   user build script.
4. Only the server signs updates. CI never sees the updater private key.

## 2. Project template (`templates/desktop-app/`)

The template is a Vite, React, and TypeScript app, like `web-app`, without
Supabase. The agent edits it in the sandbox. The preview runs it in the
browser on port 5173.

```
desktop-app/
  migrations/0001_init.sql   first migration (one `app_settings` table)
  src/router.tsx             code routes on browser history
  src/root-layout.tsx        the theme, the fonts, the database gate
  src/lib/db.ts              the only data API of the app (section 4)
  src/lib/preview-db.ts      the sql.js driver of the browser preview (section 7)
  .claude/settings.json      deny rules: no write in migrations/, no network tools
  .claude/hooks/...          the PreToolUse hook of the web-app template
  CLAUDE.md                  the desktop rules of the agent
  template_version           line 1 `desktop-app@<semver>`, line 2 the date
  scripts/pack.mjs           packs `desktop-app-<semver>.tar.gz`
```

The agent changes the schema only with the `add_local_migration` host tool
(section 6). The deny rules block a direct write under `migrations/`. The
MCP `apply_changes` tool refuses a path under `migrations/` too. A GitHub
Update can write `migrations/`; the `desktop-build` task checks every file
again before CI. A desktop turn gets no backend tool, no `enable_ai`, and no
`request_network_host`. The API gives a desktop project no cloud backend,
and every Cloud route answers 404. The
installed app reaches no remote host, so the agent must not build a feature
that needs one.

The installed app runs only script files of the app origin (section 3). So
`index.html` holds no inline script and no remote script tag. The browser
preview does not show this failure.

The router uses browser history, not hash history. So the preview bridge
posts the real page path to the builder. A reload on a page path still loads
`index.html`: Vite dev falls back to it, and so does the shell (section 3).

In the shell, `src/root-layout.tsx` loads one stylesheet,
`/wandit-fonts/theme.css`, with no preconnect. The build task writes that
file (section 9). In Vite dev and in the builder preview, the app loads the
remote theme stylesheets. The build drops every user file under
`dist/wandit-fonts/`, so the app must never write files to
`public/wandit-fonts/`.

## 3. Native shell (`templates/desktop-shell/`)

```
desktop-shell/
  src-tauri/
    Cargo.toml, Cargo.lock     pinned crates; CI builds with --locked
    build.rs                   embeds ../migrations/*.sql, checks names and UTF-8
    tauri.conf.json            the static config
    tauri.macos.conf.json      the macOS bundle keys, merged on macOS only
    capabilities/main.json     the 4 app commands, nothing else
    icons/                     the default icon set and the fixed macOS icon.icns
    src/main.rs, src/lib.rs    app setup, menu, navigation lock, updater
    src/db.rs                  connection, migration runner, authorizer, commands
    src/backup.rs              backups, export, import
  README.md
```

The build input (section 9) places `dist/` and `migrations/` next to
`src-tauri/`. So `frontendDist` is `../dist`, and `build.rs` reads
`../migrations`.

The server writes one file per build: `src-tauri/tauri.desktop.json`. CI
merges it with `--config tauri.desktop.json` (section 9). Only these keys
come from the server:

```json
{
  "productName": "<desktop_apps.product_name>",
  "mainBinaryName": "<desktop_apps.binary_name>",
  "version": "1.0.<release number>",
  "identifier": "app.wandit.p<project id without dashes>",
  "plugins": {
    "updater": {
      "pubkey": "<desktop_apps.updater_public_key>",
      "endpoints": ["<updates base URL>/desktop/<project id>/<manifest of the build platform>"]
    }
  }
}
```

The endpoint is `latest.json` for a Windows build and `latest-macos.json`
for a macOS build (`desktopManifestKey(projectId, build.platform)` in
`desktop-build.runtime.ts`). So each build writes its own input archive.

Static config of the shell (`tauri.conf.json`):

- `app.windows`: `[]`. Rust creates the main window in `setup`, with the
  product name as its title, so the navigation lock applies to it. The
  window opens `WebviewUrl::App("index.html")`. The Tauri asset resolver
  answers `index.html` for an unknown path, so a reload on a router path
  works.
- `bundle.targets`: `["nsis"]`. `bundle.createUpdaterArtifacts`: `false`.
  The server signs, so CI needs no key.
- `bundle.windows.nsis.installMode`: `currentUser`. No admin prompt.
- `bundle.windows.webviewInstallMode`: `embedBootstrapper`. Windows 10 and
  11 only.
- `app.withGlobalTauri`: `false`. `app.security.freezePrototype`: `false`,
  the Tauri default. With `true`, Tauri freezes `Object.prototype` before
  the first page script. A library that sets `toString` on its own
  prototype then throws at load, for example `decimal.js-light` of
  recharts. The script stops, and the window stays white.
- `app.security.csp`:
  `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline';
  img-src 'self' data: blob:; font-src 'self' data:;
  connect-src ipc: http://ipc.localhost; object-src 'none';
  base-uri 'self'; form-action 'none'; frame-src 'none'`.
  The theme fonts are local files in `dist/wandit-fonts/` (section 9), so
  the CSP needs no font host.
- `app.security.dangerousDisableAssetCspModification`: `["script-src"]`.
  Without it, Tauri adds a nonce to each script tag of an HTML file, also
  to a remote one. `script-src 'self'` then lets that tag run. With it,
  Tauri adds no nonce and no hash to `script-src`. So only a script
  file of the app origin runs. An inline `<script>` and a remote script tag
  never run, also in `index.html`. The Vite build writes neither. The
  browser preview does not show this failure. Tauri injects its own init
  scripts outside the CSP, so they need no nonce.
- `plugins.updater.windows.installMode`: `passive` (Windows only).
- `plugins.updater.requireSignedVersion`: `true`. The plugin refuses a
  signature whose trusted comment has no version, or a version that is not
  the manifest version (section 10). This is a security setting: never
  remove it.

macOS config (`tauri.macos.conf.json`). Tauri merges it over
`tauri.conf.json` on macOS only. An array in it replaces the array of the
base file. The server file `tauri.desktop.json` has no `bundle` key, so it
does not change these values.

- `bundle.targets`: `["app", "dmg"]`. The `.app` is the source of the
  update archive (section 9). The disk image is the download.
- `bundle.icon`: the 4 PNG files and `icons/icon.icns`. Tauri takes the
  window icon from a PNG. Without an `.icns` in the list, the bundler names
  the icon `<productName>.icns`, and the signature seals that name. The
  disk image is HFS+, which stores an accented name in another Unicode
  form. The seal then breaks for a name like "Gestion Café". With the fixed
  `icon.icns`, no file in the app takes the product name. Never run
  `cargo tauri icon`: it also writes the Windows `icon.ico` again.
- `bundle.macOS.signingIdentity`: `-`, an ad-hoc signature. Apple silicon
  runs no executable without a signature. An app with only the linker
  signature shows "damaged" after a download, with no Open Anyway button.
  So CI never builds with `--no-sign`.
- `bundle.macOS.minimumSystemVersion`: `15.0` (D36).
- `hardenedRuntime` keeps its default, `true`. The app has no entitlements.

CSP on every answer: Tauri sets the CSP header only on an `.html` answer
of the app protocol. A worker script, an `.svg` file, or an `.htm` page
would then run with no CSP. So `create_main_window` registers
`on_web_resource_request`, which adds the CSP of `tauri.conf.json` to each
answer that has none. An `.html` answer keeps the CSP of Tauri, because it
holds the style nonces of the page. A build with no CSP in its config does
not start.

Plugins: `tauri-plugin-updater`, `tauri-plugin-dialog`,
`tauri-plugin-process`, `tauri-plugin-single-instance`. A second start of the
app focuses the first window, so two processes never migrate one file. On
macOS, the lock of the single-instance plugin is a socket in the shared
`/tmp` (security.md section 14).

Navigation lock: the main window loads only the app origin of the current
system: `http://tauri.localhost` on Windows, `tauri://localhost` on macOS
(`is_app_origin` in `lib.rs`). Tauri gives IPC only to that origin. Every
other navigation and every `window.open` is refused.

Downloads: the shell refuses every download (`on_download` answers
`false`). Else WebView2 or WKWebView writes the file to the Downloads
folder, with a name that the page chooses.

WebView2 browser args (`WEBVIEW2_BROWSER_ARGS`, Windows only). They close
the channels that the CSP does not control: WebRTC (UDP, TCP, and DNS) and
DNS prefetch.

- `--disable-features=msWebOOUI,msPdfOOUI,msSmartScreenProtection`: the
  wry default. A custom value replaces it, so the shell repeats it.
- `--proxy-server=http://127.0.0.1:1`: Windows has no service on that
  port, so no TCP request of the webview reaches a host.
- `--force-webrtc-ip-handling-policy=disable_non_proxied_udp`: WebRTC
  sends no UDP.
- `--host-resolver-rules="MAP * ~NOTFOUND"`: every host name fails, so DNS
  prefetch and WebRTC send no DNS query.

wry answers `tauri.localhost` and `ipc.localhost` itself, before the
network stack. The updater runs in Rust, so the args do not touch it.
On Windows, `proxy_url()` is not used: wry adds its proxy arg only when no
custom args are set.

macOS network lock. WKWebView takes no browser args. Two parts in
`create_main_window` (`lib.rs`) close the channels that the CSP does not
control:

- `locked_webview_configuration` gives the main window its own WebKit
  configuration. It sets the private `WKPreferences` key
  `peerConnectionEnabled` to false before the first page script, then
  reads it back. `RTCPeerConnection` is then not defined. A missing key or
  a value that stays on gives an error, and the window does not open (fail
  closed). The function also sets `DNSPrefetchingEnabled` to false when
  WebKit still has that setter. Newer WebKit makes the setter a no-op, so
  the runbook measures DNS prefetch (macOS staging check 6).
- `proxy_url(LOOPBACK_PROXY_URL)`, `http://127.0.0.1:1`, from the
  `macos-proxy` feature of `tauri` (`Cargo.toml`). No service listens on
  that port. So an HTTP load that the CSP does not govern, for example a
  preconnect, reaches no host. The proxy does not stop WebRTC UDP. It needs
  macOS 14 or later.

When the window does not open on macOS, `setup` shows the dialog "The app
did not open" and keeps the app running. The app menu and the update check
still work, so a fixed build reaches the user.

Native menu, owned by Rust (the frontend cannot break it):

- Windows (a window menu): File (Back up now, Export data..., Import
  data..., Quit) and Help (Check for updates, About).
- macOS: Tauri ignores a window menu, so `setup` sets the menu on the app
  (`set_menu`). The first submenu is the app menu: About, Hide, Hide
  Others, Show All, and Quit (Cmd+Q). Then File (Back up now, Export
  data..., Import data...), Edit, Window (Minimize, Maximize, Close
  Window), and Help (Check for updates). Edit gives Cmd+C, Cmd+V, and the
  other edit keys to the webview.
- When the last window closes, the app quits, on both systems.

All dialogs are Rust calls to `tauri-plugin-dialog`. The webview never gives
a file path to Rust.

## 4. JS and Rust contract

The webview may call 4 commands. `capabilities/main.json` grants
`allow-db-select`, `allow-db-execute`, `allow-db-batch`, and
`allow-app-info`, and no plugin permission.

Types:

```ts
type SqlValue = string | number | null;   // BLOB is not supported
type SqlParam = SqlValue | boolean;       // true -> 1, false -> 0
type DbErrorCode =
  | "migration_failed"   // the database did not open or migrate at start
  | "statement_refused"  // the statement kind is not allowed for this command
  | "sql_error"          // SQLite refused the statement; message is SQLite text
  | "too_many_rows"      // a select answered more than 10,000 rows
  | "unsupported_value"  // a BLOB column, or a number that is not finite
  | "invalid_input";     // a limit below is broken
```

| Command | Arguments | Answer |
|---|---|---|
| `db_select` | `{ sql: string, params?: SqlParam[] }` | `{ columns: string[], rows: SqlValue[][] }` |
| `db_execute` | `{ sql: string, params?: SqlParam[] }` | `{ changes: number, lastInsertRowId: number }` |
| `db_batch` | `{ statements: { sql: string, params?: SqlParam[] }[] }` | `{ results: { changes: number, lastInsertRowId: number }[] }` |
| `app_info` | `{}` | `{ version: string, schemaVersion: number, databaseBytes: number, lastBackupAt: string \| null }` |

A failed command rejects with `{ code: DbErrorCode, message: string }`.

Limits: `sql` at most 100,000 bytes; at most 999 params; one statement per
`sql` (a second statement is `invalid_input`); `db_batch` at most 500
statements, in one transaction (all or none); `db_select` at most 10,000 rows.
The param count must equal the parameter count of the statement
(`sqlite3_bind_parameter_count`, the highest parameter index), else
`invalid_input`. So `?1` used two times takes one param. An integer above
2^53 loses precision in JavaScript.

Order and time limit: the commands run one at a time, each on a blocking
thread. A call runs after each call that the app awaited before it. A
waiting command holds no thread, so a stuck command never blocks the async
workers of the update check. Each command
has a time limit of 10 s (`COMMAND_TIME_LIMIT` in `db.rs`). A whole
`db_batch` counts as one command. SQLite checks the limit only between two
VM steps (a progress handler). So the limit stops a loop, for example a
recursive CTE over a `parent_id` cycle. It does not stop one long function
call, for example LIKE, `instr`, or `replace` on a long text. Such a call
delays the later commands, but not an update (section 10). A stopped
command rejects with `sql_error` and this message: `interrupted: the call
ran longer than 10 s, so the shell stopped it. Make the query faster, for
example with an index or a LIMIT.` A stopped batch rolls back. The runner,
the backups, the export, and the import have no time limit.

An SQL text with no statement (only spaces, comments, or semicolons) gives
`invalid_input` with the message "The SQL text holds no statement.". A text
that starts with no keyword gives `sql_error`: SQLite cannot parse it.

Statement rules (an SQLite authorizer on the connection, after migrations):

- Refused: ATTACH, DETACH, PRAGMA, every CREATE, DROP, and ALTER, REINDEX,
  ANALYZE, virtual tables, BEGIN, COMMIT, ROLLBACK, SAVEPOINT, RELEASE, and a
  write to `wandit_migrations` or a `sqlite_` table.
- `db_select` also needs a read-only statement (`sqlite3_stmt_readonly`).
- `db_execute` and `db_batch` accept INSERT, UPDATE, DELETE, and SELECT.

`src/lib/db.ts` in the template is the only caller. It exports:

```ts
export function select<Row extends Record<string, SqlValue>>(sql: string, params?: SqlParam[]): Promise<Row[]>;
export function execute(sql: string, params?: SqlParam[]): Promise<{ changes: number; lastInsertRowId: number }>;
export function batch(statements: { sql: string; params?: SqlParam[] }[]): Promise<{ changes: number; lastInsertRowId: number }[]>;
export class DbError extends Error { code: DbErrorCode }
```

In the Tauri shell (`"__TAURI_INTERNALS__" in window`) it calls
`invoke` from `@tauri-apps/api/core`. In the Electron shell
(`"wanditDesktop" in window`) it calls the bridge of section 13. In the
browser preview (`vite dev`) it
loads `preview-db.ts` with a dynamic import. That import is behind an
`import.meta.env.DEV` check, so a production build holds no sql.js. Outside
the shell, a production build answers `migration_failed`. The app shows an
error screen for `migration_failed`.

## 5. Database on the user machine

- File: `<base>/data/app.db`. Backups: `<base>/backups/`. The base folder
  (`DataPaths` in `lib.rs`) is `%LOCALAPPDATA%\<identifier>` on Windows and
  `~/Library/Application Support/<identifier>` on macOS. On macOS, WebKit
  also writes `~/Library/WebKit/<identifier>` and
  `~/Library/Caches/<identifier>`. Both systems use one `.db` format. The
  runbook proves an export from a Mac into a Windows app (macOS staging
  check 15).
- Settings on open: `journal_mode=WAL`, `foreign_keys=ON`,
  `trusted_schema=OFF`, `busy_timeout=5000`, `synchronous=NORMAL`,
  `SQLITE_DBCONFIG_DEFENSIVE=1`, `SQLITE_LIMIT_ATTACHED=0`. Extension load
  stays off. The gate dry run uses the same `foreign_keys` and
  `trusted_schema` values.
- Ledger table, created by the shell:

```sql
CREATE TABLE IF NOT EXISTS wandit_migrations (
  version INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  sha256 TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('applied', 'replaced', 'skipped')),
  recorded_at TEXT NOT NULL,
  app_version TEXT NOT NULL
)
```

`CREATE_LEDGER_SQL` in `db.rs` and `LEDGER_SQL` in `preview-db.ts` hold
this exact text, with no `;`. Never change it. The import check compares
the `sqlite_schema` text, so a changed text refuses every earlier export.

Each embedded version gets exactly one ledger row. `sha256` is always the
hash of the file of that version, also for a `replaced` or `skipped` row.
`recorded_at` is a UTC time in ISO 8601. No logic reads `status`. It is
for support:

- `applied`: the SQL of this file ran.
- `replaced`: this file is a target. Its newest replacement ran in its
  place.
- `skipped`: this file is a replacement, and its SQL did not run. Its
  target ran at an earlier start, or a newer replacement ran.

Replacement file: a new file that replaces one frozen file. Line 1 is
`-- wandit:replaces NNNN` and one LF. `NNNN` is the version of the target,
4 ASCII digits from `0001` to `9999`. A line that starts with `-- wandit:`
is valid only as this line 1. A typo, a CRLF, version `0000`, or a marker
on a later line makes the file invalid. `DESKTOP_MIGRATION_REPLACES_PATTERN`
and `parseDesktopMigrationHeader` (packages/contracts) hold the rule.
`replaced_version` in `db.rs` and `parseMigrationHeader` in `preview-db.ts`
copy it. `build.rs` does not read line 1: a replacement is an ordinary
file for it.

Migration runner, at each start, before the webview can query:

1. Open the file and apply the settings. Create the ledger.
2. Read the ledger.
3. For each ledger row whose version the app embeds, the SHA-256 must be
   equal. Else: stop with `migration_failed`.
4. Pending = embedded versions that are not in the ledger. If a pending
   version is below the highest ledger version: stop with
   `migration_failed`. Ledger rows above every embedded version are
   allowed, so a build that embeds fewer files still opens the database.
   The schema is additive, so the older code still works.
5. If pending is empty: the database does not change. Go to the
   authorizer.
6. Read line 1 of every embedded file. Stop with `migration_failed` when a
   file has an invalid line. Also stop when a replacement names a missing
   file, a version that is not earlier, or another replacement. This step
   comes after step 5, so a bad group never locks out an install that has
   nothing to run.
7. If the ledger is not empty: write the backup
   `backups/before-<app version>-<UTC time>.db` with the SQLite online
   backup API. If the backup fails: stop with `migration_failed`. Never
   migrate without a backup. `<UTC time>` has a fixed width, for example
   `20261104T153012345Z`, and no `:`, because Windows refuses it in a name.
8. `BEGIN IMMEDIATE`. All pending files and their ledger rows run in this
   one transaction.
9. Walk the pending files in version order:
   - A replacement: record it `skipped`. Its target is in the ledger, or
     this walk recorded the target already.
   - A plain file with no replacement: run it, then record it `applied`.
   - A plain file with replacements: run its newest replacement in its
     place. Record the target `replaced`, the newest replacement
     `applied`, and each other replacement `skipped`.
10. COMMIT. On any error in steps 8 to 10: ROLLBACK, and stop with
    `migration_failed`. The database is then exactly as before the update.
    A deferred foreign key fails at COMMIT. SQLite then keeps the
    transaction open, so the rollback runs in that case too.

Then the shell installs the authorizer. The commands now work.

Example: a new install with the files `[1, 2 = F, 3, 4 = R replaces 2]`
runs R at the place of 2, before 3. The ledger then holds `1 applied`,
`2 replaced`, `3 applied`, and `4 applied`. An install that ran F has the
pending file `[4]`: R is `skipped`, and its SQL does not run.

Checks: the runner runs the statements of a file in order, and counts
them from 1. A read-only statement that answers columns is a check
(`sqlite3_stmt_readonly`, and a column count above 0). In a file that
passed the gate, only a top-level SELECT is a check. A check must answer
exactly one row with one column, and the value must be the INTEGER 1. Any
other answer fails the file. The reason is one of these texts:

- `answered <c> columns, not 1`, `answered no row`, or
  `answered more than one row`.
- `answered <value>, not the integer 1`. `<value>` is `NULL`, an integer,
  `<number> (REAL)` (so 1.0 shows `1 (REAL)`), the first 50 characters of
  a text in quotes, or `a BLOB`.

A failed file gives one of these texts:

- `Migration <file> failed: Statement <n>: <SQLite text>`. An error inside
  a check, for example `json_extract` on `'{'`, also has this form.
- `Migration <file> failed: Statement <n> is a check that <reason>: <text>`.
  `<text>` is the check, trimmed, cut at 200 characters.
- `Migration <file> failed: The ledger row could not be written: <error>`.

In the `migration_failed` state, the 4 commands answer `migration_failed`,
and a native dialog says that the step that failed changed no data. The
dialog also shows the reason. No file of the failed update stays applied.
No connection to the file is open. The update check still runs, so a fixed
build reaches the user. Before that update installs, the shell writes the
backup `before-update-<from version>-<UTC time>.db` (see "Backups").

The embedded files come from `build.rs`: the sorted list of
`(version, name, sql, sha256)`. `build.rs` refuses a file name that breaks
`DESKTOP_MIGRATION_FILE_PATTERN`. It also refuses an entry that is not a
regular file, and a file that is not UTF-8. The SHA-256 is of the exact
bytes, which are the UTF-8 text that the gate checked.

Backups:

- Automatic: `before-<app version>-<UTC time>.db` before a migration,
  `before-update-<from version>-<UTC time>.db` before an update install, and
  `before-import-<UTC time>.db` before an import. With an open database, the
  copy uses the online backup API, in one step, so it reads one snapshot.
  In the `migration_failed` state, it is a copy of the closed file (`.db`
  and `-wal`). All `before-` files count as automatic backups: the shell
  keeps the 10 newest, with their `-wal` files.
- The `before-update` copy first opens its own read-only connection, so it
  never waits for a webview command. WAL gives that connection the last
  commit. When that copy fails, the shell copies under the database lock.
  In the Ready state, it uses the app connection. In the
  `migration_failed` state, it copies the closed file. So a file that does
  not open still gets a backup, and a fixed build still installs.
- Manual: File > Back up now writes `backups/manual-<UTC time>.db`. The shell
  never deletes a manual backup.
- Export: a Save dialog, then the online backup API to that path.
- Import: an Open dialog. The shell copies the file into the data folder
  and opens the copy read-only. It checks the SQLite header and
  `PRAGMA integrity_check` (`ok`). The ledger must be a table, and each
  ledger row must match an embedded file (version and SHA-256). The schema
  must equal a fresh database migrated to the same version (same
  `sqlite_schema` rows, so no extra trigger or view). The fresh run takes
  each embedded file whose place is at or below the highest ledger
  version. The place of a replacement is the version of its target. So the
  fresh run runs a replacement in place of its target, as a new install
  does, also when the replacement is above that version. The gate proves
  that both files make the same schema (section 6). Then a confirm dialog,
  the `before-import` backup, a clean close, an atomic rename, the runner,
  and a window reload.
- The NSIS uninstaller keeps the data unless the user ticks its delete box.
  On macOS, a drag of the app to the Trash keeps the data folders above.
  An update install never deletes data.

## 6. Migration rules and the gate

Migration files are `migrations/NNNN_snake_name.sql`. A file that a `ready`
build held is frozen: the build writes it to `desktop_migrations` (version,
name, SHA-256). Installed apps may have run it.

The gate (`checkDesktopMigrations`) runs in two places: in the
`add_local_migration` host tool, and in the `desktop-build` task before CI.
A file from a GitHub Update skips the host tool. The build gate is the check
that protects installed apps. A refused file blocks every build until a
restore or another GitHub change fixes it.
It refuses:

- a bad name, a duplicate version, a file above 256 KB, more than 500 files,
  or more than 4 MB in total;
- a changed or missing frozen file;
- a new file whose version is not above the last frozen version;
- a bad `-- wandit:` line, or a replacement whose target is not a frozen
  plain file (`migration_replaces_invalid`);
- a statement off the allow list (`migration_statement_refused`);
- a statement that fails on the test rows or on a new install
  (`migration_dry_run_failed`);
- a check that does not answer the integer 1 there
  (`migration_check_failed`);
- a replacement that makes another schema than its target
  (`migration_replaces_schema_differs`).

Allow list for a new file:

- CREATE TABLE (not TEMP, not `AS SELECT`), CREATE INDEX, CREATE VIEW,
  CREATE TRIGGER.
- CREATE UNIQUE INDEX only on a table that no frozen file creates. Saved
  rows can hold duplicates. A replacement must copy the same CREATE
  statement, so no later build can fix such an index. When the gate cannot
  read the table name, it refuses the statement.
- ALTER TABLE ... ADD COLUMN. On a frozen table, the ADD COLUMN probe
  decides (see "Dry run").
- DROP INDEX, DROP TRIGGER. They hold no data, and no query names them.
- INSERT OR IGNORE. SQLite then skips a row that breaks a UNIQUE,
  NOT NULL, CHECK, or PRIMARY KEY rule. A plain INSERT is refused.
  `ON CONFLICT DO NOTHING` without `OR IGNORE` is refused too: it does not
  skip a NOT NULL error. REPLACE and DO UPDATE are refused, because they
  change saved rows.
- UPDATE OR IGNORE of columns that this build adds. A migration never
  changes a value that the user saved. The gate refuses an UPDATE with
  `IS [NOT] DISTINCT FROM` in a SET value. It cannot read the SET columns
  after it, so it fails closed. The agent uses IS or IS NOT.
- Checks: a top-level SELECT (section 5).
- Never: DROP TABLE, DROP VIEW, ALTER TABLE RENAME or DROP COLUMN, DELETE,
  PRAGMA, ATTACH, transactions, VACUUM, and any use of `wandit_migrations`.
- Never WITH, at any place in a statement. A recursive query can run
  without end.
- Never a `sqlite_` or `pragma_` name, also in quotes or in a string. The
  installed app has the ledger table and another SQLite version. So a read
  of `sqlite_schema` or `sqlite_version()` answers other values there.
- Never a function that only sql.js has (`SQLJS_ONLY_FUNCTIONS`), for
  example `floor`, `ceil`, `sqrt`, `power`, `log`, or `median`. The SQLite
  of the shell does not have them.

OR IGNORE does not skip a foreign key error, a STRICT type error, or a
function error (`json_extract` on malformed text, an `abs()` overflow).
The test rows and the new-install run find these errors. When one escapes,
the one transaction of section 5 keeps the data, and a replacement can fix
the statement.

These rules keep each table, column, and view of an older build. So the
code of that build works on the newer database. A rebuild of older code
(section 10) needs this rule.

Risky DDL. These statements can fail on saved rows and pass on an
empty table. The decision for each one:

- ADD COLUMN with NOT NULL and no default, or with `DEFAULT NULL`: the
  probe refuses it.
- ADD COLUMN with REFERENCES and a default that is not NULL: the probe
  refuses it.
- ADD COLUMN with `DEFAULT CURRENT_TIMESTAMP` or a default expression: the
  probe refuses it. `DEFAULT (1)` passes.
- ADD COLUMN with a CHECK or a generated value: the probe decides with the
  default. A CHECK or an `AS (...)` that reads another column fails with
  "no such column".
- ADD COLUMN on a STRICT table, with a default of another type: the probe
  refuses it.
- CREATE UNIQUE INDEX on a frozen table: refused.
- CREATE INDEX with an expression or a WHERE on a frozen table: accepted.
  The test rows decide: row 6 holds the malformed JSON `'{'`.
- CREATE VIEW, CREATE TRIGGER, a new CREATE TABLE, DROP INDEX, and
  DROP TRIGGER: accepted. They read or change no saved row.
- An INSERT or an UPDATE that can fire a trigger or a foreign key action:
  the trigger rule refuses it.
- A `DEFERRABLE INITIALLY DEFERRED` reference with the child row first:
  accepted. The gate checks each statement at once, so it is stricter than
  the shell, which checks at COMMIT.

Dry run (sql.js, SQLite in WebAssembly, in memory, no file access). Each
database sets `foreign_keys=ON` and `trusted_schema=OFF`. It also has
these limits:

- A heap limit of 64 MiB (`hard_heap_limit`), with the temp data in that
  heap (`temp_store = MEMORY`). sql.js keeps the database file and the
  temp files in JavaScript memory, outside the heap limit.
- A file limit of 32 MiB (`max_page_count` 8192). The legal folders that
  were measured make files of 8 MiB or less.
- A query that goes past a limit fails with "out of memory" or "database
  or disk is full". That error is a finding.
- One deadline of 30 s for the three runs together
  (`DRY_RUN_DEADLINE_MS`). The `node:vm` watchdog stops sql.js, also
  inside WebAssembly. A timeout gives one `migration_dry_run_failed`
  finding on `migrations/`: "The dry run stopped after 30 s." The gate then
  loads a new copy of the sql.js package, because the stopped module can
  hold a broken heap.

`locking_mode = EXCLUSIVE` keeps the page cache between the statements and
changes no result. A large legal folder holds 4 MiB of one-row INSERT
statements and 5 indexes. Its cold run took about 4 s on an Apple M1 Max.
The 1 vCPU Trigger machines are slower. The gate answers the findings of
the first run that has some.

1. Run 1, the upgrade path. Run the frozen plain files: only CREATE, ALTER,
   and DROP execute, and other statements are prepared only. Read the
   frozen schema, and add the test rows. Run the new plain files with the
   allow list: INSERT, UPDATE, and checks execute. The first file with a
   finding stops the run. Then refuse a frozen table or column that is
   gone, a temporary object, and a view that names a missing table.
2. Run 2, one database for each new replacement. Run the frozen plain files
   below its target, and add the test rows. Run the replacement with the
   allow list. Its `sqlite_schema` rows must then equal the rows after the
   target in run 1, byte for byte. The finding shows the expected CREATE
   text: a lowercase keyword or one more space gives another text.
3. Run 3, a new install with no rows. Each plain file runs as its newest
   replacement, as in the shell. Every statement runs, and checks are
   evaluated. A finding on a frozen file contains "New installs fail on
   this file. Call add_local_migration with replaces: <version>."
   `<version>` is always a plain file, never a replacement.

Run 2 stops after the replacement. On the same schema, the frozen files
above the target give the same result. Their data statements passed the
test rows of their own build. Run 3 covers the replacement and every later
file on a new install.

Rules of runs 1 and 2:

- Test rows: up to 15 rows in each table of an earlier build. The
  triggers are dropped and the foreign keys are off during the inserts.
  Rows 1 to 6 fill every column. Row 1 holds normal values, and row 2 is a
  copy of row 1, except the keys. Row 3 holds NULL in the nullable columns.
  Row 4 holds empty values, row 5 negative values, and row 6 the malformed
  JSON `'{'` in the text columns. Rows 7 to 15 fill only the columns
  without a default. Rows 8 to 15 cycle through the quoted literals of each
  text column, so an enum CHECK passes. A text key has the shape of a UUID,
  so `CHECK (length(id) = 36)` passes. Each insert is INSERT OR IGNORE, so
  a table rule never stops the dry run. Imported files can hold rows with a
  missing parent, so the test rows can hold them too.
- ADD COLUMN probe: run 1 also runs each ADD COLUMN of a frozen table in a
  separate database. That database holds a one-row table with the same
  name and no old rule. SQLite checks some ADD COLUMN rules only on a
  table with rows. An error refuses the statement. Run 2 skips the probe:
  a replacement copies the ADD COLUMN of its target, which passed the probe
  in its own build.
- Trigger rule: before it runs a statement, the gate refuses an INSERT or
  an UPDATE that can fire a trigger. The same is true for a foreign key
  action: ON UPDATE CASCADE, SET NULL, SET DEFAULT, or RESTRICT. The
  finding is `migration_statement_refused`. The gate reads `EXPLAIN` of the
  statement. SQLite compiles each such trigger or action into a `Program`
  opcode. It does so also when a WHEN clause or empty test rows stop it.
  So the rule does not depend on the test rows. OR IGNORE does not stop a
  trigger, and a trigger body runs under the outer OR IGNORE. The agent
  drops the trigger before the statement and creates it again after it.
- After the first refusal in a file, the later statements do not run. They
  only get their static refusals. The database then differs from a real
  install, so a later result is noise.
- In runs 1 and 2, the text of a dry-run error or a failed check starts
  with "On the test rows: ". In run 3, it starts with "On a new install: ".

The `add_local_migration` host tool picks the next version, above every
file and every frozen version. It runs the gate on the folder plus the new
file. It writes the file only when the gate answers no findings. Its input
and output are `addLocalMigrationToolInputSchema` and
`addLocalMigrationToolOutputSchema` in packages/contracts. It is on only for
a project whose framework is `desktop-app`. More rules:

- The optional input `replaces` (1 to 9999) makes the tool write line 1
  `-- wandit:replaces NNNN` before the SQL.
- The tool encodes the text as UTF-8, gates the decoded text of those
  bytes, and writes those bytes. So the gate checks the text that the app
  embeds, also when the input holds a lone surrogate.
- After a pass, a second gate run treats every earlier file that is not
  frozen as frozen. A build that started before the call can still freeze
  those files without the new one. These findings start with "If a build
  ships the earlier migrations before this one: ". So a backfill and a
  CREATE UNIQUE INDEX go in the migration that adds their column or table.
  With two gate runs, one tool call can take 60 s at most.
- The build task runs the gate one time, with the real frozen rows.

A file that fails on the saved rows of an install: the update rolls back as
one unit, and the app shows `migration_failed` (section 5). The data stays
as it was. A rebuild of an older build does not help: it embeds every
frozen file, the failed file too (section 10). The agent writes a
replacement with `replaces`, and the owner builds and releases it. Installs
where the file passed skip the replacement. Installs where it failed run
the replacement in place of the failed file. A replacement copies each
CREATE, ALTER, and DROP statement of its target, so it can fix only
INSERT, UPDATE, and checks. A DDL statement that fails on
saved rows has no fix. The ADD COLUMN probe and the UNIQUE index rule stop
such statements before the first build.

## 7. Preview in the sandbox

The sandbox runs `pnpm run dev`. The browser preview has no Tauri, so
`db.ts` uses `preview-db.ts`:

- sql.js from the template dependencies, with its wasm file from Vite.
  `db.ts` imports `preview-db.ts` only when `import.meta.env.DEV` is true, so
  a production build holds no sql.js.
- The migrations from `import.meta.glob("/migrations/*.sql", { query: "?raw", eager: true })`,
  run in version order with the same ledger table and the same
  `foreign_keys` and `trusted_schema` values. A new or changed file reloads
  the page.
- The runner rules of section 5, steps 5 to 10. So all pending files run in
  one transaction, with the checks, the replacement groups, and the skip
  rule. A check is a statement whose first keyword is SELECT. With nothing
  pending, a stored database opens, also with a bad replacement group. The
  error texts are the texts of the shell, with `migrations/<file>` in place
  of `Migration <file>`. On an error, the preview drops the database in
  memory. The stored bytes keep the state before the open.
- The database bytes in IndexedDB, one entry per preview host. Each project
  preview has its own host. When IndexedDB is blocked, the data stays in
  memory until a reload.
- The same answers and error codes as section 4. The statement rules are an
  approximation by the first keyword. A `LIMIT` block in `preview-db.ts`
  lists the known differences from the shell. The desktop app enforces the
  real rules.
- A write call saves the bytes when `total_changes()` changed during the
  call. So a write through a trigger also saves.
- The preview database starts again from empty in these cases:
  - a migration file changed after the preview ran it;
  - a pending version is below the highest ledger version;
  - the stored bytes do not open;
  - a pending file fails on the stored rows.

  It answers `migration_failed` only when a file also fails on an empty
  database. This is preview data only.

## 8. API

Routes are in `desktopRoutes` (packages/contracts). All four need the
project role `editor`, which the global `ProjectAccessGuard` checks from the
project row. The workspace header does not decide. A viewer gets 403, and a
caller without access gets 404.

- `GET /api/v2/projects/:id/desktop` answers `desktopOverviewResponseSchema`.
  `app.releases.windows` and `app.releases.macos` each hold the manifest
  URL (`updatesUrl`), the stable download link (`downloadUrl`), and the
  current build (`currentBuildId`) of that platform. Each build has its
  `platform`. `buildablePlatforms` is `["windows", "macos"]` while
  `DESKTOP_MACOS_BUILDS_ENABLED` is true, else `["windows"]`. The web shows
  the platform choice only with 2 entries. For a suspended project,
  `suspension` holds the reason code and the time, and each `downloadUrl`
  and the `installerUrl` of every build are null. The web then shows the
  reason and disables Build. Cancel stays on. The web shows Release for a
  ready build with an `installerUrl` that is not older than the current
  build of its platform. It shows Rebuild for a ready build that is older
  (section 10).
- `POST .../desktop/builds` with `createDesktopBuildBodySchema` (the
  required `platform` is `windows` or `macos`; the notes have at most
  `desktopBuildNotesMaxLength` characters; the optional `rebuildOfBuildId`
  is a uuid):
  1. The project must be a desktop project (`framework` is `desktop-app`),
     else 404. A suspended project (`projects.suspended_reason_code`)
     answers 403 `PROJECT_SUSPENDED`.
  2. A request key that a build of the project already has answers that
     build. The route holds no credits for it. Else, a macOS create while
     `DESKTOP_MACOS_BUILDS_ENABLED` is false answers 403
     `DESKTOP_PLATFORM_UNAVAILABLE`. The flag check comes after the replay,
     so a retry of an accepted request still answers its build.
  3. The commit. With `rebuildOfBuildId`: the commit of that build. It
     must be a build of the same project, else 404, and `ready`, else 409
     `DESKTOP_BUILD_NOT_READY`. Without it: the head of `main`, else
     `DESKTOP_BUILD_NO_VERSION`. The rebuild takes only the commit: the
     body names the platform. The web Rebuild button sends the platform of
     the old build.
  4. The DESKTOP_* env values must exist (`requireV2Env`), and the updates
     URL of the manifest of the platform must exist (`requireBuildConfig`).
  5. Hold `DESKTOP_BUILD_CREDITS` with the idempotency key
     `desktop_build:<project id>:<request key>` (`desktop_build`, fixed
     price, no parent).
  6. In one transaction:
     - Take the advisory lock `desktop-builds:<credit owner>`, so two
       creates of one payer never both pass the count.
     - A repeated request key answers its first row.
     - Count the live builds of the payer in all its projects. A build of a
       deleted project does not count. At
       `MAX_LIVE_DESKTOP_BUILDS_PER_PAYER` (2), refund the hold and answer
       409 `DESKTOP_BUILD_LIMIT_REACHED`. The payer is the organization of
       a team project, else the owner of a personal project
       (`projects.user_id`), also when a member or a collaborator builds.
       The count reads the payer from the project row.
     - On the first build: write `desktop_apps` with the product name, the
       binary name, and a new Ed25519 updater key pair. The private key is
       encrypted with `APP_SECRETS_ENCRYPTION_KEY`, with
       `<project id>:DESKTOP_UPDATER_KEY` as the authenticated data.
     - Insert the build row (`queued`, its `platform`, next release
       number). `desktop_builds.user_id` holds the user who asked: the
       actor, not always the payer. One counter serves both platforms, so each build has its
       own version (section 10). The unique index answers
       `DESKTOP_BUILD_ACTIVE` for a second live build, of any platform.
  7. Write the `desktop.build` audit row and start the `desktop-build` task.
     The audit metadata holds `commitSha`, `platform`, `version`, and
     `rebuildOfBuildId` (null for a normal build).
- `POST .../builds/:buildId/cancel`: cancels the CI run and releases the
  hold. Audit `desktop.cancel`. The route stops only a `queued`,
  `preparing`, or `building` build. A build in `signing` answers as it is:
  CI is done and paid, so a refund would make the signed files free.
  The web then shows a toast. After 90 min in `signing`
  (`DESKTOP_SIGNING_STUCK_AFTER_MS`), the route can stop it, because only
  a crashed run stays there that long. A build that ended answers as it
  is. The task stop (section 9) still cancels every live status.
- `POST .../builds/:buildId/release`: only a `ready` build that has its
  files, else `DESKTOP_BUILD_NOT_READY`. The files are the download file
  (`installer_key`) and the signature, and on macOS also the update
  archive (`update_archive_key`). A suspend removes every file key. A
  suspended project answers 403 `PROJECT_SUSPENDED`. Then, in one
  transaction that locks the `desktop_apps` row:
  1. Read the release number of the current build of the same platform in
     the lock query. A build with a lower release number answers 409
     `DESKTOP_BUILD_OLDER_THAN_CURRENT`: installed apps accept only a newer
     version (section 10). The owner rebuilds it instead. A Windows release
     never makes a macOS build older, and the reverse.
  2. Copy the download file to the stable download object of the platform
     (`desktopStableInstallerKey`).
  3. Write the manifest of the platform: `latest.json` or
     `latest-macos.json`.
  4. Read the project again, on the same transaction. When staff
     suspended or deleted it during the writes, delete the top-level
     release objects and answer 403 `PROJECT_SUSPENDED`. The transaction
     rolls back, so the current-build pointer does not change.
  5. Set `released_at` on the build and the pointer of its platform on the
     app: `current_windows_build_id` or `current_macos_build_id`. The
     pointer of the other platform does not change.

  Each release uses one pool connection. Audit `desktop.release`, with the
  metadata `{ platform, version }`. A release costs no credits.
  `DESKTOP_MACOS_BUILDS_ENABLED` does not gate release or cancel. They use
  no runner minute, and a fixed build must reach Mac apps also while new
  macOS builds are off.

Binary name: the product name, NFKD, without marks, lowercase, each run of
other characters as one `-`, no `-` at the two ends, at most 40 characters.
Empty gives `app`. A reserved Windows name (`con`, `prn`, `aux`, `nul`,
`com1` to `com9`, `lpt1` to `lpt9`) gets `-app` at the end. It never changes
after the first build, as the product name. Both platforms use it: it names
the executable, the download files, and the root folder of the macOS update
archive.

## 9. Build task and CI

`desktop-build` Trigger task, one per build row. One attempt, machine
`medium-1x`, `maxDuration` 4800 s. The starter sets `concurrencyKey` to the
project id, so one build per project runs at a time. The task claims the
`queued` row, then leases the credit hold (section 11).

1. `preparing`: use the running sandbox of the project (kept alive), or
   start one without a turn. Check out the build commit with
   `git worktree add --detach`. Read `migrations/` and
   `src/styles/theme.json` at the commit, before `pnpm install`, so no
   install or build script changes them. Each migration file must be
   UTF-8: a file that is not UTF-8 gives a `migration_dry_run_failed`
   finding. The task reads theme.json only when `find -maxdepth 0 -type f`
   shows a regular file under 64 KiB. A symlink or a larger file counts as
   missing. `appThemeFileSchema` parses it. A missing or invalid file gives
   no fonts and a warning, not a failure. Then run
   `pnpm install --frozen-lockfile` and `pnpm run build`. Read `dist/` with
   the publish limits: no symlink, an `index.html`, at most 5,000 files and
   100 MB. Run the secret scanner on `dist/` (`secret_in_frontend`). Run the
   gate with the frozen rows. A finding gives `blocked` and releases the
   hold. A gate that throws gives `gate_unavailable`.

   A rebuild (a commit that a ready build already holds) reads
   `migrations/` from a second worktree. Its commit is the commit of the
   first build of the highest frozen version (`findMigrationsCommit`). That
   build held every frozen file, because the gate gives each new file a
   version above every frozen version. The frontend and `theme.json` still
   come from the commit of the row. The task removes both worktrees at the
   end.
2. Bundle the theme fonts, then write the build input
   `desktop-input.tar.gz`:

   ```
   src-tauri/                 from templates/desktop-shell (worker image copy)
   src-tauri/tauri.desktop.json
   dist/                      the checked frontend files
   dist/wandit-fonts/         theme fonts and theme.css, written by the task
   migrations/                one folder entry, then the checked SQL text
   ```

   Theme fonts: the task fetches each distinct css `href` of
   `resolved.fonts` (Google Fonts or Fontshare). It uses
   `redirect: "error"`, a desktop Chrome User-Agent, and one 60 s deadline
   for all fetches. It keeps only `@font-face` blocks, with only
   `font-family`, `font-style`, `font-weight`, `font-stretch`,
   `font-display`, `unicode-range`, and `src`. Each value must match a
   strict pattern. A `src` url must be https on `fonts.gstatic.com` or
   `cdn.fontshare.com`, and woff2 or woff (woff2 first). Each file must
   start with the woff2 or woff signature. The task downloads at most 40
   files, 2 MB each, 8 MB in total. It names each file
   `<first 16 hex of its sha256>.<ext>`. Then it writes
   `dist/wandit-fonts/theme.css` with `url("/wandit-fonts/<name>")`. The
   task always writes theme.css. The file is empty when there is no font. A
   failure only logs a warning. The task drops every user file under
   `dist/wandit-fonts/`.

   Each `dist/` and `migrations/` path must be printable ASCII and a valid
   Windows name. So a path has no `< > : " | ? * \` and no device name such
   as `con.js`. No name ends with a dot or a space. No part is empty, `.`,
   or `..`. No two paths differ only in case. Another path fails with
   `output_invalid`. The archive has one folder entry `migrations/`, so
   `build.rs` finds the folder also when it holds no file. The entry order
   and the headers are fixed, so the same input gives the same bytes.

   Upload it to `desktop-temp/<project id>/inputs/<build id>-<random>.tar.gz`.
   In each key of this section, `<random>` is 32 hex digits (128 random
   bits). Each call makes a new one. The bucket is public, so only an
   unknown key keeps an object private. The temporary objects live under
   `desktop-temp/`. An R2 lifecycle rule on that prefix deletes each one
   1 day after its upload (runbook, desktop "Setup"). So a late CI upload
   or a crashed task leaves no object for good. The project delete drains
   `desktop-temp/<project id>/` too.
3. `building`: dispatch the workflow of the platform with
   `return_run_details: true`: `build.yml` (Windows) or `build-macos.yml`
   (macOS) (`WORKFLOW_FILES` in `github-desktop-build-runner.ts`). An
   Electron project uses the 2 workflows of section 13.
   Inputs: `build_id`, `input_url` (presigned GET, 2 h), `input_sha256`, and
   `output_url` (presigned PUT, 2 h). `output_url` is for
   `desktop-temp/<project id>/staging/<build id>-<random>.exe` on Windows
   and `...-<random>.dmg` on macOS. A macOS dispatch also sends
   `update_url` (presigned PUT, 2 h) for `...-<random>.app.tar.gz`. GitHub
   refuses an input that the workflow does not declare, so a Windows
   dispatch never sends `update_url`. Poll the run every 20 s, at most
   70 min. After a run that did not succeed, read its jobs
   (`GET .../actions/runs/{id}/jobs`). A failed step "Self-test the
   installed app" gives `self_test_failed`. The 4 workflows use this step
   name (`SELF_TEST_STEP`). Any other failure, and a failed jobs read, gives
   `ci_failed`.
4. `signing`: check, sign, and upload the files of the platform. Each
   staged file has a limit of 300 MB (`MAX_INSTALLER_BYTES`), and a missing
   file or a wrong magic gives `artifact_invalid` (`downloadStagedFile` in
   `desktop-build.runtime.ts`).
   - Windows: the staged installer must start with `MZ`. Compute its
     SHA-256. Sign it (section 10), and verify the signature with the
     public key. Its name is `<binary name>-<version>-setup.exe`.
   - macOS: the last 512 bytes of the staged disk image must start with
     `koly`, the UDIF trailer. Compute its SHA-256. The staged archive must
     start with the gzip bytes `1f 8b`. `repackMacAppArchive` checks the
     archive and writes it again ("macOS update archive" below). A broken
     rule gives `artifact_invalid`, with the rule in `error_message`. Sign
     the new archive, and verify the signature. The names are
     `<binary name>-<version>.dmg` and `<binary name>-<version>.app.tar.gz`.
   - Upload the files to one folder
     `desktop/<project id>/builds/<build id>-<random>/`
     (`desktopBuildFolderKey`), with `Cache-Control: no-cache` and the
     headers of `desktopDownloadHeaders`. Nobody knows the key until the
     `ready` row stores it. A build that stops before `ready` deletes these
     files (`signedKeys`). Delete the input and the staged files.
5. `ready`: in one transaction, write the file fields and insert the
   `desktop_migrations` rows of the new files. The installer fields hold the
   setup exe or the disk image. `update_archive_key` holds the macOS archive
   and is null on Windows. `updater_signature` signs the update file: the
   setup exe or the archive. The write answers no row for a suspended or
   deleted project; the task then stops and deletes the files. Then settle
   the hold.

Any failure gives `failed` with a `desktopBuildErrorCodes` value and releases
the hold. The staged and input objects are deleted.

macOS update archive. The macOS updater drops the first path part of each
archive entry and unpacks it with no `..` check. Only the minisign signature
gates it. So `repackMacAppArchive` (`macos-update-archive.ts`) reads the CI
archive with strict rules, and the task signs only the archive that the
server writes. The rules:

- Gunzip has an output cap of 200 MB (`MAX_UNPACKED_BYTES`), so a gzip bomb
  stops in zlib.
- Each header has the magic `ustar\0`, the version `00`, and a correct
  checksum. A number is octal text. A base-256 number fails.
- Type `0` (or NUL) is a file, and type `5` is a folder. Every other type
  fails: links, devices, pax headers (`x`, `g`), and GNU long names (`L`,
  `K`).
- The path is `prefix/name`. Each byte is ASCII, and each part matches
  `SEGMENT_PATTERN` (`^[A-Za-z0-9_][A-Za-z0-9._-]*$`). So no part is empty,
  `.`, `..`, or an AppleDouble `._` name, and no path starts with `/`.
- The first entry is the folder `<binary name>.app`. Every other entry is
  `<binary name>.app/Contents` or under it.
- Each entry comes after its parent folder. So a folder that tar dropped
  also fails. No two paths differ only in case. A folder has size 0. The
  archive has at most 1,000 entries (`MAX_ENTRIES`).
- `Contents/Info.plist`, `Contents/MacOS/<binary name>`, and
  `Contents/_CodeSignature/CodeResources` exist. `Contents/MacOS/` holds
  only the binary.
- After the end block, every byte is zero.

The new archive has the same paths, in the same order, with the same file
bytes. The tar writer (`packTarGzip` in `desktop-build-input.ts`) sets owner
0, time 0, mode 0755 on the binary and the folders, and mode 0644 on other
files. So no header field that the parser did not read reaches the signed
file. The server does not read `Info.plist` or the code signature: CI checks
the seal of the unpacked archive.

Stop checks: the task reads the row and the project at the start, before
the dispatch, and at each poll. A row that ended ends the run: the API
cancel, or the failed start of the API, already released the hold. A
suspended project (`projects.suspended_reason_code`) or a deleted project
(`projects.deleted_at`) stops the build at its next stop check, or at the
refused `ready` write. The task cancels CI, deletes the input, the staged
files, and the signed files, moves the row to `canceled`, and releases the hold
(`desktop_build_canceled`). The project delete also removes the
`desktop_apps` row. A queued build of that project still claims its row and
stops at the first stop check. When the `ready` write is refused but the
read after it finds no reason, staff lifted the suspension in between. The
task then stops with the reason `suspension_lifted`: it deletes the
signed files, moves the row to `canceled`, and releases the hold.

Windows CI workflow (`tooling/desktop-builder/.github/workflows/build.yml`,
copied to the private repo):

- `on: workflow_dispatch` with the 4 inputs. `permissions: {}`.
  `runs-on: windows-2022`. `timeout-minutes: 60`.
- Each input goes into `env:`. No `${{ }}` inside a `run:` script.
- The first step, "Mask and check the URLs", reads the two URLs from
  `GITHUB_EVENT_PATH`. It masks them, then checks them against the repo
  variable `DESKTOP_BUILD_BUCKET_URLS`. That variable holds one bucket URL
  for each environment:
  `https://<R2_BUCKET>.<R2_ACCOUNT_ID>.r2.cloudflarestorage.com`.
  An empty variable fails the step. Each check is a full-string,
  case-sensitive regex:
  - `input_url`:
    `<bucket URL>/desktop-temp/<uuid>/inputs/<uuid>-<32 hex>.tar.gz?<query>`.
  - `output_url`: the same shape with `staging/` and `.exe`.
  - The query holds only `[A-Za-z0-9%=&._~-]`, so it holds no `/`, `#`,
    or `@`. An empty URL or a URL with a line break also fails.

  Only the API holds the R2 keys that write a `desktop-temp/` object and
  sign its URL. So a stolen dispatch token cannot make CI build its own
  input. When `r2.ts` changes its endpoint (for example `forcePathStyle` or
  an R2 jurisdiction host), change these patterns in the same PR.
- The next step checks `build_id` (uuid) and `input_sha256` (64 hex),
  downloads the input, checks its SHA-256, and extracts it with the tar of
  Windows. Then it checks that the workspace root holds only `src-tauri/`,
  `dist/`, and `migrations/`.
- The cargo cache is restore-only (`actions/cache/restore`). A separate
  workflow on the default branch saves it. So a user build never writes a
  cache that another build reads.
- Every action is pinned by commit SHA. Rust and tauri-cli are pinned, and
  tauri-cli installs with `--locked`. The build command is
  `cargo tauri build --ci --bundles nsis --config tauri.desktop.json -- --locked`.
  tauri-cli refuses `--locked`, so it goes to `cargo build` after `--`.
- `warm-cache.yml` saves the caches of both platforms. It has 2 jobs for
  the Tauri shell: `warm` (Windows) and `warm-macos` (macOS). Section 13
  gives its 2 Electron jobs. Each job runs the build
  command of its workflow with `--config ../tauri.desktop.json`, because
  `sync-shell.mjs` writes the fixture config next to `src-tauri/`. A push
  to `main`, a manual start, and a daily schedule (03:17 UTC) start it.
  GitHub deletes a cache after 7 days without access, so the daily run
  makes a deleted cache again.
- "Download and check the WebView2 bootstrapper" runs before the build. The
  installer embeds this exe (`embedBootstrapper`), and the pinned
  tauri-bundler 2.10.4 downloads it with no check. So the step downloads
  `https://go.microsoft.com/fwlink/p/?LinkId=2124703` itself, to
  `%LOCALAPPDATA%\tauri\MicrosoftEdgeWebview2Setup.exe`. The Authenticode
  status must be `Valid`, and the signer CN must be exactly
  `Microsoft Corporation`. The bundler then finds the file and skips its
  own download. If Microsoft changes the file or the signer name, every
  build fails with `ci_failed` until someone changes the step.
- Self-test, in 3 steps before the upload. "Install the app on the runner"
  checks that `mainBinaryName` is lowercase kebab-case, runs the NSIS
  installer with `/S /D=%LOCALAPPDATA%\wandit-self-test-install`, and
  checks that `<install folder>\<mainBinaryName>.exe` exists. It writes
  that path to the step output `app-exe`. So a bad name or a missing exe
  gives `ci_failed`, not `self_test_failed`.
  "Self-test the installed app" runs the `app-exe` file with
  `--wandit-self-test`.
  With this argument, the shell opens no window and uses no network. It
  runs `try_open_app_database` (the runner, then the authorizer) on a new
  database in a temp folder, deletes the folder, and prints one line:
  `wandit-self-test: ok, <N> migrations` (exit 0) or
  `wandit-self-test: failed: <reason>` (exit 1). The step prints that line
  between `::stop-commands::` markers. "Uninstall the app" runs
  `uninstall.exe /S` also after a failed self-test. A new database has
  every file pending, so the runner also checks each replacement group.
- Upload the one `.exe` to `output_url` only after every step before it
  passed. No GitHub artifact. The log prints the SHA-256 of the installer
  (`runbook.md`).

macOS CI workflow (`tooling/desktop-builder/.github/workflows/build-macos.yml`,
copied to the private repo). It keeps the rules of `build.yml` above, with
these changes:

- `on: workflow_dispatch` with 5 inputs: the 4 of `build.yml` and
  `update_url`. `permissions: {}`. `runs-on: macos-15` (Apple silicon, 3
  vCPU). cargo builds for the host, so the app runs only on Apple silicon.
  `timeout-minutes: 45`: a cold build takes about 10 to 25 minutes
  (ESTIMATE). The job must stop before the 70-minute poll of the task.
- "Mask and check the URLs" masks and checks 3 URLs. `output_url` must be a
  presigned URL of `staging/<uuid>-<32 hex>.dmg`, and `update_url` of
  `staging/<uuid>-<32 hex>.app.tar.gz`. The input check and the bucket
  check are the same as in `build.yml`.
- The input step extracts with `/usr/bin/tar` (bsdtar). It refuses an
  absolute path, a `..` part, and a write through a symlink.
- The cargo cache is restore-only, with the exact key
  `desktop-cargo-v1-macos-arm64-rust-<Rust>-tauri-cli-<tauri-cli>-<hash of Cargo.lock>`.
  The `macos-arm64` part keeps it apart from the Windows key. The
  `warm-macos` job of `warm-cache.yml` saves it.
- The build command is
  `cargo tauri build --ci --bundles app,dmg --config tauri.desktop.json -- --locked`.
  The disk image script needs `CI=true`, else it asks Finder for the window
  layout and times out. GitHub sets `CI=true` in every job.
- "Check the signatures and mount the disk image" (5 min). It checks that
  `mainBinaryName` is lowercase kebab-case, and that the bundle folders
  hold exactly 1 app and 1 disk image. It runs
  `codesign --verify --deep --strict` on the app. It mounts the disk image
  read-only and runs `codesign` again on the app in it. HFS+ stores names in
  another Unicode form, so this finds a seal that breaks there. It checks
  that `Contents/MacOS/<mainBinaryName>` exists. A failure here gives
  `ci_failed`, not `self_test_failed`.
- "Self-test the installed app" (5 min) runs the binary of the app inside
  the mounted disk image with `--wandit-self-test`. The output rules are the
  same as on Windows.
- "Make and check the update archive". `ditto --norsrc --noextattr --noqtn
  --noacl` copies the app to `<mainBinaryName>.app`. Then
  `COPYFILE_DISABLE=1 /usr/bin/tar --no-mac-metadata --no-xattrs --no-acls
  --no-fflags --format ustar -czf` writes plain ustar. The root folder comes
  first, each folder comes before its content, and no pax header exists.
  tar drops a name that ustar cannot hold and still exits 0. So the step
  unpacks the archive and runs `codesign` on the unpacked app.
- "Upload the disk image and the update archive" puts the files to
  `output_url` and `update_url`. The log prints the name, the size, and the
  SHA-256 of each file. The disk image hash must equal `installer_sha256`.
  The archive hash differs on purpose: the server writes the archive again.
- The job holds no secret: no signing key and no updater key. The disk
  image stays mounted until the job ends.

The installer is not Authenticode-signed (D34). Windows SmartScreen shows a
warning on the first download.

The macOS app has an ad-hoc signature and no notarization (D36). On the
first start, Gatekeeper shows "Not Opened". The user opens the app one time
with System Settings > Privacy & Security > Open Anyway. The web shows these
steps (`appBuilder.desktopBuilds.gatekeeper` in `publish-popover.tsx`) while
macOS is buildable or a macOS download link exists.

## 10. Updater

Each app has its own Ed25519 key. The public key is in every built app, on
both platforms. The private key never leaves the API and the task. The
signed update file is the setup exe on Windows and the re-packed
`.app.tar.gz` on macOS.

Signature format (minisign, as tauri-plugin-updater 2.x verifies it):

- Key id: 8 random bytes. The comment shows it as 16 uppercase hex digits of
  the little-endian u64.
- Public key = base64 of the text
  `untrusted comment: minisign public key: <KEY ID>\n<base64("Ed" + key id + 32-byte public key)>`.
- Signature: BLAKE2b-512 of the file, then Ed25519 (the prehashed `ED`
  form). Global signature: Ed25519 of `signature (64 bytes) + trusted comment`.
- Signature file = base64 of the 4-line text:
  `untrusted comment: signature from tauri secret key`,
  `<base64("ED" + key id + signature)>`,
  `trusted comment: timestamp:<unix>\tfile:<file name>\tversion:<version>`,
  `<base64(global signature)>`. The version in the comment equals the
  manifest version. `requireSignedVersion` makes the plugin check it, so a
  bad manifest cannot pair a new version with an older signed file.

Manifests: one per platform, with `Cache-Control: no-cache`
(`desktopManifestKey` in `r2.ts`):

- Windows: `desktop/<project id>/latest.json`, with the keys
  `windows-x86_64` and `windows-x86_64-nsis`. The url is the setup exe.
- macOS: `desktop/<project id>/latest-macos.json`, with the keys
  `darwin-aarch64` and `darwin-aarch64-app`. The url is the re-packed
  archive, not the disk image.

The plugin looks for `<os>-<arch>-<installer>` first, then `<os>-<arch>`.
So both keys of a platform hold the same entry (`updateManifest` in
`desktop-builds.service.ts`). The shape is `desktopUpdateManifestSchema`: a
union of the 2 key sets, each a strict object, so a mixed key set fails.
One file cannot hold both platforms. The signed version must equal the
manifest version, and a newer manifest version with no entry for the
running system gives `TargetsNotFound` in the plugin.

Update flow in the app: at start and from Help > Check for updates, Rust
checks the endpoint. When the remote version is newer than the installed
version, a native dialog shows the version and the notes. The default
comparator of the plugin makes this check. Else Help > Check for updates
says that the installed version is the newest. On "Install": backup
(section 5), download, signature check by the plugin, and install. A
failed backup stops the update. The backup uses its own read-only
connection, so a stuck webview command (section 4) never stops an update.

- Windows: `download_and_install` starts the NSIS installer
  (`/P /UPDATE /R`) and ends the app with `process::exit`. The installer
  then starts the new version, and its migration runner runs.
- macOS: the plugin unpacks the archive and replaces the `.app` folder in
  place. Then the shell calls `app.restart()`. Only macOS and Linux reach
  `app.restart()`. An app that runs from Downloads or from the disk image
  runs from a random read-only path (App Translocation), so the install
  fails. The "Update failed" text then ends with "Open the app from the
  Applications folder, then try again." (`INSTALL_FAILED_HINT` in
  `lib.rs`). For a standard user, the plugin asks for an admin password.

The check at start shows no dialog for a check error or for "no update".
After "Install", every update error shows a dialog, also in the start
check.

No downgrade: an installed app installs only a newer version (D35).
`requireSignedVersion` refuses a manifest that gives a higher version with
the url and signature of an older build. Both rules together stop a
changed manifest from installing an older signed build. The release route
refuses a build older than the current build of its platform (409
`DESKTOP_BUILD_OLDER_THAN_CURRENT`, section 8). Each platform has its own
pointer, so a Windows release cannot move a Mac app back.

One key signs both platforms, and one release counter serves both
(`release_number` in `desktop-apps.ts`). So each build has its own version.
The signed version must equal the manifest version, so a signed file of one
platform never passes as an update of the other. A Mac app compares only
with the macOS manifest, so a gap in its version numbers is harmless.

Rollback by rebuild: for a ready build older than the current one, the web
shows Rebuild. A rebuild is a new build of the commit of that build
(`rebuildOfBuildId`, section 8), for the platform in the body. It gets the
next release number and
costs `DESKTOP_BUILD_CREDITS`. Its frontend and theme come from the old
commit. Its `migrations/` come from a commit that holds every frozen file
(section 9, step 1). The gate refuses a missing frozen file. The old
frontend then runs on the newer database, which works because the schema
is additive (D33). The owner releases the rebuild as any build, and
installed apps take it as an update. A rebuild does not fix a file that
fails on saved rows: it embeds that file too. Only a replacement file fixes
it (section 6).

Stable download link, one per platform (`desktopStableFileName` in
`r2.ts`): `desktop/<project id>/<binary name>-setup.exe` (Windows) and
`desktop/<project id>/<binary name>.dmg` (macOS). Each is a copy of the
current download file of its platform, written on each release of that
platform, with `Cache-Control: no-cache`.

Suspend and delete: a staff suspend clears both current-build pointers and
sets `installer_key` and `update_archive_key` to null on every build of the
project (`withdrawRelease`). Then it deletes the whole
`desktop/<project id>/` prefix: both manifests, both stable download
objects, and every build file. Installed apps stop updating, and no
download link works. An unsuspend restores nothing: no build has a file,
so the owner builds again. A deleted project loses the whole
`desktop/<project id>/` prefix (`v2ProjectPrefixes`) and its `desktop_apps`
row with the encrypted updater key. When that row delete fails, the task
logs `app-project.delete.desktop-app-failed` and continues. Staff then
delete the row (runbook, "Suspend and delete"). The `desktop_builds` and
`desktop_migrations` rows stay. Installed apps of a deleted project never
get an update again. A build of a deleted project stops at its next stop
check: the task cancels it and refunds its hold (section 9).

The updates base URL is `DESKTOP_UPDATES_BASE_URL`, else
`R2_PUBLIC_BASE_URL`. It is fixed in each built app, so change it only with
a redirect from the old host.

## 11. Credits

One build holds `DESKTOP_BUILD_CREDITS` (operation `desktop_build`). A
rebuild is a build, so it costs the same. `ready` settles the hold.
`failed`, `blocked`, and `canceled` (also a canceled build of a deleted or
suspended project) release it. The cancel route cannot stop a `signing`
build (section 8), so a signed installer is never free. A cold Windows
build takes about 35 minutes: 10 for tauri-cli and 25 for the shell
(ESTIMATE). A cached Windows build takes about 8 minutes (ESTIMATE).

A macOS build has the same price (D36, `DESKTOP_BUILD_CREDITS` in
packages/contracts). The settle row holds the platform
(`rawUsage: { ciRunId, platform }`). A macOS runner minute costs $0.062. A
cached macOS build takes 5 to 8 minutes, $0.31 to $0.50 (ESTIMATE). A cold
macOS build takes 10 to 25 minutes, $0.62 to $1.55 (ESTIMATE), so it can
cost more than its price of $0.80. A failed build refunds the hold, but
GitHub bills the minutes. One payer has at most 2 live builds, so the worst
case is about $7.44 per hour on macOS. The runbook counts these failures
each week.

The task leases the hold and renews the lease (heartbeat) after each step and
at each poll. The lease TTL is 40 min, so the stale-hold sweep skips a live
build. A hold that is not `reserved` at the lease, or that leaves `reserved`
during the build, fails the build with `internal`. The task reads the hold
with no payer check and takes the payer from the hold row. With billing on,
a missing hold, or a hold of another project, actor, or operation, fails the
build with `internal` before any work. `createBuildCreditHold` in
`apps/server/src/trigger/build-credit-hold.ts` holds this code.

Refund reasons:

- `desktop_build_create_failed`: the create route held the credits but
  queued no build.
- `desktop_build_canceled`: the cancel route, or the task stop of a deleted
  or suspended project. A refused `ready` write always ends with this
  refund at once, also when staff lift the suspension before the next stop
  check (`suspension_lifted`, section 9).
- `desktop_build_blocked`: a gate or secret finding.
- `desktop_build_failed`: a failure of the task.

A run that ends without a terminal write leaves the row live. The user
cancels it, and the sweep refunds the hold after the lease ends.

## 12. Limits

- Windows x64, and macOS 15 or later on Apple silicon (D36). No Linux
  build. An Intel Mac refuses the app. One build makes the files of one
  platform.
- No remote network from the app (section 3). Windows uses the CSP and the
  WebView2 browser args. macOS uses the CSP, the WebKit preference, and the
  loopback proxy. No BLOB values. No file download.
- macOS builds start only while `DESKTOP_MACOS_BUILDS_ENABLED` is true
  (`packages/env/src/server.ts`). It is also the kill switch. It gates only
  create.
- The macOS app has an ad-hoc signature and no notarization. The user
  opens it one time with Open Anyway (section 9). The ad-hoc designated
  requirement is the code hash, so each update resets the privacy grants of
  the app. The shell uses no grant today.
- The macOS WebRTC block uses a private WebKit key. When Apple removes it,
  the window does not open until an update (section 3). Repeat the runbook
  network probe (macOS staging check 6) after each macOS major release.
- DNS prefetch on macOS: open until macOS staging check 6. Newer WebKit
  ignores the setter of `DNSPrefetchingEnabled`.
- A macOS app updates only from a writable folder, for example
  Applications (section 10).
- The macOS re-pack holds up to 4 copies of the archive, about 900 MB at
  the limits. The build sources use the same 2 GB `medium-1x` machine
  (LIMIT in `desktop-build.runtime.ts`). Upgrade: a streaming tar reader.
- GitHub Free, Pro, and Team run at most 5 macOS jobs at the same time, for
  the whole account (D36). The task stops 70 min after the dispatch, also
  while GitHub queues the job. So a long queue can time out macOS builds.
- On macOS, the single-instance lock is a socket in the shared `/tmp`.
  Another local user can take the path first and stop the start.
- No custom icon. No rename after the first build.
- No downgrade. A rollback is a rebuild at the price of a build
  (section 10).
- One live build per project, of any platform, and at most 2 live builds
  per payer in all its projects. There is no global cap: the CI repo runs
  builds in parallel up to the GitHub concurrency of the account.
- The release keeps the `desktop_apps` row lock and one pool connection
  while R2 copies the download file (up to 300 MB). A create of the same
  project waits. That create holds the payer lock. So every create of the
  same payer in other projects waits too, and each holds one pool
  connection. Upgrade: a Redis lock per project around the R2 writes, then
  a short transaction.
- The time limit of a webview command stops a loop, but not one long
  function call (section 4). Such a call delays the later commands. It
  also delays Back up now, Export, and Import, which wait for the database
  lock. It never stops an update.
- Theme fonts: at most 40 font files, 2 MB each, 8 MB in total. A cap drops
  the faces after it, in css order.
- A migration can pass the dry run and fail on the saved rows of an
  install (section 6). The update then rolls back, and the data stays as
  it was. A replacement file fixes INSERT, UPDATE, and checks. A frozen DDL
  statement that fails on saved rows has no fix.
- The test rows cannot fill a table whose CHECK needs a value that no
  literal gives. Examples: `CHECK (length(code) = 3)`, a CHECK that ties
  two columns, or a table CHECK that refuses NULL. They also hold one
  malformed JSON text, not every value that breaks an index expression.
  Upgrade: solve each CHECK for a value.
- The gate dry run blocks the event loop of the task, for 30 s at most
  per run (section 6). The host tool can run the gate two times. So one
  tool call can block the event loop for 60 s at most. After a timeout,
  the static import keeps the first sql.js module in memory. That is about
  160 MB at most per process. Each later timeout frees the module before
  it. Upgrade: a worker thread.
- The gate time was measured on an Apple M1 Max, not on the 1 vCPU
  Trigger machines (runbook, staging checks). A frozen table with many
  expensive generated columns can make every later gate run of the project
  reach the deadline. The project then cannot build, and only support can
  recover it.
- The second gate run of the host tool assumes that a build ships all
  earlier files that are not frozen together. It does not check a build
  that froze only some of them. Upgrade: one run per earlier file that is
  not frozen. That run is also stricter than the build gate, also when no
  build runs.
- The SQLite of the shell has no math functions, and sql.js has them. The
  gate refuses those functions in a migration. In app code, the preview
  runs them and the installed app fails (`templates/desktop-app/CLAUDE.md`).
- A failed CI self-test shows `self_test_failed` to the user. The agent
  does not get the reason line. Staff read it in the CI log.
- A suspend has no undo: after an unsuspend, no build has a download
  file, so the owner builds again.
- Installed apps of a deleted project never get an update. Wandit cannot
  stop or delete an app on a user machine.
- The preview approximates the statement rules of the shell (section 7, the
  `LIMIT` block in `preview-db.ts`).
- The Electron engine is experimental (D37). Its own limits are in
  section 13.

## 13. Electron engine (Desktop app 2)

The Electron engine is a second native shell (D37). It is experimental. The
create prompt box shows it as the app type "Desktop app 2". The project
template, the preview, the migration gate, the build task, the publish
popover, the release flow, the credits, and the manifests are the same as
for the Tauri engine. This section gives each difference. Security notes:
`security.md` section 14, "Electron engine".

### Engine of a project

- `projects.desktop_engine` (pg enum `desktop_engine`: `tauri`, `electron`)
  holds the engine. `desktopEngines` in packages/contracts holds the same
  values. `projects.target_platform` stays `desktop`, and
  `projects.framework` stays `desktop-app`.
- `POST /api/v2/projects` accepts `desktopEngine` only with
  `targetPlatform: "desktop"`. Another platform with the key answers 400. A
  desktop create with no key stores `tauri`. A web or mobile create stores
  NULL.
- NULL on a desktop project means `tauri`: a row older than the column.
- The engine never changes after the create. No route writes the column.
- The project answer (`appProjectSchema`) has `desktopEngine`, nullable.
- Web: the app type "Desktop app 2" sends `targetPlatform: "desktop"` and
  `desktopEngine: "electron"` (`toAppTypeTarget` in
  `apps/web/src/lib/app-type-choice.ts`). "Desktop app" sends no engine.
- The agent cannot see or select the engine. The agent prompt and the
  template `CLAUDE.md` are the same for both engines.
- An Electron build needs `desktop-app@1.1.0` or later: `src/lib/db.ts` of
  1.0.0 has no Electron mode. Each Electron project is new, so it has that
  template.

### Parts

| Part | Tauri engine | Electron engine |
|---|---|---|
| Shell folder | `templates/desktop-shell/src-tauri/` | `templates/desktop-shell-electron/shell/` |
| Shell language | Rust | Plain JavaScript (CommonJS), no compile step |
| Browser | WebView2 (Windows), WKWebView (macOS) | The Chromium inside Electron 45.3.1, on both systems |
| SQLite | rusqlite | `node:sqlite` of the Node 24.22 inside Electron |
| Config file of a build | `src-tauri/tauri.desktop.json` | `shell/wandit.desktop.json`, the same JSON |
| CI workflows | `build.yml`, `build-macos.yml` | `build-electron.yml`, `build-electron-macos.yml` |
| Bundler | tauri-cli | electron-builder 26.18.0 |
| App origin | `http://tauri.localhost`, `tauri://localhost` | `app://app` |
| Page to shell | `invoke` | `window.wanditDesktop` |
| Update signature | minisign | `wandit-ed25519-v1` |
| macOS update file | the re-packed `.app.tar.gz` | the disk image |

### Shell folder

```
desktop-shell-electron/
  README.md
  shell/
    package.json, package-lock.json   electron 45.3.1 and electron-builder 26.18.0, exact
    electron-builder.config.cjs       the packaging config; reads ./wandit.desktop.json
    icons/icon.icns, icon.ico         copies of the Tauri shell icons
    src/main.js                       start, network switches, single instance, self-test
    src/config.js                     reads and checks wandit.desktop.json
    src/app-origin.js, window.js      the app:// protocol, the CSP, the locks, the window
    src/preload.js, commands.js       the bridge and the 4 IPC commands
    src/menu.js, dialogs.js           the native menu and dialogs
    src/updater.js, update-files.js, update-install.js   the updater
    src/db/                           the database process, the runner, the backups
    test/, testing/                   unit tests (node:test)
```

The shell has no runtime npm dependency: only `node:` modules and
`electron`. `templates/desktop-shell-electron/README.md` lists each file.

### Build input and packaging

The task writes this archive for an Electron build (`DESKTOP_SHELL_LAYOUTS`
in `desktop-build-input.ts`):

```
shell/                      from templates/desktop-shell-electron/shell (worker image copy)
shell/wandit.desktop.json
dist/                       the checked frontend files
dist/wandit-fonts/          theme fonts and theme.css, written by the task
migrations/                 one folder entry, then the checked SQL text
```

- The copy of `shell/` has no top-level `node_modules/` and no `release/`.
- `shell/wandit.desktop.json` holds exactly the JSON of
  `tauri.desktop.json` (section 3), byte for byte.
- `trigger.config.ts` copies the shell to the worker image. Its glob skips
  dotfiles, so the shell must not need one.
- `electron-builder.config.cjs` reads `./wandit.desktop.json` with
  `config.js`. It stops when `mainBinaryName` is not lowercase kebab-case,
  the version is not `N.N.N`, or the endpoint is not https. It also stops
  when `../dist/index.html` or `../migrations` is missing.
- The app archive (`app.asar`) holds `package.json`, `wandit.desktop.json`,
  `src/`, `dist/`, and `migrations/`.
- File names are ASCII. The app bundle, the executable, and the install
  folder use `mainBinaryName` (the reason is in section 3, `bundle.icon`).
- The product name shows in the window title, the menu, the dialogs, the
  NSIS shortcut, and the uninstall entry.
- macOS: `CFBundleName` is `mainBinaryName`, not the product name. Electron
  finds its helper apps by that name. With another value the app stops
  with "Unable to find helper app". `CFBundleDisplayName` and an
  `InfoPlist.strings` file in each language folder give macOS the product
  name.
- Windows: target `nsis`, x64, `oneClick`, `perMachine: false`. No admin
  prompt. The output is `release/<mainBinaryName>-<version>-setup.exe`.
- macOS: target `dmg`, arm64 only, identity `-` (ad-hoc), hardened runtime
  on, `minimumSystemVersion` 15.0, the fixed `icons/icon.icns`. The output
  is `release/<mainBinaryName>-<version>.dmg`. electron-builder adds the
  entitlements `allow-jit`, `allow-unsigned-executable-memory`, and
  `disable-library-validation`.
- Fuses (`electronFuses`): `runAsNode`,
  `enableNodeOptionsEnvironmentVariable`, and
  `enableNodeCliInspectArguments` are off. `onlyLoadAppFromAsar`,
  `enableEmbeddedAsarIntegrityValidation`, and `enableCookieEncryption` are
  on. The ad-hoc signed macOS build runs with all 6.
- `electronDownload.checksums` is `electron/checksums.json` of the
  installed npm package. `npm ci` checks that package against
  `package-lock.json`. So electron-builder refuses an Electron zip that
  does not match the lock file.

### Runtime rules

- Frontend: the window loads `app://app/`. `app` is a standard, secure
  scheme (`protocol.handle`). The root path and each unknown path answer
  `index.html`. A path guard refuses each path outside the packed `dist`
  folder.
- CSP: every answer of the protocol has this header, also an error answer:
  `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline';
  img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self';
  object-src 'none'; base-uri 'self'; form-action 'none'; frame-src 'none'`.
  Each answer also has `X-Content-Type-Options: nosniff`. The shell does
  not freeze prototypes.
- Window: `contextIsolation` and `sandbox` are on. `nodeIntegration` and
  the webview tag are off. A packed app has no developer tools. The spell
  checker is off, because it downloads word lists.
- Commands: each IPC handler accepts only the main frame of the main
  window, on the origin `app://app`. `input.js` checks the argument types,
  and `db/database.js` checks the limits of section 4.
- Navigation lock: `will-navigate`, `will-frame-navigate`, and
  `will-redirect` refuse each URL outside `app://app`. Every `window.open`
  is denied. Every webview is refused.
- Downloads: the session cancels each download.
- Permissions: the session denies each permission request, each
  permission check, and each device.
- Network lock: `webRequest.onBeforeRequest` cancels each request whose
  scheme is not `app`, `devtools`, `data`, or `blob`. 3 Chromium switches
  are set before `ready`: `host-resolver-rules` `MAP * ~NOTFOUND`,
  `proxy-server` `http://127.0.0.1:1`, and
  `force-webrtc-ip-handling-policy` `disable_non_proxied_udp`. Each page
  also gets `setWebRTCIPHandlingPolicy("disable_non_proxied_udp")`. Both
  systems use the same lock.
- Single instance: `app.requestSingleInstanceLock()`. A second start
  focuses the first window. When the last window closes, the app quits, on
  both systems.
- Data folder: the base folder is the same as in section 5. The database
  is `<base>/data/app.db`, and the backups are in `<base>/backups/`. Two
  more folders exist: `<base>/electron` (the Chromium files) and
  `<base>/updates` (one downloaded update file). The shell deletes
  `<base>/updates` at each start.
- Menu: the items of section 3, on both systems. All dialogs are
  main-process calls. The page never gives a file path to the shell.
- Self-test: `--wandit-self-test` gives the same 2 result lines and exit
  codes as section 9. The shell writes the line to stdout with a
  synchronous write, before Electron is ready.
- `migration_failed`: as section 5. The 4 commands answer
  `migration_failed`, the dialog "The data did not open" shows the reason,
  and the update check still runs.

### Bridge of the page

The preload script sets `window.wanditDesktop` with `contextBridge`. It has
4 functions and nothing else:

| Function | Command of section 4 |
|---|---|
| `dbSelect(args)` | `db_select` |
| `dbExecute(args)` | `db_execute` |
| `dbBatch(args)` | `db_batch` |
| `appInfo()` | `app_info` |

- The arguments and the answers are the objects of section 4.
- A failed command rejects with an `Error`. Its `message` is the JSON text
  `{"code": DbErrorCode, "message": string}`. Electron IPC keeps only the
  message of an error, so the code goes into the text.
- `src/lib/db.ts` reads the text from the first `{` and parses it into
  `DbError` (`toElectronError`). A rejection with no such JSON becomes a
  plain `Error`: "The desktop command <name> failed: ...".
- When `wanditDesktop` is in `window`, `db.ts` uses it and does not call
  the Tauri `invoke`.
- `isDesktopShell` of `db.ts` is true in both shells. `root-layout.tsx`
  reads it to load `/wandit-fonts/theme.css`.
- The IPC channels are `wandit:db-select`, `wandit:db-execute`,
  `wandit:db-batch`, and `wandit:app-info`. A handler answers
  `{ ok, value }` or `{ ok: false, error }`, and the preload script makes
  the `Error`.

### Database

The connection settings, the ledger text, the runner, the statement rules,
the limits, the error codes, the backups, the export, and the import are
those of sections 4 and 5. `db/database.js` and `db/backup.js` hold them.
One export file opens in both shells. These parts are different:

- SQLite runs in an Electron utility process (`db/worker.js`), not on the
  main thread. A worker thread is not sufficient: Node cannot stop a thread
  that is inside one SQLite call.
- Time limit: `node:sqlite` has no progress handler. After 10 s, the shell
  ends the database process and answers `sql_error` with the
  `interrupted:` text of section 4. Then it starts a new process, which
  opens the database again. SQLite rolls back the open transaction. So the
  limit also stops one long function call.
- Jobs of the menu and the updater (backup, export, import, update backup)
  run before the page commands that wait in the queue. So the update
  backup waits for one command at most, 10 s.
- `db_select` read-only rule: `node:sqlite` has no
  `sqlite3_stmt_readonly`. The authorizer sees each action of a statement,
  and a write action refuses the statement.
- One statement per call: `db/sql-scan.js` splits the SQL text and counts
  the parameters.
- ATTACH: the connection has `limits.attach` 0, and the authorizer refuses
  ATTACH and DETACH also while a migration runs.
- Migrations are not compiled into the binary. The shell reads the packed
  `migrations/` folder at each start, with the rules of `build.rs`: the
  file name pattern, a regular file, and UTF-8. It computes the SHA-256 of
  the exact bytes. A build with no SQL file has no packed folder, and the
  shell reads that as zero files.

### Updater

The manifests, the URLs, the file names, the release flow, and the version
rule are those of section 10. The shell has its own updater in the main
process (`updater.js`). It uses no minisign and no tauri-plugin-updater:
the Node inside Electron has no BLAKE2b-512.

- Signature format `wandit-ed25519-v1`. The signature is the base64 of the
  64-byte pure Ed25519 signature of this UTF-8 message:
  `"wandit-desktop-update-v1\n" + version + "\n" + <lowercase hex SHA-512 of the update file> + "\n"`.
  `version` is the manifest version, `1.0.N`. So an older signed file never
  passes as a newer version. `signElectronUpdate` in
  `updater-signature.ts` signs, and `verifyUpdateFile` in
  `update-files.js` verifies. A change of the message needs both files.
- Key: the same per-app Ed25519 key (`desktop_apps`). `pubkey` in
  `wandit.desktop.json` is the minisign public key text in base64. The
  shell decodes it, takes line 2, decodes that line, and checks 42 bytes
  that start with `Ed`. The key is bytes 10 to 41.
- Manifest: the shape does not change (`desktopUpdateManifestSchema`). The
  shell reads only `windows-x86_64` or `darwin-aarch64`, and ignores the
  second key of the platform. The version must be `N.N.N`.
- Update file: the NSIS setup exe on Windows, and the disk image on macOS.
  An Electron macOS build has no `.app.tar.gz`. So `update_archive_key`
  stays null, and the url of `latest-macos.json` is the disk image of the
  build folder.
- Check: at start, and from Help > Check for updates. The check at start
  shows no dialog for an error or for "no update". Only a strictly higher
  version is an update.
- On "Install": the `before-update` backup first. A failed backup stops
  the update. Then the download, to `<base>/updates/`, with a cap of
  300 MB. The request uses `node:https`, which does not use the dead proxy
  of Chromium. Each hop is https, with at most 5 redirects. The host of
  the file url must equal the host that answered the manifest. Then the
  signature check. No byte of the file runs or mounts before it.
- Windows install: the shell starts the setup exe with `/S --force-run`,
  detached, and exits. The setup starts the new version.
- macOS install: `hdiutil attach -nobrowse -readonly -noautoopen` to a
  temp mount point. The image must hold `<mainBinaryName>.app`.
  `codesign --verify --deep --strict` must pass on it. `ditto` copies it
  next to the running bundle. Two renames swap the bundles, and the old
  bundle stays until the new one is in place. Then `hdiutil detach`,
  `app.relaunch`, and `app.exit`.
- An app that runs from a translocated path, or from a folder that the
  user cannot write, fails with "Open the app from the Applications
  folder, then try again.". The shell asks for no admin password.
- After "Install", each error shows the dialog "Update failed".

### CI workflows

`build-electron.yml` (Windows) and `build-electron-macos.yml` (macOS) keep
the rules of `build.yml`: the same 4 inputs, `permissions: {}`, pinned
action SHAs, the step "Mask and check the URLs", the input check, the safe
extract, no secret, and the upload only after every check. Changes:

- The macOS workflow has no `update_url` input. The task presigns no
  archive URL for an Electron build.
- The workspace root must hold only `shell/`, `dist/`, and `migrations/`.
- `runs-on: windows-2022` and `macos-15`. `timeout-minutes: 30` each. A
  build compiles nothing.
- `actions/setup-node` installs Node.js 24.22.2 (`NODE_VERSION`). It runs
  only npm and electron-builder. The app uses the Node inside Electron.
- Build, in `shell/`: `npm ci --ignore-scripts`, then
  `npx --no-install electron-builder --win nsis --x64 --config electron-builder.config.cjs --publish never`
  or `... --mac dmg --arm64 ...`. `--ignore-scripts` stops every install
  script. `--no-install` stops a download by npx.
- No WebView2 step: Electron holds its own browser.
- The download cache is restore-only, with the exact key
  `desktop-electron-v1-windows-x64-node-<Node>-<hash of package-lock.json>`
  or `desktop-electron-v1-macos-arm64-node-<Node>-<hash>`. It holds the npm
  cache, the Electron zip folder of `@electron/get`, and the
  electron-builder tools. The jobs `warm-electron` and
  `warm-electron-macos` of `warm-cache.yml` save it. A miss only adds
  download time.
- Windows self-test: the installer runs with
  `/S /D=%LOCALAPPDATA%\wandit-self-test-install`. The exe is
  `<install folder>\<mainBinaryName>.exe`. The step "Self-test the
  installed app" sends its output to files, because the exe has no
  console. Then the one `Uninstall *.exe` of that folder runs with `/S`.
- macOS: "Check the signature and mount the disk image" mounts the image
  read-only. It needs exactly one app, `<mainBinaryName>.app`, and
  `codesign --verify --deep --strict` on it. The self-test runs
  `Contents/MacOS/<mainBinaryName>` from the mount.
- A self-test passes only with exit code 0 and one line that starts with
  `wandit-self-test: ok`.
- The output must be exactly `<mainBinaryName>-<version>-setup.exe` or
  `<mainBinaryName>-<version>.dmg` in `shell/release/`.
- Builder repo: `sync-shell.mjs` writes `shell-electron/shell/` (the shell
  without `node_modules/` and `release/`), plus the fixture files
  `shell-electron/dist/`, `shell-electron/migrations/`, and
  `shell-electron/shell/wandit.desktop.json`.

### Server branch points

The task reads the engine with `DesktopBuildsRepository.findForTask`, and
the API reads `project.desktopEngine`. The code branches only here:

| Point | Where |
|---|---|
| Shell folder and its marker file (`package.json`) | `shellDirs` in `desktop-build.task.ts`, `DESKTOP_SHELL_LAYOUTS` |
| Archive layout and config path | `DESKTOP_SHELL_LAYOUTS` in `desktop-build-input.ts` |
| Workflow file, and `update_url` only for Tauri macOS | `WORKFLOW_FILES` in `github-desktop-build-runner.ts` |
| No staged archive and no `repackMacAppArchive` on Electron macOS | `stagingUpdateKey` in `desktop-build.runtime.ts` |
| Signature format | `signUpdateFile` in `desktop-build.runtime.ts` |
| Update file of a macOS release, and the "has its files" check | `release` in `desktop-builds.service.ts` |

The staged keys, the file checks (`MZ`, `koly`, 300 MB), the build folder,
the row fields, and the credits do not change. For an Electron macOS build,
`installer_sha256` and `updater_signature` are both of the disk image.

### Limits of the Electron engine

- Experimental (D37). No Windows build and no Windows run of this shell
  happened before the first staging test (UNVERIFIED): the NSIS config,
  the `/S --force-run` update, and the self-test output of the packed exe.
- Size: a macOS disk image of a small app is about 119 MB (measured on a
  fixture app). A Tauri disk image is much smaller. The update file has
  the same size, and the cap is 300 MB.
- Versions: Electron 45.3.1 (Node 24.22) and electron-builder 26.18.0,
  exact, in `shell/package-lock.json`. To change one, follow the shell
  README, "Change the Electron version".
- Permissions: the shell denies every permission. So
  `navigator.clipboard.writeText`, a fullscreen request, and pointer lock
  fail. The copy and paste keys work. A "Copy" button in a generated app
  does not work.
- TEXT that is not UTF-8: `node:sqlite` answers replacement characters. The
  Tauri shell answers `unsupported_value`.
- A NUL character in an SQL text gives `invalid_input` for a command, and a
  failed file for a migration.
- EXPLAIN of a write statement in a migration: the Tauri shell counts it
  as a check. This shell runs it as a write statement.
- ATTACH in a migration: the error text is "not authorized", not "too many
  attached databases".
- A wrong argument type answers `invalid_input`. Tauri answers a plain
  text.
- The app protocol has no byte ranges, and a file loads fully into memory
  (`LIMIT` in `window.js`).
- The NSIS uninstaller has no "Delete the application data" box. The data
  folder always stays.
- macOS: the Tauri dialog "The app did not open" with a running app is not
  ported. A failed start shows one error dialog, and the app exits.
- macOS standard user: no admin password prompt. An app bundle that the
  user cannot write does not update.
- Windows: the file description of the exe is `mainBinaryName`. The
  shortcut and the uninstall entry show the product name.
