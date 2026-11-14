# V2 runbook

Operator steps for the V2 app builder. Each entry names the issue that
added it. WANDIT-176 adds the staging alpha entries.

## Staging limits (restored on 2026-10-17)

The event tests lifted these limits on staging. Zack restored the
production values on every environment, so staging tests show the real
stops and upgrade prompts. Do not lift them again without a gate on who
can sign in.

- `BACKEND_DEFAULTS.backendsPerPlan`: starter 0, pro 1, business 1000.
- `DEVICE_MINUTES_PER_PLAN`: starter 0, pro 60, business 180.
- `LLM_PROXY_DAILY_USER_CAP_USD`: 50.
- `PROJECT_CREATE_LIMIT` 10 and `PROJECT_CREATE_IP_LIMIT` 30 per day.
- `TURN_CREATE_IP_LIMIT`: 90 per 10 min.
- `PUBLISH_IP_LIMIT`: 30 per hour.
- The signup grant in the admin app (Product controls): decide per
  environment. Each new account gets it, so it is a cost per sign-up.

## Before production

These limits are still lifted. Restore them before V2 goes to production.

- Model picks: every priced model runs on every plan. Restore a plan rule
  for model picks: the turn check (`assertPickableModel`) and the token
  `model` in the LLM proxy.

## Harness host deploys (audit P0-05)

A new `harness-host` instance starts while the old one still runs its
turns. Each host turn keeps a run mark in Redis,
`builder:turn:<turnId>:host-run`, for 90 s and refreshes it every 30 s.
The recovery sweep of every instance skips a turn with a mark, so a new
instance does not fail the turns of the old one. On SIGTERM, the host
takes no new turns and waits for its live turns until 5 s before Railway
sends SIGKILL.

1. On `harness-host`, add the service variable
   `RAILWAY_DEPLOYMENT_DRAINING_SECONDS` = `2400` (40 min, longer than the
   longest build). Use the Variables tab, not only the Teardown switch: the
   host reads the variable to know its drain time. Unset means 0: the old
   host exits at once and its live turns fail. Staging has it since
   2026-10-06.
2. The Railway Custom Start Command must start node directly:
   `cd apps/server && exec node --enable-source-maps --max-old-space-size=6144 --import ./dist/instrument.mjs dist/harness-host/main.mjs`.
   With `pnpm --filter server start:host`, node gets SIGTERM from Railway
   and from pnpm, and it died before the drain on staging (2026-10-06, log
   `ERR_PNPM_RECURSIVE_RUN_FIRST_FAIL ... Command failed with signal
   "SIGTERM"`). After a deploy, the log of the old instance must show
   `harness-host.draining` and then `harness-host.drained`.
3. During an event, do not deploy anyway. A deploy also restarts the API,
   and an API restart cuts every open chat stream for a few seconds.
4. The start command (and `start:host`) sets `--max-old-space-size=6144`.
   The memory limit of the
   `harness-host` service must stay above 7 GB (it is 8 GB on 2026-10-06).
   A heap limit above the container limit gives a kernel OOM kill, and that
   kill ends every live turn. Lower the flag when you lower the limit.

## Unstick a user during an event (audit P1-08)

Keep two terminals open: `railway connect Redis` (environment staging)
and `psql` on the staging `DATABASE_URL`. Ask the user to click Stop
first. Stop runs the full cleanup: it ends the row, refunds the hold,
releases the lock, and starts the next queued turn.

1. Find the turn of a user:
   ```sql
   SELECT t.id, t.project_id, t.chat_id, t.status, t.runner, t.created_at
   FROM builder_turns t JOIN "user" u ON u.id = t.user_id
   WHERE u.email = '<email>'
     AND t.status IN ('queued', 'waiting', 'running', 'cancelling',
                      'waiting_for_answer', 'waiting_for_approval')
   ORDER BY t.created_at DESC;
   ```
2. A project that answers 409 to every message: read the lock with
   `GET builder:lock:<project_id>`. Delete it only in one of these cases:
   - the value is a turn id, and that row has ended (not in the list of
     step 1);
   - the value starts with `wake:` or `restore:` (an API restart killed
     the wake or the restore).
   A live runner sees the lost lock within 60 s and stops with
   `lock_lost`.
3. The room gets "Too many requests. Please wait a moment and try again."
   on New project or on Send: find
   the IP keys with `redis-cli --scan --pattern 'builder:rate:*:ip:*'`,
   then `DEL builder:rate:project-create:ip:<ip>
   builder:rate:turn-create:ip:<ip>`.
4. One user's chat shows "The chat lost its connection to the server.",
   and Reconnect fails again (leaked
   stream slots after a deploy): `DEL builder:rate:turn-stream:<userId>`,
   or wait: a slot frees 16 min after its window opened.
5. The device says "A device is already open" after a reload:
   `DEL mobile_preview:user:<userId>`.
6. A user is out of credits: admin app, Users > Grant credits. A user at
   the daily LLM cap ("You reached today's AI limit"): `DEL
   llm:spend:user:<userId>:<yyyymmdd UTC>`. Grant credits does not reset
   this counter.
7. Every turn of every user fails at the same time: check the balance of
   the upstream of `V2_DEFAULT_MODEL` first. For a `paperinstruments/`
   model it is Paper Instruments (Sentry "LLM upstream refused the
   account", row reason `upstream_429`, body `insufficient_quota`); else
   the AI Gateway. Then check Redis `INFO persistence`
   (`rdb_last_bgsave_status`), then the `harness-host` deploy status in
   Railway.

## After the robustness deploy (audit batch 2)

Do these steps once, after the deploy of the robustness branch to staging
and before the event.

1. Deploy all runners from the same commit: Railway `server`, Railway
   `harness-host`, and the Trigger.dev worker. Each one runs a part of the
   fixes, and the template archives must be the same in all three.
2. Run `template-snapshot` once in the Trigger dashboard (staging), or wait
   up to 10 min for its schedule. The template files changed, so the
   snapshot name changes. Until the new snapshot exists, a new sandbox boots
   from the image, and the first turn takes about 70 s.
3. Stop the sandboxes of the demo projects in the Vercel dashboard
   (Sandboxes, Stop). A sandbox that already runs keeps its old dev server,
   with no restart loop, until its next create or resume.
4. Delete the old stream slot keys once: `redis-cli --scan --pattern
   'builder:rate:turn-stream:*' | xargs redis-cli DEL`. The keys of the old
   code keep a TTL of up to 60 min.
5. Vercel, project `wandit-web`: add `VITE_POSTHOG_HOST=https://preview.wandit.dev/lumen`
   to the Preview environment, for the git branch `staging` only. Then
   redeploy the staging web with a new build: Vite reads `VITE_*` values at
   build time. Check: `curl -s -o /dev/null -w '%{http_code}'
   https://preview.wandit.dev/lumen/static/array.js` gives 200.
6. Check that the old harness host drains on the next deploy: its log must
   show `harness-host.draining` and then `harness-host.drained`.

## Harness host capacity (audit P0-10)

- The host runs at most `MAX_LIVE_TURNS = 20` turns at the same time
  (`harness-host.server.ts`). Over the cap it answers 503. The API then moves
  the row back and runs the turn on Trigger.dev. A 503 does not start the
  30 s host pause. The host log line is `harness-host.turn-refused-full`.
  Many of these lines mean that Trigger.dev carries the overflow, so check
  the Trigger.dev concurrency of the staging environment.
- `start:host` runs node with `--max-old-space-size=6144`: 75 % of the 8 GB
  memory limit of `harness-host` on Railway. If you change the Railway
  memory limit, change this flag to about 75 % of the new limit.
- The host samples 0 traces. Errors and warn and error logs still go to
  Sentry with the tag `runtime:harness-host`.
- Load check before the event: start 10 short turns at the same time on
  staging. Read the memory and CPU of `harness-host` in Railway. If 20 turns
  do not fit in about 5 GB, lower `MAX_LIVE_TURNS` and deploy again.

## Preview and sandbox symptoms (audit P1-01, P1-17, P1-18)

- "Preview not running" on a running sandbox: wait 10 s. The dev loop starts
  Vite or Metro again 5 s after it exits. Metro can need 60 s.
- The preview stays down after 1 min: the dev server fails at start, for
  example after an edit of `vite.config.ts`, `metro.config.js`, `app.json`,
  or `package.json`. Ask the agent to fix the start error. The loop starts
  the server within 5 s after the fix.
- The preview shows the template and not the app after a sandbox error:
  run `update sandbox_sessions set status='creating' where
  project_id='<projectId>' and status in ('running','stopped');`, then click
  Wake. The next start restores the repository from code.storage.
- Wake answers busy, or a chat send answers 409, after an API restart: the
  wake lock and the restore lock live 2 min. If it continues, run `GET
  builder:lock:<projectId>`, and `DEL` it when the value starts with `wake:`
  or `restore:`.

## Version Restore (audit P1-06, P1-07)

- A restore first saves the uncommitted sandbox files as a version "Before
  restore". A user who lost work in a failed turn finds it in History.
- After the restore commit, the restore runs `pnpm install --frozen-lockfile
  --prefer-offline` with a 120 s limit. The log line `Restore install failed
  for <projectId>` means that `node_modules` can differ from the lockfile.
  Ask the next turn to run `pnpm install`.
- A restore that answers 500 with `CommitTurnError` before "Restore to": the
  "Before restore" save failed, and the restore did not reset the files.
  When code.storage `main` has a commit that the sandbox HEAD does not have,
  each retry rejects the push. Copy the files that you must keep, then delete
  the Vercel sandbox of the project. The next start makes a new sandbox from
  code.storage.

## Claude Code limits in the builder (audit P1-05, P2-09)

- One Bash call stops at 210 s (`BASH_MAX_TIMEOUT_MS`), below the 4 min stall
  watchdog. A longer install or build gets a timeout result, and the agent
  must split it.
- Background tasks and cron are off. Build sessions cannot start subagents
  (`Agent` and `Workflow` are blocked), because the bridge drops their output.
- A turn that fails with a session-bound error clears the stored session of
  the chat: "No conversation found with session ID", "Failed to resume
  session", "Start a new session", "safeguards flagged this message" or
  "session", or the proxy 403 "This plan may not call that model". The next
  turn starts a new Claude Code session. The project files stay. To clear a
  chat by hand: `UPDATE builder_sessions SET provider_session_id = NULL,
  resume_state = NULL WHERE chat_id = '<chat id>';`
- After the deploy, each kept bridge starts one new Claude Code process on
  its next turn, because the env and the tool list changed. Expect one slower
  turn for each warm chat.

## Mobile "Try to fix" (audit P1-10)

- When the web build of a mobile app throws an error, a red row with "Try to
  fix" shows under the phone bar. The click sends the errors to the agent as
  one chat message. The banner waits for the end of the turn.
- A mobile project made before this change has no preview bridge in its code,
  so it shows no banner. Type the error in the chat.
- A load error of a route module in `src/app/(tabs)` on a fresh page load
  shows no banner (LIMIT in `_layout.tsx`).

## Backends during the event (audit P1-14, P1-15, P0-08)

- A backend row in `error` gets a new provisioning run on each new chat
  message of its project. To retry a failed backend, send any message.
- The `backend-provisioning` queue runs 10 at the same time (was 3). If you
  set a concurrency override in the Trigger dashboard, remove it after the
  event: an override stays after a deploy.
- Provisioning now always turns off email confirmation, also without
  `PREVIEW_DOMAIN`. Backends that went active before this change keep email
  confirmation on: turn it off in the Supabase dashboard (Authentication >
  Email > "Confirm email").

## Rotate `APP_SECRETS_ENCRYPTION_KEY` (WANDIT-185)

The value has the form `v1:<base64 32 bytes>,v2:<base64 32 bytes>`. The
highest version encrypts every new write. All listed versions decrypt.
Every `project_secrets` row stores the version that encrypted it in
`key_version`. The API and the Trigger worker read the same value.

1. Add the new version. Make a key with `openssl rand -base64 32`. Append
   `,v<N+1>:<base64>` to the value in Railway, on the API service and on
   the Trigger worker. Keep `v<N>` in the value.
2. Deploy both services. New writes now use `v<N+1>`. Old rows still
   decrypt with `v<N>`.
3. Run the script from `apps/server` with the production env:
   `pnpm secrets:rotate`. It re-encrypts the rows with an older
   `key_version` in pages of 100 and prints one line per page with the
   counts `rotated`, `skipped`, and `failed`. A `skipped` row was written
   by a user during the run and already has the new version. A `failed`
   row prints its id and its version; the usual cause is a version that
   is not in the value. Fix the value and run the script again until
   `failed` is 0.
4. Remove `v<N>` from the value and deploy both services again. Check
   with `SELECT key_version, count(*) FROM project_secrets GROUP BY 1`
   that only `v<N+1>` remains.

### After a suspected key leak

Do steps 1 to 4 in one session, without a pause between step 3 and
step 4. The rotation protects the rows from the old key. It does not
change the stored values: a person who read the database with the old
key knows them. After step 4, ask the affected users to replace their
secrets in the Secrets panel, and re-create the `system` rows of their
Supabase backends.

## Workers for Platforms (WANDIT-200)

A published V2 app runs as one Worker, `app-<projectId>`, in a Workers for
Platforms dispatch namespace. The edge Worker binds the namespace as
`DISPATCHER`. The API and the Trigger worker upload and delete the app
Workers through the W4P REST API. Do these steps in this order.

1. Enable the Workers for Platforms subscription on the Cloudflare account
   `6b421048e434497bce142970530e4eb1`: Dashboard > Workers & Pages >
   Workers for Platforms. The plan costs $25 per month.
2. Create the two namespaces from `apps/edge`, logged in to that account:
   `npx wrangler dispatch-namespace create production` and
   `npx wrangler dispatch-namespace create staging`. Check them with
   `npx wrangler dispatch-namespace list`.
3. Create the API deploy token: Dashboard > My Profile > API Tokens >
   Create Token > Custom token. Give it one permission, "Account: Workers
   Scripts: Edit", on this account only. Give it no zone permission and no
   other permission. Do not reuse `CLOUDFLARE_API_TOKEN`.
4. Set three values on the API service in Railway and in the Trigger.dev
   environment, for staging and for production:
   - `CLOUDFLARE_ACCOUNT_ID`: the account id of step 1. It can already be
     set for the domain tasks; keep the same value.
   - `CLOUDFLARE_W4P_NAMESPACE`: `staging` on staging, `production` on
     production.
   - `CLOUDFLARE_V2_DEPLOY_TOKEN`: the token of step 3.
   `GET /api/v2/health` then reports `CLOUDFLARE_W4P_NAMESPACE` and
   `CLOUDFLARE_V2_DEPLOY_TOKEN` as `true`. Without all three values the
   publish is off, a project delete records the Worker step as `skipped`,
   and the daily `w4p-orphan-sweep` task does nothing. The sweep also runs
   only in the Trigger.dev PRODUCTION and STAGING environments; in a
   PREVIEW or DEVELOPMENT environment it logs
   `w4p.orphan-sweep.environment-skipped` and deletes nothing.
5. Merge order: the namespaces of step 2 must exist before the edge Worker
   deploys with the `dispatch_namespaces` entry. A push to `staging` or to
   `main` that touches `apps/edge` deploys it, and the deploy fails when the
   namespace is missing. The pull request dry run does not check the
   namespace, so a green pull request does not prove step 2.

The GitHub repository secret with the same name, `CLOUDFLARE_V2_DEPLOY_TOKEN`,
is a different token: the CI deploy of the edge Worker uses it, and it
keeps its wider scopes (Workers Scripts and Workers Routes). Do not put the
narrow token of step 3 into GitHub, and do not put the CI token into
Railway or Trigger.dev.

## Backend lifecycle (WANDIT-184)

The operator steps to pause or wake one backend by hand, and to test the
daily `backend-pause-sweep` on staging, are in
`docs/v2/backend-lifecycle.md` ("Operator steps"). The sweep needs
`SUPABASE_PLATFORM_TOKEN` and `SUPABASE_PLATFORM_ORG_ID` in the Trigger.dev
environment and runs only in PRODUCTION and STAGING. `BACKEND_IDLE_DAYS`
and `BACKEND_IDLE_DAYS_PUBLISHED` override the idle windows; leave them
unset in production until WANDIT-153 settles the numbers.
`LLM_DAILY_CAP_OFF=true` on the API removes the $50 daily LLM spend cap per
user; the run cap still applies. Set it only on staging; on Railway
production the API forces it to false.
`BACKEND_LIMIT_OFF=true` on the API removes the plan limit on backends, so
testers without a plan get one. Set it only on staging; on Railway
production the API forces it to false.

## Mobile builds (WANDIT-194)

The Android card of the publish popover builds an APK on EAS. The API and the
`mobile-build` Trigger task use the robot token of the wandit Expo
organization. Do these steps in this order.

1. In the wandit Expo organization, open Settings > Access tokens. Add a
   robot user with the Developer role, so it can create projects and
   builds. Create a token for it. Never paste the token in a chat.
2. Set two values on the API service in Railway and in the Trigger.dev
   environment, for staging first:
   - `EXPO_TOKEN`: the robot token of step 1.
   - `EXPO_ACCOUNT`: the name of the Expo organization.
   `GET /api/v2/health` then reports both as `true`. Without them the create
   route answers 503 `V2_ENV_MISSING`, and a queued build fails with
   `unconfigured`.
3. The Trigger deploy adds git, `eas-cli@24.8.0`, and `pnpm@11.7.0` to the
   worker image (`apps/server/trigger.config.ts`). It needs no manual step.
4. Check the EAS plan of the organization. The free plan gives 15 Android
   builds per month, one build at a time, and a 45-minute build timeout.
   After the quota, an Android build costs about $1 to $2.
5. End test on staging: open a mobile project that has a saved version,
   click "Build APK" in the publish popover, and install the APK on an
   Android phone. Log the build id, the EAS build id, the project id, the
   duration, and the credits.

Local run: install `npm install -g eas-cli@24.8.0 pnpm@11.7.0`, put
`EXPO_TOKEN` and `EXPO_ACCOUNT` in `apps/server/.env`, and start the worker
with `npx trigger.dev@4.5.3 dev` from `apps/server`. Caution: each run uses
one EAS build.

Check these facts on the first real build (UNVERIFIED):

- `eas init --account <org>` with a robot token creates the EAS project.
- code.storage allows a fetch by commit sha. Else the task fetches `main`
  and checks out the sha.
- The first non-interactive build creates the Android keystore on EAS
  (eas-cli 18.2 and later).

## Desktop apps

A desktop build runs in three places: the `desktop-build` Trigger task, a
sandbox for the frontend build, and a workflow of the private builder repo:
`build.yml` for Windows, `build-macos.yml` for macOS. A project with the
Electron engine ("Desktop app 2", D37) uses `build-electron.yml` and
`build-electron-macos.yml`. The contract is
`docs/v2/desktop-apps.md`. Security notes: section 14 of
`docs/v2/security.md`. The macOS steps are in "macOS desktop builds" below.
The Electron steps are in "Electron engine (Desktop app 2)" below.

### Setup

1. Set up the builder repo and the token: `tooling/desktop-builder/README.md`,
   section "Setup".
   - Step 9 of that section adds the repository variable
     `DESKTOP_BUILD_BUCKET_URLS` to the builder repo. It holds one line for
     each environment that dispatches to it:
     `https://<R2_BUCKET>.<R2_ACCOUNT_ID>.r2.cloudflarestorage.com`.
   - A builder repo that exists already needs this variable before its
     `build.yml` gets the URL check. Else every build fails with
     `ci_failed` in the step "Mask and check the URLs". Add the variable
     first. Then copy `tooling/desktop-builder/.github/workflows/build.yml`
     to the builder repo with a pull request to `main`.
   - When an environment changes `R2_BUCKET` or `R2_ACCOUNT_ID`, change
     the variable first.
2. Set these values on the API service in Railway and in the Trigger.dev
   environment, for staging first:
   - `DESKTOP_BUILD_REPO`: `<owner>/<repo>` of the builder repo.
   - `DESKTOP_BUILD_GITHUB_TOKEN`: the fine-grained token.
   - `DESKTOP_UPDATES_BASE_URL`: optional. Unset means `R2_PUBLIC_BASE_URL`.
     Every installer holds the updater URL built on it. Set it before the
     first release, and then never change it without a redirect from the
     old host.
3. Check `GET /api/v2/health`: it reports the three names. Without the repo
   or the token, the create route answers 503 `V2_ENV_MISSING`, and a
   queued build fails with `unconfigured`.
4. The Trigger deploy puts the desktop template and the shell copy into the
   worker image. A desktop project create that answers 503
   `DESKTOP_TEMPLATE_UNAVAILABLE` means that the server had no
   `templates/desktop-app/template_version` at boot. Deploy again with the
   templates packed.
5. Add the R2 lifecycle rule of the temporary build objects, on the bucket
   `R2_BUCKET` of each environment:
   `npx wrangler r2 bucket lifecycle add <R2_BUCKET> desktop-temp desktop-temp/ --expire-days 1`.
   Check it with `npx wrangler r2 bucket lifecycle list <R2_BUCKET>`. The rule
   deletes each object under `desktop-temp/` 1 day after its upload. A build
   ends in less than 2 hours, so no live build loses an object. See "Orphan
   build objects".

### First staging test of desktop apps

Do this test on staging before the first production release, and after each
change of the migration runner. You need a Windows 10 or 11 PC (x64) and a
staging account with credits. Do the steps of "Setup" first.

1. Create a desktop project. Ask the agent for a notes app with one `notes`
   table. Build it, and release it when it is `ready`. This is v1 (`1.0.1`).
2. On the PC, download the installer from the download link and run it.
   SmartScreen warns about the unsigned installer (D34): select "More info",
   then "Run anyway".
3. Open the app and add 3 notes. Close the app.
4. In the chat, ask for a `pinned` column with `DEFAULT 0`, plus this check
   query in the same migration:
   `SELECT (SELECT count(*) FROM notes WHERE pinned = 0) = (SELECT count(*) FROM notes);`
   Build v2.
5. Open the CI run of v2. The step "Self-test the installed app" must show
   `wandit-self-test: ok`. Release v2.
6. Open the app on the PC, and click Install in the update dialog. The app
   starts again as v2.
7. Make sure that the 3 notes are there and that Help > About shows `1.0.2`.
   `%LOCALAPPDATA%\<identifier>\backups\` must hold a
   `before-update-1.0.1-...` file and a `before-1.0.2-...` file.
8. Roll back by rebuild: the v1 build shows Rebuild, not Release. Click
   Rebuild and confirm the credits. The new build is v3 (`1.0.3`): the
   frontend of v1 with every migration of v2. Check the self-test line of
   step 5 again, and release v3. On the PC, click Help > Check for updates
   and install `1.0.3`.
9. Make sure that the app opens with the 3 notes and shows no "The data did
   not open" dialog. The v1 frontend runs on the database with the
   `pinned` column.
10. In the chat, ask the agent to replace the migration of step 4. The new
    file has `-- wandit:replaces NNNN` on line 1, with the version of the
    step 4 file. It keeps the ALTER statement byte for byte and adds the
    check `SELECT (SELECT count(*) FROM notes WHERE pinned IS NULL) = 0;`.
11. Build v4. Check the self-test line of step 5 again, and release v4.
12. On the PC, install the update to v4. Make sure that the app opens with
    the 3 notes. The PC ran the step 4 file, so the replacement does not run.
13. Uninstall the app with "Delete the application data" selected. Install
    v4 from the download link. Make sure that the app opens with no notes.
    The replacement ran in place of the step 4 file.
14. Optional: open `%LOCALAPPDATA%\<identifier>\data\app.db` in a SQLite
    viewer and run `SELECT version, status FROM wandit_migrations;`. After
    step 12, the replacement is `skipped`. After step 13, the step 4 file is
    `replaced` and the replacement is `applied`.

### Staging checks of the security fixes

Do these checks once on staging, after the first staging test. They prove
the fixes of `security.md` section 14 that no unit test can prove. A
release build has no devtools, so put each test page or query in the app
UI. Ask the agent for it, or change the frontend by hand in a test
project.

Windows, installed app (WebView2):

1. The app opens. The assets, the theme fonts, and the 4 database commands
   work. Help > Check for updates, File > Back up now, Export data, and
   Import data work.
2. Release a newer build: it installs. Then call the release route for an
   older build: it answers 409 `DESKTOP_BUILD_OLDER_THAN_CURRENT`. Write
   the `latest.json` of an older build to R2 by hand: Help > Check for
   updates says that the installed version is the newest. Release the
   newest build again after the test.
3. A test page with `<a href="/favicon.svg" download>`: a click writes
   nothing to the Downloads folder.
4. WebRTC: in the app UI, create this connection:
   ```js
   new RTCPeerConnection({
     iceServers: [
       { urls: "stun:stun.l.google.com:19302" },
       { urls: "turn:<public IP>:3478", username: "x", credential: "y" },
     ],
   });
   ```
   Then call `createDataChannel`, `createOffer`, and
   `setLocalDescription`, and show each `onicecandidate` event in the UI.
   Expect no candidate. In Wireshark or pktmon, expect no UDP or TCP to
   these hosts and no DNS query for `stun.l.google.com`.
5. DNS prefetch: a page with
   `<link rel="dns-prefetch" href="//wandit-test-<random>.example.com">`.
   Expect no DNS query (Wireshark, or `ipconfig /displaydns`). This also
   proves that WebView2 gets the quoted `--host-resolver-rules` value in
   one piece.
6. A dedicated worker from a `.js` file of `dist/` runs
   `fetch("https://example.com")`: the CSP blocks it.
7. A query that never ends answers `sql_error` after about 10 s, and the
   UI stays usable:
   ```sql
   WITH RECURSIVE c(x) AS (SELECT 1 UNION ALL SELECT x+1 FROM c)
   SELECT count(*) FROM c
   ```
8. One long function call, sent once, while a timer in the UI sends a
   `db_select` every 200 ms:
   `SELECT printf('%.*c',400000,'a') LIKE ('%'||printf('%.*c',40000,'a')||'b')`.
   While it runs, Help > Check for updates shows the update. Install
   writes `before-update-<version>-<time>.db` in the backups folder, and
   the installer starts.
9. Normal use after these changes: the app loads, many queries run at the
   same time, and the answers are correct.

CI of the builder repo:

10. A real build passes "Mask and check the URLs". This confirms the
    virtual-hosted URL shape and the 32 hex digits of the account id.
11. "Download and check the WebView2 bootstrapper" passes. The log of
    "Build the installer" shows no second bootstrapper download.
12. "Self-test the installed app" runs the exe of the step output `app-exe`
    and prints `wandit-self-test: ok`.
13. Optional: a manual dispatch with an `https` `input_url` outside the
    bucket fails in the first step.

Builds and the gate:

14. A third live build of one payer, in another project, answers 409
    `DESKTOP_BUILD_LIMIT_REACHED`, and the credits come back.
15. Cancel during `signing` shows a toast. The build ends `ready` and keeps
    its charge.
16. The installer answers show `Cache-Control: no-cache`, and the installer
    URL has the random part.
17. Ten parallel releases do not block the API.
18. `add_local_migration` with a normal migration answers in well under
    1 s. A large legal folder answers in well under 30 s. Optional: a check
    that cross joins 12 copies of a table with rows answers `refused`. The
    finding says "The dry run stopped after 30 s". The next call on the
    same machine works.

### Cache warm-up after a shell dependency change

Do this when `Cargo.toml` or `Cargo.lock` of `templates/desktop-shell`
changes, and when you change the Rust or tauri-cli pin.

1. Merge the shell change in this repo.
2. Run `node tooling/desktop-builder/sync-shell.mjs <builder checkout>`,
   and merge the change of `shell/` to `main` of the builder repo.
3. Wait for the green "Desktop cache warm-up" run in the Actions tab of the
   builder repo. Both jobs, `warm` (Windows) and `warm-macos` (macOS), must
   be green. Actions > Caches then shows the new `desktop-cargo-v1-rust-...`
   key and the new `desktop-cargo-v1-macos-arm64-...` key.
4. Then deploy the API and the Trigger worker. Until a key exists, each
   build of its platform is cold. A cold Windows build takes about 35
   minutes (ESTIMATE), below the 60-minute job limit. A cold macOS build
   takes about 10 to 25 minutes (ESTIMATE), below the 45-minute job limit.
5. GitHub deletes a cache that no run used for 7 days. The warm-up runs
   each day at 03:17 UTC and makes a deleted cache again. To skip the wait,
   start it by hand: Actions > Desktop cache warm-up > Run workflow.

### A stuck or failed build

1. Find the builds of the project:
   ```sql
   SELECT id, status, version, error_code, error_message, ci_run_id,
          trigger_run_id, created_at, updated_at, completed_at
   FROM desktop_builds
   WHERE project_id = '<project id>'
   ORDER BY created_at DESC
   LIMIT 5;
   ```
2. Open the CI run: `https://github.com/<DESKTOP_BUILD_REPO>/actions/runs/<ci_run_id>`.
   The run name holds the build id. Open the Trigger run with
   `trigger_run_id` in the Trigger dashboard.
3. Read the status:
   - `queued`: Trigger.dev did not start the task yet.
   - `preparing`: the sandbox builds the frontend, and the gate runs.
   - `building`: the CI run compiles the installer.
   - `signing`: the task checks, signs, and uploads the installer.
   - `canceled` with no user cancel: staff suspended the project, or the
     owner deleted it. The Trigger log line `desktop-build.stopped` holds
     the reason. `suspension_lifted`: the `ready` write saw a suspension
     that staff lifted a moment later. The owner builds again.
4. A live build that does not move: the task polls CI every 20 s for at
   most 70 minutes and then fails with `timeout`. To stop it earlier, the
   user clicks Cancel. Cancel stops the CI run and releases the credit
   hold. Cancel does not stop a build in `signing`: the web shows a toast,
   and the build normally ends in minutes. After 90 minutes in `signing`,
   only a crashed run stays there, and Cancel then stops it. Do not set the
   status with SQL: the hold then stays.
5. `blocked`: the `findings` column lists the gate rules and the files.
   Ask the user to give the finding to the agent in the chat. The finding
   "The dry run stopped after 30 s" on `migrations/` means a slow
   statement. When the folder looks legal, the machine can be too slow for
   the deadline: tell engineering (`desktop-apps.md` section 12).
6. `failed`: read `error_code`.
   - `start_failed`: the API could not start the Trigger task. Read the
     API log and the Sentry event, and check the Trigger.dev deploy.
   - `unconfigured`: a `DESKTOP_*` value or the shell copy is missing on
     the worker. See "Setup".
   - `sandbox_failed`, `frontend_build_failed`, `output_invalid`: read the
     Trigger run log. The user asks the agent to fix the build.
   - `gate_unavailable`: the gate could not run. Read the Trigger run log.
   - `ci_start_failed`: the dispatch failed. Check the token expiry and the
     repo name.
   - `ci_failed`: read the failed step of the CI run. A cold build that
     hits the 60-minute limit needs the cache warm-up above. A failure in the
     steps "Install the app on the runner" or "Uninstall the app" is a
     problem of the shell or the runner, not of the app. The install step
     also fails for a bad `mainBinaryName` or a missing exe. The task also
     stores `ci_failed` when the GitHub jobs read fails after a failed run.
     The Trigger log then holds `desktop-build.ci-jobs-read-failed`.
     - "Mask and check the URLs": the repo variable
       `DESKTOP_BUILD_BUCKET_URLS` is empty or wrong. Or a bucket changed,
       and the variable does not show it. An empty variable prints the
       path `tooling/desktop-builder/README.md of the Wandit repo, Setup
       step 9`. Fix the variable, then build again.
     - "Download and check the WebView2 bootstrapper": the file has a bad
       signature. Or Microsoft changed the file or the signer name. Every
       build fails until an engineer changes the step. Read the status and
       the signer in the error line.
   - `self_test_failed`: the step "Self-test the installed app" failed. The
     step prints `wandit-self-test: failed: <reason>` when the migrations
     fail on a new database on Windows. A retry fails again. The user sees
     only "fix the migrations", so give the reason line to the user for the
     agent. A new file can change. A file of an earlier ready build needs a
     replacement file. A step timeout is a problem of the shell.
   - `artifact_invalid`: the CI run ended, but the staged file is missing,
     larger than 300 MB, or does not start with `MZ`.
   - `signing_failed`, `upload_failed`, `internal`: read the Trigger run
     log and the Sentry event.
7. The installed app shows a fallback font instead of the theme font. The
   build bundles the theme fonts, and a font failure only logs a warning.
   Search the Trigger run log for `desktop-build.theme-unreadable`,
   `desktop-build.font-css-failed`, `desktop-build.font-file-failed`, and
   `desktop-build.font-count-cap`. The Trigger worker must reach
   `fonts.googleapis.com`, `fonts.gstatic.com`, `api.fontshare.com`, and
   `cdn.fontshare.com`.
8. The CI log prints `Installer <name>: <bytes> bytes, SHA-256 <hash>` in
   the step "Upload the installer". The hash must equal `installer_sha256`
   of the row (ignore the case). A different hash means that the staged
   file changed between CI and the task. Do not release that build, and
   treat it as an incident.

API errors of the desktop routes:

- `DESKTOP_BUILD_ACTIVE`: the project has a live build. Wait, or cancel it.
- `DESKTOP_BUILD_LIMIT_REACHED`: the payer already has 2 live builds in
  all its projects. The payer is the organization of a team project, else
  the owner of a personal project, also when a shared member or a
  collaborator asks. So a member with no build of their own can get it. Wait for a build to end. The hold comes back.
- `DESKTOP_BUILD_NO_VERSION`: `main` has no commit yet. The user sends a
  first message in the chat.
- `DESKTOP_BUILD_NOT_READY`: a release of a build that is not `ready`, or
  that has no installer, or a rebuild of a build that is not `ready`. A
  suspend removes every installer.
- `DESKTOP_BUILD_OLDER_THAN_CURRENT`: a release of a build older than the
  current one. Installed apps accept only a newer version. The owner
  clicks Rebuild on that build (D35).
- `PROJECT_SUSPENDED` (403): staff suspended the project. See "Suspend and
  delete".
- `DESKTOP_TEMPLATE_UNAVAILABLE`: see "Setup", step 4.
- `V2_ENV_MISSING`: see "Setup", step 3.

### An installed app shows "The data did not open"

The app stops in the `migration_failed` state. Its data stays as it was
before the update: all pending files run in one transaction, and a failure
rolls back all of them. The dialog names the reason, for example a statement
or a check query that failed on the saved rows.

1. Ask the owner to give the dialog text to the agent. The failed file is
   frozen, so the agent writes a replacement file with
   `-- wandit:replaces NNNN` on line 1. The owner builds and releases the
   new build. The replacement runs in place of the failed file on each PC
   that did not run it.
2. Do not rebuild an older build for this. A rebuild embeds every frozen
   file, the failed file too, so the app fails again. Until the fixed build
   installs, the app stays in this state and its data does not change.
3. The backups of the user stay in `%LOCALAPPDATA%\<identifier>\backups\`.

### Key rotation

- Rotate `APP_SECRETS_ENCRYPTION_KEY` with the steps of "Rotate
  `APP_SECRETS_ENCRYPTION_KEY`" above. `pnpm secrets:rotate` also
  re-encrypts `desktop_apps.updater_private_key_ciphertext`. After step 4,
  check with `SELECT updater_key_version, count(*) FROM desktop_apps GROUP
  BY 1` that only the new version remains.
- A rotation changes only the encryption of the updater keys. The updater
  key pair of an app stays: its public key is in every installer.
- After a leak of the database and of `APP_SECRETS_ENCRYPTION_KEY`, the
  holder knows the updater private keys. A bad update also needs a write
  to `desktop/<project id>/latest.json` (Windows) or
  `desktop/<project id>/latest-macos.json` (macOS). Rotate the R2 keys
  too. No path changes the key pair of an installed app today
  (`security.md` section 14, "Open items").
- Rotate `DESKTOP_BUILD_GITHUB_TOKEN` before it expires: make a new token
  (builder README, step 8), set it on the API and the Trigger worker, and
  then delete the old token.

### Suspend and delete

- A staff suspend clears both current-build pointers
  (`current_windows_build_id`, `current_macos_build_id`), every
  `installer_key`, and every `update_archive_key`. Then it deletes all of
  `desktop/<project id>/` in R2. Old download links stop working.
  Installed apps find no update and keep their version. Wandit cannot stop
  or delete an app on a user machine.
- After an unsuspend, the owner builds again. An unsuspend restores no
  installer, and the release route refuses a build without one.
- A suspend with a KV or R2 error answers 502
  `SUSPENSION_HOSTS_NOT_UPDATED`. The desktop withdraw runs after the KV
  write, so after a 502 the withdraw can be incomplete. Send the same action
  again.
- While the project is suspended, the create and release routes answer 403
  `PROJECT_SUSPENDED`. A live build stops at its next check: the task
  cancels CI, deletes its objects, moves the row to `canceled`, and refunds
  the hold.
- A project delete is a soft delete. The `delete-app-project` task drains
  the `desktop/<project id>/` prefix: both manifests (`latest.json`,
  `latest-macos.json`), the stable files, and all build files go. It also
  drains `desktop-temp/<project id>/`, the build inputs and the staged
  files.
  So no update reaches those installs again. Installed apps keep working
  with their local data. The `desktop-build` task stops a build of the
  project at its next check, moves the row to `canceled`, and refunds its
  hold.
- The `delete-app-project` task deletes the `desktop_apps` row with the
  encrypted updater key. The `desktop_builds` and `desktop_migrations` rows
  stay.
- If the row delete fails, the task logs
  `app-project.delete.desktop-app-failed` and continues. The encrypted
  updater key then stays. Read the project id in that log line, then delete
  the row: `DELETE FROM desktop_apps WHERE project_id = '<project id>';`.
  No row references `desktop_apps`.

### Orphan build objects

- The task deletes the input archive and the staged installer at each exit.
  A CI upload can still arrive after that exit, because its presigned URL
  stays valid for 2 hours. Example: a cancel or a project delete during the
  CI step "Upload the installer". The object then stays at
  `desktop-temp/<project id>/staging/<build id>-<random>.exe`. A worker
  crash can also leave `desktop-temp/<project id>/inputs/<build id>-<random>.tar.gz`.
- The lifecycle rule of "Setup", step 5, deletes these objects. R2 deletes
  an object within 24 hours after the 1 day of the rule.
- When `npx wrangler r2 bucket lifecycle list <R2_BUCKET>` does not show the
  `desktop-temp` rule, add it again with the command of "Setup", step 5.
  The rule also deletes the objects that are already older than 1 day.

### macOS desktop builds

A macOS build makes a disk image (`.dmg`) and an update archive
(`.app.tar.gz`) for Apple silicon, macOS 15 or later (D36). The app has an
ad-hoc signature and no notarization. The contract is
`docs/v2/desktop-apps.md` sections 3, 9, and 10.

#### Deploy order

Use this order for the first macOS release. Use it again for each later
change of the shell, its `Cargo.toml`, or its `Cargo.lock`.

1. In the builder repo, open a pull request to `main` with these files:
   - `tooling/desktop-builder/.github/workflows/build-macos.yml` (new).
   - `tooling/desktop-builder/.github/workflows/warm-cache.yml` (it now has
     the job `warm-macos` and a daily schedule).
   - `shell/`: run `node tooling/desktop-builder/sync-shell.mjs <builder checkout>`.
2. Merge the pull request. Wait until both warm-up jobs, `warm` and
   `warm-macos`, are green for that exact `Cargo.lock`. The Windows job also
   proves that the shell still compiles on Windows.
3. Only then deploy the API and the Trigger worker. The worker image holds
   its own copy of the shell (`apps/server/trigger.config.ts`), and every
   Windows build uses it too.

Why: a shell that does not compile fails every Windows build after the
deploy. A `Cargo.lock` with no warm cache makes every build cold. Staging
and production share the builder repo, so this order holds for both.

#### The flag `DESKTOP_MACOS_BUILDS_ENABLED`

Only the API reads the flag (`desktop-builds.service.ts`). The Trigger
worker does not read it. An unset flag means false
(`packages/env/src/server.ts`).

1. Staging: set `DESKTOP_MACOS_BUILDS_ENABLED=true` on the API service in
   Railway. Do the deploy order above first.
2. Production: keep the flag `false` until every staging check below passes
   or Zack accepts it. Then set it to `true`.
3. Kill switch: set the flag to `false` on the API service. Railway then
   deploys the API again.
   - A live macOS build finishes.
   - A new macOS create answers 403 `DESKTOP_PLATFORM_UNAVAILABLE`, and the
     web hides the macOS choice.
   - Release and cancel still work, so a fixed build still reaches Mac apps.
   - The Gatekeeper note stays while a macOS download link exists.

Use the kill switch when Apple removes the WebRTC key (check 6), or when the
weekly cost check below grows.

#### Weekly check of refunded macOS failures

A failed build refunds its hold, but GitHub bills the runner minutes. A
macOS minute costs $0.062. One payer has at most 2 live builds, so one payer
can cost about $7.44 per hour (`desktop-apps.md` section 11).

1. Each Monday, run this query on the production database. The payer comes
   from `projects`: `desktop_builds.user_id` holds the user who asked.
   ```sql
   SELECT coalesce(p.organization_id, p.user_id) AS payer, b.error_code, count(*)
   FROM desktop_builds b
   JOIN projects p ON p.id = b.project_id
   WHERE b.platform = 'macos'
     AND b.status = 'failed'
     AND b.completed_at > now() - interval '7 days'
   GROUP BY 1, 2
   ORDER BY 3 DESC;
   ```
2. Look for a payer with many failures of one code, for example
   `self_test_failed` again and again.
3. Count the `ci_failed` rows whose run failed in "Check the signatures and
   mount the disk image" with `hdiutil` "Resource busy". Record the rate.
4. When the cost grows, set the flag to `false` (kill switch above), and tell
   Zack.

#### Cache

GitHub deletes a cache after 7 days without access. A build run only
restores. The warm-up runs each day at 03:17 UTC, so a deleted cache comes
back within 1 day. To skip the wait, start "Desktop cache warm-up" by hand.

#### A failed macOS build

Use "A stuck or failed build" first. These lines add the macOS cases:

- `ci_failed` in "Check the signatures and mount the disk image": a
  signature check failed, or the disk image did not mount. Or the binary is
  missing. `hdiutil` "Resource busy" is a runner fault. A new build can
  pass.
- `ci_failed` in "Make and check the update archive": a name was too long
  for ustar, or the seal broke after the unpack. Tell engineering.
- `ci_failed` after 45 minutes: the job timeout. Check that the cache key
  exists (see "Cache").
- `self_test_failed`: the step "Self-test the installed app" ran the app in
  the mounted disk image. Read the `wandit-self-test: failed` line, as for
  Windows.
- `artifact_invalid`: `error_message` holds the reason. The staged disk
  image is missing or has no `koly` trailer. Or the staged archive is
  missing, is not gzip, or breaks a rule of `macos-update-archive.ts`. A
  broken rule means that CI changed its tar output. Tell engineering. Do
  not make the parser less strict.
- `timeout`: the task stops 70 minutes after the dispatch, also while
  GitHub queues the job. GitHub Free, Pro, and Team run at most 5 macOS
  jobs at the same time for the whole account. Look for queued jobs in the
  Actions tab.

#### Support: check a disk image

1. Open the CI run of the build. In the step "Upload the disk image and the
   update archive", read the line `<file name>: <bytes> bytes, SHA-256 <hash>`
   of the `.dmg`.
2. Compare the hash with `desktop_builds.installer_sha256` (ignore the
   case). A different hash means that the staged file changed between CI
   and the task. Do not release that build, and treat it as an incident.
3. Do not compare the hash of the archive. The task writes the archive
   again, so the signed archive (`update_archive_key`) differs on purpose.

Limit: this check does not cover the update archive. A person with
`update_url` can replace the staged archive before the task re-packs and
signs it. Every installed Mac app then takes that file at the release of
the build. The task keeps no hash of the staged archive, so you cannot
compare it with the CI log line (`security.md`, "macOS builds").

Orphan objects: a late CI upload can leave
`desktop-temp/<project id>/staging/<build id>-<random>.dmg` or `.app.tar.gz`.
The lifecycle rule of "Setup", step 5, deletes them.

#### After each new macOS major release

1. Install the new macOS version on a test Mac.
2. Run checks 3, 6, and 8 below on it.
3. If check 6 shows `RTCPeerConnection`, or the window does not open, set
   the flag to `false`. Then tell engineering: Apple changed the WebRTC key.

#### Desktop migration number

The desktop migration is `packages/db/src/migrations/0092_desktop-apps.sql`.
Before the merge with `dev`, it was `0088_desktop-apps.sql` with the journal
`when` 1793877910625. No remote branch holds that file, so only a local
database can have its row. To find the row, run
`select 1 from drizzle.__drizzle_migrations where created_at = 1793877910625;`.

Drizzle applies only the files that are newer than the newest row. So a
database with this row skips dev's 0088 to 0091. It then fails on 0092 with
`type "desktop_build_status" already exists`. Drop and create that database
again, then run `pnpm db:migrate`. A drop of the desktop tables is not
sufficient: Postgres cannot remove the enum values `desktop_build` and
`desktop` that 0092 adds, so 0092 fails again.

#### macOS staging checks

Do these checks on staging before production turns the flag on. Use a Mac
with macOS 15 and a Mac with macOS 26. Use macOS 27 when it ships. Record
each result on the "Result" line: the date, the macOS version, and pass or
fail.

1. Builder repo. Do the deploy order above. Open Actions > Caches.
   - Pass: both warm-up jobs are green. Caches shows a
     `desktop-cargo-v1-macos-arm64-...` entry and a Windows entry.
   - Result: not run.
2. Build time. Set the staging flag to `true`. Delete the
   `desktop-cargo-v1-macos-arm64-...` entry in Actions > Caches. Build macOS
   for a test project (cold). Run `warm-cache.yml` by hand. Build again
   (cached).
   - Pass: both builds reach `ready`. Record the job minutes from the run
     pages. A cold build over 40 minutes needs a new `timeout-minutes`
     (D36, 45 now).
   - Result: not run.
3. First start. Download the disk image with Safari from the stable link.
   Open it, drag the app to Applications, and open the app.
   - Pass: the alert "Not Opened" shows. Click Done. Open System Settings >
     Privacy & Security > Open Anyway, and enter the password. The app
     opens.
   - Result: not run.
4. Window and menu. Try About, Hide, and Cmd+Q. Try Cmd+C and Cmd+V in a
   text field. Try File > Back up now, Export data, and Import data. Try
   Help > Check for updates. Try Cmd+W.
   - Pass: each item works, and each dialog shows. Cmd+W closes the window,
     and the app quits.
   - Result: not run.
5. Second start. Run `open -n /Applications/<App>.app`.
   - Pass: the first window comes to the front. No second window opens.
   - Result: not run.
6. Network probe. Make a test project whose frontend shows
   `typeof RTCPeerConnection`. It also runs `fetch("https://example.com")`,
   a fetch from a Worker, a remote `<img>`,
   `<link rel=preconnect href="https://<probe host>">`, and
   `<link rel=dns-prefetch href="//<probe host>">`. Run
   `sudo tcpdump -n -i any 'udp or port 53'` while the app starts.
   - Pass: `RTCPeerConnection` is `undefined`. Each fetch and the image
     fail. tcpdump shows no packet to the probe host and no STUN.
   - A DNS query for the probe host fails the check. Then a WebKit content
     rule list must block it before production. Write the result in
     `security.md` section 14, "Open items".
   - Result: not run.
7. CSP header. The probe app loads a Worker script and an `.svg` page. Each
   one tries an inline script.
   - Pass: the inline script does not run. The shell adds the CSP to these
     answers (`add_missing_csp`).
   - Result: not run.
8. Update. Release a second macOS build. In the old app, click Help > Check
   for updates > Install.
   - Pass: the app starts again in the new version with no Gatekeeper
     alert. About shows the new version. The re-pack writes time 0 on each
     file, so this also proves that the time does not matter.
   - Record the output of `xattr -l /Applications/<App>.app`,
     `spctl -a -vv /Applications/<App>.app`, and
     `log show --predicate 'process == "syspolicyd"' --last 5m`.
   - Result: not run.
9. App Management. Do the update of check 8 with the app in Applications.
   - Pass: no notice "was prevented from modifying apps" shows.
   - Result: not run.
10. Standard user. An admin installs the app in Applications. A standard
    (non-admin) user installs an update.
    - Pass: a prompt asks for an admin password. After it, the update
      installs.
    - Result: not run.
11. Translocation. Open the app from Downloads (not moved). Try an update.
    Then open the app from the mounted disk image, and try an update again.
    - Pass: "Update failed" shows, with the line "Open the app from the
      Applications folder, then try again."
    - Result: not run.
12. Independence. Release Windows, then macOS, then Windows.
    - Pass: after each step, `latest.json` holds only the Windows keys, and
      `latest-macos.json` holds only the darwin keys.
      `current_windows_build_id` and `current_macos_build_id` change only
      for their own platform.
    - Result: not run.
13. Suspension. Staff suspend the project.
    - Pass: `latest.json`, `latest-macos.json`, and both stable files answer
      404. The installed Mac app finds no update.
    - Result: not run.
14. Texts. Read the card and the Gatekeeper note in en, fr, and ar. Set a
    Mac to French, then to Arabic, and compare the macOS labels.
    - Pass: the labels of the note match the labels of the system.
    - Result: not run.
15. Data. Open `~/Library/Application Support/app.wandit.p<hex>/`. Export
    the data on the Mac, and import the file into the Windows app.
    - Pass: `data/app.db` and `backups/` exist. The import passes.
    - Result: not run.
16. Flag off. Set the staging flag to `false`. Open the card. Send a macOS
    create with a tool such as curl.
    - Pass: the card shows no macOS choice. The create answers 403
      `DESKTOP_PLATFORM_UNAVAILABLE`.
    - Result: not run.
17. Intel Mac, if one exists. Open the app from the disk image.
    - Pass: macOS refuses to open it. The Gatekeeper note says Apple
      silicon.
    - Result: not run.
18. Product names. Build macOS for 2 test projects named "Gestion Café" and
    "متجر أحمد". Install, open, and update each one, as in checks 3 and 8.
    - Pass: both builds reach `ready`. Both apps open after Open Anyway and
      update.
    - Result: not run.
19. Cancel. Start a macOS build. Cancel it while it is `building`.
    - Pass: the GitHub run stops. The build is `canceled`, and the hold
      comes back. No object of the build stays under
      `desktop-temp/<project id>/staging/` or `desktop/<project id>/builds/`.
      A late CI upload can leave a staged file until the lifecycle rule
      deletes it ("Orphan build objects").
    - Result: not run.
20. Mixed platforms. Release a Windows build. Then send a create with
    `platform: "macos"` and `rebuildOfBuildId` of that Windows build. The
    web Rebuild button keeps the platform of the old build, so use a tool
    such as curl. Release the macOS build.
    - Pass: the macOS build passes the migration gate with the frozen
      files and gets the next version. The Windows app finds no update.
    - Result: not run.

### Electron engine (Desktop app 2)

An Electron build makes a setup exe (Windows) or a disk image (macOS) with
the shell of `templates/desktop-shell-electron` (D37, experimental). The
contract is `docs/v2/desktop-apps.md` section 13. The engine has no flag
of its own: `DESKTOP_MACOS_BUILDS_ENABLED` also gates its macOS builds.

#### Setup on staging

Do "Setup" of "Desktop apps" first. The builder repo and its variable
`DESKTOP_BUILD_BUCKET_URLS` must exist. Then use this order. Use it again
after each change of the Electron shell or its `package-lock.json`.

1. Apply the database migration `0095_desktop-engine.sql`
   (`pnpm db:migrate`). It adds the enum `desktop_engine` and the nullable
   column `projects.desktop_engine`. Old rows keep NULL, which means Tauri.
2. In the builder repo, open Settings > Actions > General. The allowed
   actions must include the actions of GitHub: the 2 new workflows use
   `actions/setup-node`.
3. In a checkout of the builder repo, make a branch. Copy these files from
   `tooling/desktop-builder/.github/workflows/`:
   - `build-electron.yml` (new).
   - `build-electron-macos.yml` (new).
   - `warm-cache.yml` (it now has the jobs `warm-electron` and
     `warm-electron-macos`).
4. From the root of this repo, run
   `node tooling/desktop-builder/sync-shell.mjs <builder checkout>`. It
   writes `shell-electron/` and writes `shell/` again. Commit both
   folders. `git status` must show `shell-electron/shell/package-lock.json`
   and `shell-electron/shell/wandit.desktop.json`.
5. Merge the pull request to `main`. "Desktop cache warm-up" starts. Wait
   until `warm-electron` and `warm-electron-macos` are green. Each job
   builds the fixture app, so a green job also proves the packaging on
   its system. An Electron job takes about 5 to 10 minutes (ESTIMATE).
6. Open Actions > Caches. It must show a
   `desktop-electron-v1-windows-x64-...` entry and a
   `desktop-electron-v1-macos-arm64-...` entry. Open the `warm-electron`
   log and make sure that the saved cache holds the Electron zip
   (UNVERIFIED: the path `~\AppData\Local\electron\Cache` did not run
   before this test). A missing cache only adds download time.
7. Pack the templates, then deploy the API and the Trigger worker. The
   worker image gets `templates/desktop-shell-electron/shell` through
   `additionalFiles` of `apps/server/trigger.config.ts`, and the template
   `desktop-app@1.1.0`. A worker without the shell fails each Electron
   build with `unconfigured`.
8. Deploy the web app. The create prompt box then shows "Desktop app 2".

Why this order: the API dispatches `build-electron.yml` by name on `main`.
A dispatch before step 5 finds no workflow, and the build fails.

#### Electron staging checks

Do these checks on staging before any production use. You need a Windows
10 or 11 PC (x64), a Mac with Apple silicon and macOS 15 or later, and a
staging account with credits. Record each result on the "Result" line: the
date, the system version, and pass or fail. No Windows build of this shell
ran before these checks.

1. Create. In the prompt box, select "Desktop app 2". Ask for a notes app
   with one `notes` table.
   - Pass: `select desktop_engine, framework, template_version from projects where id = '<id>';`
     answers `electron`, `desktop-app`, and `desktop-app@1.1.0` or later.
     The preview works as for a Tauri project.
   - Result: not run.
2. Old projects. Create a project with "Desktop app". Read an older
   desktop project.
   - Pass: the new row holds `tauri`. The old row holds NULL, and its
     build still dispatches `build.yml`.
   - Result: not run.
3. Windows build. Build Windows for the project of check 1.
   - Pass: the run "Desktop build (Electron)" is green. The step
     "Self-test the installed app" shows `wandit-self-test: ok`. The build
     is `ready`. The SHA-256 of the log line "Installer ..." equals
     `desktop_builds.installer_sha256`.
   - Result: not run.
4. Windows first start. Release the build. Download the setup exe and run
   it. Pass SmartScreen with "More info", then "Run anyway".
   - Pass: no admin prompt shows. The app opens on its home page, not a
     white window. The title and the shortcut show the product name.
     `%LOCALAPPDATA%\<identifier>\data\app.db` exists. Add 3 notes.
   - Result: not run.
5. Windows menu. Try File > Back up now, Export data, and Import data.
   Try Help > Check for updates and About. Start the app a second time.
   - Pass: each dialog shows. The second start focuses the first window.
   - Result: not run.
6. Windows update. Ask for a `pinned` column with `DEFAULT 0`. Build and
   release v2. In the app, click Help > Check for updates > Install.
   - Pass: the app closes, installs with no window, and starts again as
     v2 with the 3 notes. `backups\` holds a `before-update-1.0.1-...`
     file. About shows `1.0.2`.
   - Result: not run.
7. macOS build. Set the staging flag `DESKTOP_MACOS_BUILDS_ENABLED` to
   `true`. Build macOS for the same project.
   - Pass: the run "Desktop build (Electron, macOS)" is green, with the
     `wandit-self-test: ok` line. The build is `ready`, and its
     `update_archive_key` is NULL. The SHA-256 of the log line
     "Disk image ..." equals `desktop_builds.installer_sha256`.
   - Result: not run.
8. macOS first start. Release the build. Download the disk image with
   Safari, drag the app to Applications, and open it with Open Anyway.
   - Pass: the app opens on its home page, not a white window. The menu
     bar, the Dock, and Finder show the product name. Cmd+C and Cmd+V work
     in a text field. Cmd+W closes the window, and the app quits.
   - Result: not run.
9. macOS update. Release a second macOS build. In the old app, click
   Help > Check for updates > Install.
   - Pass: `latest-macos.json` has a url that ends in `.dmg`. The app
     starts again in the new version with no Gatekeeper alert, and the
     notes are there. No mounted disk image stays in Finder.
     `codesign --verify --deep --strict /Applications/<name>.app` passes.
   - Result: not run.
10. macOS update from a read-only place. Open the app from the mounted
    disk image, and try an update.
    - Pass: "Update failed" shows, with the line "Open the app from the
      Applications folder, then try again." The app still runs.
    - Result: not run.
11. Network probe, on both systems. Use the probe project of macOS staging
    check 6, made with "Desktop app 2". Watch the network with tcpdump or
    Wireshark while the app starts.
    - Pass: each fetch and the remote image fail. No packet goes to the
      probe host, no DNS query names it, and no STUN packet shows. Only
      the update check reaches the updates host.
    - Result: not run.
12. CSP. The probe app has an inline script in `index.html`, in a Worker,
    and in an `.svg` page.
    - Pass: no inline script runs.
    - Result: not run.
13. Product names. Build both platforms for a project named
    "Gestion Café" and one named "متجر أحمد". Install, open, and update
    each one.
    - Pass: each build is `ready`. Each app opens and updates. The file
      names hold only the ASCII binary name.
    - Result: not run.
14. Data exchange. Export the data in a Tauri app of a project with the
    same migrations, if one exists. Else export in the Electron Windows
    app and import in the Electron Mac app.
    - Pass: the import passes, and the rows show.
    - Result: not run.
15. Size and time. Read the job minutes of checks 3 and 7 and the file
    sizes.
    - Pass: each file is below 300 MB. Record the numbers in
      `desktop-apps.md` section 13, "Limits of the Electron engine".
    - Result: not run.

#### A failed Electron build

Use "A stuck or failed build" above. These causes are specific:

- `ci_failed` in "Build the installer" with an npm usage error: the
  workflow has `npx --no`. It must be `npx --no-install`.
- `ci_failed` with "did not match expected checksum": the Electron zip does
  not match `electron/checksums.json`. Do not build again until you know
  the reason.
- `unconfigured`: the worker image has no
  `templates/desktop-shell-electron/shell/package.json`. Deploy the
  Trigger worker again.

#### After a change of the Electron shell

1. Run `node --test` in `templates/desktop-shell-electron/shell` (Node
   24.22 or later).
2. Merge the change. Run `sync-shell.mjs`, and merge `shell-electron/` to
   `main` of the builder repo.
3. When `package-lock.json` changed, wait for the green `warm-electron`
   and `warm-electron-macos` jobs.
4. Deploy the Trigger worker. A worker and a builder repo with different
   `package-lock.json` files only miss the cache.
