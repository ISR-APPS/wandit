# Rules for the coding agent

You build a mobile app inside this project. It runs on iPhone, Android, and the web.
These rules are binding. The host machine runs the session. You write code; the host runs it.

## Interface contract

- The user describes the app in the chat. That brief is the product spec.
- You reply in the user's language. Always.
- User-provided assets (images, logos, texts) are facts. Never replace them.
- Never invent business facts: prices, addresses, phone numbers, opening hours.
- When a fact is missing, ask the user. See the ask_user contract below.
- You work inside this project only. Do not touch files outside it.

## Stack

- Expo SDK 57. The pin is fixed: the store Expo Go app runs SDK 57.
- React Native 0.86, React 19.2, TypeScript strict.
- expo-router with file-based routes in `src/app/`.
- HeroUI Native components, styled with Uniwind (Tailwind v4 classes in `className`).
- react-native-web renders the same code in the browser preview.
- Supabase for auth and data through `src/lib/supabase.ts`.
- Biome for lint and format: `pnpm run lint`. Typecheck: `pnpm run typecheck`.

## How the preview runs

- The host runs `pnpm run dev`: one Metro server on port 8081.
- That server feeds the web preview in a phone frame and the Expo Go app on a phone.
- Metro reloads the app when you save a file. Never start, stop, or restart Metro.
- Never run `expo start`, `expo run:ios`, `expo run:android`, `expo prebuild`, or `eas`.

## What you must refuse

- Do not switch framework, router, styling system, UI kit, or backend.
- Do not change the Expo SDK. Do not change the version of an Expo package by hand.
- Do not add a state library, an ORM, or a second i18n system.
- Do not remove the Supabase env check or return a null client.
- Do not create `ios/` or `android/`. The app runs in Expo Go with no native code.
- Do not change the `dev` script in `package.json`. The host starts it.
- Do not edit `CLAUDE.md`, `AGENTS.md`, `template_version`, `native-modules.json`,
  `pnpm-workspace.yaml`, `eas.json`, or `scripts/`.
- Do not run `pnpm run pack`, `pnpm run smoke`, or `pnpm run allow-list`. They are host tools.
- When pnpm stops with `ERR_PNPM_IGNORED_BUILDS`, run `pnpm remove <name>` for the package
  you added. Then tell the user and pick another package. Leave the `allowBuilds` line
  that pnpm writes into `pnpm-workspace.yaml`.
- The deny rules in `.claude/settings.json` block edits to `.claude/`, `.mcp.json`,
  `opencode.json`, `.git/hooks/`, `.git/config`, `.env`, `.env.*`, `.npmrc`,
  `.pnpmfile.cjs`, and shell start-up files.
- Do not run `git push`, `git reset`, `git checkout`, `git switch`, `git rebase`,
  `git tag`, or any other git write command. The host commits, not you.
- Do not write arbitrary scripts for behaviors that have a contract, like the public form.

## Expo Go limits

The phone preview is the store Expo Go app. It holds a fixed set of native modules.

- Use only the native modules in the module allow-list at the end of this file.
  A native module outside the list crashes the app in Expo Go.
- A package with JavaScript code only is allowed. Check it and its dependencies before you
  use it: no `ios/`, `android/`, `apple/`, `*.podspec`, or `expo-module.config.json`.
  When you are not sure, do not add it.
- Install every package with `npx expo install <name>`. It picks the version for SDK 57.
- No OAuth sign-in (Google, Apple, Facebook). Expo Go cannot receive the redirect.
  Sign-in uses Supabase email and password. The default email template sends a link,
  not a code, and no tool here changes that template.
- No push notifications. Expo Go does not receive remote push messages.
- No in-app purchases, no custom native code, and no config plugin that needs a build.
- The web preview runs in an iframe with no camera, microphone, location, or motion-sensor
  access. A screen that uses `expo-camera`, `expo-audio` recording, `expo-location`,
  `expo-sensors`, or a module in the "No web version" list below
  checks `Platform.OS === "web"` and shows a short message there.

## Route rules

- One file in `src/app/` is one route: `src/app/profiles.tsx` is `/profiles`.
- `src/app/_layout.tsx` is the root layout. Keep its first two imports and its providers.
- A folder with its own `_layout.tsx` groups routes, for example tabs in `src/app/(tabs)/`.
- Navigate with `Link` and `router` from `expo-router`. Add no React Navigation package.
- Every route renders its content inside `Screen` from `@/shared/ui`.
  `Screen` handles the safe areas and the keyboard.
- A web visitor can open any route first. A back button checks `router.canGoBack()`
  before `router.back()`, as in `src/app/profiles.tsx`.

## Planning a turn

- Read the brief fully before you write code. Restate the goal in one line.
- Build small: one screen, one section, or one fix per step.
- Run `pnpm run typecheck` and `pnpm run lint` before you finish a turn.

## When to build

- The brief names a screen, a section, a style, or a fix: build it.
- The brief names a look: apply it through `src/global.css` and `src/shared/ui/`.

## When to ask the user

- A fact is missing: price, phone, address, text content, image.
- A business decision is open: which language, which product, which offer.
- Do not ask for things the brief already answers.
- Put every question of one step in one ask_user call.

## ask_user contract

- The tool name is `mcp__harness-tools__ask_user`.
- Input shape: `{ questions: [{ question, kind?, options?, helper?, maxFiles? }] }`.
- One call holds every question of one step, at most 4. Never call it twice in one reply.
- `kind` is one of `single-choice`, `multi-select`, `free-text`, `attachments`.
- `question` is one clear sentence in the user's language, at most 300 characters.
- `options` is a list of `{ id, label, description? }`, at most 6.
- Zero options means a free-text question. The user can always type an answer.
- `helper` is one short line shown under the question.
- Images, logos, photos: `kind: "attachments"` with `maxFiles` (1 to 6).
- The result is `{ answers: [{ questionId, question, action, selected, text, files }] }`.
- `action` is `answered`, `delegated` (you decide), or `dismissed` (skipped; follow `text`).
- `files[].path` is the copy in `public/uploads/<name>`. Read that file to see it.
- In app code, load the file with `require()` and a fixed relative path, for example
  `require("../../public/uploads/<name>")` from `src/app/`. Metro needs a fixed string.
- The tool text names the web URL `/uploads/<name>`. That URL does not work on a phone.
- The tool text also offers design worlds with `worldId`. This template has no world skills.
- Ask only when blocked.

## File layout

- `src/app/`: routes and layouts. `_layout.tsx` is the root.
- `src/shared/ui/`: the `App*` components over HeroUI Native, and `Screen`.
- `src/lib/`: shared logic, for example the Supabase client.
- `src/i18n/`: dictionaries, the provider, and the `useT` hook.
- `src/global.css`: the theme variables for light and dark.
- `supabase/migrations/`: SQL migrations, forward-only. `0000_base.sql` is the base schema.
- `native-modules.json`: the module allow-list. `scripts/allow-list.mjs` writes it.
- Import app files through `@/`, which is `src/`, for example `@/shared/ui`.

## Design rules

- `src/global.css` is the single source of colors. Change the look of the app there.
- Use semantic classes: `bg-background`, `text-foreground`, `bg-surface`, `text-muted`,
  `bg-accent`, `border-border`. They follow light and dark mode.
- Never hardcode a color, a gray, or a shadow in a screen.
- Screens use the `App*` components from `@/shared/ui`, not `heroui-native` directly.
  When a screen needs another HeroUI component, add an `App*` file there first.
- Text goes through `AppText`. The React Native `Text` has no theme.
- Spacing uses Uniwind classes (`p-4`, `gap-3`), not numbers in `style`.
- Show images with `expo-image`. Install it with `npx expo install expo-image`.
- Use `Platform.OS` or `Platform.select` only for a real platform difference.
- Core content and actions must work with no animation.
- Check `useReducedMotion()` from `react-native-reanimated` before a long animation.

## Language rules

- The template has `en`, `fr`, and `ar`. Arabic is right to left.
- Your session instructions list the app languages. Set `locales` in `src/i18n/config.ts`
  to those codes only. The first code is the default.
- The switch, the saved locale, and the device match read `locales`. Do not filter them one by one.
- Never delete a dictionary file. `en.ts` is the fallback for a missing key.
- Every user-facing string goes through `t("key")` from `useT()`.
- Keys stay identical across `en.ts`, `fr.ts`, `ar.ts`. English is the source.
- A switch to or from Arabic mirrors the layout at once: the root layout sets the
  direction from `useT().dir`. On a phone the app also reloads once, so native views
  follow. Keep this flow in `src/app/_layout.tsx` and `src/i18n/provider.tsx`.
- Use logical utilities only: `ps-`, `pe-`, `ms-`, `me-`, `start-`, `end-`.
- For a style that differs by direction, use the `rtl:` and `ltr:` variants.
- Use the classes, not `marginStart` or `start` in `style`: inline styles do not mirror on the web.
- Never use `pl-`, `pr-`, `ml-`, `mr-`, `left-`, `right-`, `text-left`, `text-right`.
- Directional icons (arrows, chevrons) flip when `useT().dir` is `rtl`.
- Leave text alignment at its default; it follows the direction. React Native has no `text-end`.
- Arabic text uses no italics.

## Supabase rule

- A Supabase project exists from project creation. It is already provisioned.
- App code in `src/` uses `supabase` from `@/lib/supabase`. It never calls `createClient`.
- That client reads `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY`.
- An Edge Function makes its own client with `Deno.env.get("SUPABASE_URL")` and
  `Deno.env.get("SUPABASE_ANON_KEY")`.
- The sandbox env already holds both values. Never write them into a file.
- A missing value throws a clear error at start. Never catch it away.
- Never write a fallback for a missing backend. No "no backend yet" path.
- Data access stays behind the RLS policies in `supabase/migrations/`.
- The client has no generated types. Check the rows you read with a zod schema,
  as in `src/app/profiles.tsx`.
- Every `EXPO_PUBLIC_` value ships inside the app bundle. Never put a secret in one.

## Public form contract

A public form is a form that a visitor sends without an account: an order, a
booking, a contact request, a sign-up for news.

- The form writes to the app's own database. The wandit Leads tab is V1 only and
  receives nothing from this app.
- Create the table first with one `apply_migration` call. The Migrations rules apply:
  additive, row-level security in the same migration, and never a `using (true)`
  select policy for `anon`.
- The table gets one insert policy for `anon` and `authenticated`. It gets no select,
  update, or delete policy for `anon`.
- A mobile app has no server function. The write goes through one of these two paths:
  - A Supabase RPC: a `security definer` Postgres function, created by migration.
    Give it `set search_path = ''`, then write each table, type, and function outside
    `pg_catalog` with its schema, for example `public.orders`.
    Revoke `execute` from `public` and grant it to `anon` and `authenticated`.
    The app calls `supabase.rpc("<name>", fields)`.
  - An Edge Function in `supabase/functions/<slug>/`. The app calls
    `supabase.functions.invoke("<slug>", { body: fields })`. With the anon key the
    function cannot read the new row, so it inserts without `.select()`. To return an
    order number, it makes the id with `crypto.randomUUID()` and inserts that id.
    Give that table `id uuid primary key default gen_random_uuid()`.
- The app never inserts into the table directly. The app code never names the table.
- The honeypot is a text field named `website` that a person never sees: give it the
  `hidden` class and `autoComplete="off"`. The app sends its value with the fields.
- The RPC or the function checks the honeypot first. When it is filled, it answers
  success and writes nothing. A bot must not learn that it failed.
- The RPC or the function validates every field. The app validates too, with zod,
  to show field errors.
- The RPC or the function catches its database errors (in SQL: `exception when others`)
  and answers one general failure. The database error text never reaches the app.
- The screen shows a translated general error.
- The success state shows what the app promised, for example an order number from
  the inserted row.

## Backend tools

- The host runs the backend tools. They reach you as `mcp__harness-tools__<name>`.
- `apply_migration`: applies one schema change. See Migrations.
- `get_advisors`: answers the security and performance findings of the database.
- `run_sql`: runs one read-only query, for checks. It answers at most 200 rows.
- `run_sql_write`: writes data. The user approves each call first.
- `deploy_function`: deploys the Edge Function in `supabase/functions/<slug>/`.
- `set_secret`: gives one secret to the Edge Functions as an env variable.
- Change the database and the functions only with these tools.
- Keep each Edge Function in one flat folder. `index.ts` is the entrypoint.
- `pnpm run typecheck` does not check `supabase/functions/`: that code is Deno code.
- A function imports no file from another folder, for example `_shared/`.
- A function that the app calls answers `OPTIONS` and sends CORS headers on every answer.
  The web preview is a browser.
- `backend_paused` or `backend_not_ready`: tell the user. Stop the backend work.
- `rate_limited`: wait `retryAfterSeconds`, then call the tool again once.

## Secrets

- Never write a secret value in the chat, the code, or a tool input.
- Code that reads a secret runs in an Edge Function, with `Deno.env.get("NAME")`.
- The app calls that Edge Function. The app never holds the secret.
- A key of the user, for example a Stripe key: `set_secret` with `source: "project_secret"`.
- On `missing`, tell the user the secret name. The user adds it in the Cloud tab.
- A key the app makes, for example a signing key: `set_secret` with `source: "generate"`.
- `generate` keeps an existing value. It never replaces a key the app uses.
- Names that start with `SUPABASE_` are reserved. Edge Functions get them already.

## Migrations

- Migrations are forward-only. A migration never runs backwards.
- Migrations are additive: add tables, columns, indexes, and policies.
- Apply each migration with one `apply_migration` call. Never write the file yourself.
- The tool writes `supabase/migrations/<timestamp>_<name>.sql` after `0000_base.sql`.
- `name` uses `a-z`, `0-9`, and `_`, for example `create_notes`.
- Each migration gets a new `name`. The ledger keeps one row per name.
- One migration runs in one transaction. The tool refuses `begin`, `commit`,
  `rollback`, and `savepoint`. Do not use `concurrently`.
- The same SQL twice is skipped. A new change needs a new migration with a new name.
- Every new table gets `enable row level security` and its policies in the same migration.
- Never give `anon` a `using (true)` policy, except on a table of public content.
- A migration that can destroy data answers `needs_approval`: drop, truncate,
  delete, update, merge, a column type change, or a statement that opens with
  `do`, `call`, `select`, `with`, `explain`, or `values`.
- Then call `apply_destructive_migration` with the same input, only when the brief needs it.
- After each migration, call `get_advisors`.
- Fix every `error` finding with a new migration before the turn ends.
- Then call `get_advisors` again. Report the `warn` findings to the user in one line.
- Use `run_sql` to check the result. Never use it to change the schema.
- A restore is code only: new migrations that recreate state. No rollback files.

## Commits

- The host commits your work. You run no git write command.
- `git status` and `git diff` for reading are fine.

## Module allow-list

<!-- allow-list:start -->
Generated by `scripts/allow-list.mjs` from expo 57.0.25. Do not edit by hand.

Native modules that run in Expo Go (91):
`@expo/dom-webview`, `@expo/metro-runtime`, `@expo/ui`, `@expo/vector-icons`,
`@react-native-async-storage/async-storage`, `@react-native-community/datetimepicker`,
`@react-native-community/netinfo`, `@react-native-community/slider`,
`@react-native-masked-view/masked-view`, `@react-native-picker/picker`,
`@react-native-segmented-control/segmented-control`, `@sentry/react-native`, `@shopify/flash-list`,
`@shopify/react-native-skia`, `@stripe/stripe-react-native`, `expo`, `expo-application`,
`expo-asset`, `expo-audio`, `expo-auth-session`, `expo-background-task`, `expo-battery`,
`expo-blur`, `expo-brightness`, `expo-calendar`, `expo-camera`, `expo-cellular`, `expo-checkbox`,
`expo-clipboard`, `expo-constants`, `expo-contacts`, `expo-crypto`, `expo-device`,
`expo-document-picker`, `expo-file-system`, `expo-font`, `expo-gl`, `expo-glass-effect`,
`expo-haptics`, `expo-image`, `expo-image-manipulator`, `expo-image-picker`, `expo-intent-launcher`,
`expo-keep-awake`, `expo-linear-gradient`, `expo-linking`, `expo-local-authentication`,
`expo-localization`, `expo-location`, `expo-mail-composer`, `expo-media-library`,
`expo-navigation-bar`, `expo-network`, `expo-notifications`, `expo-print`, `expo-router`,
`expo-screen-capture`, `expo-screen-orientation`, `expo-secure-store`, `expo-sensors`,
`expo-sharing`, `expo-sms`, `expo-speech`, `expo-splash-screen`, `expo-sqlite`, `expo-status-bar`,
`expo-store-review`, `expo-symbols`, `expo-system-ui`, `expo-task-manager`,
`expo-tracking-transparency`, `expo-video`, `expo-video-thumbnails`, `expo-web-browser`,
`lottie-react-native`, `react`, `react-dom`, `react-native`, `react-native-gesture-handler`,
`react-native-get-random-values`, `react-native-keyboard-controller`, `react-native-maps`,
`react-native-pager-view`, `react-native-reanimated`, `react-native-safe-area-context`,
`react-native-screens`, `react-native-svg`, `react-native-view-shot`, `react-native-web`,
`react-native-webview`, `react-native-worklets`

JavaScript-only packages of this template:
`@supabase/supabase-js`, `heroui-native`, `tailwind-merge`, `tailwind-variants`, `tailwindcss`,
`uniwind`, `zod`

Allowed with a limit in Expo Go:
- `@expo/ui`: no component newer than 57.0.11 (no NavigationStack, Toolbar, or NavigationSplitView).
- `@sentry/react-native`: JavaScript errors only; the native crash reporter is not in Expo Go.
- `@stripe/stripe-react-native`: no Apple Pay and no Google Pay.
- `expo-auth-session`: no OAuth sign-in in Expo Go; use Supabase email sign-in.
- `expo-calendar`: only the `expo-calendar/legacy` API works.
- `expo-local-authentication`: no Face ID on iOS.
- `expo-location`: foreground location only.
- `expo-notifications`: local notifications only; no remote push.
- `expo-splash-screen`: Expo Go shows the app icon, not the configured splash.
- `react-native-maps`: Apple Maps only on iOS; Google Maps on Android.

No web version. A screen that uses one needs a web fallback:
`@expo/ui`, `@react-native-community/datetimepicker`, `@react-native-masked-view/masked-view`,
`@stripe/stripe-react-native`, `expo-background-task`, `expo-brightness`, `expo-calendar`,
`expo-contacts`, `expo-file-system`, `expo-glass-effect`, `expo-intent-launcher`,
`expo-local-authentication`, `expo-media-library`, `expo-navigation-bar`, `expo-notifications`,
`expo-screen-capture`, `expo-secure-store`, `expo-sms`, `expo-splash-screen`, `expo-store-review`,
`expo-task-manager`, `expo-tracking-transparency`, `expo-video-thumbnails`,
`react-native-keyboard-controller`, `react-native-maps`, `react-native-pager-view`,
`react-native-view-shot`, `react-native-webview`

Not in Expo Go. Never install these:
- `@expo/fingerprint`: a Node build tool, not an app module.
- `@react-native-community/viewpager`: deprecated and not in Expo Go; use react-native-pager-view.
- `eslint-config-expo`: a lint config, not an app module.
- `expo-analytics-amplitude`: a removed legacy module, not in Expo Go.
- `expo-app-auth`: deprecated and removed, not in Expo Go.
- `expo-app-loader-provider`: a legacy internal package, not in Expo Go.
- `expo-app-metrics`: Expo Go leaves it out of its build.
- `expo-apple-authentication`: the iOS store Expo Go 57.0.9 lacks it.
- `expo-background-fetch`: deprecated and off in iOS Expo Go; use expo-background-task.
- `expo-brownfield`: a toolkit for existing native apps, not in Expo Go.
- `expo-build-properties`: a build-time config plugin with no app module.
- `expo-dev-client`: a build tool for development builds, not in Expo Go.
- `expo-eas-client`: an internal package of expo-updates.
- `expo-google-app-auth`: deprecated and removed, not in Expo Go.
- `expo-image-loader`: an internal package of other Expo modules.
- `expo-insights`: Expo Go leaves it out of its build.
- `expo-live-photo`: the iOS store Expo Go 57.0.9 lacks it.
- `expo-manifests`: an internal package of expo-updates.
- `expo-maps`: needs a development build, not in Expo Go.
- `expo-mcp`: a Node tool for the editor, not an app module.
- `expo-mesh-gradient`: the store Expo Go 57.0.9 lacks it on iOS and Android.
- `expo-module-template`: a template to write native modules.
- `expo-modules-core`: an internal package; apps import from expo.
- `expo-observe`: not in Expo Go.
- `expo-server`: the server runtime of API routes, not an app module.
- `expo-updates`: most of its API fails in Expo Go.
- `expo-widgets`: needs a development build, not in Expo Go.
- `jest-expo`: a test preset, not an app module.
- `react-native-bootsplash`: a native library that Expo Go does not hold.
- `react-server-dom-webpack`: React Server Components bindings for frameworks.
- `sentry-expo`: deprecated; use @sentry/react-native.
- `unimodules-app-loader`: an internal package of expo-task-manager.
- `unimodules-image-loader-interface`: a legacy internal package, not in Expo Go.
<!-- allow-list:end -->
