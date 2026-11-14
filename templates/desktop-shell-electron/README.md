# Desktop shell (Electron engine)

This folder is the trusted native shell of a Wandit desktop app that uses the Electron
engine ("Desktop app 2"). It is an Electron app for Windows (x64) and macOS (Apple
silicon) with a local SQLite database. The contract is `docs/v2/desktop-apps.md`
(sections 3, 4, 5, 9, and 10). The Tauri engine in `templates/desktop-shell/` follows
the same contract. Both engines use the same project template, the same data folder, and
the same database file format.

Only Wandit engineers change this folder. The agent never sees it: the sandbox holds only
the frontend and the `migrations/` folder of the project. This folder is not a project
template, so it has no `scripts/pack.mjs`, and `templates/pack-all.mjs` skips it.

## Layout

```
desktop-shell-electron/
  README.md
  shell/                          the app. The build task copies this folder to CI.
    package.json, package-lock.json   electron 45.3.1 and electron-builder 26.18.0, exact versions
    electron-builder.config.cjs   the packaging config. It reads ./wandit.desktop.json.
    icons/icon.icns, icon.ico     the fixed icons, copied from the Tauri shell
    src/main.js                   start, network switches, single instance, self-test
    src/config.js                 reads and checks wandit.desktop.json
    src/paths.js                  the data folders
    src/app-origin.js             the app origin, the CSP, the path guard, the request rule
    src/window.js                 the app:// protocol, the session locks, the main window
    src/preload.js                the bridge window.wanditDesktop (4 functions)
    src/commands.js               the 4 IPC commands: sender check, input check, queue
    src/input.js                  the type checks of the command arguments
    src/menu.js                   the native menu, Back up now, Export data, Import data
    src/dialogs.js                the native message dialogs
    src/updater.js                the update flow
    src/update-files.js           manifest, version rule, download, signature check
    src/update-install.js         the install step: NSIS setup exe, or the macOS bundle swap
    src/db/client.js              the queue in front of the database process, the 10 s limit
    src/db/worker.js              the entry file of the database process
    src/db/app-database.js        the database state, import swap, update backup, self-test
    src/db/database.js            connection, migration runner, statement rules, command bodies
    src/db/backup.js              backups, export, the import checks
    src/db/migration-files.js     reads migrations/, the replacement header rules
    src/db/sql-scan.js            splits an SQL text into statements, lists the parameters
    src/db/db-error.js            the error of a failed command
    test/                         the unit tests (node:test)
    testing/support.js            the helpers of the tests
```

The shell has no runtime dependency: only the `node:` modules and `electron`. The code is
plain CommonJS, so CI has no compile step.

## Build input

The `desktop-build` task writes one archive with this layout:

```
shell/                      a copy of this shell folder, without node_modules/ and release/
shell/wandit.desktop.json   productName, mainBinaryName, version, identifier, updater keys
dist/                       the checked frontend files
migrations/                 the checked SQL files
```

`wandit.desktop.json` holds exactly the JSON of `tauri.desktop.json` (section 3 of the
doc). The packaging config packs `../dist` as `dist/` and `../migrations` as
`migrations/` into the app archive (`app.asar`), next to `src/` and a copy of
`wandit.desktop.json`. The config stops the build when `../dist/index.html` or
`../migrations` is missing.

## Rules

- **Names.** The app bundle, the executable, and the install folder use `mainBinaryName`,
  which is ASCII. A product name with an accent breaks the seal of the macOS signature on a
  disk image. The real product name shows in the window title, the menu, the dialogs, the
  NSIS shortcut, and the uninstall entry. On macOS, the config writes it into
  `InfoPlist.strings` of each language folder, so the menu bar, the Dock, and Finder show
  it. `CFBundleName` must stay `mainBinaryName`: Electron finds its helper apps by that
  name, and the app does not start with another value.
- **Frontend.** The window loads `app://app/`, so the router of the frontend starts on its
  home route. The root path and each unknown path answer `index.html`. A path guard refuses each path outside the packed `dist` folder. Every
  answer has the CSP of `src/app-origin.js`. The shell does not freeze prototypes.
- **Window.** Context isolation and the sandbox are on. Node integration, the webview tag,
  and the developer tools of a packed app are off. The preload script gives the page 4
  functions and nothing else.
- **Commands.** Each IPC handler accepts only the top frame of the main window on the
  app origin. `input.js` checks the types. `database.js` checks the limits of section 4.
- **Locks.** The shell refuses each navigation to another origin, every new window, every
  webview, every download, and every permission. It cancels each request whose scheme is
  not `app`, `devtools`, `data`, or `blob`. Three Chromium switches close the other
  channels: a resolver rule that fails every host name, a proxy on loopback port 1, and
  the WebRTC policy `disable_non_proxied_udp`.
- **Updater.** It runs in the main process with `node:https`, which does not use the
  proxy of Chromium. It is the only network user of the app.
- **Database process.** SQLite (`node:sqlite`) runs in an Electron utility process. The
  commands of the page run one at a time, in call order. After 10 s, the shell ends the
  process, answers `sql_error` with the `interrupted:` text, and starts a new process.
  SQLite then drops the transaction that the stopped process left open. A worker thread is
  not enough: Node cannot stop a thread that is inside one SQLite call.
- **Jobs of the menu and the updater** have no time limit. They run before the commands of
  the page that wait in the queue.
- **Data.** The base folder is `%LOCALAPPDATA%\<identifier>` on Windows and
  `~/Library/Application Support/<identifier>` on macOS: `data/app.db`, `backups/`,
  `updates/` (a downloaded update file), and `electron/` (the files of Chromium).
- **Migrations.** The shell reads the packed `migrations/` folder at each start. It refuses
  a bad file name, an entry that is not a regular file, and a file that is not UTF-8. A
  build with no SQL file has no `migrations/` folder in the app archive, which is valid. The
  runner, the ledger, the checks, and the error texts are those of section 5 of the doc.
- **Self-test.** With the argument `--wandit-self-test`, the app opens no window and uses
  no network. It runs the start path of the database on a new database in a temp folder,
  and prints one line on stdout: `wandit-self-test: ok, <N> migrations` (exit code 0) or
  `wandit-self-test: failed: <reason>` (exit code 1).
- **Electron download.** `electron-builder.config.cjs` gives electron-builder the hashes
  of `node_modules/electron/checksums.json` (`electronDownload.checksums`). `npm ci` checks
  that package against `package-lock.json`. So the Electron zip must match the lock file.
- **Fuses.** `runAsNode`, `enableNodeOptionsEnvironmentVariable`, and
  `enableNodeCliInspectArguments` are off. `onlyLoadAppFromAsar`,
  `enableEmbeddedAsarIntegrityValidation`, and `enableCookieEncryption` are on.

## Updates

The manifest, the URLs, the file names, and the version rule are those of section 10 of
the doc. These parts are different from the Tauri engine:

- **Signature `wandit-ed25519-v1`.** The signature is base64 of the 64-byte Ed25519
  signature of the UTF-8 text `wandit-desktop-update-v1\n<version>\n<hex SHA-512 of the
  file>\n`. The version is the manifest version, so an older signed file never passes as
  a newer version. The key is the Ed25519 key of the app. The shell reads its 32 bytes
  from the minisign public key text of `wandit.desktop.json`.
- **Update file.** Windows: the NSIS setup exe. macOS: the disk image.
- **Checks before the install.** The version is strictly higher than the installed
  version. The backup `before-update-...` is written. The download uses https only, from
  the host that answered the manifest, with a cap of 300 MB. The signature is valid.
- **Install on Windows.** The shell starts the setup exe with `/S --force-run` and exits.
- **Install on macOS.** The shell mounts the disk image (`hdiutil`), checks that it holds
  `<mainBinaryName>.app`, runs `codesign --verify --deep --strict`, copies the app next
  to the running app (`ditto`), swaps the two bundles with renames, and starts the app
  again. An app that runs from Downloads or from the disk image fails with the text "Open
  the app from the Applications folder, then try again.".

## Differences from the Tauri shell

`node:sqlite` has fewer functions than rusqlite. These parts reach the same result in
another way:

- **Time limit.** No progress handler exists. The shell ends the database process. So the
  limit also stops one long function call, which the Tauri shell cannot stop.
- **Read-only test.** No `sqlite3_stmt_readonly` exists. SQLite calls the authorizer for
  each action of a statement, so the actions show if the statement writes.
- **One statement per call.** `node:sqlite` prepares only the first statement of a text.
  `sql-scan.js` splits the text with the token rules of SQLite and counts the parameters.
- **ATTACH.** The connection has the ATTACH limit of 0 (`limits.attach`), and the
  authorizer refuses ATTACH and DETACH also while a migration runs.
- **TEXT that is not UTF-8.** `node:sqlite` answers such a value with replacement
  characters. The Tauri shell answers `unsupported_value`.
- **A NUL character in an SQL text** gives `invalid_input`. The Tauri shell gives
  `sql_error`.
- **Permissions.** The shell denies every permission, also a clipboard write of the page
  through `navigator.clipboard`. The copy and paste keys work.

## Run the tests

The tests use the test runner of Node. They need Node 24.22 or later, for `node:sqlite`. Electron 45.3.1 holds Node 24.22.

```sh
cd templates/desktop-shell-electron/shell
node --test
```

The tests open plain SQLite connections and one forked Node process. They need no
`npm install` and no window.

## Run and build locally

Do not build inside this folder: the build needs `dist/` and `migrations/` next to
`shell/`. Use a copy outside the repo:

```sh
mkdir -p ~/shell-check/dist ~/shell-check/migrations
rsync -a --exclude node_modules --exclude release templates/desktop-shell-electron/shell ~/shell-check/
echo '<!doctype html><title>Fixture</title>' > ~/shell-check/dist/index.html
cp templates/desktop-app/migrations/0001_init.sql ~/shell-check/migrations/
cd ~/shell-check/shell
# Write wandit.desktop.json here, with the 5 keys of section 3 of the doc.
npm ci --ignore-scripts
```

A local run without a build needs the Electron binary of the npm package:

```sh
node node_modules/electron/install.js
npx electron . --wandit-self-test
npx electron .
```

A build of the macOS disk image, on a Mac with Apple silicon:

```sh
npx electron-builder --mac dmg --arm64 --config electron-builder.config.cjs --publish never
release/mac-arm64/<mainBinaryName>.app/Contents/MacOS/<mainBinaryName> --wandit-self-test
codesign --verify --deep --strict release/mac-arm64/<mainBinaryName>.app
```

A build of the Windows installer, on Windows:

```sh
npx electron-builder --win nsis --x64 --config electron-builder.config.cjs --publish never
```

The output files are `release/<mainBinaryName>-<version>.dmg` and
`release/<mainBinaryName>-<version>-setup.exe`.

electron-builder refuses a source file under a system folder, for example `/tmp` or
`/private`, unless the folder is inside the temp folder of the system. For a copy in such
a folder, set `TMPDIR` to a parent folder of the copy.

## Change the Electron version

Change the exact version in `package.json`, then run `npm install --ignore-scripts` in
`shell/` to write `package-lock.json` again. Run the tests with the Node of that Electron
(`ELECTRON_RUN_AS_NODE=1 node_modules/.bin/electron --test`), then make a local build.
`node:sqlite` must have `setAuthorizer`, `enableDefensive`, `backup`, and the `limits`
option in that version.
