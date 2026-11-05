# Desktop shell

This folder is the trusted native shell of every Wandit desktop app. It is a Tauri v2 app
for Windows and macOS (Apple silicon) with a local SQLite database. The contract is
`docs/v2/desktop-apps.md` (sections 3, 4, 5, 9, and 10). The "macOS" section below lists
what is different on macOS.

Only Wandit engineers change this folder. The agent never sees it: the sandbox holds only
the frontend and the `migrations/` folder of the project. This folder is not a project
template, so it has no `scripts/pack.mjs`, and `templates/pack-all.mjs` skips it.

## What the shell does

- It opens `<data folder>/data/app.db` and runs the migration runner before the window
  opens. The data folder is `%LOCALAPPDATA%\<identifier>` on Windows and
  `~/Library/Application Support/<identifier>` on macOS. When a file is pending and the
  ledger has rows, it writes a backup first. All pending files run in one transaction. A
  replacement runs at the place of its target.
  A top-level SELECT is a check: it must answer the integer 1, else the whole update rolls back.
- It gives the webview 4 commands: `db_select`, `db_execute`, `db_batch`, and `app_info`.
  An SQLite authorizer refuses schema changes, PRAGMA, ATTACH, and transactions.
  The commands run one at a time, each on a blocking thread. SQLite stops a command after
  10 s, for example a recursive query that never ends. SQLite checks the limit only between
  VM steps, so one long function call (LIKE, instr, or replace on a long text) can run longer.
  Such a call never stops an update (see the update item below).
- It locks the window to the bundled frontend. It refuses other navigation and every new
  window. The CSP blocks every remote connection. The window opens `index.html`, and the
  asset resolver answers `index.html` for an unknown path, so the app router uses browser
  history.
- Tauri sets the CSP only on `.html` answers, so the shell adds the same CSP to every other
  answer. Tauri adds no nonce to a script tag (`dangerousDisableAssetCspModification`), so
  a remote script never runs. An inline script in `index.html` does not run either.
- It refuses every download. The CSP does not control WebRTC and DNS prefetch. On Windows,
  browser args of WebView2 close them. On macOS, a WebKit preference and a loopback proxy
  close them (see "macOS").
- It owns the native menu. On Windows: File (Back up now, Export data, Import data, Quit)
  and Help (Check for updates, About). The macOS menu is in "macOS". All dialogs are Rust calls.
- It checks for updates at start and from the Help menu. It writes a backup before an
  update installs. The backup uses its own read-only connection, so it never waits for a
  webview command. When that copy fails, the shell copies under the database lock: in the
  `migration_failed` state, a copy of the closed file. It installs only a newer version, and
  `requireSignedVersion` refuses a higher version with the signature of an older build. A
  rollback is a rebuild of the older code with a higher version. On Windows,
  `download_and_install` starts the NSIS installer, then ends the app with `process::exit`.
  The installer then starts the new version. On macOS, it replaces the `.app` folder in
  place, and the shell then restarts the app.
- With `--wandit-self-test` as argument 1, it opens no window and uses no network. It runs
  the embedded migrations on a new database in a temp folder, with the start path of the app.
  It prints one `wandit-self-test:` line and exits with 0 or 1. The CI runs it on the
  installed exe before the upload. On macOS, it runs the app inside the disk image.

## Files

| Path | Content |
|---|---|
| `src-tauri/Cargo.toml`, `Cargo.lock` | Pinned crates. CI builds with `--locked`. |
| `src-tauri/build.rs` | Embeds `../migrations/*.sql`. Refuses a bad file name, an entry that is not a regular file, and a file that is not UTF-8. |
| `src-tauri/tauri.conf.json` | The static config. The per-build file overrides some keys. |
| `src-tauri/tauri.macos.conf.json` | The macOS bundle keys. Tauri merges it on macOS only (see "macOS"). |
| `src-tauri/capabilities/main.json` | The 4 app commands. No core and no plugin permission. |
| `src-tauri/icons/` | The default icon set. `icon.icns` is the fixed macOS icon (see "macOS"). |
| `src-tauri/src/lib.rs` | App setup, window, menu, commands, updater flow, and the CI self-test. |
| `src-tauri/src/db.rs` | Connection, migration runner, authorizer, command time limit, and command bodies. |
| `src-tauri/src/backup.rs` | Backups, export, and import. |

## Build input

The `desktop-build` task writes `desktop-input.tar.gz` with this layout:

```
src-tauri/                  a copy of this src-tauri folder
src-tauri/tauri.desktop.json  productName, mainBinaryName, version, identifier, updater keys
dist/                       the checked frontend files (frontendDist is ../dist)
dist/wandit-fonts/          the theme fonts and theme.css, written by the task
migrations/                 the checked SQL files (build.rs reads ../migrations)
```

The archive always holds the `migrations/` folder, also when it has no file.

The task never copies a `src-tauri/` folder of the project.

## How CI builds it

The private repo `DESKTOP_BUILD_REPO` runs the workflows of `tooling/desktop-builder/`.
Each workflow downloads the build input, checks its SHA-256, and builds one platform.

Windows (`build.yml`, on `windows-2022`):

```
cargo tauri build --ci --bundles nsis --config tauri.desktop.json -- --locked
```

macOS (`build-macos.yml`, on `macos-15`, Apple silicon). The bundler needs `CI=true`,
else the disk image step asks Finder for the window layout and times out:

```
CI=true cargo tauri build --ci --bundles app,dmg --config tauri.desktop.json -- --locked
```

tauri-cli refuses `--locked`, so the flag goes to `cargo build` after `--`.

On Windows, CI uploads the one NSIS installer, and the server signs it for the updater.
On macOS, CI uploads the disk image and an update archive (`<mainBinaryName>.app` as plain
ustar, made with `tar`). The server checks both files, then packs the archive again and signs
it for the updater. So CI holds no key.

## Run the tests locally

Do not build inside this folder. The build needs `dist/` and `migrations/` next to
`src-tauri/`. Also, the repo must not get a `target/` folder. Use a copy:

```sh
mkdir -p /tmp/shell-check/dist /tmp/shell-check/migrations
cp -R templates/desktop-shell/src-tauri /tmp/shell-check/
echo '<!doctype html><title>Fixture</title>' > /tmp/shell-check/dist/index.html
echo 'CREATE TABLE app_settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);' \
  > /tmp/shell-check/migrations/0001_init.sql
cd /tmp/shell-check/src-tauri
cargo test
cargo fmt --check
cargo clippy --all-targets -- -D warnings
```

The tests use plain rusqlite connections, so they run on macOS and Linux without a window.
The window code of each system (the WebView2 browser args, the macOS WebKit preference and
proxy) and the install of an update run only in a real install.

## macOS

- **`tauri.macos.conf.json`.** Tauri merges it over `tauri.conf.json` on macOS only. An array
  in it replaces the array of the base file. `targets` gives the app (the source of the
  update archive) and the disk image (the download). The icon list keeps the PNG files,
  because Tauri takes the window icon from a PNG, and adds `icons/icon.icns`.
  `hardenedRuntime` keeps its default value, true. JSON has no comments, so this section
  explains each value.
- **Ad-hoc signature.** `signingIdentity` is `-`. Apple silicon runs no executable without a
  signature, and an ad-hoc signature is enough. Gatekeeper does not accept it, so the user
  opens the app one time with System Settings, Privacy & Security, Open Anyway. A bundle
  with no signature shows "damaged" after a download, with no Open Anyway button. So never
  build with `--no-sign`.
- **Minimum version.** `minimumSystemVersion` is 15.0 (decision D35). The loopback proxy
  needs macOS 14, and each supported version needs a probe of the WebRTC preference.
- **WebRTC block.** WKWebView takes no browser args, and the CSP does not stop WebRTC UDP.
  `locked_webview_configuration` in `lib.rs` sets the private WebKit preference
  `peerConnectionEnabled` to false before the first page script, and reads it back. If the
  preference is missing or stays on, the window does not open (fail closed). The app menu
  and the update check still work, so a fixed build reaches the user. The same function
  turns off `DNSPrefetchingEnabled` where WebKit still has that setter.
- **Loopback proxy.** The `macos-proxy` feature of `tauri` sends every HTTP load of the
  webview to `http://127.0.0.1:1`, where no service listens. It stops a load that the CSP
  does not govern, for example a preconnect. It does not stop WebRTC.
- **Menu.** Tauri ignores a window menu on macOS, so the shell sets the menu on the app. The
  first submenu is the app menu: About, Hide, Hide Others, Show All, and Quit (Cmd+Q). Then
  File (Back up now, Export data, Import data), Edit (gives Cmd+C, Cmd+V, and the other edit
  keys to the webview), Window, and Help (Check for updates). When the window closes, the app
  quits, the same as on Windows.
- **Data folders.** The app writes `~/Library/Application Support/<identifier>` (database and
  backups), `~/Library/WebKit/<identifier>`, and `~/Library/Caches/<identifier>`. A drag of
  the app to the Trash leaves these folders.
- **Single instance.** The plugin lock is a socket in the shared `/tmp`. Another local user
  can take the path first and stop the start. `docs/v2/security.md` lists this limit.
- **Updates.** The updater replaces the `.app` folder in place. An app that runs from
  Downloads or from the disk image runs from a random read-only path, so its update fails.
  The error text tells the user to open the app from the Applications folder.
- **Fixed icon `icons/icon.icns`.** Without an `.icns` file in the icon list, the bundler
  names the app icon `<productName>.icns`, and the signature seals that name. The disk image
  is HFS+, which stores a name with an accent in another Unicode form. The seal then breaks
  for a product name like "Gestion Café". With `icon.icns` in the list, the bundler copies
  that file, and no file in the app takes the product name. Windows builds do not read it.
- **Never run `cargo tauri icon`.** It writes every icon file again, also `icon.ico` of
  Windows. To make `icon.icns` again: build the shell on a Mac without the file and with an
  ASCII product name, then copy `Contents/Resources/<product name>.icns` of the app.

## Change a crate version

Every crate is pinned with `=`. Change the version in `Cargo.toml`, run
`cargo generate-lockfile` in the copy above, run the tests, and copy `Cargo.lock` back.
