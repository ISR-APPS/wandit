# mobile-app template

Expo starter for generated wandit mobile apps. It runs on iPhone, Android, and the web.
Expo SDK 57 (pinned to the store Expo Go app), React Native 0.86, expo-router,
HeroUI Native with Uniwind, Supabase, and i18n (en/fr/ar with right-to-left).

## How the template reaches the sandbox

1. `pnpm run pack` writes `mobile-app-<version>.tar.gz` next to this folder.
2. The sandbox init uploads the archive and extracts it into the workspace.
3. It runs `pnpm install --frozen-lockfile --offline`, then the same install online.
   The sandbox image warms only the web-app store, so the mobile install runs online.
4. It runs `git init` and commits `init: template <version>`.

## Contract with the server (WANDIT-192)

- `template_version`: line 1 `mobile-app@<semver>`, line 2 the date, line 3 `expo-sdk@<major>`.
  The server reads line 1 and splits it on `@`.
- `scripts/pack.mjs` writes `templates/mobile-app-<semver>.tar.gz` with `COPYFILE_DISABLE=1`.
  It leaves out `node_modules`, `dist`, `.expo`, `*.tar.gz`, `._*`, `.env`, and `.env.*`.
- `pnpm-lock.yaml` is committed. `pnpm install --frozen-lockfile` works. The offline try
  fails until the sandbox image warms the mobile-app store; then the online try installs.
- `pnpm run dev` starts one Metro on port 8081. It serves the web app and the native
  manifest. Expo CLI listens on all interfaces by default; it does not read `HOST`.
  The server also sets `HOST=0.0.0.0` and `WANDIT_PREVIEW_HOST` in the process env.
  Do not set `CI=1` for this server: Expo CLI then stops file watching and reloads.
  The smoke sets `CI=1` only because it needs no reload.
- Health check: `GET /` on port 8081 answers 200 with the Expo web HTML.
- A request with the header `expo-platform: ios` or `android` gets the Expo Go manifest.
- `CLAUDE.md`, `AGENTS.md`, and `.claude/settings.json` sit at the template root.
- `eas.json` holds the EAS build profiles. The `mobile-build` task replaces the app copy
  with the trusted template copy.

## Environment

- `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`: injected at project creation.
  A missing value stops the app at start (D18). Metro inlines both into the bundle.
- `EXPO_PACKAGER_PROXY_URL`: the public URL that Expo CLI puts in the manifest and the
  QR code. Expo CLI reads it from the process env before `.env` loads, so it must be
  in the launch command (WANDIT-193), never in a `.env` file.

To run the template locally: `pnpm install`, export the two Supabase values, then
`pnpm run dev`.

## Commands

- `pnpm run dev`: Metro on port 8081 for web and native.
- `pnpm run web`: the same, and it opens the browser.
- `pnpm run export:web`: static web build into `dist/`.
- `pnpm run typecheck`: `tsc --noEmit`.
- `pnpm run lint`: `biome check --error-on-warnings .`
- `pnpm run allow-list`: writes `native-modules.json` and the allow-list block in `CLAUDE.md`.
- `pnpm run smoke`: frozen install, typecheck, lint, the allow-list check, the base SQL
  compare, Metro (web page, iOS manifest, iOS bundle), the web export, and a 500 MB
  ceiling on `node_modules`.
- `pnpm run pack`: writes the archive.

## Module allow-list

The store Expo Go app holds a fixed set of native modules. The allow-list is the
packages in `expo/bundledNativeModules.json`, minus a manual exclude list (each entry
has a reason), plus the JavaScript-only packages of the template. Expo Go publishes no
machine-readable list, so re-check the exclude, limit, and no-web lists in
`scripts/allow-list.mjs` on each SDK bump, then run `pnpm run allow-list`.

## SDK bump

1. Check the Expo Go version in the App Store and Google Play, and on https://expo.dev/go.
2. Move `expo` to the new SDK, then run `npx expo install --fix`.
3. Update all three lines of `template_version`: a new semver, the date, and the SDK.
4. Update the SDK and version facts in the Stack section of `CLAUDE.md` and in this README.
5. Review the exclude, limit, and no-web lists in `scripts/allow-list.mjs`, then run
   `pnpm run allow-list` and `pnpm run smoke`.

## Base schema

`supabase/migrations/0000_base.sql` is a byte copy of the web-app file. The server applies
the web-app copy to every backend; this copy shows the agent its start schema. The smoke
fails when the two files differ.
