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
| `domain/errors/` | WANDIT-162: `V2BuilderDisabledError`, `SandboxForkNotSupportedError` |
| `infrastructure/env/` | WANDIT-162: `requireV2Env` call-time checks |
| `infrastructure/sandbox/` | WANDIT-164: the Vercel `SandboxProvider`, env builder, template init |
| `infrastructure/git/` | WANDIT-164: `LoggingRepoRestorer` placeholder; WANDIT-171: code.storage |
| `infrastructure/redis/` | WANDIT-167: the Redis `TurnLock` |
| `infrastructure/git/` | WANDIT-152/171: `CodeStorageGitStore`, `commitTurn`, `CodeStorageRepoRestorer` |
| `infrastructure/trigger/` | WANDIT-166/167: the `ui` stream writer/reader; WANDIT-175: the `delete-app-project` starter |
| `infrastructure/template/` | WANDIT-175: `TemplateVersionService` (reads `templates/web-app/template_version`) |
| `infrastructure/mappers/` | WANDIT-175: `mapAppProjectRow` |
| `infrastructure/persistence/` | WANDIT-163: V2 schema spec; WANDIT-164: `sandbox_sessions` repository; WANDIT-175: `audit_events` repository |
| `presentation/http/controllers/` | WANDIT-162: health; WANDIT-167: turn routes; WANDIT-174: cost caps; WANDIT-175: `POST /api/v2/projects` |
| `presentation/http/guards/` | WANDIT-162: `V2BuilderEnabledGuard` |
| `application/` | WANDIT-166: the builder-turn task; WANDIT-169: host tools; WANDIT-171: versions; WANDIT-174: money; WANDIT-183: backends; WANDIT-165: the LLM proxy |

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
- `BackendProvider` — the hidden Supabase project behind an app (D18).
- `GitStore` / `RepoRestorer` — the code.storage repository and its push
  back into a fresh sandbox (D21).

## Sandbox

Each V2 project owns one named sandbox on Vercel Sandbox (D1): region
`cdg1`, 2 vCPU / 4 GB, the vendor default image `vercel/sandbox/node:22`
(`VERCEL_SANDBOX_IMAGE` is unset; `tooling/sandbox-image/` is ready but
not selected). The `sandbox_sessions` row tracks the lifecycle; the
partial unique index guarantees at most one live row per project.

- `getOrCreate` is the only entry: it creates (row `creating` → `running`),
  reuses a live sandbox, and resumes a stopped one from its vendor
  snapshot. `resume` takes the same options — the caller always rebuilds
  the env from the `projects` and `app_backends` rows plus the per-run
  proxy token; the provider never reads `app_backends`.
- `stop` keeps the last snapshot (`keepLastSnapshots: 1`) and marks the
  row stopped. `destroy` deletes sandbox, snapshots, and the live row.
  `fork` throws `SandboxForkNotSupportedError` until P6 (D13).
- Rebuild rule: the vendor snapshot is a disk cache; the git copy on
  code.storage is the source of truth (D21). When the named sandbox or its
  snapshot is gone, the provider boots a fresh one, applies the template
  archive (`ArchiveTemplateInit`), calls `RepoRestorer`, and logs a
  `rebuild` warning. `LoggingRepoRestorer` is the placeholder until
  WANDIT-171.
- Env allow-list: `buildSandboxEnv` emits only `SANDBOX_ENV_ALLOW_LIST`
  names — the per-run proxy values, `VITE_SUPABASE_URL`,
  `VITE_SUPABASE_ANON_KEY`, and `WANDIT_PREVIEW_HOST`. `ANTHROPIC_API_KEY`
  is always written empty; `VERCEL_SANDBOX_TOKEN`, signing keys, and
  service-role keys can never enter the sandbox.
- Egress is deny-by-default: `buildNetworkPolicy` emits the global allow
  list (`registry.npmjs.org`, `*.supabase.co`, fonts, `api.stripe.com`,
  `api.resend.com`, `maps.googleapis.com`, `api.openai.com`) plus the
  proxy host of `ANTHROPIC_BASE_URL`, the `<org>.code.storage` git host,
  the `R2_PUBLIC_BASE_URL` host, and the per-project hosts from
  `projects.networkAllowedHosts` (layer 3). `SANDBOX_DENIED_RANGES`
  blocks link-local metadata, private, CGNAT, and loopback CIDRs (IPv4
  only — the vendor API rejects IPv6 CIDRs).
- `V2_SANDBOX_EGRESS_MODE` selects the mode: `strict` (default) applies
  the allow list; `open` allows every host but keeps the deny ranges —
  the fallback when the allow list breaks a turn. Every start logs
  `sandbox.network-policy.applied` with mode, host count, and rejected
  names (warn in `open`).
- `handle.setNetworkPolicy` replaces the whole vendor policy on the live
  sandbox without a restart; a resume or reuse re-pushes it through the
  same call so a changed list reaches a running VM.
- `handle.allowHost(host)` adds one host to the live allow list, for the
  `request_network_host` tool. It merges the host into the applied
  policy and routes through the live harness session, so the proxy
  run-token transformation the session added stays in place.
- On every boot the provider adds `HOST=0.0.0.0` and a fresh
  `WANDIT_PREVIEW_HOST` (the current vendor host of `devPort`) to the dev
  command env; the vendor route only reaches a `0.0.0.0` listener.
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
  than `SANDBOX_IDLE_STOP_MINUTES` (20). Turn start/end and preview
  heartbeats call `touchActivity`; an old stamp means no turn and no
  preview traffic.

## Lock rule

The API sets and releases the Redis key `builder:lock:{projectId}` with a
compare-and-delete; the running task only refreshes it.

## Turn API (WANDIT-167)

Four routes under `/api/v2/projects/:projectId/turns`, all behind
`V2BuilderEnabledGuard` and the workspace `project:update` permission:

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
  `approval`; a turn paused on a question takes the message text as the
  answer.
- `GET /:turnId/stream` relays one turn's stream; `204` while the row has
  no run id.
- `GET /active/stream` is the `useChat` reconnect route: the active
  turn's stream, or `204` when the project has none. A row whose run id
  is not written yet streams through the row poll instead of `204`.
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

- `POST /` refuses `mobile` (WANDIT-192), checks attachments and the
  settled balance, then writes the project row (`engine = 'v2_app'`), the
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
seven steps, each in its own try/catch. It cancels the active turn's
run, destroys the vendor sandbox, and holds the WANDIT-183/184 backend
seam. Then it drains the two `v2ProjectPrefixes` and deletes the
code.storage repository. The prefixes are `git/<id>/` and
`sites/<id>/assets/`, never `published/` — WANDIT-178 owns that root.
It writes one `audit_events` row with each step's outcome and sends
`v2_project_deleted`. The starter binds null when V2 is off, so a V1
deploy never builds it.

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
   turn before any sandbox work. The model is `turn.model ??
   V2_DEFAULT_MODEL`; a missing one fails the turn `model_missing`.
2. Reads the cost caps (`ProjectCostCapsRepository`) and the plan;
   computes `capUsd` for the token claims from `perTurnCapCredits` — the
   row value or `DEFAULT_PER_TURN_CAP_CREDITS` (5000 cc). The pre-start
   stop rules throw into `failTurn`: the builder flag off →
   `stopped_disabled`, a settled balance at 0 → `stopped_no_credits`,
   the monthly cap already reached → `stopped_project_cap`.
3. Mints the scoped proxy token (`mintLlmProxyToken`) with the run, turn,
   user, project, workspace, and plan claims.
4. Builds the allow-listed env (`buildSandboxEnv`): the run token becomes
   `ANTHROPIC_AUTH_TOKEN`, the proxy URL `ANTHROPIC_BASE_URL`, the run id
   `ANTHROPIC_CUSTOM_HEADERS`; the real `ANTHROPIC_API_KEY` is forced to
   an empty string.
5. Wakes or creates the sandbox (`sandboxes.getOrCreate`) and touches
   `sandbox_sessions` activity so the idle sweep leaves it alone.
6. Loads the `builder_sessions` row (`findByChatId`) the API created at
   turn create, then creates or resumes the `HarnessAgent` session
   through `createBuilderHarness`; a stored `resumeState` means resume, a
   harness mismatch is a failure. A `waiting_for_*` row of the project
   moves to `succeeded` first — this run is its answer. When the stored
   state holds pending cards, the turn streams a `continue` input: the
   message text answers the first question (a matching option label
   becomes its id, other text becomes a freeform answer), `spec.approval`
   answers the approval card (an unnamed approval counts as denied). A
   session that cannot resume starts fresh and hears the answer as plain
   text.
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
   the balance and cap checks.
8. Streams harness parts: each `part` goes to the `ui` Trigger stream
   (`TriggerTurnEventWriter`) and to a `readUIMessageStream`
   reconstruction. Harness `usage` events only feed the
   `builder-turn.harness-usage` log line; the money path never reads
   them.
9. On stream end `hasUnfinishedTurn` picks the path. A paused turn runs
   `suspendTurn` instead of `detach`: one `data-question` or
   `data-approval` stream part and message part per pending card, the row
   completes as `waiting_for_answer` (`waiting_for_approval` when a
   card is an approval), and the suspended state lands on the session
   row. A finished turn completes as `succeeded`. Both paths share the
   same tail: `commitTurn` commits the workspace (a commit failure only
   costs the commit, not the turn), a `files` event carries the numstat,
   `insertTurnAssistantMessage` persists the assistant message with
   usage (the proxy row sums) and commit metadata, and the resume state
   is saved on the session row.
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
    oldest `waiting` turn, and `touchActivity` runs once more. The
    runtime `finally` only stops the timers and closes the host tools;
    the task `finally` closes the event writer, the two Redis clients,
    and the pool.

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
- `request_network_host` (WANDIT-180) asks to reach one extra egress
  host. It is `"user-approval"`, so the user approves first; the body
  runs only on approval. It checks the host with `isValidNetworkHost`,
  appends it to `projects.networkAllowedHosts` (a deduping write), calls
  `SandboxHandle.allowHost` to apply it to the live sandbox with no
  restart, and writes a `network.host_allowed` audit row. `allowHost`
  routes through the live harness session, so the proxy run-token
  transformation survives. A bad host or a failed update answers
  `denied` and writes no audit row. See `docs/v2/security.md` section 5.
- Approval state comes back in `toolApproval`; a tool with
  `"user-approval"` pauses the stream on an approval request the same
  way `askUserQuestions` pauses for an answer. `generate_image` is
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
  `iat`, `exp`. A git credential carries `git:read` + `git:write` for one
  repository only, so a project token cannot touch another project's
  code. A repository-admin call carries `repo:write` (TTL 300 s); a push,
  pull, or clone credential lives 600 s.
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
  compare-and-swap on the previous head. A head mismatch answers 409
  `VERSION_CONFLICT`.
- A fresh sandbox restores the code through `RepoRestorer`: `git pull`
  when `.git` exists, `git clone` when the sandbox workspace (`<vendor cwd>/workspace`) is
  empty, and an in-place `init` + `fetch` + `reset --hard` + `clean -fd`
  when the template files are already unpacked.
- A restore is copy-forward: `git read-tree -u --reset <sha>` sets the
  worktree to the old content and a NEW commit lands on top
  (`source = 'restore'`, `restored_from_sha` points at the target).
  History never rewinds.
- Routes: `GET /api/v2/projects/:id/versions` (cursor, max 50),
  `GET .../versions/:sha/diff`, `POST .../versions/:sha/restore` (409
  `BUILDER_TURN_ACTIVE` while a turn runs).

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
5. **Daily user cap.** Redis `llm:spend:user:{userId}:{yyyymmdd}` micros vs
   `LLM_PROXY_DAILY_USER_CAP_USD` ($50, ESTIMATE until WANDIT-174). Over:
   402 `V2_DAILY_CAP_REACHED` and a `cap_rejected` row.

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
(the stranded-hold sweep) gives `agent_session` holds a 90-minute stale
window (`AGENT_SESSION_STALE_AFTER_MS`); other operations keep 40
minutes. The `sandbox` operation sits in the registry — measured per
minute, rate zero, `customerBillable: false` — and has no writer before
WANDIT-196.

Token revocation: the builder-turn task (WANDIT-166) calls `revokeRun`
when the turn completes or fails; the API calls it on cancel and on the
stream end.

Env: `LLM_PROXY_SIGNING_KEY`, `V2_DEFAULT_MODEL`,
`V2_LLM_UPSTREAM_BASE_URL` (unset → `https://api.anthropic.com`),
`ANTHROPIC_API_KEY`, `AI_GATEWAY_API_KEY`, `OPENROUTER_API_KEY`,
`REDIS_URL`, `GENERATION_BILLING_MODE` (`off` skips the hold, the
checkpoints, and the settle), `AI_USD_PER_CREDIT` (0.032, the credit
anchor the settle uses). Logs carry ids, tokens counts, micros, and
status — never a body, a token, or a provider key.
