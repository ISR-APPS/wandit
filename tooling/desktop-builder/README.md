# Desktop builder

The Windows and macOS CI of V2 desktop apps (`docs/v2/desktop-apps.md`, section 9).
The files of this folder go to a separate private GitHub repo. The API reads
that repo name from `DESKTOP_BUILD_REPO`. Security notes: section 14 of
`docs/v2/security.md`.

| File | What it does |
|---|---|
| `.github/workflows/build.yml` | Builds one Windows installer. The `desktop-build` task dispatches it. It accepts only presigned URLs of `desktop-temp/` keys in a bucket of `DESKTOP_BUILD_BUCKET_URLS`. It only restores the cargo cache. Before the build, it requires a valid Microsoft signature on the WebView2 bootstrapper that the installer embeds. Before the upload, it installs the installer on the runner, runs the exe with `--wandit-self-test`, and uninstalls it. A failed self-test fails the run, and the task stores `self_test_failed`. The task finds that step by its name "Self-test the installed app": do not rename it. |
| `.github/workflows/build-macos.yml` | Builds one macOS disk image and one update archive for Apple silicon. The `desktop-build` task dispatches it for a macOS build. Same URL check as `build.yml`, plus `update_url`. It only restores the cargo cache. It builds the app with the ad-hoc signature of `tauri.macos.conf.json` and checks it with `codesign --verify --deep --strict`. It mounts the disk image and runs the app in it with `--wandit-self-test`. Then it writes the update archive as plain ustar and checks the seal of an unpacked copy. The step name "Self-test the installed app" is the same as in `build.yml`: do not rename it. |
| `.github/workflows/build-electron.yml` | Builds one Windows installer of a project with the Electron engine. The `desktop-build` task dispatches it in place of `build.yml`. Same 4 inputs and same URL check as `build.yml`. It installs Node.js, runs `npm ci --ignore-scripts` in `shell/`, and packs the app with electron-builder. It only restores the download cache. It has no WebView2 step: Electron holds its own browser. Before the upload, it installs the installer on the runner, runs the exe with `--wandit-self-test`, and uninstalls it. The self-test needs exit code 0 and one line "wandit-self-test: ok". The step name "Self-test the installed app" is the same as in `build.yml`: do not rename it. |
| `.github/workflows/build-electron-macos.yml` | Builds one macOS disk image of a project with the Electron engine, for Apple silicon. The `desktop-build` task dispatches it in place of `build-macos.yml`. It has 4 inputs and no `update_url`: the updater of the Electron shell installs from the disk image, so there is no update archive. It only restores the download cache. It mounts the disk image, checks the app in it with `codesign --verify --deep --strict`, and runs it with `--wandit-self-test`. Then it uploads the `.dmg`. The step name "Self-test the installed app" is the same as in `build.yml`: do not rename it. |
| `.github/workflows/warm-cache.yml` | Builds each shell with fixture files and saves the caches. 4 jobs. `warm` and `warm-macos` save the cargo caches of the Tauri shell: each runs the build command of `build.yml` or `build-macos.yml` with `--config ../tauri.desktop.json`. `warm-electron` and `warm-electron-macos` save the download caches of the Electron shell: each runs the commands of `build-electron.yml` or `build-electron-macos.yml` in `shell-electron/shell/`. A push to `main`, a manual start, and a daily schedule start it. |
| `sync-shell.mjs` | Copies `templates/desktop-shell/src-tauri` to `shell/` of a builder repo checkout, and `templates/desktop-shell-electron/shell` to `shell-electron/shell/`. Writes the fixture files `dist/`, `migrations/`, and the config next to each shell: `shell/tauri.desktop.json` and `shell-electron/shell/wandit.desktop.json`. |

The builder repo holds only `.github/`, `shell/`, and `shell-electron/`. Do
not copy `sync-shell.mjs` or this README there.

A `.gitignore` in `templates/desktop-shell-electron/shell` must not match
`wandit.desktop.json`. If it does, git drops the fixture config, and the 2
Electron warm-up jobs fail.

## Setup

Do these steps in this order. You must be an owner of the GitHub
organization.

1. Create a private repo in the organization, for example
   `ISR-APPS/wandit-desktop-builder`. Keep `main` as the default branch.
   `warm-cache.yml` starts on a push to `main`, and the API dispatches
   the 4 build workflows on `main`.
2. Copy `tooling/desktop-builder/.github/` to the root of the new repo.
3. From the root of this repo, run:
   `node tooling/desktop-builder/sync-shell.mjs <path of the builder repo checkout>`.
   The script replaces `shell/` and `shell-electron/` of the checkout.
4. Commit `.github/`, `shell/`, and `shell-electron/`, and push to `main`.
   `warm-cache.yml` starts. A cold Tauri run takes about 35 minutes on
   Windows and 10 to 25 minutes on macOS, plus the cache upload (ESTIMATE).
   An Electron job takes about 5 to 10 minutes (ESTIMATE). The 4 jobs run
   in parallel.
5. In the builder repo, open Settings > Actions > General:
   - Actions permissions: select "Allow <organization>, and select
     non-<organization>, actions and reusable workflows". Select only
     "Allow actions created by GitHub". The workflows use
     `actions/checkout`, `actions/cache`, and `actions/setup-node` only.
   - Fork pull request workflows: clear "Run workflows from fork pull
     requests".
   - Workflow permissions: select "Read repository contents and packages
     permissions". Clear "Allow GitHub Actions to create and approve pull
     requests".
6. Open Settings > General. Clear "Allow forking".
7. Protect `main`: open Settings > Rules > Rulesets, and add a branch
   ruleset for the default branch. Require a pull request with one
   approval. Block force pushes and deletions. A person who can push to
   `main` controls the build and the cache of every desktop app.
8. Make a fine-grained personal access token: GitHub > Settings >
   Developer settings > Fine-grained tokens > Generate new token.
   - Resource owner: the organization.
   - Repository access: "Only select repositories", and select the
     builder repo only.
   - Repository permissions: "Actions: Read and write". GitHub adds
     "Metadata: Read-only". Add no other permission.
   - Set an expiration date, and record it. Builds fail with
     `ci_start_failed` when the token expires.
   Never paste the token in a chat or in the builder repo.
9. In the builder repo, open Settings > Secrets and variables > Actions >
   Variables, and add the repository variable `DESKTOP_BUILD_BUCKET_URLS`.
   Its value is one line for each environment that dispatches builds to
   this repo:
   `https://<R2_BUCKET>.<R2_ACCOUNT_ID>.r2.cloudflarestorage.com`. Copy
   `R2_BUCKET` and `R2_ACCOUNT_ID` from the API service of that
   environment, in lower case, with no `/` at the end.
   - The 4 build workflows accept only presigned URLs of
     `desktop-temp/` keys in these buckets. So a stolen token of step 8
     cannot make CI build its own input. That token cannot change a
     variable.
   - When the variable is empty or wrong, every build fails with
     `ci_failed` in the step "Mask and check the URLs".
   - When you add an environment or change its bucket, change this
     variable first.
10. Set two values on the API service in Railway and in the Trigger.dev
    environment, for staging first:
    - `DESKTOP_BUILD_REPO`: `<owner>/<repo>` of step 1.
    - `DESKTOP_BUILD_GITHUB_TOKEN`: the token of step 8.
    `GET /api/v2/health` then reports both as `true`.
11. Wait until the `warm-cache.yml` run of step 4 is green. Actions >
    Caches then shows a `desktop-cargo-v1-rust-...` entry, a
    `desktop-cargo-v1-macos-arm64-...` entry, a
    `desktop-electron-v1-windows-x64-...` entry, and a
    `desktop-electron-v1-macos-arm64-...` entry.
12. Deploy the Wandit API and the Trigger worker only after the 2 Tauri
    warm-up jobs are green for the `Cargo.lock` of `shell/`
    (`docs/v2/runbook.md`, macOS section, step 1). An Electron build with
    no cache only downloads more, so it does not block a deploy.

macOS runner minutes cost $0.062 each, Windows minutes $0.010
(https://docs.github.com/en/billing/reference/actions-runner-pricing).
On GitHub Free, Pro, and Team, at most 5 macOS jobs run at the same time,
for the whole account, not for one repo
(https://docs.github.com/en/actions/reference/limits). On Enterprise, the
limit is 50. Other jobs wait in the queue, and the task stops 70 minutes
after the dispatch. Confirm the plan of the organization before production.

## After each change of the shell

1. Run `sync-shell.mjs` again (Setup step 3).
2. Open a pull request with the change of `shell/` and merge it to `main`.
3. `warm-cache.yml` runs. Each job skips the build when its cache key
   exists already, for example after a change of a `.rs` file only.
4. Deploy the API and the Trigger worker after that run is green. The
   worker image holds its own copy of each shell. When its `Cargo.lock`
   differs from `shell/src-tauri/Cargo.lock`, every Tauri build is cold.
   When its `package-lock.json` differs from
   `shell-electron/shell/package-lock.json`, every Electron build downloads
   Electron and the electron-builder tools again.

## Pins

The 3 Tauri workflow files (`build.yml`, `build-macos.yml`, `warm-cache.yml`)
hold the same pins: `RUSTUP_TOOLCHAIN`, `TAURI_CLI_VERSION`, and the commit
SHA of each action. The cache paths use
`TAURI_CLI_ROOT` and `CARGO_TARGET_DIR`, so each build job and its warm-up
job hold the same values:

- `build.yml` and the job `warm`: `C:\desktop-build\tools` and
  `C:\desktop-build\target`.
- `build-macos.yml` and the job `warm-macos`:
  `/Users/runner/desktop-build/tools` and `/Users/runner/desktop-build/target`.

The 3 Electron workflow files (`build-electron.yml`,
`build-electron-macos.yml`, `warm-cache.yml`) hold the same `NODE_VERSION`
and the same commit SHA of each action. `NODE_VERSION` is an exact Node.js
24 version. It runs only npm and electron-builder on the runner. The app
uses the Node.js inside Electron. `shell/package-lock.json` pins electron
and electron-builder, not the workflows. The cache paths are
`npm_config_cache`, `ELECTRON_BUILDER_CACHE`, and the default folder of
`@electron/get`. electron-builder reads no variable for that third folder:

- `build-electron.yml` and the job `warm-electron`: `npm` and
  `electron-builder` in `C:\desktop-build\electron`, plus
  `%LOCALAPPDATA%\electron\Cache` (written as `~\AppData\Local\electron\Cache`).
- `build-electron-macos.yml` and the job `warm-electron-macos`: `npm` and
  `electron-builder` in `/Users/runner/desktop-build/electron`, plus
  `~/Library/Caches/electron`.

Change these values in all files in the same commit.

To change an action pin, read the commit of the new tag with
`gh api repos/actions/<name>/git/ref/tags/<tag>`. Use the commit SHA, never
the tag.

## Cache facts

- The Windows key is `desktop-cargo-v1-rust-<Rust>-tauri-cli-<tauri-cli>-<hash of Cargo.lock>`.
  `build.yml` restores the exact key only. A miss gives a cold build of
  about 35 minutes (ESTIMATE). The job limit is 60 minutes.
- The macOS key is `desktop-cargo-v1-macos-arm64-rust-<Rust>-tauri-cli-<tauri-cli>-<hash of Cargo.lock>`.
  `build-macos.yml` restores the exact key only. A miss gives a cold build
  of about 10 to 25 minutes (ESTIMATE). The job limit is 45 minutes.
- The cached paths are the cargo registry, the cargo git folder,
  `TAURI_CLI_ROOT` (tauri-cli), and `CARGO_TARGET_DIR` (values in "Pins").
  The path lists of a build job and its warm-up job must stay equal: the
  cache version is a hash of them.
- The Electron keys are
  `desktop-electron-v1-windows-x64-node-<Node.js>-<hash of package-lock.json>`
  and `desktop-electron-v1-macos-arm64-node-<Node.js>-<hash of package-lock.json>`.
  The 2 Electron build workflows restore the exact key only. The cached
  paths are the npm cache, the `@electron/get` folder with the Electron zip,
  and the electron-builder tools. A miss adds only download time. The job limit is 30 minutes.
- The cache storage of the repo has a 10 GB limit. Two caches per
  `Cargo.lock` and two caches per `package-lock.json` share it. At the limit, GitHub deletes the cache with the
  oldest last access.
- GitHub deletes a cache after 7 days without access. Build runs only
  restore, so the daily run of `warm-cache.yml` makes it again. To skip
  the wait, start it by hand: Actions > Desktop cache warm-up > Run
  workflow.
