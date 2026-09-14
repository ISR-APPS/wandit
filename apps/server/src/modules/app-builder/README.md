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
| `infrastructure/trigger/` | WANDIT-166/167: the `ui` stream writer/reader |
| `infrastructure/persistence/` | WANDIT-163: V2 schema spec; WANDIT-164: `sandbox_sessions` repository |
| `presentation/http/controllers/` | WANDIT-162: health; WANDIT-167: turn routes; WANDIT-175: `POST /api/v2/projects` |
| `presentation/http/guards/` | WANDIT-162: `V2BuilderEnabledGuard` |
| `application/` | WANDIT-166: the builder-turn task; WANDIT-169: host tools; WANDIT-171: versions; WANDIT-174: money; WANDIT-183: backends; WANDIT-165: the LLM proxy |

## Ports (`domain/ports/`)

- `SandboxProvider` — one persistent sandbox per project: exec, files,
  ports, preview URL, the harness session.
- `BuilderHarness` — the coding agent: create/resume a session, stream one
  turn, detach into `HarnessResumeState`.
- `HostToolRegistry` — the host-side tools the agent may call during a
  turn.
- `TurnEventWriter` / `TurnEventReader` — the two ends of the `ui` stream
  (D20).
- `TurnLock` — the per-project lock serializing turns.
- `BackendProvider` — the hidden Supabase project behind an app (D18).
- `GitStore` / `RepoRestorer` — the code.storage repository and its push
  back into a fresh sandbox (D21).

## Sandbox

Each V2 project owns one named sandbox on Vercel Sandbox (D1): region
`cdg1`, 2 vCPU / 4 GB, the custom image named by `VERCEL_SANDBOX_IMAGE`
(`tooling/sandbox-image/` builds it). The `sandbox_sessions` row tracks
the lifecycle; the partial unique index guarantees at most one live row
per project.

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

- `POST /` creates a turn — credit hold first, then the session, the
  lock, the `queued` row, the user message, and the task handoff — and
  answers with the turn's own stream: the `data-turn-created` part first,
  then the relayed chunks. A parked `waiting` row streams as soon as
  promotion gives it a run.
- `GET /:turnId/stream` relays one turn's stream; `204` while the row has
  no run id.
- `GET /active/stream` is the `useChat` reconnect route: the active
  turn's stream, or `204` when the project has none. A row whose run id
  is not written yet streams through the row poll instead of `204`.
- `POST /:turnId/cancel` CAS-moves the row to `cancelling`, cancels the
  run best-effort, releases the lock, settles to `canceled`, refunds the
  hold, and promotes the oldest `waiting` turn.

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
- Credit holds use `attemptRef = turnId`; every failure path refunds the
  hold before the error leaves the service.
- The task handoff is idempotent on `builder-turn:{turnId}` (TTL 1 h), so
  a retried create or a promoted requeue can never start a twin run.
- Only `infrastructure/trigger/` may import the Trigger streams API;
  `trigger-isolation.spec.ts` enforces this.
- `TurnStreamRelayService` copies the V1 SSE socket handling: 15 s
  heartbeats, backpressure on `drain`, error frames on reader failure.

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
  when `.git` exists, `git clone` when `/vercel/sandbox/workspace` is
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
lands before the Redis counters, so a failed insert never inflates spend;
WANDIT-174 reconciles counters against the table.

Token revocation: the builder-turn task (WANDIT-166) calls `revokeRun`
when the turn completes or fails; the API calls it on cancel and on the
stream end.

Env: `LLM_PROXY_SIGNING_KEY`, `V2_DEFAULT_MODEL`,
`V2_LLM_UPSTREAM_BASE_URL` (unset → `https://api.anthropic.com`),
`ANTHROPIC_API_KEY`, `AI_GATEWAY_API_KEY`, `OPENROUTER_API_KEY`,
`REDIS_URL`. Logs carry ids, tokens counts, micros, and status — never a
body, a token, or a provider key.
