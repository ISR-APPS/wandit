# App builder (V2)

The V2 app builder produces a full web app inside a persistent sandbox,
driven by a coding-agent harness. V1 page projects never touch this module
(D11). `app.module.ts` loads it only when `V2_BUILDER_ENABLED=true`; every
route is additionally gated by `V2BuilderEnabledGuard` (product setting +
PostHog flag `v2-builder`).

## Stack

- The generated web app is a TanStack Start app (D15).
- Each published app runs as one Cloudflare Worker (D15, WANDIT-200).
- The harness is the Claude Code adapter of the AI SDK `HarnessAgent`
  (D17). `V2_HARNESS` selects it; OpenCode comes later without a code
  change.
- The default model comes from `V2_DEFAULT_MODEL` (D10).
- The turn stream is the Trigger.dev stream `ui`, read by the API and
  relayed as SSE (D20 — one box for the whole stream).
- The durable git store is code.storage (D21).

## Folder map

| Folder | Filled by |
| --- | --- |
| `domain/ports/` | WANDIT-162 (this issue): the interfaces below |
| `domain/errors/` | WANDIT-162: `V2BuilderDisabledError`, `SandboxForkNotSupportedError`; WANDIT-184: `BackendLimitReachedError` |
| `domain/` | WANDIT-184: `backend-lifecycle.ts`, the idle, delete, and entitlement rules; WANDIT-194: `mobile-build.ts`, the build status machine, the EAS identity, and the config plugin check; WANDIT-178: `app-build.ts`, the publish status machine; `app-recipe.ts`, the design recipe sentence of a web project |
| `infrastructure/env/` | WANDIT-162: `requireV2Env` call-time checks |
| `infrastructure/sandbox/` | WANDIT-164: the Vercel `SandboxProvider`, env builder, template init; WANDIT-192: `template-profiles.ts`, one profile per platform |
| `infrastructure/git/` | WANDIT-164: `LoggingRepoRestorer` placeholder; WANDIT-171: code.storage |
| `infrastructure/redis/` | WANDIT-167: the Redis `TurnLock` |
| `infrastructure/git/` | WANDIT-152/171: `CodeStorageGitStore`, `commitTurn`, `CodeStorageRepoRestorer` |
| `infrastructure/trigger/` | WANDIT-166/167: the `ui` stream writer/reader; WANDIT-175: the `delete-app-project` starter; WANDIT-178: the `publish-app` starter |
| `infrastructure/template/` | WANDIT-175: `TemplateVersionService`; WANDIT-192: one version per platform (the web file is required at boot, the mobile file is optional) |
| `infrastructure/mappers/` | WANDIT-175: `mapAppProjectRow` |
| `infrastructure/persistence/` | WANDIT-163: V2 schema spec; WANDIT-164: `sandbox_sessions` repository; WANDIT-175: `audit_events` repository; WANDIT-183: `app_backends` repository; WANDIT-185: `project_secrets` repository; WANDIT-200: `ProjectLivenessRepository`; WANDIT-184: the lifecycle writes of `app_backends` and `deleteAllForProject`; WANDIT-178: `AppPublishRepository` |
| `infrastructure/supabase/` | WANDIT-183: the Management API client and the rate limiter; WANDIT-187: the interactive form, the Storage API calls, and the shared fake fetch; WANDIT-186: the function deploy, the bulk secrets, and the advisors calls; WANDIT-184: `pauseProject` and `deleteProject` |
| `infrastructure/cloudflare/` | WANDIT-200: the Workers for Platforms client, its fake, and `assetManifest` |
| `infrastructure/eas/` | WANDIT-194: `hostExec`, the EAS runner (eas CLI and GraphQL), and the build workspace |
| `infrastructure/secrets/` | WANDIT-185: `secret-crypto.ts` (AES-256-GCM, the key ring) and `rotateProjectSecrets` |
| `presentation/http/controllers/` | WANDIT-162: health; WANDIT-167: turn routes; WANDIT-170: the preview-token route; WANDIT-174: cost caps; WANDIT-175: `POST /api/v2/projects`; WANDIT-185: the secrets routes; WANDIT-187: the Cloud tab routes; WANDIT-271: the Code view routes; WANDIT-178: the publish routes |
| `presentation/http/guards/` | WANDIT-162: `V2BuilderEnabledGuard` |
| `application/` | WANDIT-166: the builder-turn task; WANDIT-169: host tools; WANDIT-171: versions; WANDIT-174: money; WANDIT-183: backends; WANDIT-165: the LLM proxy; WANDIT-170: the preview token; WANDIT-185: `ProjectSecretsService`; WANDIT-187: `CloudService`; WANDIT-186: the backend tools in `host-tools/backend/`, `AdvisorsService`, `BackendSecretsService`; WANDIT-271: `CodeService`; WANDIT-184: the activity stamps and the backend entitlement; WANDIT-178: `PublishService` |

## Ports (`domain/ports/`)

- `SandboxProvider` — one persistent sandbox per project: exec, files,
  ports, preview URL, the harness session.
- `BuilderHarness` — the coding agent: create/resume a session, stream one
  turn (a prompt or a continuation), detach into `HarnessResumeState`,
  and suspend a paused turn with its pending cards.
- `HostToolRegistry` — the host-side tools the agent may call during a
  turn; `HostToolContext` carries the turn hold and the metering subject
  so paid tools bill under the turn.
- `TurnEventWriter` / `TurnEventReader` — the two ends of the `ui` stream
  (D20).
- `TurnLock` — the per-project lock serializing turns.
- `GitStore` / `RepoRestorer` — the code.storage repository and its push
  back into a fresh sandbox (D21).
- `EasBuildRunner` — starts, reads, and cancels one EAS build (WANDIT-194).
- `MobileBuildTaskStarter` — queues the `mobile-build` Trigger task.

## Sandbox

Each V2 project owns one named sandbox on Vercel Sandbox (D1): region
`cdg1`, 2 vCPU / 4 GB, the vendor default image `vercel/sandbox/node:22`
(`VERCEL_SANDBOX_IMAGE` is unset; `tooling/sandbox-image/` is ready but
not selected). The `sandbox_sessions` row tracks the lifecycle; the
partial unique index guarantees at most one live row per project.

- `getOrCreate` is the only entry: it creates (row `creating` → `running`),
  reuses a live sandbox, and resumes a stopped one from its vendor
  snapshot. `resume` takes the same options — the caller always rebuilds
  the env from the per-run proxy token, and passes `backendUrl` from an
  `active` `app_backends` row; the provider never reads `app_backends`.
- `stop` keeps the last snapshot (`keepLastSnapshots: 1`) and marks the
  row stopped. `destroy` deletes sandbox, snapshots, and the live row.
  `fork` throws `SandboxForkNotSupportedError` until P6 (D13).
- Rebuild rule: the vendor snapshot is a disk cache; the git copy on
  code.storage is the source of truth (D21). When the named sandbox or its
  snapshot is gone, the provider boots a fresh one, applies the template
  archive (`ArchiveTemplateInit`), calls `RepoRestorer`, and logs a
  `rebuild` warning. After `RepoRestorer`, and on each resume before the
  dev server starts, `TemplateInit.replaceOldTemplateFiles` replaces a
  `vite.config.ts` (WANDIT-281) or a `.claude/settings.json` (WANDIT-180)
  that is byte-equal to an old template version. The next turn commits the
  new file. `LoggingRepoRestorer` is the placeholder until WANDIT-171.
- Template snapshot (first-turn latency): a new or rebuilt sandbox boots
  from a ready Vercel snapshot that already holds the template, its
  `node_modules`, the template commit, and the harness install. The boot
  takes about 4 s instead of about 70 s (template install plus the Claude
  Code install). The `template-snapshot` Trigger task builds one snapshot
  per platform every 10 minutes when none is ready; a failed platform
  fails the run. The name `wandit-template-<framework>-<16 hex>` hashes
  `TEMPLATE_SNAPSHOT_BUILD_VERSION`, the template files
  (`hashTemplateArchive`, file times ignored), the image, and
  `BuilderHarness.bootstrapKey`, so a change of any of them gives a new
  build. Increase the build version when the build steps change. The
  builder sandbox is not persistent, holds no env, and reaches only
  `registry.npmjs.org`. The build checks the template commit and takes the
  snapshot on its first session, so a lost disk never becomes the
  snapshot. A snapshot expires 30 days after the last boot from it; a
  project sandbox made from it still resumes after that (checked on the
  vendor). The runtime passes `harnessKey` to
  `getOrCreate`; without it, or when no snapshot is ready, or when the
  vendor refuses the snapshot, the sandbox boots from the image as before.
  The template commit has a fixed date, so the same files give the same
  root commit in every sandbox.
- Template profiles (WANDIT-192): `TEMPLATE_PROFILES` in
  `template-profiles.ts` holds one profile per target platform: the
  `framework` (the archive prefix, `web-app` or `mobile-app`), the dev
  command, the dev port (5173 for Vite, 8081 for Metro), and the version
  file. The builder-turn runtime and `startSandboxWithoutTurn` (restore,
  wake, publish) pick the profile with
  `profileForFramework(project.framework)` and pass its dev command and
  port to `getOrCreate`. The dev port decides `previewHost`.
- Template files in a deploy: the `templates/<framework>-<version>.tar.gz`
  archives are not in git. The server `build` script runs
  `templates/pack-all.mjs` before `tsdown`. It runs `scripts/pack.mjs` of
  every template folder that has one, in name order, and skips a folder
  without one. So the Railway image has the archives under `/app/templates`.
  The Trigger deploy workflow runs `pack-all.mjs` too, and `additionalFiles`
  in `trigger.config.ts` copies `templates/*-*.tar.gz` and
  `web-app/supabase/migrations/*.sql` under `<build>/templates`.
  `TEMPLATE_VERSION_FILE_PATHS` and `TEMPLATE_ARCHIVE_DIR` both resolve from
  the working directory, never from the bundled file.
- Env allow-list: `buildSandboxEnv` emits only `SANDBOX_ENV_ALLOW_LIST`
  names — the per-run proxy values and `WANDIT_PREVIEW_HOST`. `ANTHROPIC_API_KEY`
  is always written empty; `VERCEL_SANDBOX_TOKEN`, signing keys, and
  service-role keys can never enter the sandbox.
- Backend values: `syncBackendEnvFile` writes `VITE_SUPABASE_URL`,
  `VITE_SUPABASE_ANON_KEY`, and their Expo copies `EXPO_PUBLIC_SUPABASE_URL`
  and `EXPO_PUBLIC_SUPABASE_ANON_KEY` to `<workspace>/.env`, only for an
  `active` `app_backends` row. They are not in the process env, because
  Vite and Expo CLI prefer a process value to a `.env` value. Vite restarts
  and Metro sends an HMR update when the file changes, so the running app
  gets the values with no restart code. The builder-turn runtime writes the
  file after `getOrCreate`; `startSandboxWithoutTurn` (restore, wake,
  publish) writes it after a boot; provision-backend writes it after
  `markActive` when the sandbox runs. provision-backend never pushes the
  egress policy: a push from that process deletes the proxy run-token rule of
  the harness session. A turn that started without an active backend adds the
  backend host itself on its keep-alive tick. The writer waits until the dev port answers,
  because a dev server watches `.env` only from then. It writes only when
  the content differs, because each write restarts Vite. git ignores
  `.env`, and the Code view never shows it.
- Egress is deny-by-default. `buildNetworkPolicy` emits the global allow
  list: `registry.npmjs.org`, fonts, `api.stripe.com`, `api.resend.com`,
  `maps.googleapis.com`, and `api.openai.com`. It adds the proxy host of
  `ANTHROPIC_BASE_URL`, the `<org>.code.storage` git host, and the
  `R2_PUBLIC_BASE_URL` host. It adds the project's own Supabase host, the
  hostname of `SandboxCreateOptions.backendUrl`, only while the backend is
  active (WANDIT-283). It adds the per-project hosts of
  `projects.networkAllowedHosts` (layer 3). The list has no
  `*.supabase.co`: it also reaches a Supabase project of an attacker.
  `request_network_host` denies every `supabase.co` and `supabase.com`
  host. The policy rejects a stored one other than the backend host. `SANDBOX_DENIED_RANGES`
  blocks link-local metadata, private, CGNAT, and loopback CIDRs (IPv4
  only — the vendor API rejects IPv6 CIDRs).
- `V2_SANDBOX_EGRESS_MODE` selects the mode: `strict` (default) applies
  the allow list; `open` allows every host but keeps the deny ranges —
  the fallback when the allow list breaks a turn. Every start logs
  `sandbox.network-policy.applied` with mode, host count, and rejected
  names (warn in `open`).
- `handle.setNetworkPolicy` replaces the whole vendor policy on the live
  sandbox without a restart. A resume always re-pushes the policy, because
  the snapshot may hold an old one. A plain reuse of a running sandbox
  compares the SHA-256 of the built policy with
  `sandbox_sessions.networkPolicyHash` and pushes only when they differ
  (WANDIT-253); the row keeps the hash of the last push. A vendor answer
  that carries no policy also gets the push: the harness session reads a
  missing policy as allow-all. The log line is
  `sandbox.network-policy.applied` or `sandbox.network-policy.unchanged`.
- `SandboxCreateOptions.onWake` fires once, before the slow work, when the
  sandbox really boots: a create, a resume, or a rebuild. A new or stopped
  row fires it before the vendor call; a running row fires it only after
  the vendor reports a create or a resume. A plain reuse never fires it.
- `handle.allowHost(host)` adds one host to the live allow list, for the
  `request_network_host` tool. It merges the host into the applied
  policy and routes through the live harness session, so the proxy
  run-token transformation the session added stays in place.
- `keepAliveIfRunning(projectId)` moves the vendor deadline of a running
  sandbox back to a full 30 minutes (WANDIT-164). The preview-token mint
  calls it. It uses the session call, so a stopped sandbox stays stopped.
- On every boot the provider adds `HOST=0.0.0.0` and a fresh
  `WANDIT_PREVIEW_HOST` (the current vendor host of `devPort`) to the dev
  command env; the vendor route only reaches a `0.0.0.0` listener. A
  `mobile-app` project also gets
  `EXPO_PACKAGER_PROXY_URL=https://p-<projectId>.<PREVIEW_DOMAIN>`
  (WANDIT-193): Expo CLI puts this fixed host in every manifest URL, and
  the preview proxy writes the phone host over it.
- Port additions in this slice: `SandboxCreateOptions` carries
  `ownerUserId` and `organizationId` (the provider writes them on the
  `sandbox_sessions` row it creates), and `SandboxLogger` is the narrow
  logger the lifecycle writes through.
- Vendor isolation: only `infrastructure/sandbox/` may import
  `@vercel/sandbox` or `@ai-sdk/sandbox-vercel` or emit a vendor host
  name; `vendor-isolation.spec.ts` enforces it by grep. Callers use the
  domain policy (`allowedHosts`, `deniedRanges`) and `handle.previewUrl`.
- Idle: `sandbox-idle-sweep` (Trigger cron, every 5 min, queue
  `sandbox-maintenance`) stops running rows whose `lastActiveAt` is older
  than `SANDBOX_IDLE_STOP_MINUTES` (20). The turn and each preview-token
  mint call `touchActivity`. An open preview mints every 14 minutes, so an
  old stamp means no turn and no open preview.

## Lock rule

The API sets and releases the Redis key `builder:lock:{projectId}` with a
compare-and-delete; the running task only refreshes it.

## Turn API (WANDIT-167)

Five routes under `/api/v2/projects/:projectId/turns`, all behind
`V2BuilderEnabledGuard`. The two `POST` routes also need the workspace
`project:update` permission; the three `GET` routes are reads, and the
service checks the scope:

- `POST /` creates a turn — the `agent_session` hold first, then the
  session, the lock, the `queued` row, the user message, and the task
  handoff — and answers with the turn's own stream: the
  `data-turn-created` part first, then the relayed chunks. The hold is
  the median of the project's last 10 settled `agent_session` events. A
  project with none gets the fixed 1400 cc. The hold is clamped to
  500..250_000 cc and the per-turn cap. The `data-turn-created` part
  carries the estimate: `credits` in whole credits, `basis` (`fixed`
  or `history`), `modelId`, and `multiplier` (the output-rate ratio
  over the default model). The optional `model` body field must be in
  the payer's plan allow-list; a denied pick answers 400
  `V2_MODEL_DENIED`, a picked or default model with no price row
  answers 503 `V2_MODEL_UNPRICED` (a deploy error).
  Two create-time stops refuse early: a project at its monthly cap
  answers 403 `PROJECT_CREDIT_CAP_REACHED` with `cap: "monthly"`, and a
  user holding three reserved `agent_session` events answers 429
  `TOO_MANY_ACTIVE_TURNS`. A parked `waiting` row streams as soon as
  promotion gives it a run. A turn paused on a `data-approval` card
  answers 409 `BUILDER_APPROVAL_PENDING` until the body carries
  `approval`. A turn paused on a question takes `answers` as the answer:
  one entry per `data-question` card, with `optionIds`, `text`, and
  `files`. Without `answers`, the message text answers the first
  question. Answer files pass the same owner check as attachments. The
  optional `targets` field holds at most 10 elements that the user picked
  in the preview (WANDIT-203). The user row keeps them as a `data-targets`
  part, and the task adds one "The user points at:" line per target to
  the prompt.
- `GET /estimate` answers `{ estimate }`: the hold that the next turn on
  the default model reserves, from the same `estimateTurn` as `POST /`,
  with no write. `estimate` is null when the deploy sets no default
  model. The composer shows it before send.
- `GET /:turnId/stream` relays one turn's stream; `204` while the row has
  no run id.
- `GET /active/stream` is the `useChat` reconnect route: the active
  turn's stream, or `204` when the project has none. A row whose run id
  is not written yet streams through the row poll instead of `204`. The
  stream starts with a `data-turn-created` part with no estimate, so
  the browser knows the turn id after a reload and Stop can cancel.
- `POST /:turnId/cancel` CAS-moves the row to `cancelling`, cancels the
  run best-effort, releases the lock, settles to `canceled`, refunds the
  hold, and promotes the oldest `waiting` turn.

`GET` and `PUT /api/v2/projects/:projectId/cost-caps` (WANDIT-174) sit
behind the same guard and the `limits:manage` permission — an owner or
org admin, never a member. Amounts are centi-credits: `perTurnCapCredits`
defaults to 5000 and accepts at most 250_000; `monthlyCapCredits` null
means no monthly cap. `GET` answers the row or the plan defaults; `PUT`
upserts and answers the row. A non-`v2_app` project answers 404.

Wire format — the D20 envelope is unwrapped for the browser (the task
keeps writing it on the `ui` stream): one `data:` line of JSON per frame,
no `id:`/`event:` lines, `: heartbeat` comments, `data: [DONE]` to end. A
`part` envelope passes through as the AI SDK chunk it carries;
`status`/`usage`/`error`/`done` become `data-turn-*` parts
(`turnDataPartSchema`), and `error` adds the AI SDK `error` chunk.
Response headers are the SDK's `UI_MESSAGE_STREAM_HEADERS` values plus
CORS. The Trigger read ends after 60 s of silence; the relay then checks
the row — terminal writes `data-turn-done` from the row, otherwise it
reopens the read and skips the event ids already sent.

Rules the code pins:

- One active turn per project. The Redis lock serializes the queue; the
  unique index `builder_turns_active_project_uq` backs it in Postgres.
- `agent_session` holds use `attemptRef = turnId`; every failure path
  refunds the hold before the error leaves the service, checkpoint
  debits included. A stopped turn settles the hold from the proxy rows
  instead. `GENERATION_BILLING_MODE=off` skips the hold.
- The task handoff is idempotent on `builder-turn:{turnId}` (TTL 1 h), so
  a retried create or a promoted requeue can never start a twin run.
- Only `infrastructure/trigger/` may import the Trigger streams API;
  `trigger-isolation.spec.ts` enforces this.
- `TurnStreamRelayService` copies the V1 SSE socket handling: 15 s
  heartbeats, backpressure on `drain`, error frames on reader failure.

## Projects (WANDIT-175)

Two routes under `/api/v2/projects`, behind `V2BuilderEnabledGuard` and
the same workspace permissions V1 uses (`project:create`, read = any
member):

- `POST /` first reads the template version of `targetPlatform`
  (WANDIT-192): when the API booted without
  `templates/mobile-app/template_version`, a mobile create answers 503
  `MOBILE_TEMPLATE_UNAVAILABLE` and writes nothing. The service reads the
  files once, at boot. Then it checks attachments and the settled balance, and writes the project row (`engine = 'v2_app'`), the
  first chat, the first user message, and the `builder_sessions` row in
  one transaction. The first builder turn starts right after the commit
  and adopts that message row — a failed turn still answers 201 with
  `turnId: null`. The title job and `v2_project_created` follow.
- `GET /:projectId` answers the `AppProject` shape; a `v1_page` row in
  scope answers 404 like a missing one.

Deletion rides the V1 route: a `v2_app` soft-delete queues the
`delete-app-project` task. The task is idempotent on `projectId` and
runs one attempt. It uses its own `app-project-cleanup` queue at
concurrency 2, so a delete never waits behind a sweep. The runtime runs
nine steps, each in its own try/catch. It cancels the active turn's
run, destroys the vendor sandbox, and deletes the user Worker
(WANDIT-200). The deployment step (WANDIT-178) deletes the slug pointer,
then marks the live app deployment `unpublished`. The backend step
(WANDIT-184) moves the `app_backends` row
to `deleting`, pauses a running Supabase project, and deletes the
`project_secrets` rows; the pause sweep deletes the Supabase project after
the grace window. Then it drains the three `v2ProjectPrefixes` and deletes
the code.storage repository. The prefixes are `git/<id>/`,
`sites/<id>/assets/`, and `published/<id>/builds/` (the stored publish
outputs), never the whole `published/<id>/` root.
It writes one `audit_events` row with each step's outcome and sends
`v2_project_deleted`. The starter binds null when V2 is off, so a V1
deploy never builds it.

## Code view (WANDIT-271)

- `GET /api/v2/projects/:projectId/code` answers the file tree, the branch,
  and `defaultFilePath`. `GET .../code/file?path=<path>` answers one file
  as `{ path, content, size, binary }`. Both sit behind
  `V2BuilderEnabledGuard`; read = any member, like `GET /:projectId`.
  `CodeService` reads only a running sandbox through
  `SandboxProvider.findRunning`, which never wakes, boots, or changes it; a
  stopped sandbox answers 409 `SANDBOX_NOT_RUNNING`. The tree comes from
  `git ls-files --cached --others --exclude-standard`, so ignored files
  never show; it holds at most 5000 paths and 2 MB. A `.env*` file and `.git` are
  never listed or read, also not through a symlink: the real path must stay
  inside the worktree. A bad path answers 400 `CODE_PATH_INVALID`, a
  missing file 404 `CODE_FILE_NOT_FOUND`, and a file above 512 KB 413
  `CODE_FILE_TOO_LARGE`. The read runs `head -c` in the sandbox, so the API
  never holds more than 512 KB of one file. Reads never take the turn lock.
- One file read is one sandbox command. The script opens the file, reads
  the real path of the open descriptor from `/proc/self/fd`, and prints
  bytes only for a file inside the worktree that is not `.git` or `.env*`.
  TS checks the same rule again. A file that the sandbox user cannot open
  answers 404.
- `GET .../code` also answers `files`: the small files that one more
  command reads with the tree, so the web shows them with no request.
  `pickPrefetchPaths` picks the default file first, then `src/`, then the
  rest, never `.claude/`, at most 300 paths. The script reads at most 64 KB
  per file and 512 KB in total, with the same path rule as a file read. A
  failed prefetch logs a warning and answers `files: []`; the tree answer
  never fails because of it. `code-scripts.linux.spec.ts` runs both scripts
  on a real worktree in CI (Linux only).

## Backend provisioning (WANDIT-183)

`BackendsService.provisionBackend` is the single entry of provisioning (D18):
`AppProjectsService.create` calls it after the create transaction and before
the first turn. `POST cloud/backend` calls it for a project without a row
(for example a project made while provisioning was unconfigured) and for a
failed (`error`) row, which it provisions again with a new request key. It
writes the `creating` row and starts the task with idempotency key
`provision-backend:<requestKey>`; a second call answers the row and starts
nothing.
Without `SUPABASE_PLATFORM_TOKEN` or `SUPABASE_PLATFORM_ORG_ID` it writes no
row, logs one `supabase.provisioning.unconfigured` warn, and creation still
succeeds. `SUPABASE_PLATFORM_REGION` overrides `pickSupabaseRegion`; an
invalid value logs `supabase.provisioning.region-override-invalid` and the
picked region wins. A task-start failure never throws: the row is marked
`backend_provision_start_failed` and the project keeps working.
The task (`backend-provisioning` queue, concurrency 3, one attempt) claims the row by `requestKey`.
Every row write of the task applies only while the row holds that key, so a run of an old key cannot change a retried row.
A row with a `ref` (a retry or a replay) reuses its project; an `INIT_FAILED` project is deleted first, and a `REMOVED` one (or a 404) is replaced. A replay or a retry never leaves a second paid project.
It stores the database password as the `system` secret `SUPABASE_DB_PASSWORD` before the create call, and sets `db_password_secret_id`.
It creates the Supabase project when the row has no `ref`, with one fetch only: a retry after a lost answer could create a second paid project.
It polls `GET /projects/{ref}` every 5 s until `ACTIVE_HEALTHY` or a 10-minute timeout. A paused (`INACTIVE`) or `RESTORE_FAILED` project of a retried row gets one restore call.
It reads the anon key and the service-role key, stores the service-role key as the `system` secret `SUPABASE_SERVICE_ROLE_KEY`, and sets `service_role_secret_id`.
It applies `templates/web-app/supabase/migrations/0000_base.sql`; the file is platform-neutral, serves both templates, and can run twice. A reused project that was active before keeps its schema and auth config: the run skips this step and the next one.
It sets the auth `site_url` to the preview apex with the `previewAuthRedirectPattern` allow list (`r-` plus 12 hex characters, never `*`: a `*` also matches `@` and lets a login token go to another host).
`BackendAuthUrlsService` (Trigger task `sync-backend-auth-urls`) replaces both URL fields after a publish, an unpublish, and a custom domain change: `site_url` becomes the primary domain, else the slug host, and the allow list keeps the preview pattern and adds each live host.
It sets `external_email_enabled` and `mailer_autoconfirm` to true: email sign-up gives a session at once, with no confirmation email.
No task changes the email setting on a backend after its provisioning.
Without `PREVIEW_DOMAIN`, the task skips this step, and the backend keeps email confirmation on.
It marks the row `active`.
A failure writes `status = error`, the `failure_*` columns, and a Sentry event: `backend_provision_failed`, `backend_provision_timeout`, `backend_provision_unconfigured`, `backend_base_schema_missing`.
When the sandbox runs, the run then writes the backend values to its `.env` (see "Backend values" above).
Before the insert, the D3 entitlement checks the payer's plan (see "Backend lifecycle").

## Backend lifecycle (WANDIT-184)

Every number here is a provisional D3 default in `BACKEND_DEFAULTS`
(`domain/backend-lifecycle.ts`); WANDIT-153 replaces them. The full
description and the operator steps are in `docs/v2/backend-lifecycle.md`.

- Activity: `touchActive` stamps `last_active_at` of an `active` row at
  every turn end, every publish that went live, every Cloud tab panel
  read, and every agent backend tool call. A failed stamp only logs.
- Pause sweep: the Trigger task `backend-pause-sweep` (03:00 UTC, own
  queue at 1, one attempt, PRODUCTION and STAGING only) pauses at most 50
  `active` backends idle for 7 days (30 days with a live `deployments`
  row; env `BACKEND_IDLE_DAYS`, `BACKEND_IDLE_DAYS_PUBLISHED`). It calls
  `POST /v1/projects/{ref}/pause`, then the CAS `markPaused`, then the
  audit row `backend.paused`.
- Delete: the project delete moves the row to `deleting` and pauses the
  project. The same sweep deletes at most 50 `deleting` backends 7 days
  later: `DELETE /v1/projects/{ref}` (404 counts as done), `markDeleted`
  (the row keeps `deleting` and loses its ref: the terminal state), and
  the audit row `backend.deleted`. The sweep also moves the backend of a
  project deleted more than a day ago to `deleting` when the delete step
  missed it, ends a stale `restoring` row (also one stuck for more than
  10 minutes), and pauses the running project of an `error` row.
- Wake: the turn start restores a `paused` backend and waits for a
  `paused` or `restoring` one (a 180 s poll; with the restore call and the
  last read, about 300 s at most), with the `sandbox_waking` status
  `Waking up the database`. After the ceiling the turn runs with
  `Backend not ready yet`. `markRestored` moves `restoring` back to
  `active`; `GET cloud/backend` and the sweep also call it.
  `RESTORE_FAILED` or `REMOVED` moves the row to `error`
  (`backend_restore_failed`); `GET cloud/backend` and the sweep do the same
  for a wake older than 10 minutes.
- Entitlement: `provisionBackend` counts the payer's `creating`,
  `active`, `paused`, and `restoring` backends on live projects and
  refuses at the plan limit (starter 0, pro 1, business 3) with 403
  `BACKEND_LIMIT_REACHED`. The count and the insert run under one
  advisory lock per payer. Project creation then goes on without a
  backend.
- Billing: no `backend_provision` or `backend_hosting` operation yet; see
  the doc for what a later issue must do.

## Project secrets (WANDIT-185)

`project_secrets` holds the secret values of a V2 app: the Supabase keys
(`system` rows, written by server code) and the user's own keys (`user`
rows, written from the Cloud tab). Each value is AES-256-GCM ciphertext:
a random 12-byte IV, the 16-byte auth tag, and the data, base64 in one
column. The additional authenticated data is `projectId:name`, so a
ciphertext copied to another row fails to decrypt. The unique index
`project_secrets_projectId_name_uq` gives one name per project; the
check `project_secrets_name_ck` pins the name pattern
`^[A-Z][A-Z0-9_]{0,63}$`.

The key ring is `APP_SECRETS_ENCRYPTION_KEY`, in the form
`v1:<base64 32 bytes>,v2:<base64 32 bytes>`. The highest version
encrypts every new write; every listed version decrypts. The row stores
its version in `key_version`. `ProjectSecretsService` parses the value
at call time through `requireV2Env`, so an unset key is a 503
`V2_ENV_MISSING` on the first write, not a boot failure.
`pnpm secrets:rotate` re-encrypts the rows below the current version in
pages of 100 with a compare-and-set on `key_version`; a user write during
the run wins. The operator steps are in `docs/v2/runbook.md`.

Three routes under `/api/v2/projects/:projectId/secrets`, behind
`V2BuilderEnabledGuard` and the workspace `project:update` permission
(an owner, an admin, or a member). The service answers 404 for a
missing, out-of-scope, or V1 project, like the turn routes.

- `GET /` answers `{ secrets: [{ name, kind, createdAt, updatedAt }] }`,
  sorted by name. Never a value.
- `PUT /:name` with `{ value }` (at most 8 KB of UTF-8) sets or replaces
  a `user` row and answers 204. A `user` write over a `system` row
  answers 409 `PROJECT_SECRET_SYSTEM`; the guard is a `setWhere` on the
  upsert, so no read races the write. A name that starts with `SUPABASE_`
  answers 400 (`userSecretNameSchema`): the Supabase keys use these names.
- `DELETE /:name` removes a `user` row and answers 204. A `system` row
  answers 409; a missing row answers 404.

`ProjectSecretsService.readValue(projectId, name)` decrypts one row for
server code only; no controller calls it. Its callers are WANDIT-186
(`set_secret`) and WANDIT-189 (the connectors). `readSystemValue` reads
only a `system` row, so a `user` row with the same name never acts as a
platform key; the Cloud storage routes call it.
`set(projectId, name, value, kind, actor)` answers the row id. The
provisioning task (WANDIT-183) and the Cloud storage routes pass
`kind: "system"` for `SUPABASE_SERVICE_ROLE_KEY` and
`SUPABASE_DB_PASSWORD`; the actor scope comes from the `app_backends` row
or the request.

Every set and delete writes one `audit_events` row (`secret.set`,
`secret.deleted`) with the actor, the client IP, the project, and the
name in `metadata`; never the value. The API request log carries no
body. The Sentry `beforeSend` (`scrubEvent`) masks the `value` field of
a captured body and replaces every string that holds `sk_live_`,
`rk_live_`, `sb_secret_`, `service_role`, or `whsec_`.

## Cloud tab API (WANDIT-187)

Routes under `/api/v2/projects/:projectId/cloud/*` answer the panels of
the Cloud tab. `CloudController` parses and delegates; `CloudService`
holds the rules. Every route sits behind the global AuthGuard,
`V2BuilderEnabledGuard`, `RedisRateLimitGuard`, and the workspace
permission `project:update` on the whole controller (owner, admin, and
member all hold it). A project outside the scope, or a V1 project,
answers 404. The contracts live in `packages/contracts/src/v2/cloud.ts`,
with `cloudRoutes` and the SQL classifier `classifySql`.

The API holds the keys. The browser never sees the platform token or the
service-role key. The module factory `createCloudSupabaseClient`
composes the interactive `SupabaseManagementClient` (token
`SUPABASE_MANAGEMENT_CLIENT`): no wait on a full bucket, one retry (none
for a SQL write), and
a 429 at once. Without `SUPABASE_PLATFORM_TOKEN` the factory answers
null and every route answers 503 `V2_ENV_MISSING`. The storage routes
read the service-role key from its `system` row in `project_secrets`. A
backend from before that store has no row: the first storage call reads
`GET /projects/{ref}/api-keys?reveal=true` once, stores the key, and sets
`service_role_secret_id`. The key never leaves the process.

Backend state:

- `GET backend` answers `status`, `ref`, `region`, and `failureCode`;
  `status: "none"` without a row. A `restoring` row reads the Supabase
  status and moves to `active` at `ACTIVE_HEALTHY` (WANDIT-184), or to
  `error` when the wake is older than 10 minutes. A `creating` row with no
  write for 30 minutes moves to `error` (`backend_provision_timeout`,
  `markCreatingTimedOut`), and the Cloud tab then shows "Try again".
- `POST backend` calls `BackendsService.provisionBackend` and answers the
  row: no row gets one, an `error` row gets a new run, and any other row
  starts nothing. Unconfigured provisioning answers 503
  `V2_ENV_MISSING`; a plan without a free slot answers 403
  `BACKEND_LIMIT_REACHED` with `details: { plan, limit }`.
- `POST backend/restore` calls `POST /projects/{ref}/restore`, then moves
  the row `paused` → `restoring` with the CAS `markRestoring`. A row in
  another state answers as it is. A failed upstream call leaves the row
  `paused`.
- Every other route needs an `active` row with a ref: `paused` answers
  409 `BACKEND_PAUSED`, every other state 409 `BACKEND_NOT_READY`. An
  active row gets the activity stamp (`touchActive`).

Every SQL call goes through `SupabaseManagementClient.runQuery`
(`POST /projects/{ref}/database/query`, Beta) with `read_only: true`,
except the confirmed console write. The rows come back as ISO text
through `to_char` so the answers parse with `isoDateTimeSchema`.

- `GET tables[?exact=<table>]`: the `public` base tables with their
  columns from `information_schema.columns` and the live-row estimate
  from `pg_stat_user_tables.n_live_tup`; `exact` runs one `count(*)` on
  that table. The list is cached 30 s per ref.
- `GET tables/:table/rows?page&pageSize&sort&dir`: `table` and `sort`
  must be names in the cached list (else 400 `INVALID_IDENTIFIER`) and
  enter the SQL quoted. `pageSize` caps at 100. `total` is an exact
  `count(*)` in the same statement.
- `POST sql { query, confirmWrite }`: `classifySql` sorts the text. A
  read runs at once; a write without `confirmWrite: true` answers 409
  `WRITE_NEEDS_CONFIRM`. The answer keeps the first 500 rows and sets
  `truncated`. The fetch times out after 15 s. A refused statement
  answers 400 `QUERY_FAILED` with the Postgres message. A write leaves an
  `audit_events` row `cloud.sql_write` with the SHA-256 of the text and
  the row count, never the text.
- `GET auth/users?page&pageSize`: `auth.users` newest first with the
  provider from `raw_app_meta_data`. `GET auth/signups`: one count per
  UTC day for the last 30 days, cached 30 s.
- `GET storage/buckets`: `GET /projects/{ref}/storage/buckets`.
  `GET storage/buckets/:bucket/objects?prefix&cursor`: the project
  Storage API `POST /object/list/{bucket}` with the service-role key,
  100 per page, the cursor is the next offset; each file carries a signed
  download URL valid 10 minutes from one batch `POST /object/sign/{bucket}`
  call. `POST .../objects/upload-url { path }` answers a signed upload
  URL (Supabase keeps it valid two hours). `DELETE .../objects { paths }`
  removes up to 100 paths and leaves an `audit_events` row
  `cloud.objects_deleted` with the bucket and the counts.
- `GET logs?source&start&end&level&search`: the analytics endpoint
  `GET /projects/{ref}/analytics/endpoints/logs` with the window as
  `iso_timestamp_start` and `iso_timestamp_end`. It takes ClickHouse SQL
  over one `logs` table (Supabase removed `logs.all` on 2026-09-23).
  Sources map to the `source` values `edge_logs`, `postgres_logs`, and
  `function_edge_logs`; the level reads `log_attributes['response.status_code']`
  or `log_attributes['parsed.error_severity']`. A window above 24 hours
  answers 400 `WINDOW_TOO_LARGE`. At most 100 lines, newest first. The
  field names were verified against the live API on 2026-10-03.
- `GET functions`: `GET /projects/{ref}/functions` plus one logs query
  over the last 24 hours for the call counts; cached 30 s.
- `GET jobs`: `to_regclass('cron.job')` first (`installed: false`
  without pg_cron), then `cron.job` with the last 20 rows of
  `cron.job_run_details` per job.

Rate limits: every upstream call takes the `SupabaseRateLimiter` bucket
of its ref (120 per minute; the logs endpoint has its own bucket
`supabase:rl:logs:<ref>` at 30). A full bucket or an upstream 429
answers 429 `RATE_LIMITED`; `RetryAfterInterceptor` sets `Retry-After`
from the bucket wait. `POST sql` adds the per-user `@RateLimit` bucket
`cloud-sql` at 30 per minute. Any other upstream failure answers 503
`UPSTREAM_UNAVAILABLE`. The caches (tables, functions, sign-ups) live in
the API process; two processes may differ for 30 s.

## Workers for Platforms (WANDIT-200)

A published V2 app runs as one Cloudflare Worker in a Workers for
Platforms dispatch namespace (D15). The edge Worker dispatches to it with
the `DISPATCHER` binding (`apps/edge/README.md`, "V2 apps"). The API talks
to the namespace through `WorkersForPlatformsClient` in
`infrastructure/cloudflare/`. The publish task (WANDIT-178) is its first
real caller.

- **Namespace:** `production` for production, `staging` for staging. The
  API reads the name from `CLOUDFLARE_W4P_NAMESPACE`. The edge binds the
  same name in `wrangler.jsonc`.
- **Worker name:** `app-<projectId>` (`appWorkerName` in
  `packages/contracts/src/v2/publish.ts`). The name never changes, so a
  domain pointer keeps its target. Every project call takes
  `{ projectId, scriptName }` and checks `isAppWorkerOf` before any fetch:
  a project touches only its own Worker.
- **Tags:** `project:<projectId>` and `customer:<workspaceId>`
  (`appWorkerTags`). The client builds them from `WorkerDeployInput`, so
  no caller can drop the project tag. Cloudflare allows 8 tags per script.
- **Assets:** `assetManifest(projectId, files)` hashes each file as the
  first 32 hex characters of
  `sha256(projectId + "\0" + contentType + "\0" + bytes)`. Cloudflare
  shares an asset between all scripts of a namespace by hash, so the
  project id keeps two projects apart. One asset has one content type, so
  equal bytes under two types (an empty `.js` and an empty `.css`) get two
  hashes. Paths start with `/`; a
  `..` segment, a backslash, or a duplicate path throws. The upload runs in
  three calls: `createAssetUploadSession` (manifest in, jwt and buckets
  out), `uploadAssets` (one request per bucket with the session jwt, base64
  bodies, split only past 50 MiB; answers the completion jwt), then
  `deployScript`.
- **Bindings:** `deployScript` sends the env values of the app as
  `plain_text` bindings and the app secrets as `secret_text` bindings. A
  secret never goes into a file of the build, a log line, or an error
  message.
- **Limits:** `WorkerDeployInput.limits` (`AppWorkerLimits`) goes out as
  `limits: { cpu_ms, subrequests }`. The edge applies the same values per
  request from the host pointer.
- **Retries:** at most 5 attempts. A 429 waits `Retry-After` (at most
  60 s); a 5xx or a network failure backs off 1, 2, 4, 8 s. Another 4xx
  throws `WorkersForPlatformsError` at once, with the status, the `cf-ray`
  id, and the Cloudflare errors.
- **Versions:** the namespace API has no versions endpoints. Each PUT
  replaces the one script of a project, so nothing needs pruning. A
  rollback in WANDIT-178 uploads the old build again. `deployScript`
  answers the `etag` (the content hash), not a version id.
- **Cleanup:** `delete-app-project` deletes `app-<projectId>` with
  `force=true`; a 404 with the code 10007 (script not found) counts as
  done, any other 404 is a failure. The daily `w4p-orphan-sweep` task
  (04:00 UTC) runs only in the Trigger.dev PRODUCTION and STAGING
  environments: a dev run reads a local database and would see every
  Worker as an orphan. It lists the namespace, keeps the scripts whose
  uuid project tag matches their name, and deletes at most 50 whose
  project row is gone or soft-deleted (`deletedAt`). The list call has no
  pagination; one call answers every script.
- **Env values:** `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_W4P_NAMESPACE`, and
  `CLOUDFLARE_V2_DEPLOY_TOKEN` (scope "Account: Workers Scripts: Edit"
  only), on the API service and in the Trigger.dev environment. Without
  all three, `WORKERS_FOR_PLATFORMS_CLIENT` is null, the delete step
  answers `skipped`, and the sweep does nothing. The operator steps are in
  `docs/v2/runbook.md`.

## Publish (WANDIT-178)

A V2 web app goes live as its user Worker `app-<projectId>` (see the
section above) on `{slug}.{SITES_DOMAIN}`. A mobile app publishes through
the mobile builds below.

Routes under `/api/v2/projects/:projectId/publish`, behind
`V2BuilderEnabledGuard` and `RedisRateLimitGuard`. The writes need
`publish:manage`, like the V1 routes. Publish and "Publish anyway" share
one bucket: 10 per user and 30 per trusted client IP per hour. Rollback
and unpublish take 10 per 10 minutes per user. A V1 project, a mobile
app, or a project of another workspace answers 404.

Rate limits (WANDIT-181): `RedisRateLimitGuard` counts per user and, with
`ipLimit`, per client IP that `TRUSTED_PROXY_CIDRS` confirms (the Better
Auth rule; without a trusted IP the IP key is skipped). Project create:
10 per user and 30 per IP per day. Turn create: 30 per user and 90 per IP
per 10 minutes. A Redis error lets the request through with a Sentry
warning. Every audit row of these routes goes through `AuditEventsService`
(`audit_events`, action names in `packages/contracts/src/v2/audit.ts`).

- `POST /override` ("Publish anyway"): only the project creator, only for
  the newest `blocked` attempt, and only when every `block` finding is an
  RLS probe finding or a WARN lint. It writes `publish.gate_override`
  first, then queues a build of the same commit with `gate_override`.

- `GET /` answers `live` (the active row and its URL), `latestBuild`, and
  the 20 newest app deployments. Every route first ends a live row with no
  change for 30 minutes and a pending deployment older than 35 minutes: a
  run that Trigger stopped from outside never ends its row. A run whose
  row ended this way uploads nothing.
- `POST /` with `{ requestKey }` answers 202 and a `queued` build of the
  head of `main`. Without the W4P client or R2 it answers 503
  `V2_ENV_MISSING`; without KV (and without `ALLOW_PUBLISH_WITHOUT_KV`)
  503 `PUBLISH_UNAVAILABLE`; with a negative settled balance 402; with no
  saved version 409 `PUBLISH_NO_VERSION`; with a live build 409
  `PUBLISH_ACTIVE`. A publish costs no credits (WANDIT-178: no debit in P2).
- `POST /rollback` with `{ deploymentId, requestKey }` answers 202 and a
  `queued` build whose `sourceBuildId` names the stored output to upload
  again. Only a `superseded` or `unpublished` row comes back (409
  `PUBLISH_ROLLBACK_INVALID`).
- `DELETE /` deletes the slug pointer (its error reaches the client),
  deletes the Worker (best effort), and marks the live row `unpublished`.
  A live build answers 409. The Supabase project keeps running: the
  builder preview uses it.

`app_builds` holds one row per attempt: `queued` → `building` →
`uploading` → `published`, or `blocked` / `failed`. The partial unique
index `app_builds_live_project_uq` allows one live row per project, so a
publish and a rollback never upload at the same time. A `deployments` row
of kind `app` names its build and its commit; `version_id` is null on it.
The V1 routes answer 404 for a `v2_app` project.

The `publish-app` task (queue `publish-app`, `concurrencyKey` = project,
one attempt, key `publish-app:<buildId>`, `maxDuration` 900 s):

1. Claims the row (`queued` → `building`). A replay skips.
2. Build from source: wakes the sandbox, adds a git worktree of the
   commit under `/tmp/wandit-publish/<buildId>`, runs `pnpm install
   --frozen-lockfile --prefer-offline` (3 min) and `pnpm run build` (5 min)
   with the public `VITE_SUPABASE_*` values, then removes the worktree. A
   running turn neither blocks the build nor changes its files.
3. Reads `dist/`: the `.js`, `.mjs`, and `.wasm` files of `server/` are the
   modules (`server/wrangler.json` names the main one), the files of
   `client/` minus `.assetsignore` are the assets. A symlink, more than
   2,000 files, more than 100 MB, or an asset above 25 MiB fails the build.
4. Checks the slug with the phishing rules (`domain/publish-gate/phishing-rules.ts`),
   then runs the publish gates in order: the secret scan
   (`domain/publish-gate/secret-scanner.ts`) and the backend gate
   (`application/services/backend-publish-gate.ts`: Supabase security
   advisors and the anonymous RLS probe). A `block` finding moves the row
   to `blocked`, stores every finding in `app_builds.gate_findings`, and
   uploads nothing. The owner "Publish anyway" route builds again with
   `gate_override`: then RLS probe findings and WARN lints pass; a secret,
   a phishing name, and an ERROR lint never pass. A gate that cannot run
   fails the row with `gate_unavailable`. A suspended project fails with
   `suspended`, and the API refuses it with 403 `PROJECT_SUSPENDED`.
5. Stores the output as gzip JSON at
   `published/<projectId>/builds/<buildId>.json.gz`. A rollback skips steps
   2 to 5 and reads this object of its source build.
6. Uploads: asset session, assets, then the script with the bindings. The
   user `project_secrets` rows go as `secret_text`, the public Supabase
   values as `plain_text`. A `system` row never goes. No secret enters a
   file of the build.
7. Promotes the pending row, then writes `appHostPointer` on the slug host
   and on every active custom domain. The promote comes first: the
   unique slug index then holds the slug, so the pointer never overwrites
   another project. The live slug stays; a first publish takes a free slug
   of the project name with the V1 rules. Every plan gets
   `DEFAULT_APP_WORKER_LIMITS` today. Then it reads the suspend state again:
   a suspend during the run rewrites every pointer as suspended. It writes
   the `publish.done` audit row and queues `sync-backend-auth-urls`.

A failed upload keeps the previous Worker live. A first publish that fails
after the script upload deletes the Worker again (and ends its row when
the pointer write failed), so no app stays reachable without a live row. A
re-publish whose pointer rewrite fails stays published: the stored pointer
already names the project. The project delete deletes the
slug pointer, ends the live row, and drains `published/<id>/builds/`.

## Mobile builds (WANDIT-194)

The Android card of the publish popover builds an APK of a mobile app on
EAS. iOS joins with WANDIT-284 (D22). The price is 50 credits
(`MOBILE_BUILD_ANDROID_CREDITS`, D23).

Routes under `/api/v2/projects/:projectId/mobile-builds`, behind
`V2BuilderEnabledGuard`, `RedisRateLimitGuard`, and the workspace permission
`project:update`. A V1 project, a web app, or a project of another workspace
answers 404.

- `POST /` with `{ platform: "android", requestKey }` answers 201 and the
  build. A retried `requestKey` answers its first build. Without
  `EXPO_TOKEN` or `EXPO_ACCOUNT` it answers 503 `V2_ENV_MISSING`; without a
  saved version (no `app_branches` head) 409 `MOBILE_BUILD_NO_VERSION`; with a
  live build 409 `MOBILE_BUILD_ACTIVE`. The hold `mobile_build:<buildId>`
  (`mobileBuildHoldKey`) comes first, so a 402 writes no row. Then the
  `queued` row, the task start, and the audit row `mobile_build.started`. A
  task that does not start leaves the row `failed` with `start_failed` and
  refunds the hold. Rate limit: 10 per 10 minutes per user.
- `GET /` pages the builds, newest first (cursor, at most 50). `GET /:buildId`
  answers one build.
- `POST /:buildId/cancel` moves a live row to `canceled` with a
  compare-and-set, cancels the EAS build over GraphQL, refunds the hold, and
  writes `mobile_build.canceled`. A build that already ended answers as it
  is.

`mobile_builds` holds one row per build. The partial unique index
`mobile_builds_live_project_platform_uq` allows one `queued` or `building` row
per project and platform. Every status change is a compare-and-set in
`MobileBuildsRepository.transition`: only one of the API and the task ends a
build, and only that side moves the credits.

The `mobile-build` task (queue `mobile-builds`, `concurrencyKey` = project,
one attempt, idempotency key `mobile-build:<buildId>`):

1. Claims the row (`queued` → `building`). A canceled or replayed run skips.
2. Leases the hold (`LEASE_TTL_MS`, 40 min), so the stale-hold sweep skips
   it during the build.
3. Prepares the workspace in a temp folder (`prepareMobileBuildWorkspace`):
   a read-only credential, `git fetch` of the commit (fallback: `main`), the
   app.json checks, the wandit EAS identity, the trusted `eas.json` with the
   backend env, a fixed `.easignore`, and the trusted template install. See
   `docs/v2/security.md` section 12.
4. Runs `eas init --account <EXPO_ACCOUNT>` and `eas build -p android
   --profile apk --no-wait`, then removes the temp folder before any wait.
5. Polls the build over GraphQL every 30 s with `wait.for`, for at most 2 h.
   FINISHED stores `artifactUrl` and settles 5000 cc. ERRORED, a timeout, or
   any other error fails the row and refunds. A failed DB read or EAS read
   only waits for the next poll. A row that left `building` ends the run:
   the API canceled it, and the run asks EAS to cancel once more. A
   soft-deleted project cancels EAS and the row and refunds. A hold that the
   stale-hold sweep or a cancel refunded stops the build (like builder-turn).

A run that Trigger stops from outside (OOM, `maxDuration`) leaves the row
`building`. The user Cancel is the exit, and the sweep refunds the hold when
the lease expires. The operator steps are in `docs/v2/runbook.md`.

## Builder turn

The `builder-turn` Trigger task (WANDIT-166) runs one turn end to end.
`builder-task-queues.ts` gives it the `builder-turn` queue
(`concurrencyLimit: 1`); `builder-turn.task.ts` wires the production
dependencies; `builder-turn.runtime.ts` holds the step list and runs on
fakes in `builder-turn.runtime.spec.ts`. The API takes the project lock
and queues the run; the task only refreshes and releases the lock under
the turn id.

One run does this, in order:

1. Claims the row (`builderTurns.claimRunning`, a `queued` → `running`
   CAS under the run id); a lost claim ends the run quietly. Then loads
   the turn row and the project row (`TurnProjectRepository`); a
   non-`v2_app` project or a missing framework/template version fails the
   turn before any sandbox work; a framework without a template profile
   fails it `project_template_unknown`. The model is `turn.model ??
   V2_DEFAULT_MODEL`; a missing one fails the turn `model_missing`.
2. Reads the cost caps (`ProjectCostCapsRepository`) and the plan;
   computes `capUsd` for the token claims from `perTurnCapCredits` — the
   row value or `DEFAULT_PER_TURN_CAP_CREDITS` (5000 cc). The pre-start
   stop rules throw into `failTurn`: the builder flag off →
   `stopped_disabled`, a settled balance at 0 → `stopped_no_credits`,
   the monthly cap already reached → `stopped_project_cap`.
3. Mints the scoped proxy token (`mintLlmProxyToken`) with the run, turn,
   user, project, workspace, and plan claims.
4. Wakes a `paused` or `restoring` backend first (WANDIT-184, a 180 s
   poll, see "Backend lifecycle"). Then it builds the allow-listed env
   (`buildSandboxEnv`): the run token becomes
   `ANTHROPIC_AUTH_TOKEN`, the proxy URL `ANTHROPIC_BASE_URL`, the run id
   `ANTHROPIC_CUSTOM_HEADERS`; the real `ANTHROPIC_API_KEY` is forced to
   an empty string. An `active` `app_backends` row gives `backendUrl` for
   the egress policy; any other row, or no row, adds the note
   `Backend not ready yet` to the first status of the turn
   (`session_starting` on a cold session, `running` on a warm turn).
5. Wakes or creates the sandbox (`sandboxes.getOrCreate`, with the dev
   command and port of the template profile) and touches
   `sandbox_sessions` activity so the idle sweep leaves it alone. The
   `sandbox_waking` status is written from `onWake`, so a running sandbox
   (a warm turn) shows no waking step on the card. Then it reads the
   `app_backends` row again and, for an `active` row, writes the backend
   `.env` (`syncBackendEnvFile`). The second read covers a row that turned
   `active` while the sandbox booted.
6. Loads the `builder_sessions` row (`findByChatId`) the API created at
   turn create, then creates or resumes the `HarnessAgent` session
   through `createBuilderHarness`; a stored `resumeState` means resume, a
   harness mismatch is a failure. The session instructions give the UI
   language as a hint for the app language, the `ask_user` rule, the
   description language, and the CLAUDE.md work rules (plan, checks,
   plain final answer). A mobile project adds the Expo sentence. A web
   project adds the app design recipe (`domain/app-recipe.ts`): one stable
   sentence per project id, so the warm CLI and the prompt cache stay
   valid. Claude Code loads the template `CLAUDE.md` from the workspace
   root. The `session_starting` status is
   written only for a cold session: no stored state, or a resume that
   failed (`Starting a fresh session`). A warm turn goes to `running`
   directly, and that status carries the `Backend not ready yet` note
   when it applies. A `waiting_for_*` row of the project
   moves to `succeeded` first — this run is its answer. When the stored
   state holds pending cards, the turn streams a `continue` input. For an
   `ask_user` card, `askUserOutputOf` builds the tool result: a
   `spec.answers` entry wins. Without one, the message text answers the
   first question (an exact option label picks that option). A built-in
   `askUserQuestions` card from an older pause reads the same typed
   answers (`builtinQuestionResultOf`). After the sandbox is ready, each answer file is copied to `public/uploads/` (at
   most 15 MB, `ANSWER_FILE_MAX_BYTES`). A failed copy keeps
   `path: null`, and the agent gets the URL. `spec.approval` answers the
   approval card (an unnamed approval counts as denied). A session that
   cannot resume starts fresh and hears the answers as plain text. After
   a sandbox stop, the bridge and its open tool calls are gone: an
   `ask_user` answer then resumes the same thread between turns
   (`dropPausedTurn`) and goes as the same plain text. An approval keeps
   the `continue` input.
7. Starts the timers: a 60 s keep-alive (`TURN_KEEPALIVE_MS`: lock
   refresh, `sandbox.keepAlive`, `touchActivity`) and the 30 s pulse
   (`STREAM_HEARTBEAT_MS`). The pulse runs the 4 min stall watchdog
   (`TURN_STALL_MS`; a silent harness ends the turn `stalled`) and the
   `Working` heartbeat. For billing it reads
   `llm:spend:run:<runId>`; each $0.25 of spend past what the hold
   covers lands a `checkpoint:<id>:<n>` debit on the hold. It writes a
   `usage` stream event from the `llm_proxy_requests` sums. A failed
   checkpoint logs
   `builder-turn.checkpoint-failed` and the stop rules still run; a
   non-finite counter reads 0 with a
   `builder-turn.spend-counter-invalid` warn. Then the stop rules: a
   settled balance at 0 → `stopped_no_credits`, the per-turn or
   monthly cap → `stopped_project_cap`, `v2BuilderEnabled` off →
   `stopped_disabled`. Each stop commits a wip and settles the spend
   from the rows. Each stop writes the `error` event (`code` = the
   terminal status, `retryable: false`), then the `done` event with
   that status. `GENERATION_BILLING_MODE=off` skips the checkpoint and
   the balance and cap checks. The harness can end on a proxy 402
   `V2_RUN_CAP_REACHED` before the next tick. So at the stream end and
   in the failure path, the task reads the `llm_proxy_requests` row with
   reason `run_cap` of the turn: one row stops the turn on the cap.
8. Streams harness parts: each `part` goes to the `ui` Trigger stream
   (`TriggerTurnEventWriter`) and to a `readUIMessageStream`
   reconstruction. A harness `error` chunk stays off the `ui` stream:
   `useChat` stops at it, and the `data-turn-error` card comes later.
   Harness `usage` events only feed the
   `builder-turn.harness-usage` log line; the money path never reads
   them. After each `reasoning-end`, the task writes a `data-thought`
   part (`reasoningId`, `seconds`, at least 1) to both streams. The UI
   shows it as "Thought for Ns".
9. On stream end `hasUnfinishedTurn` picks the path. A paused turn runs
   `suspendTurn` instead of `detach`: one `data-question` or
   `data-approval` stream part and message part per pending card, the row
   completes as `waiting_for_answer` (`waiting_for_approval` when a
   card is an approval), and the suspended state lands on the session
   row. A finished turn completes as `succeeded`. Both paths share the
   same tail: `commitTurn` commits the workspace (a commit failure only
   costs the commit, not the turn), one `data-turn-summary` part carries
   the numstat and the work seconds on the stream and in the stored
   message, `insertTurnAssistantMessage` persists the assistant message with
   usage (the proxy row sums) and commit metadata, and the resume state
   is saved on the session row. A `detach` in the middle of a turn (a
   cancel, a stall) keeps that turn in the state too, with its cards in
   `pending`, so the next message answers them. When a resumed session
   still holds an unfinished turn and no card exists to answer, the
   runtime starts a fresh session: the SDK refuses a new prompt on it.
10. Settles the hold from the `llm_proxy_requests` rows
    (`settleHoldFromRows` reads `LlmProxyRequestsRepository.sumByTurn`,
    the `status = 'ok'` rows). `pricing` is `"direct"`, `finalCredits`
    the `usdMicros` sum through `usdMicrosToCentiCredits`. The snapshot
    carries `source: "llm_proxy_rows"`, `table: "llm-model-prices@1"`
    (`HARNESS_PRICE_TABLE_VERSION`), `checkpoints`, `modelId`, and
    `usdMicrosPerCredit`, and `rawUsage` the per-model sums. A
    zero-spend turn with no checkpoints refunds in full instead.
    `recordUsage` and the assistant metadata take the row token sums.
    The `done` frame carries the receipt: `credits` (cc), `modelId`,
    `inputTokens`, `outputTokens`, `cacheReadTokens`,
    `cacheWriteTokens`, and the payer's settled `balanceCredits` after
    the settle.
    Failure and cancel still refund — the refund pays back the reserve
    and every `checkpoint:<id>:<n>` debit.
    `GENERATION_BILLING_MODE=off` skips the settle and logs
    `billing.off` once. `builderTurns.complete`/`fail` mark the row
    terminal with a compare-and-set, so a stale task can never
    overwrite a newer turn.
11. Each terminal path ends with `finishTurn`: `counters.revokeRun` kills
    the token, the lock releases, `promoteNext` hands the slot to the
    oldest `waiting` turn, `touchActivity` runs once more, and the backend
    activity stamp (`touchActive`) runs. The
    runtime `finally` stops the timers, closes the host tools, and writes
    the `builder-turn.timing` line; the task `finally` closes the event
    writer, the two Redis clients, and the pool.
12. `builder-turn.timing` (WANDIT-253) is one log line per run that
    passes the claim and the chat check, failures included, with the ms of
    each step: `queueMs` (row create → run
    start), `prestartMs` (row reads, money checks, token mint),
    `sandboxMs`, `hostToolsMs`, `sessionMs`, `firstPartMs` (stream start
    → first harness part), `firstModelCallMs` (run start → the first
    `llm_proxy_requests` row's start, from `firstRequestStartedAtMs`),
    `streamMs`, `commitMs`, `settleMs`, `totalMs`. `sandbox` is `woke` or
    `warm`, `session` is `resumed` or `created`; a step that did not run
    is null.

Warm turns (WANDIT-253): the SDK keeps the bridge alive between turns.
`detach` only suspends the socket (`channel.suspend()`), and
`createSession({ resumeFrom })` first tries to attach to the running
bridge through its stored port and token; it spawns a new bridge only
when the attach fails. The Claude Code process inside the bridge still
starts one `query()` per turn, so the model call waits for its startup on
every turn; that cost sits inside the SDK. The runtime never caches a
session object across runs: the proxy run token rotates per run and lives
in the vendor request transformation the SDK installs at session start.

## Host tools (WANDIT-169)

Host tools run in the task process, not inside the sandbox: platform and
partner secrets never enter the VM. `BuilderHostToolRegistry` assembles
the per-turn `HostToolSet` the harness hands to the agent; `build` gets
the `builder-turn:<turnId>` hold id and the metering subject, so a paid
tool reserves a measured child event under the parent hold. `close`
releases per-turn clients (none today — connectors land in a follow-up).

- `generate_image` reuses the V1 `generateBuildImage` pipeline (gateway
  model, R2 upload, renditions) and writes the bytes into the sandbox
  project. Rules it pins: the `path` must stay under `public/` or
  `src/assets/` (checked before any credit moves); at most 6 calls per
  turn (`MAX_IMAGES`); the file extension follows the stored media type;
  a child hold is reserved per call (`builder-turn-image:<turnId>:<n>`),
  gateway evidence is captured before settlement, a provider failure
  refunds, and a `failed`/`unavailable` result returns to the agent
  instead of throwing. `null` `holdEventId` answers `failed` — a paid
  tool never runs unbilled.
- `ask_user` asks the user 1 to 4 questions in one call. It is
  `"not-applicable"`, has no execute, and pauses the turn. The harness
  cuts the input to the card limits (`askUserQuestionsOf`). The built-in
  `askUserQuestions` is inactive.
- `request_network_host` (WANDIT-180) asks to reach one extra egress
  host. It is `"user-approval"`, so the user approves first; the body
  runs only on approval. It checks the host with `isValidNetworkHost`.
  Then one transaction appends it to `projects.networkAllowedHosts` (a
  deduping write), writes a `network.host_allowed` audit row, and calls
  `SandboxHandle.allowHost` last to apply it with no restart. `allowHost`
  routes through the live harness session, so the proxy run-token
  transformation survives. A bad host, a `supabase.co` or `supabase.com`
  host (WANDIT-283), or a failed step answers `denied`. A failed step
  rolls back both rows, so the next start does not allow the host.
  See `docs/v2/security.md` section 5.
- Approval state comes back in `toolApproval`; a tool with
  `"user-approval"` pauses the stream on an approval request the same
  way `ask_user` pauses for an answer. `generate_image` is
  `"not-applicable"` — it never asks.
- MCP connector tools are out of scope here: they need the Nest
  container, and the task has none (follow-up issue).

Run a turn locally: from `apps/server`, start the worker with
`npx trigger.dev@4.5.3 dev`, then create a turn through
`POST /api/v2/projects/:projectId/turns`. The handoff queues the run by
task id `builder-turn`; watch it in the Trigger dev dashboard. The
worker needs `DATABASE_URL`, `REDIS_URL`, `TRIGGER_SECRET_KEY`,
`V2_DEFAULT_MODEL`, `LLM_PROXY_SIGNING_KEY`, the sandbox envs
(`VERCEL_SANDBOX_TOKEN`, `VERCEL_TEAM_ID`, `VERCEL_PROJECT_ID`), and the
code.storage envs.

Switch `V2_HARNESS`: `claude-code` is the default and only built harness
(D17). The task calls `createBuilderHarness(env.V2_HARNESS)`; an unknown
value throws `HarnessNotBuiltError` before the sandbox starts. OpenCode
joins the same enum later; the runtime only sees the `BuilderHarness`
port.

## Backend tools (WANDIT-186)

Seven host tools act on the hidden Supabase project of the app. They live
in `application/host-tools/backend/` and run in the `builder-turn` task.
They call the interactive `SupabaseManagementClient`: a full rate-limit
bucket answers `rate_limited` with `retryAfterSeconds` at once. A
`run_sql_write` query gets one fetch and no retry. The migration text can
retry once, and the unique sha stops a second run. The schemas and
`backendToolNames` live in
`packages/contracts/src/v2/backend-tools.ts`. The worker needs
`SUPABASE_PLATFORM_TOKEN` and `SUPABASE_PLATFORM_ORG_ID`; `set_secret` also
needs `APP_SECRETS_ENCRYPTION_KEY`.

- No tool creates or wakes a backend. `resolveActiveBackend` answers
  `backend_paused` for a paused row and `backend_not_ready` for every other
  row that is not `active` with a ref, before any upstream call. An active
  row gets the activity stamp. Without `SUPABASE_PLATFORM_TOKEN` every
  tool answers `failed`.
- `runBackendTool` is the body of every `execute`. It parses the input
  with the tool schema first: the harness passes the raw model JSON to
  `execute` and does not parse it. It turns each error into a typed
  failure (`mapClientError`), so a tool never throws to the agent. It
  writes one `host-tool.backend` log line per call with the tool, the ref,
  the status, and `durationMs`.
- Approval: the harness reads `toolApproval` per tool name; the AI SDK
  `needsApproval` option of a custom tool is not read
  (`resolveCustomToolApproval` in `@ai-sdk/harness`). So each write the
  user approves is its own tool with `"user-approval"`.

| Tool | Approval | Does | Audit action |
| --- | --- | --- | --- |
| `apply_migration` | not-applicable | Applies an additive migration. A destructive one (`isDestructiveMigration`) answers `needs_approval`. | `backend.migration_applied` (`name`, `sha256`, `destructive`) |
| `apply_destructive_migration` | user-approval | Applies any migration. | `backend.migration_applied` with `destructive: true` |
| `run_sql` | not-applicable | A read (`classifySql`) with `read_only: true`, first 200 rows. A write answers `needs_approval`. | none |
| `run_sql_write` | user-approval | Runs the statement with `read_only: false`. | `backend.sql_written` (`queryHash`, `returnedRows`: the rows the endpoint answered), never the text |
| `deploy_function` | not-applicable | Deploys `supabase/functions/<slug>/` as one multipart request: one folder level, at most 50 files and 5 MB, `index.ts` required. Answers the slug and the function URL. | `backend.function_deployed` (`slug`, `version`) |
| `set_secret` | not-applicable | Pushes one `project_secrets` value to the Edge Function secrets. | `secret.synced` (`name`, `source`) |
| `get_advisors` | not-applicable | The Supabase advisors plus the wandit RLS check. | none |

Migration ledger: `wandit.migrations (name primary key, sha256 unique,
applied_at)`, created on the first call. `apply_migration` sends the ledger
insert first and the migration SQL after it in one text. The Management
API runs one text as one implicit transaction (UNVERIFIED for the Beta
endpoint). So the row and the migration commit together. A retry after a
commit fails on the unique sha. The audit row follows the commit, before
the file write. A known sha answers `skipped` and writes the file again
from the stored name and `applied_at`. The file is
`supabase/migrations/<yyyymmddHHMMSS>_<name>.sql` in the sandbox; the turn
commit takes it. The RLS check reads `public` only, so the `wandit` schema
never counts.

Secrets: `set_secret` reads the value with `ProjectSecretsService.readValue`;
no row answers `missing`, and the web app shows the Cloud tab secret input.
`generate` stores 32 random bytes (base64url) as a `user` row only when no
value exists, so a repeated call never rotates a key. After the push,
`project_secrets.synced_to_backend_at` holds the time of the read; a value
written after the read keeps no stamp. A new value through `upsert` sets
the stamp back to null. The value never reaches an output, a log line, an
audit row, or an error. A refused `bulkCreateSecrets` call carries a fixed
detail, because the upstream message can echo the value. An Edge Function
reads a secret with `Deno.env.get`; TanStack server functions do not get it.

Two services serve later callers. Both take the resolved `BackendRef`, so
the caller runs `resolveActiveBackend` first.

- `AdvisorsService.run(backend)` answers `GateFinding[]`. It holds the
  Supabase security and performance lints, without `INFO`. It adds one
  `wandit_rls_missing` error for each `public` table with RLS off or
  without a policy. The `get_advisors` tool calls it; the publish gate
  reads the advisors itself.
- `BackendSecretsService.push(backend, name)`: one push and the sync
  stamp. The connectors of WANDIT-189 call it.

The tool cards in `apps/web` are a follow-up (UI); they read the same
contracts.


## Versions and the git store

Every turn ends in one git commit on the project's code.storage
repository (WANDIT-152/171, D21). The sandbox disk is temporary; the
repository is the durable copy.

- Repository name: `wandit/<projectId>`. The remote URL is
  `https://<org>.code.storage/wandit/<projectId>.git` — never with a
  token inside.
- Credentials are ES256 JWTs minted locally with the org's private key
  (`CODE_STORAGE_PRIVATE_KEY`, `CODE_STORAGE_ORG`). Claims: `iss` = org
  slug, `sub` = `wandit-api`, `repo` = the repository name, `scopes`,
  `iat`, `exp`. A JWT is for one repository only, so a project token
  cannot touch another project's code (a live probe confirmed it).
- A restore or mobile-build credential carries `git:read` only. A push
  credential carries `git:read` + `git:write` and the `refs` claim
  `[["refs/heads/main", ["no-force-push"]], ["*", ["no-push"]]]`: no force
  push, no other branch, no tag. code.storage still accepts a delete of
  `main` and a new `main` (the LIMIT at `PUSH_MAIN_REFS`).
- A push or restore credential lives 120 s, and each push mints a new
  JWT. A mobile-build credential lives 600 s on the Trigger worker. A
  repository-admin call carries `repo:write` (TTL 300 s).
- The git URL passes the JWT as `https://t:<jwt>@<org>.code.storage/...`.
  `redactRemoteUrl` masks it for logs; errors never carry it.
- One commit per turn: `git add -A`, `commit --allow-empty` with the
  trailers `Wandit-Message: <messageId>` and `Wandit-Chat: <chatId>`, then
  `git tag -f msg/<messageId>`. The trailer is the idempotency key: a
  retried call does not add a second commit for the same message.
- The patch (`git show`, capped at 1 MB) and the numstat go to R2 under
  `git/<projectId>/patches/<sha>.diff` and `.numstat`.
- Write order: R2 objects, then `git push <url> HEAD:main`, then the
  `app_commits` row, then the `app_branches` `main` head as a
  compare-and-swap on the previous head. When no `main` row exists, the
  write creates it for any previous head. The template init commits
  outside `commitTurn`, so the first turn has no row. A head mismatch
  answers 409 `VERSION_CONFLICT`.
- A fresh sandbox restores the code through `RepoRestorer`: `fetch` +
  `reset --hard FETCH_HEAD` when `.git` exists (the template commit of a
  new sandbox can have another root than the project, so `git pull` can
  refuse), and else an in-place `init` + `fetch` + `reset --hard` +
  `clean -fd`. No `git clone`: it stores the URL with the JWT in
  `.git/config`.
- A restore is copy-forward: `git read-tree -u --reset <sha>` sets the
  worktree to the old content and a NEW commit lands on top
  (`source = 'restore'`, `restored_from_sha` points at the target).
  History never rewinds.
- Routes: `GET /api/v2/projects/:id/versions` (cursor, max 50),
  `GET .../versions/:sha/diff`, `POST .../versions/:sha/restore` (409
  `BUILDER_TURN_ACTIVE` while a turn runs).
- `GET /api/v2/projects/:id` answers `hasCodeChanges`: true when one
  `app_commits` row has a numstat that is not `[]`. A text-only turn
  commits with `[]`, and the template commit has no row. While the flag
  is false, the web preview never shows the template app: a running turn
  shows the build step, and no turn shows the "waiting for your next
  step" note. A stopped turn writes its wip commit before `done`, so the
  refetch at the stream end sees it.

## LLM proxy

`POST /api/v2/llm/v1/messages` and `POST /api/v2/llm/v1/messages/count_tokens`
forward Anthropic Messages API traffic to the configured upstream. The
sandbox holds only a run token; the real provider key never leaves the API.
An OpenAI-compatible inbound route for OpenCode can reuse
`LlmProxyService` unchanged — the token check, caps, and usage-row code
live there, not in the controller.

Check order, per request:

1. **Token.** `Authorization: Bearer <run token>` is the only auth (the
   route is `@Public()`; session guards do not run). The token is
   `base64url(json).base64url(hmac-sha256)`, signed with the first key of
   `LLM_PROXY_SIGNING_KEY`; verification accepts any key in the list, so
   rotation adds the new key, then swaps minting. Claims: `runId`,
   `turnId`, `userId`, `projectId`, `workspaceId`, `plan`, `capUsd`, `exp`
   (mint + 65 minutes: a 60-minute turn never loses its token). A bad or
   expired token gets 401 `V2_TOKEN_INVALID` and writes no row. A token
   whose run was revoked (`llm:revoked:run:{runId}` exists — the turn
   ended) gets the same 401 and also writes no row.
2. **Model.** The body's `model` must be in `allowedLlmModels(plan)` —
   `V2_DEFAULT_MODEL` plus the plan's paid list in
   `@wandit/contracts` (`llmProxyAllowedModels`). A dated bare id like
   `claude-haiku-4-5-20251001` — what Claude Code sends for its aliases —
   is normalized to `anthropic/claude-haiku-4-5` before the check. An
   absent model means the default. A denied model gets 403
   `V2_MODEL_DENIED` with `allowed` and a `model_denied` row.
3. **Rate limit.** Redis `llm:rl:run:{runId}`, `INCR` + `PEXPIRE`, fixed
   60 s window, 120 requests per minute (ESTIMATE). Over the limit: 429
   `V2_RATE_LIMITED` with `retry-after: 60` and a `rate_limited` row.
4. **Run cap.** Redis `llm:spend:run:{runId}` micros vs `capUsd`. Over:
   402 `V2_RUN_CAP_REACHED` and a `cap_rejected` row.
   `GENERATION_BILLING_MODE=off` skips this check.
5. **Daily user cap.** Redis `llm:spend:user:{userId}:{yyyymmdd}` micros vs
   `LLM_PROXY_DAILY_USER_CAP_USD` ($50, ESTIMATE until WANDIT-174). Over:
   402 `V2_DAILY_CAP_REACHED` and a `cap_rejected` row.
   `GENERATION_BILLING_MODE=off` skips this check.

Then the forward. `upstreamFor(modelId, env)` picks the upstream and key:
`AI_GATEWAY_API_KEY` when the upstream host is `ai-gateway.vercel.sh`,
`OPENROUTER_API_KEY` for `openrouter/` model ids or an `openrouter.ai`
host, `ANTHROPIC_API_KEY` otherwise. Anthropic gets `x-api-key`; the
gateway and OpenRouter get `Authorization: Bearer`. A missing key is a 503
`V2_ENV_MISSING` naming the value. The upstream gets
`anthropic-version`, `anthropic-beta`, `X-Wandit-Run`, the query string,
and the body bytes unchanged — except `model`, rewritten to the upstream's
id when the two differ (api.anthropic.com gets the bare id the client
sent, a gateway gets the normalized `anthropic/...` id). The body
cap is 4 MiB, set in `main.ts` at the route level.

The answer streams through without buffering; each chunk also feeds the
SSE usage parser (`message_start` → input/cache counts, `message_delta` →
output). A client abort writes a `client_aborted` row with the counts seen
so far. Every request ends in one `llm_proxy_requests` row: token claims,
provider, normalized model id, token counts, `usdMicros` from
`LLM_MODEL_PRICES`, status, and latency. A model with no price row fails
closed: 503 `V2_MODEL_UNPRICED` before the forward, no row. WANDIT-151
adds the price row of the default model before the first turn. The row
lands before the Redis counters, so a failed insert never inflates
spend. The rows are the billing source of truth for a turn; the
`llm:spend:run:<runId>` counter only drives the mid-turn checkpoints.

Two sweeps maintain the money records. `reconcile-agent-sessions`
(Trigger cron `*/15 * * * *` UTC, queue `meteringMaintenanceQueue`)
reprices settled `agent_session` events. Each run takes events 10
minutes to 48 hours old, 200 at a time.
`MeteringService.reconcileAgentSession` reprices one under ledger key
`reconcile:<id>` and marks it `reconciled`. An event whose turn has no
`ok` row is skipped with a `reconcile.agent-session.no-rows` warn. The
rows are the truth only when they exist. `recover-stranded-metering`
(the stranded-hold sweep) gives `agent_session` holds a 180-minute stale
window (`AGENT_SESSION_STALE_AFTER_MS`); other operations keep 40
minutes. The window only matters for a queued turn: the runtime takes an
execution lease on the hold at start and renews it on every 30 s pulse,
so the sweep never refunds a running turn. The lease token is a random
uuid per run (`execution_lease_token` is a uuid column; the Trigger run
id is not one). A turn that finds its hold
`refunded` at start fails instead of running without a hold. The `sandbox` operation sits in the registry — measured per
minute, rate zero, `customerBillable: false` — and has no writer before
WANDIT-196.

Token revocation: the builder-turn task (WANDIT-166) calls `revokeRun`
when the turn completes or fails; the API calls it on cancel and on the
stream end.

Env: `LLM_PROXY_SIGNING_KEY`, `V2_DEFAULT_MODEL`,
`V2_LLM_UPSTREAM_BASE_URL` (unset → `https://api.anthropic.com`),
`ANTHROPIC_API_KEY`, `AI_GATEWAY_API_KEY`, `OPENROUTER_API_KEY`,
`REDIS_URL`, `GENERATION_BILLING_MODE` (`off` skips the hold, the
checkpoints, the settle, and the proxy run and daily spend caps; the env
schema refuses `off` when `NODE_ENV=production`), `AI_USD_PER_CREDIT` (0.032, the credit
anchor the settle uses). Logs carry ids, tokens counts, micros, and
status — never a body, a token, or a provider key.

## Preview

`GET /api/v2/projects/:projectId/preview-token` mints the signed token
that opens the app preview on the preview domain `wanditpreview.app`
(D5, WANDIT-170). The route sits behind `V2BuilderEnabledGuard` and
`RedisRateLimitGuard` (30 requests per user per minute, key
`preview-token`). The project scope and `v2_app` engine checks are the
same as the versions routes: a missing, out-of-scope, or V1 project
answers 404. Minting is a read, so the route carries no
workspace-permission decorator.

The token is `base64url(JSON payload).base64url(HMAC-SHA256)`, minted by
`signPreviewToken` in `@wandit/contracts` with
`PREVIEW_TOKEN_SIGNING_KEY` and valid for 15 minutes
(`PREVIEW_TOKEN_TTL_SECONDS`). Claims: `pid` (project id), `rid`
(`sandbox_sessions.id`), `uid` (user id), `up` (the sandbox origin, for
example `https://x-5173.vercel.run`), `exp`, `jti`. The answer carries
`token`, `previewUrl`, and `expiresAt`.

The preview URL is
`https://r-<rid12>--p-<projectId>.<PREVIEW_DOMAIN>/?wt=<token>`, where
`rid12` is the first 12 hex characters of the run id. The Worker in
`apps/preview-proxy` parses that host, verifies the `wt` token, and sets
the `__Host-wandit_preview` cookie that carries it on later requests.

A `creating` or `stopped` sandbox row, or a running row without
`previewHost`, answers 409 `SANDBOX_NOT_RUNNING`. Each mint also calls
`sandbox_sessions.touchActivity`, so an open preview keeps the idle
sweep away. It also calls `SandboxProvider.keepAliveIfRunning`, because
the vendor timeout is absolute. A vendor failure there only logs
`preview.keep-alive.failed`; the token still answers.

`POST /api/v2/projects/:projectId/sandbox/wake` (`SandboxController`)
boots a sleeping sandbox without a turn, so the asleep note needs no paid
message. It needs `project:update` and has a `RedisRateLimitGuard` bucket
of 6 wakes per user per 10 minutes (key `sandbox-wake`). The scope checks
are the same as the versions routes. It answers 202 at once:
`running` (no boot), `starting` (a background boot started), or `busy`
(a turn, a restore, or a wake holds the project lock and boots the
sandbox). The boot holds the turn lock with a `wake:` holder for at most
10 minutes, so a turn submit during the boot answers 409
`BUILDER_TURN_ACTIVE`. The boot goes through `startSandboxWithoutTurn`,
like a restore and a publish: the egress inputs of a turn, no proxy
token, and the backend `.env` after a boot. A failed boot logs
`sandbox.wake-failed` and goes to Sentry. The route does not report it, so
the web shows a failure after a 3-minute wait.

`?client=phone` (WANDIT-193) mints the same token for the phone link of
Expo Go. It takes an optional `expoUsername` (`expoUsernameSchema`:
letters, digits, `.`, `_`, `-`, at most 64), which becomes the
`expoUsername` claim. Each phone mint logs `preview.phone-token.minted`
with `projectId` and `userId`. The web app then POSTs the token as a
plain-text body to `https://<run host>/__wandit/phone-link`. The Worker
writes `phone:<id>` to `PREVIEW_KV` for 60 minutes and answers
`{expoUrl: "exps://m-<id>--p-<projectId>.<PREVIEW_DOMAIN>", expiresAt}`.

Env: `PREVIEW_DOMAIN`, `PREVIEW_TOKEN_SIGNING_KEY`. The same
`PREVIEW_TOKEN_SIGNING_KEY` is the Worker secret; set it with
`wrangler secret put`. The two values must match, or every token fails
the signature check of the Worker.

## Device preview (WANDIT-196)

`POST /api/v2/projects/:projectId/device-sessions {platform}` starts an
Appetize device that runs the store Expo Go on the project. It sits behind
`V2BuilderEnabledGuard`, `RedisRateLimitGuard` (10 starts per user per
minute), and `@RequireWorkspacePermission("project", "update")`.
`DeviceSessionsService.start` checks, in order:

1. The project is a V2 `mobile-app` project in scope, else 404.
2. `APPETIZE_IOS_PUBLIC_KEY` or `APPETIZE_ANDROID_PUBLIC_KEY` is set, else
   503 `V2_ENV_MISSING`.
3. The payer has minutes left this UTC month (`DEVICE_MINUTES_PER_PLAN`:
   starter 0, pro 60, business 180, ESTIMATE), else 402
   `DEVICE_MINUTES_EXHAUSTED`. `device_sessions` rows count their billed
   minutes, or their elapsed minutes before the bill.
4. The user holds no open session: Redis `SET NX PX` on
   `mobile_preview:user:{userId}` for 17 minutes, else 409
   `DEVICE_SESSION_OPEN`.
5. A phone preview token mints a 60-minute phone link through the Worker,
   and Metro answers `/status` through it, else 409 `SANDBOX_NOT_RUNNING`
   or `METRO_NOT_READY`. A failure here frees the lock.

The answer is the Appetize client config: `publicKey`, `device`,
`osVersion`, `launchUrl` (`exps://<phone host>`), the Expo Go `params`,
and `timeLimitSeconds` (900). `POST .../device-sessions/:id/end` stores
the Appetize `session.token` once and frees the lock; a token that another
row holds answers 409 `APPETIZE_SESSION_TAKEN`.

The `device-minutes` Trigger task runs every 5 minutes on
`meteringMaintenanceQueue` (concurrency 1). It bills each ended or stale
row once from the Appetize session log (`closeTime - startTime`, rounded
up), or from its own clock when the log is missing. It writes one
`mobile_preview` event through `MeteringService.recordFreeUsage`: zero
credits, status `reconciled`, and one `appetize` evidence row at $0.06 per
minute. `pnpm appetize:upload-expo-go` uploads the Expo Go builds. See
`docs/v2/spikes/P5-02-appetize.md`.

Env: `APPETIZE_API_TOKEN` (server and Trigger.dev),
`APPETIZE_IOS_PUBLIC_KEY`, `APPETIZE_ANDROID_PUBLIC_KEY`.
