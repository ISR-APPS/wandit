# V2 runbook

Operator steps for the V2 app builder. Each entry names the issue that
added it. WANDIT-176 adds the staging alpha entries.

## Staging-only limits to restore before production

The staging tests before the event lift these limits, so a tester on any
plan can use the features without a stop. A pull request from `staging`
to `main` must restore every value of this list first. The refusal paths
stay in the code, so the restore changes only the numbers. Each constant
has a `STAGING ONLY` comment; remove it with the restore.

- `BACKEND_DEFAULTS.backendsPerPlan` in
  `apps/server/src/modules/app-builder/domain/backend-lifecycle.ts`.
  Staging: 1000 on every plan. Production: starter 0, pro 1, business
  1000. Reason: a tester on any plan can add a backend to a V2 project
  (403 `BACKEND_LIMIT_REACHED` before).
- `DEVICE_MINUTES_PER_PLAN` in
  `apps/server/src/modules/app-builder/domain/device-minutes.ts`.
  Staging: 100000 minutes per month on every plan. Production: starter 0,
  pro 60, business 180. Reason: a tester on any plan can start the
  in-browser device of Appetize (402 `DEVICE_MINUTES_EXHAUSTED` before).
- `LLM_PROXY_DAILY_USER_CAP_USD` in
  `apps/server/src/modules/app-builder/infrastructure/redis/llm-spend-counters.ts`.
  Staging: 100000 USD of model cost per user per UTC day. Production: 50.
  Reason: two testers on Opus 5.5 Fast reached $50 on 2026-10-06, and
  every next turn failed with 402 `V2_DAILY_CAP_REACHED`.
- `PROJECT_CREATE_LIMIT` and `PROJECT_CREATE_IP_LIMIT` in
  `apps/server/src/modules/app-builder/presentation/http/controllers/app-projects.controller.ts`.
  Staging: 50 creates per user and 500 per IP per day. Production: 10 and
  30. Reason: an event room shares one NAT IP, and Zack rehearses on his
  own account (429 `RATE_LIMITED` before, with a Retry-After of up to 24 h).
- `TURN_CREATE_IP_LIMIT` in
  `apps/server/src/modules/app-builder/presentation/http/controllers/turns.controller.ts`.
  Staging: 2000 turn posts per IP per 10 min. Production: 90. Reason: every
  message, Approve, Deny, and answer is one turn post, so about 18 active
  people on one IP reached 90.
- `PUBLISH_IP_LIMIT` in
  `apps/server/src/modules/app-builder/presentation/http/controllers/publish.controller.ts`.
  Staging: 300 publishes per IP per hour. Production: 30. Reason: an event
  room shares one NAT IP, and every attendee can publish.
- The signup grant in the admin app (Product controls). Staging: on, with
  the amount that Zack picks for the event. Production: decide before the
  launch. Reason: staging gave a new account 0 credits on 2026-10-06.

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
7. Every turn of every user fails at the same time: check the AI Gateway
   balance first, then Redis `INFO persistence`
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
