# V2 research: the Expo app today, and the "iOS simulator streaming" branch

Date: 2026-09-03
Worktree read: `/Users/mac/Desktop/work/projects/ISR-AI/.claude/worktrees/v2-builder` (branch `feat/v2-builder`, same as `dev`)
Author: Claude Fable subagent (read-only research; no source edits, no commits)

All repo paths below are relative to the worktree root. Line numbers are from the files as read on 2026-09-03.
Items marked **UNVERIFIED** were not confirmed from code, git, or a local file.

---

## 0. Short answers

1. `apps/native` is a full mobile client for V1 wandit. It has Google sign-in (Better Auth), a projects drawer, a prompt-first home, a streaming AI chat with builder cards, a landing-page preview and editor inside a `react-native-webview`, publish/unpublish/rollback, and Assets / Marketing / Leads hub views. Settings is a placeholder. It ships to TestFlight through EAS. It does **not** preview mobile apps. It previews **static HTML pages** only.
2. The branch `claude/ios-simulator-streaming-716ef9` contains **no simulator streaming code**. It is fully merged into `dev` (PR #240 and PR #242). Its two unique commits are the native real-API workspace (`0ff4b9cd`) and the EAS TestFlight CI pipeline (`5f419b10`). The branch name comes from the name of the Claude Code worktree used for mobile development. In that worktree, "streaming the simulator" meant: the Claude Code desktop app attached a live iOS Simulator panel through its built-in `Claude_Code_iOS_Simulator` MCP tool, so the agent could screenshot, tap, and type while it built the app. Nothing of that is product code.
3. `serve-sim` is **not referenced anywhere in the repo**. It is installed on this Mac as a Claude Code plugin (marketplace `evanbacon/serve-sim`), it was run at least once on 2026-09-02, and it was **not** used in the branch's sessions. It is a macOS-only, Apple-Silicon-only tool that streams an iOS Simulator framebuffer as MJPEG or H.264 (WebCodecs) over HTTP plus a binary WebSocket for input. It is not WebRTC.
4. For V2 mobile preview, the repo gives V2 a strong mobile **client** (auth, API, chat stream, job progress), but **zero** infrastructure for previewing **user-generated** Expo apps. Streaming an iOS Simulator needs a Mac host pool; it cannot run inside a Linux sandbox. See section 5.

---

## 1. Method

- Read `docs/native-structure.md`, all Expo Router route files, and the feature modules under `apps/native/`.
- Ran `git log --oneline dev..claude/ios-simulator-streaming-716ef9`, `git diff --stat dev...claude/ios-simulator-streaming-716ef9`, `git merge-base`, `git log --graph`, and `git show --stat` on the branch's own commits. Read PR #240 and PR #242 bodies with `gh pr view`.
- Searched the repo (without `node_modules`) for `serve-sim`, `simctl`, `xcrun`, `mjpeg`, `webrtc`, `simulator`.
- Read the local `serve-sim` plugin clone at `~/.claude/plugins/marketplaces/serve-sim` (README, SKILL.md, references, Swift sources) and the plugin registry files.
- Read the Claude Code session transcripts stored for the branch's worktree (`~/.claude/projects/-Users-mac-Desktop-work-projects-ISR-AI--claude-worktrees-ios-simulator-streaming-716ef9/*.jsonl`) to see what tooling was used to "stream" the simulator. I only extracted tool calls and short text; I did not read the full transcripts.

---

## 2. Part 1: what `apps/native` does today

### 2.1 Stack

Source: `apps/native/package.json`.

| Item | Value |
|---|---|
| Expo SDK | `expo ~56.0.3`, `expo-router ~56.2.5`, entry `expo-router/entry` |
| React Native | `react-native 0.85.3`, React `19.2.3`, `react-native-web ~0.21.0` |
| UI | `heroui-native ^1.0.4`, `uniwind ^1.9.0` (Tailwind v4 for RN), `react-native-reanimated 4.3.1`, `@gorhom/bottom-sheet`, `lottie-react-native` |
| AI | `ai ^7.0.14`, `@ai-sdk/react ^4.0.17` (the same AI SDK family the server uses) |
| Auth | `better-auth` + `@better-auth/expo`, `expo-secure-store` |
| Data | `@tanstack/react-query ^5.101.2`, `axios`, `@electric-sql/client 1.0.14` (Trigger.dev Realtime shape stream) |
| Preview | `react-native-webview 13.16.1`, `@wandit/preview-editor` (workspace package) |
| Shared packages | `@wandit/contracts`, `@wandit/env`, `@wandit/internationalization`, `@wandit/preview-editor` |
| Device features | `expo-notifications`, `expo-audio` (voice dictation), `expo-image-picker`, `expo-document-picker`, `expo-sharing`, `expo-video`, `expo-clipboard`, `expo-web-browser`, `expo-haptics` |

Config:
- `apps/native/app.json`: scheme `wandit`, iOS bundle id `com.zakisb97.wandit`, EAS project id `41f71bec-…`, plugins `expo-font`, `expo-notifications`, `expo-audio` (microphone permission), `expo-sharing`, `expo-video`; experiments `typedRoutes` and `reactCompiler` on.
- `apps/native/eas.json`: profiles `development` (dev client), `preview`, `staging` (bakes `EXPO_PUBLIC_SERVER_URL=https://api-staging.wandit.dev`, `EXPO_PUBLIC_WEB_APP_URL=https://wandit.dev`), `production` (`https://api.wandit.dev`). Submit profiles carry `ascAppId 6804269467`.
- `.github/workflows/mobile-testflight.yml:10-24,57-60`: a push to `main` or `staging` that touches `apps/native/**` or the five packages it bundles runs `eas build --platform ios --profile <staging|production> --non-interactive --no-wait --auto-submit`.
- `.gitignore:71-73`: `apps/native/ios/` and `apps/native/android/` are generated by prebuild and not committed.
- `apps/native/metro.config.js`: default Expo Metro config wrapped with Uniwind and Reanimated. No `serve-sim/middleware`.
- `apps/native/.env:1`: `EXPO_PUBLIC_SERVER_URL=http://localhost:3080`.
- `packages/env/src/native.ts:4-27`: three public env vars. `EXPO_PUBLIC_SERVER_URL` (required), `EXPO_PUBLIC_TRIGGER_API_URL` (default `https://api.trigger.dev`), `EXPO_PUBLIC_WEB_APP_URL` (default `http://localhost:3001`). The runtime env uses static `process.env.EXPO_PUBLIC_*` accesses on purpose; a bare `process.env` object is empty in release builds and crashed the app at launch (fixed in commit `5f419b10`).

Root scripts (`package.json`): `dev:native` = `turbo run dev -F native`; the native `dev` script is `expo start --clear`.

### 2.2 Routes (Expo Router) — actual tree

`docs/native-structure.md` is **stale**. It describes `preview.tsx`, `leads.tsx`, a `workspace-shell.tsx` with top tabs, and a mock-data seam. None of those exist now. The real tree:

```
apps/native/app/
├── _layout.tsx                         providers + auth gate
├── +not-found.tsx
├── connect/complete.tsx                MCP OAuth deep-link landing → Redirect "/"
├── (auth)/_layout.tsx, sign-in.tsx     → features/auth WelcomeScreen
└── (app)/_layout.tsx
    └── (drawer)/_layout.tsx            Drawer, drawerContent = ProjectsDrawer
        ├── index.tsx                   → features/home HomeScreen
        └── project/[projectId]/
            ├── _layout.tsx             Stack, headerShown false
            ├── index.tsx               → workspace ChatScreen (keyed by projectId)
            ├── page.tsx                → workspace PageScreen (preview + editor)
            ├── settings.tsx            → workspace SettingsScreen (placeholder)
            └── [view].tsx              → WorkspaceViewsScreen (assets | marketing | leads)
```

Evidence:
- `apps/native/app/_layout.tsx:40-78`: `RootNavigator` reads `authClient.useSession()`, loads fonts, calls `usePushNotifications(...)`, and renders `Stack.Protected guard={signedIn}` for `(app)` and `guard={!signedIn}` for `(auth)`. Line 44-45: `signedIn = !!session?.user || authBypassed` (dev bypass, see 2.3).
- `apps/native/app/(app)/(drawer)/_layout.tsx:17-33`: `Drawer` with `drawerContent={ProjectsDrawer}`, width `min(84%, 330)`.
- `apps/native/app/(app)/(drawer)/project/[projectId]/index.tsx:9`: `<ChatScreen key={projectId} />`.
- `apps/native/app/(app)/(drawer)/project/[projectId]/[view].tsx:3-7`: one route catches `assets` / `marketing` / `leads`; static routes win first.
- `apps/native/app/connect/complete.tsx:3-16`: the deep link `…/connect/complete?mcp_code=…` normally never renders (iOS auth session intercepts it); it exists for Android and cold-start paths.

### 2.3 Auth

- `apps/native/lib/auth-client.ts:8-29`: `createAuthClient({ baseURL: env.EXPO_PUBLIC_SERVER_URL, plugins: [inferAdditionalFields(...), expoClient({ scheme, storagePrefix, storage: SecureStore })] })`. Additional user fields: `displayEmail`, `onboardingCompletedAt`.
- `apps/native/features/auth/screens/welcome-screen.tsx:83-105`: the only sign-in method is `authClient.signIn.social({ provider: "google", callbackURL: "/" })`. No email/password on native.
- `apps/native/lib/dev-auth-bypass.ts:1-10` and `welcome-screen.tsx:107-112,188-203`: a `__DEV__`-only button flips a client flag that skips the auth gate **without a session**, because Google OAuth cannot round-trip inside Expo Go (the `wandit://` scheme is not registered there). All API calls then return 401. The file has a TODO to delete it once the native Google redirect works on a dev build.
- `apps/native/shared/lib/base-service.ts:88-94,141-152`: every axios request reads the session cookie from `authClient.getCookie()` (SecureStore) and sets it as a `Cookie` header by hand. Web relies on `withCredentials`; native cannot. Lines 27-31: relative paths get the `/api/v1` prefix; timeout 60 s. Lines 99-112: a 401 calls `redirectToSignIn()` (`shared/lib/auth-redirect.ts:21-35`, `router.replace("/sign-in")` with a 1 s re-entrancy lock).
- `apps/native/shared/lib/query-client.ts:12-34`: staleTime 30 s, one retry, no retry on 401, no mutation retries.

### 2.4 Home, projects drawer, composer

- `apps/native/features/home/screens/home-screen.tsx:72-107`: the hero `PromptBox` submits `createProject.mutate({ prompt, composer, attachments })`. On success it stashes `{ projectId, chatId, composer }` in `chatAutostart` and pushes `/project/{projectId}`. Suggestion chips: sales page, website, product photos, ad creatives, video ad, flyer (lines 30-37).
- `apps/native/features/projects/components/prompt-box.tsx:29-60`: the composer imports `ConnectorsSheet` (MCP connectors), `useAttachments` (camera / library / files), `useVoiceDictation` (expo-audio + server transcription), `EnginePickerSheet` (route mode), `OutputConfigSheet`, `SkillSelectDialog`, `RecordingWaveform`. It builds the same `ComposerMetadata` contract the web composer sends.
- `apps/native/features/projects/api/projects.requests.ts:30-86`: list, paged list with server-side search (`/api/v1/projects/paged`), get, create, patch, soft delete; all responses parsed with `@wandit/contracts` zod schemas.
- `apps/native/features/projects/components/projects-drawer.tsx:1-55`: infinite project list (`useInfiniteProjects`), rename / delete / actions sheets, account sheet with language switch, sign-out (also unregisters the push token), toasts.

### 2.5 Chat (AI SDK `useChat` over the server's SSE stream)

- `apps/native/features/workspace/lib/use-ai-chat.ts:1-2,27,115-151`: `useChat` from `@ai-sdk/react` with a `DefaultChatTransport` whose `api` is `${EXPO_PUBLIC_SERVER_URL}${aiChatRoutes.stream(chatId)}` (line 435-437), `fetch` is `expo/fetch` wrapped by `createStatusPreservingChatFetch`, headers are built per request with `Accept: text/event-stream` and the SecureStore cookie (lines 439-445). `prepareSendMessagesRequest` adds `metadata.composer` and `metadata.selectedWids`.
- Lines 162-244: typed `messageMetadataSchema`, data-part schemas (`ai-error`, `billing-error`, `credits-settled`), `sendAutomaticallyWhen` = tool calls complete OR approval responses complete, `onFinish` invalidates credits and page overview/versions, `onData` routes typed errors and credit settlements.
- Lines 248-294: history is seeded once per chat; if the last message is a user message and an autostart entry exists, it calls `regenerate()` so project creation's first prompt starts the AI reply without a duplicate user row (`lib/chat-autostart.ts:9-27`).
- `lib/status-preserving-chat-fetch.ts:12-40`: converts non-2xx responses into the app's typed `ApiClientError` so billing status and server codes survive the transport.
- `apps/native/features/workspace/screens/chat-screen.tsx:73-87,286-294,345-408`: header with a "play" button that pushes `/project/{id}/page`; thread with builder cards; `KeyboardStickyView` composer; the `RequestTray` docks an `ask_user` question into the composer top slot; `useFocusEffect` (lines 205-218) consumes a page-comment handoff and sends it as one user message with `selectedWids` + `selectedTargets`.
- Builder cards (all under `features/workspace/components/`): `page-build-card.tsx` (990 lines), `async-generation-card.tsx` (images, 1459 lines), `video-generation-card.tsx`, `lead-scrape-card.tsx`, `mcp-tool-run.tsx` (1468 lines), `ask-user-card.tsx`, `publish-panel.tsx`, markdown renderer with tables and media.
- `lib/use-live-run.ts:1-9,185-199`: job progress without polling. It opens an Electric `ShapeStream` against `${EXPO_PUBLIC_TRIGGER_API_URL}/realtime/v1/runs/{runId}` with the run's public access token, folds row deltas, maps the engine status to the public API status, and fires `onSettled` once. It reconnects on app foreground (lines 216-231). This replaces `@trigger.dev/react-hooks`, which needs WHATWG streams Hermes does not guarantee.

### 2.6 Preview and editor (static HTML only)

- `apps/native/features/workspace/screens/page-screen.tsx:74-81,92-103`: the page screen polls the page overview every 1.5 s while a build is queued/generating (`api/pages.queries.ts:15-30`), fetches the active version's full HTML (`useVersionHtmlQuery`, cached forever), and renders it in `PagePreviewWebView`. Three modes: view, comment (pin notes on tapped blocks → one batched AI message), edit (theme tokens, text, spacing, removal → one op batch per Save = one new immutable version through `POST /projects/:id/page/ops`, `api/pages.requests.ts:84-120`).
- `components/page-editor/page-web-view.tsx:39-41,122-143`: a `react-native-webview` with `source={{ html }}`, `originWhitelist={["about:blank"]}`, and `onShouldStartLoadWithRequest` that blocks all navigation. It "speaks the SAME preview protocol as the web's sandboxed iframe (`@wandit/preview-editor`)".
- `lib/page-preview/preview-document.ts:1-8,43-54`: `injectPreviewEditor(html)` inserts the shared editor script; a small native adapter forwards child messages to `window.ReactNativeWebView.postMessage`.
- `packages/preview-editor/src/index.ts:1-13`: the shared package (extracted from the web editor in commit `0ff4b9cd`) exports the editor script, message schemas, token parsing, pending-op builders, and target comments. Web files are re-export shims.
- `lib/use-publish-controller.ts:1-5,58-77` and `api/deployments.requests.ts:72-116`: publish (POST runs the whole pipeline and returns the settled state), unpublish, rollback, slug availability with a debounce. The publish sheet (`components/page-editor/publish-sheet.tsx`, 627 lines) renders it.

Conclusion: the "preview" on native is the V1 landing page HTML inside a WebView. There is **no** preview of a mobile app, no Expo Snack, no simulator, no device stream.

### 2.7 Hub views, settings, notifications, connectors

- `screens/workspace-views-screen.tsx:33-39,133-152`: Assets / Marketing / Leads stay mounted (display toggle) so filters survive a switch; the floating `WorkspaceHubPill` switches the `[view]` param. Leads is a full CRM (`components/hub/leads-view.tsx`, 1060 lines): server-side search/filters, keyset infinite scroll with a 15 s poll, optimistic status/archive, CSV export via share sheet, Google Sheets sync card.
- `screens/settings-screen.tsx:5-13`: a `WorkspacePlaceholder`. Project settings are not built on native.
- `features/notifications/lib/use-push-notifications.ts:17-41`: registers the Expo push token with the server (`pushTokenRoutes`) on real devices only, never in Expo Go, and opens the lead on tap. Server side: commit `a9140e42` "push notification to the mobile app when a lead arrives".
- `features/connectors/api/connectors.requests.ts:1-8`: MCP connector OAuth: `POST connect` with a deep-link `returnUrl` → system auth browser → server callback 302s to the deep link → `POST complete`. Tokens never reach the app.
- i18n: `contexts/locale-context.tsx` stores the locale in SecureStore and loads `@wandit/internationalization` dictionaries (en / fr / ar). `app/_layout.tsx:34`: `I18nManager.allowRTL(true)`.

### 2.8 Product status of the native app

- `docs/PRD.md:72,105` still says the Expo app is "Out of MVP — untouched for now". That is out of date: the app is wired to production APIs and has a TestFlight pipeline (section 2.1).
- Recent native commits on `dev` (`git log -12 -- apps/native`): AI error normalization, image frames, Google Sheets auto-sync, lead push notifications, display email, credits, app icon and ASC id. The app is actively maintained.

---

## 3. Part 2: the branch `claude/ios-simulator-streaming-716ef9`

### 3.1 Git facts

| Command | Result |
|---|---|
| `git log --oneline dev..claude/ios-simulator-streaming-716ef9` | empty (no commits ahead of `dev`) |
| `git diff --stat dev...claude/ios-simulator-streaming-716ef9` | empty |
| `git merge-base dev claude/ios-simulator-streaming-716ef9` | `a398a4f1` = the branch tip itself (2026-08-22 18:17:16 +0100) |
| Local vs `origin/` | both at `a398a4f1` |
| Merges into `dev` | `dd0183d0` "Merge pull request #240", `5dcc69c6` "Merge pull request #242" |

The branch was merged twice and then abandoned at the tip. The full diff it ever carried is visible through its two non-merge commits:

1. `0ff4b9cd` (2026-08-22 15:56) `feat(native): real-API workspace — chat, hub views, publish, leads CRM`. 184 files, +30 699 / −6 045. It replaced the prototype native workspace with production wiring, extracted `packages/preview-editor`, added server endpoints for project output-config and MCP connectors, added native i18n namespaces, added three HTML design prototypes under `design/`, and added the iOS bundle identifier "for simulator builds".
2. `5f419b10` (2026-08-22 18:16) `ci(mobile): EAS TestFlight pipeline for staging/main`. 5 files: the GitHub workflow, `eas.json`, `app.json` (EAS project id, icon, `ITSAppUsesNonExemptEncryption=false`), and the `packages/env/src/native.ts` release-crash fix.

PR #240 body (via `gh pr view 240`): "replaces the prototype/fixture native workspace with production wiring against the real APIs, **verified live on the iOS simulator**". Test plan: "Live simulator verification of chat streaming, hub views, leads CRM … and Google Sheets sync". Merged 2026-08-22T15:01:49Z.
PR #242 body: EAS TestFlight pipeline + release env fix. Merged 2026-08-22T17:17:29Z.

### 3.2 Search for simulator-streaming code across all git history

- `git log --all -i --grep=simulator --grep=simctl --grep=webrtc --grep=mjpeg --grep=serve-sim`: only the four merge commits of this branch and `0ff4b9cd` match, all by branch name.
- `git log --all --name-only | grep -iE "simulat|webrtc|mjpeg|serve-sim|simctl|emulator"`: one hit, `apps/native/shared/ui/helpers/utils/simulate-press.ts` (a UI helper, unrelated).
- Repo grep (no `node_modules`, `ios`, `android`, lockfile) for `serve-sim|simctl|xcrun|ios simulator|mjpeg|webrtc`: **zero hits**.

So: **nothing about simulator streaming was ever committed to the product.**

### 3.3 What "iOS simulator streaming" actually was (from the worktree's session transcripts)

The worktree `.claude/worktrees/ios-simulator-streaming-716ef9` was the long-lived mobile development worktree from 2026-08-01 to 2026-08-22. Its session files:

- `~/.claude/projects/-Users-mac-Desktop-work-projects-ISR-AI--claude-worktrees-ios-simulator-streaming-716ef9/e4010649-266f-4787-b459-89c82761595a.jsonl` (2026-08-01 → 2026-08-11, 65 MB)
- `…/855674b6-88db-4c07-97f6-b6e6bd9917e2.jsonl` (2026-08-01)
- `…/ce525965-e0e9-4689-b68d-e52280f4ffda.jsonl` (2026-08-07)
- `…/461a639c-9fbd-4f1b-8aa2-c4f5e6287872.jsonl` (2026-08-17 → 2026-08-18, 20 MB)

First user prompts (verbatim from the transcripts):
- 2026-08-01 08:51: "pelase cd into the worktree. claude/worktrees/ios-simulator-streaming-716ef9 first then we will proceed wi the work." then 08:53: "ok launch the simulator here please".
- 2026-08-17 22:04: "please cd into ios simulator worktree and its related branch", then "launch it on the simulator please".

What the agent did to "launch the simulator here" (tool calls extracted from the transcripts):

1. Started the API server and Metro: `npx expo start --go --port 8081 --clear` (2026-08-01, Expo Go mode). Later (2026-08-17) it started `pnpm run dev -F server -F native` in a tmux session and built a **dev client** with `npx expo run:ios --device 6BED465E-2E87-4AB7-A3C6-B27327321A32 --no-bundler` (Xcode + CocoaPods; bundle id `com.zakisb97.wandit`).
2. Drove the simulator with **`xcrun simctl`**: `list devices booted`, `terminate … host.exp.Exponent` (Expo Go) or `… com.zakisb97.wandit`, `launch`, `openurl … "wandit://project/demo/leads"`, `ui … appearance dark|light`, `pbpaste`, `spawn … log show`.
3. Streamed and controlled the simulator through the **Claude Code desktop built-in MCP tool `mcp__Claude_Code_iOS_Simulator__control`**. Its action set, as reported by a validation error in the transcript: `attach`, `launch`, `screenshot`, `tap`, `swipe`, `touch_path`, `touch2_path`, `text`, `button`, `open_url`, `detach`. Example calls: `{"action":"open_url","url":"exp://127.0.0.1:8081"}` → "Opened exp://127.0.0.1:8081 on iPhone 15 Pro (6BED…)", and dozens of `{"action":"screenshot"}` calls. The agent's own text at 2026-08-01 08:55: "The live panel is attached, so you can drive it yourself — and I can tap/type/screenshot headlessly to verify anything." Session summaries record the working facts: "coordinate space is 393x852 POINTS (not screenshot pixels); screenshots are ~922x2000 px".
4. It did **not** call `serve-sim` in any of these sessions. Counts per transcript: `serve-sim` appears 1-5 times, all in the process list / plugin listing; `preview_start` appears only as a "No preview is open" message (2026-08-17 23:10). No `simctl io` screenshot commands were used; screenshots came from the MCP tool.

Simulator host used: iPhone 15 Pro, iOS 17.5, UDID `6BED465E-2E87-4AB7-A3C6-B27327321A32`, still booted on this Mac today.

### 3.4 What worked and what did not (as recorded in the transcripts and commits)

Worked:
- Expo Go bundle (3363 modules in 20 s) loading the worktree app against the local API on port 3100; sign-in session and credits balance came from the API.
- Dev-client build with `expo run:ios` after two fixes. Deep links (`wandit://project/demo/leads`) and dark/light switching verified by screenshots.
- Screenshot / tap / type driven verification of the drawer, page editor, hub pill, and leads views (PR #240 "verified live on the iOS simulator").

Did not work, or needed fixes:
- Google OAuth in Expo Go: the `wandit://` scheme is not registered in Expo Go, so the dev auth bypass was added (`apps/native/lib/dev-auth-bypass.ts`). It is still in the tree.
- CocoaPods failed with a Ruby `Encoding::CompatibilityError` until `LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8` was set (2026-08-17 session).
- Metro could not start because macOS ran out of FSEvents streams; fixed with a watchman `prefer_split_fsevents_watcher` setting (a `.watchmanconfig` was added in `0ff4b9cd`).
- A Fabric crash "Attempt to unmount a view which has a different index" (RN 0.85 + reanimated 4 exiting animations on skeletons) was fixed in `apps/native/shared/ui/skeleton-group.tsx`.
- Release builds crashed at launch because `runtimeEnv` used the bare `process.env` object; fixed in `packages/env/src/native.ts` (commit `5f419b10`).
- Push notifications cannot run in Expo Go on SDK 53+ (`use-push-notifications.ts:34-38` guards this).

Nothing in these sessions attempted MJPEG, WebRTC, or a hosted simulator for **end users**. The streaming was a developer-tooling feature of the Claude Code desktop app, on the developer's own Mac.

---

## 4. Part 3: `serve-sim`

### 4.1 Presence on this machine

- Not referenced in the repo (section 3.2).
- Installed as a Claude Code plugin: `~/.claude/plugins/installed_plugins.json` → `serve-sim@serve-sim` version `1.0.0`, scope `user`, installed `2026-06-23T07:10:39Z`, git sha `d46a621c8c68b17aab3f28249ef4d1cbe2f9109f`. Marketplace source: `~/.claude/plugins/known_marketplaces.json` → github repo `evanbacon/serve-sim`, cloned at `~/.claude/plugins/marketplaces/serve-sim`. Plugin homepage from `.claude-plugin/plugin.json`: `https://github.com/EvanBacon/serve-sim`.
- The skill is visible to this session as `serve-sim:serve-sim` ("Control and stream a running iOS, iPad, or Apple Watch Simulator with npx serve-sim").
- The npm package has been executed on this Mac: `~/.npm/_npx/*/node_modules/serve-sim` (three cache entries; version `0.1.42`, with `bin/serve-sim-bin`). The marketplace clone carries package version `0.1.34`.
- Runtime state: `$TMPDIR/serve-sim/server-6BED465E-2E87-4AB7-A3C6-B27327321A32.log`, dated 2026-09-02 16:57. Content: `Local: http://localhost:3100`, `[capture] Framebuffer: 1179x2556 (direct IOSurface, zero-copy)`, `[capture] Frame callbacks registered (event-driven) + 5fps idle floor`. So a stream was started yesterday for the same iPhone 15 Pro. Which session did that is **UNVERIFIED** (not the branch's sessions; those ended 2026-08-18). Note the default helper port 3100 is also the API port used in that worktree, which would conflict.

### 4.2 What it is (from the local clone)

Source of truth: `~/.claude/plugins/marketplaces/serve-sim/README.md`, `skills/serve-sim/SKILL.md`, `skills/serve-sim/references/endpoints.md`, `packages/serve-sim/Sources/SimNative/*.swift`.

- Purpose (README line 1-6): "The `npx serve` of Apple Simulators. Host your simulator for use with Agent tools like Codex, Cursor, or Claude Desktop — locally, over your LAN, or host on a remote mac and tunnel anywhere." Author: Evan Bacon (Expo team). License Apache-2.0.
- Architecture (README "How it works"): `iOS Simulator → serve-sim-bin (Swift, one per device) → MJPEG / WS → Browser`, with a state file in `$TMPDIR/serve-sim/` and a Node CLI / Connect middleware that serves the React preview UI.
- Capture: the README says "captures the simulator's framebuffer via `simctl io`". The Swift source is more specific: `Sources/SimNative/FrameCapture.swift:8-14` uses SimulatorKit frame callbacks and direct IOSurface access ("IOSurface (shared memory) → CVPixelBuffer (zero-copy) → H.264 encode") with a 5 fps idle floor.
- Video protocol (`Sources/SimNative/StreamFormat.swift:1-13`): two wire formats. `mjpeg` = JPEG per frame inside `multipart/x-mixed-replace` (works in any `<img>`, high bandwidth). `avcc` = length-prefixed H.264 NAL chunks on `/stream.avcc`, decoded in the browser by WebCodecs `VideoDecoder` ("~5-10x less bandwidth"); the client feature-detects and falls back to MJPEG. `H264Encoder.swift:6-8` uses `VTCompressionSession`, default 60 fps, 6 Mbit/s. CLI flag `--codec auto|mjpeg`. **It is not WebRTC.** There is no peer connection, no ICE, no TURN.
- Input protocol (`references/endpoints.md`): binary WebSocket at `/ws`. Touch frames `[0x10][subtype][x:f32][y:f32][seq:u16][edge?]`, multi-touch `0x11`, JSON channels for buttons (`0x04`), keyboard HID (`0x06`), orientation (`0x07`), CoreAnimation debug (`0x08`), memory warning (`0x09`). Coordinates normalized 0..1.
- HTTP surface: stream server (default port 3100): `/stream.mjpeg`, `/stream.mjpeg?raw=1`, `/ws`, `/config`, `/health`, `/ax` (accessibility tree), `/foreground`. Preview middleware (default port 3200): `/.sim` (React UI), `/.sim/api`, `/.sim/ax` (SSE), `/.sim/exec` (**runs a shell command on the host**, bearer token), `/.sim/devtools` (WebKit inspector bridge), `/grid/api/*` (start / stop devices).
- Security (`endpoints.md` "Authentication"): "The Swift stream server has no authentication. It listens on `0.0.0.0` by default — be careful when tunneling." CORS is `*`. Only `/.sim/exec` has a bearer token.
- Embedding (README "Embed in your dev server"): `serve-sim/middleware` mounts the preview UI inside Metro, Vite, Next, or Express. With `proxyHelpers: true` the stream, control socket, and DevTools are proxied behind one origin (`/.sim/helper/<device>`), which is the documented path for "remote viewers behind a single port"; the server must forward `upgrade` events to `middleware.handleUpgrade`. There is a documented Expo `metro.config.js` snippet that exposes the preview at `http://localhost:8081/.sim`.
- Extra features: `serve-sim camera <bundle-id>` injects a fake camera feed via `DYLD_INSERT_LIBRARIES` (macOS 14+), `permissions grant|revoke`, `rotate`, `ca-debug`, `memory-warning`, `type`, multi-device support, drag-and-drop media into the device, simulator log forwarding.

### 4.3 Host requirements (hard constraints)

From README "Install" and `skills/serve-sim/scripts/check-prereqs.sh`:
- macOS host with Xcode command line tools (`xcrun simctl`). The check script fails on anything but `Darwin`.
- **Apple Silicon (arm64) only**: "The bundled `serve-sim-bin` helper ships as an arm64 binary and does not run on Intel (x86_64) Macs."
- Node.js 20+ LTS (SKILL.md says ≥18). `bun` not required at runtime.
- A booted simulator (`xcrun simctl boot <UDID>`).
- Camera injection needs macOS 14+.
- Hosting model in the README: run it on "a remote mac and tunnel" the URL. There is no Linux, Docker, or cloud story in the package.

This Mac today (`sw_vers`, `uname -m`): macOS 26.5.2, arm64, `xcrun` present, one booted simulator (iPhone 15 Pro, iOS 17.5). So `serve-sim` can run here.

---

## 5. Implications for V2 mobile preview

### 5.1 Two different "mobile" things — keep them apart

1. **wandit's own mobile client** (`apps/native`). It is a V1 client for landing pages. V2 can reuse most of it as the mobile client of the new builder (auth, API layer, chat stream, job progress, i18n, EAS release).
2. **User-generated mobile apps** (the V2 goal: "mobile apps via Expo"). Nothing in the repo previews, builds, or publishes a user's Expo app. This is greenfield.

### 5.2 Facts that bound the design

- An iOS Simulator runs only on macOS. `serve-sim` also needs Apple Silicon. The V2 harness plan runs Claude Code inside a **Linux sandbox**; that sandbox can never host an iOS Simulator. A streamed iOS preview therefore needs a **separate Mac host pool** (Mac minis, or hosted Macs — provider and price **UNVERIFIED**) that the sandbox talks to over the network.
- `serve-sim` is a dev tool, not a multi-tenant service: one helper per device, no auth on the stream, `0.0.0.0` bind, a host shell-exec endpoint, and a shared `$TMPDIR` state. To expose it to end users V2 would need an authenticated proxy per session (its `proxyHelpers` middleware mode is the right seam), the `exec` endpoint disabled, per-user simulator UDIDs, and lifecycle management (boot / install / erase). Feasible, but it is an infra project, not a plugin.
- The protocol `serve-sim` proves (H.264 AVCC over HTTP + WebCodecs in the browser, MJPEG fallback, binary WS input) is simple and browser-native. It could be embedded in the V2 web preview pane with a `<canvas>` and a WebSocket. A WebRTC path would need extra signaling and TURN and is not what the tool does.
- Android emulators run on Linux with KVM and could live near the sandbox, but `serve-sim` does not cover Android (SKILL.md "When NOT to use: Android emulators → use adb"). Android streaming tooling is **UNVERIFIED** in this research.
- Expo apps already have two zero-infra preview paths: (a) Expo web (`react-native-web` is already in `apps/native/package.json`; `expo start --web`), and (b) Expo Go / a dev client on the user's own phone by QR code, which needs the sandbox's Metro server reachable from the internet (tunnel). Both work with the same iframe/URL preview V2 builds for web apps.

### 5.3 Recommended staging for V2 (my judgment, marked as such)

1. **Stage 1 (no Mac hosts)**: preview the user's Expo app as **Expo web in the existing iframe** plus a **QR / link to open it in Expo Go** on the user's phone. Cheap, and it validates the harness on Expo projects.
2. **Stage 2 (Mac pool)**: add a hosted **iOS Simulator stream** using `serve-sim`'s approach behind an authenticated proxy. Load the user's bundle into a pre-installed Expo Go or a wandit dev client from the sandbox's Metro URL, so no Xcode build per user project is needed. Xcode builds per project (for custom native modules) are a later step.
3. **Android**: separate track; likely a Linux/KVM emulator with its own streaming stack.
4. **Publishing user apps to the stores**: `eas.json` + the TestFlight workflow show how wandit ships its **own** app. For user apps this becomes per-project EAS credentials, Apple / Google developer accounts, and review; it is a product and legal decision, not a code reuse.

### 5.4 What V2 must reuse, replace, or extend in `apps/native`

Reuse as-is:
- `lib/auth-client.ts`, `shared/lib/base-service.ts` (cookie propagation), `shared/lib/auth-redirect.ts`, `shared/lib/query-client.ts`, `packages/env/src/native.ts`.
- `features/workspace/lib/use-ai-chat.ts` + `status-preserving-chat-fetch.ts`. It is already on AI SDK v7 `useChat` with typed data parts. If the V2 endpoint emits the same UI message stream, the native chat works with a new `api` URL.
- `features/workspace/lib/use-live-run.ts` for any Trigger.dev-backed V2 job (builds, deploys).
- `features/projects/*` (drawer, composer, attachments, voice dictation, connectors), `features/credits/*`, `features/notifications/*`, i18n, EAS + TestFlight pipeline.

Replace or extend:
- `screens/page-screen.tsx` and `lib/page-preview/*` assume one immutable HTML string from `pagesRoutes.versionHtml` with an injected editor. V2 web apps are multi-file, served from a sandbox URL. The WebView must load a **URL** with the session cookie (or a signed preview token) instead of inline HTML, and the edit / comment modes need a new protocol or must stay web-only at first.
- `screens/settings-screen.tsx` is a placeholder. V2 needs project settings (env / secrets, connectors, domains) on mobile or must hide them.
- `lib/dev-auth-bypass.ts` must be deleted before any V2 native release; today the auth gate can be skipped in `__DEV__`.
- `docs/native-structure.md` must be rewritten; it no longer matches the routes.
- Any "mobile app preview" screen on native (a stream viewer or a QR / "open in Expo Go" card) is new code.

---

## 6. Evidence index

Repo files (worktree `.claude/worktrees/v2-builder`):
- `apps/native/package.json`, `apps/native/app.json`, `apps/native/eas.json`, `apps/native/metro.config.js`, `apps/native/.env:1`
- `apps/native/app/_layout.tsx:34,40-78`
- `apps/native/app/(app)/(drawer)/_layout.tsx:17-33`
- `apps/native/app/(app)/(drawer)/project/[projectId]/{index,page,settings,[view]}.tsx`
- `apps/native/app/connect/complete.tsx:3-16`
- `apps/native/lib/auth-client.ts:8-29`, `apps/native/lib/dev-auth-bypass.ts:1-10`
- `apps/native/features/auth/screens/welcome-screen.tsx:83-112,188-203`
- `apps/native/shared/lib/base-service.ts:27-31,88-112,141-152`, `shared/lib/server-url.ts:19-27`, `shared/lib/auth-redirect.ts:21-35`, `shared/lib/query-client.ts:12-34`
- `packages/env/src/native.ts:4-27`
- `apps/native/features/home/screens/home-screen.tsx:30-37,72-107`
- `apps/native/features/projects/components/prompt-box.tsx:29-60`, `projects-drawer.tsx:1-55`, `api/projects.requests.ts:30-86`
- `apps/native/features/workspace/lib/use-ai-chat.ts:1-2,27,115-151,162-244,248-294,435-445`
- `apps/native/features/workspace/lib/use-live-run.ts:1-9,185-199,216-231`
- `apps/native/features/workspace/lib/status-preserving-chat-fetch.ts:12-40`, `lib/chat-autostart.ts:9-27`
- `apps/native/features/workspace/screens/chat-screen.tsx:73-87,205-218,286-294,345-408`
- `apps/native/features/workspace/screens/page-screen.tsx:74-81,92-147`
- `apps/native/features/workspace/components/page-editor/page-web-view.tsx:39-41,122-143`
- `apps/native/features/workspace/lib/page-preview/preview-document.ts:1-8,43-54`, `lib/page-preview/types.ts:8-15`
- `apps/native/features/workspace/api/pages.queries.ts:15-30`, `api/pages.requests.ts:84-120`, `api/deployments.requests.ts:72-116`
- `apps/native/features/workspace/lib/use-publish-controller.ts:1-5,58-77`
- `apps/native/features/workspace/screens/workspace-views-screen.tsx:33-39,133-152`, `screens/settings-screen.tsx:5-13`
- `apps/native/features/notifications/lib/use-push-notifications.ts:17-41`
- `apps/native/features/connectors/api/connectors.requests.ts:1-8`
- `packages/preview-editor/src/index.ts:1-13`, `packages/preview-editor/package.json`
- `.github/workflows/mobile-testflight.yml:10-24,57-60`, `.gitignore:71-73`, `package.json` scripts
- `docs/native-structure.md` (stale), `docs/PRD.md:72,105`

Git:
- `git log --oneline dev..claude/ios-simulator-streaming-716ef9` (empty); `git diff --stat dev...claude/ios-simulator-streaming-716ef9` (empty); merge-base `a398a4f1`
- Commits `0ff4b9cd`, `5f419b10`; merges `dd0183d0` (PR #240), `5dcc69c6` (PR #242); `gh pr view 240|242`

Local machine (outside the repo):
- `~/.claude/plugins/installed_plugins.json`, `~/.claude/plugins/known_marketplaces.json`
- `~/.claude/plugins/marketplaces/serve-sim/README.md`, `.claude-plugin/plugin.json`, `skills/serve-sim/SKILL.md`, `skills/serve-sim/references/endpoints.md`, `skills/serve-sim/references/workflows.md`, `skills/serve-sim/scripts/check-prereqs.sh`, `packages/serve-sim/package.json`, `packages/serve-sim/Sources/SimNative/{StreamFormat,H264Encoder,FrameCapture}.swift`
- `~/.npm/_npx/*/node_modules/serve-sim/package.json` (0.1.42)
- `$TMPDIR/serve-sim/server-6BED465E-2E87-4AB7-A3C6-B27327321A32.log` (2026-09-02)
- Session transcripts under `~/.claude/projects/-Users-mac-Desktop-work-projects-ISR-AI--claude-worktrees-ios-simulator-streaming-716ef9/`

Web:
- `https://github.com/EvanBacon/serve-sim` (plugin homepage; not fetched in this research, all claims come from the local clone)

---

## 7. Open questions

1. Who ran `serve-sim` on 2026-09-02 (the `$TMPDIR/serve-sim` log), and was it a test for V2? Its default port 3100 collides with the API port some worktrees use.
2. Does Zack want the V2 mobile preview in the **browser** (streamed simulator) first, or on the **user's phone** (Expo Go / QR) first? The second needs no Mac hosts.
3. Mac host pool: self-hosted Mac minis vs a hosted Mac provider vs a device-streaming SaaS. Costs and per-Mac simulator density are **UNVERIFIED**.
4. Android: which emulator streaming stack, and does it run next to the Linux sandbox?
5. Should the wandit native app (`apps/native`) become the V2 mobile client, or stay a V1 landing-page client until V2 stabilizes on web?
6. Will V2 user apps be **published** to the stores through wandit-managed EAS, or only previewed?
7. Does the Claude Code desktop `Claude_Code_iOS_Simulator` MCP tool have any reusable protocol for a product, or is it desktop-only? **UNVERIFIED** (closed tool; only its action list is known from transcripts).
