# Agent runtime patterns for a long-lived coding agent per project — research report

Date: 2026-09-03. Branch: `feat/v2-builder` (identical to `dev` at commit `1b2a9a1e`).
Author: Claude Fable research agent (read-only; no code changed).

Evidence marks: `path:line` = read in this worktree. URL = fetched on 2026-09-03 unless marked. `UNVERIFIED` = not confirmed from a primary source. `OLD` = source older than 12 months.

Related reports in this folder: `ai-sdk-harness.md` (harness API and Claude Agent SDK), `sandboxes.md` (sandbox providers), `competitor-architectures.md` (Lovable, v0, Bolt, Base44), `inspect-ai-pipeline.md` (V1 pipeline map), `inspect-web-builder-ui.md` (V1 web client).

---

## 0. Summary

1. Every serious product in this space runs the coding harness **inside the sandbox** and keeps a thin host process that only relays events. The AI SDK v7 Claude Code adapter does this with a WebSocket bridge (https://ai-sdk.dev/providers/ai-sdk-harnesses/claude-code). Claude Code on the web does this with Anthropic-managed VMs (https://code.claude.com/docs/en/claude-code-on-the-web). v0 does this with Vercel Sandbox (https://v0.app/docs/sandbox). OpenCode is a server that the TUI talks to over HTTP and SSE (https://opencode.ai/docs/server/).
2. The alternative, "app server drives sandbox tools remotely", is what wandit V1 does today with `ToolLoopAgent` and hand-built tools (`apps/server/src/modules/ai-chat/agent/site-builder/site-builder-agent.ts`). It gives full control but every tool, every file system, and every edit engine must be hand-built. V1 already shows the cost of that path (`docs/v2/research/inspect-ai-pipeline.md` §0).
3. Session state has two parts: the **conversation** (Claude Code `~/.claude/projects/<cwd>/<session-id>.jsonl`) and the **filesystem**. The harness adapter keeps both in the sandbox working directory so a persistent sandbox snapshot restores them together (https://raw.githubusercontent.com/vercel/ai/main/packages/harness-claude-code/src/claude-code-bootstrap.ts). Vercel Sandbox persistence is the default; stop auto-snapshots and any SDK call auto-resumes (https://vercel.com/docs/sandbox/concepts/persistent-sandboxes, last_updated 2026-08-25).
4. For streaming to the browser there are four workable transports. (a) AI SDK `useChat({ resume: true })` + `resumable-stream` on Redis; the client re-attaches with a GET (https://ai-sdk.dev/docs/ai-sdk-ui/chatbot-resume-streams). (b) Trigger.dev Realtime streams v2: unlimited length, 300 MiB per stream, 28 days retention, automatic resume by cursor (https://trigger.dev/docs/tasks/streams). (c) A Redis Stream per turn with `XADD`/`XREAD` and `Last-Event-ID`; wandit already has this relay code (`apps/server/src/modules/generation/application/services/chat-stream-relay.service.ts:26-127`). (d) WebSockets on Cloudflare Durable Objects with hibernation; the Agents SDK `AIChatAgent` gives "automatic resumable streaming" (https://developers.cloudflare.com/agents/api-reference/agents-api/).
5. Run the turn as a background job, not in the HTTP request. Trigger.dev gives `signal` in `run()`, `onCancel` with a 30 s budget, `runs.cancel(runId)`, `concurrencyKey` for a per-project queue of size 1, `idempotencyKey`, and machines up to 8 vCPU / 16 GB (https://trigger.dev/docs/tasks/overview, https://trigger.dev/docs/queue-concurrency, https://trigger.dev/docs/machines). Inngest cannot stop a running step: "Any actively executing steps will run to completion" (https://www.inngest.com/docs/features/inngest-functions/cancellation). BullMQ has `worker.cancelJob(jobId)` and an `AbortSignal` in the processor but needs a worker service that wandit no longer runs (https://docs.bullmq.io/guide/workers/cancelling-jobs; `docs/v2/research/inspect-infra-ops.md` line 14).
6. Concurrency: one active turn per project. Do it twice: a Trigger.dev queue with `concurrencyKey: projectId` and `concurrencyLimit: 1`, plus an application lock (`SET key token NX PX ttl` in Redis or `pg_try_advisory_lock`) that returns 409 `AI_CHAT_TURN_ACTIVE` as V1 already does (`ai-chat.service.ts:455-483`).
7. Checkpoint partial work with git inside the sandbox: one commit per turn on a project branch, plus a `versions` row that points at the commit. v0 does "every code-changing message auto-commits" (https://vercel.com/blog/introducing-the-new-v0). Lovable makes a version per change and can revert code only (https://docs.lovable.dev/features/projects/history). Claude Agent SDK file checkpointing (`enableFileCheckpointing`, `rewindFiles`) only covers Write/Edit, not Bash, so git is the safer base (https://code.claude.com/docs/en/agent-sdk/file-checkpointing).
8. Changed files: use `PostToolUse` hooks for the live list (tool name + input path per Write/Edit/Bash) and `git status --porcelain=v2 -z` after the turn for the truth (https://code.claude.com/docs/en/agent-sdk/hooks, https://git-scm.com/docs/git-status). Claude Code on the web computes its `+42 -18` diffs "from raw git blob content" (https://code.claude.com/docs/en/claude-code-on-the-web).
9. Auto-fix loops need three inputs: dev-server stdout/stderr (detached command logs), browser console + `pageerror` from a Playwright page in the sandbox, and build/typecheck output. V1 already captures `pageerror`, `console`, `requestfailed`, and `response` in `apps/server/src/modules/ai-chat/agent/site-builder/screenshot.ts:110-122`. Lovable's "Try to fix" "scans the logs, finds the issue, and attempts a fix" and most verification tools "run only when you ask for them" (https://docs.lovable.dev/tips-tricks/troubleshooting, https://docs.lovable.dev/features/modes).
10. Recommended design for this stack: the API (NestJS + Fastify) admits the turn and writes a `builder_turns` row; a Trigger.dev task `builder-turn` on a per-project queue owns the `HarnessAgent` session, pipes the UI message stream to a Trigger.dev v2 stream **and** to a Redis Stream keyed by turn; the web client uses a custom `ChatTransport` whose `reconnectToStream` replays from Redis by `Last-Event-ID`; the dev server and a Playwright page live in the sandbox as detached commands; the turn ends with `git commit`, `git status --porcelain=v2`, a screenshot, and a `versions` row. Section 16 gives the details.

---

## 1. Repo baseline: what V1 already has

| Concern | V1 today | Evidence |
|---|---|---|
| Chat transport | AI SDK UI-message SSE over `fetch`, one POST per turn, `reply.hijack()` then `pipeUIMessageStreamToResponse` | `apps/server/src/modules/ai-chat/presentation/http/controllers/ai-chat.controller.ts:149`; `apps/server/src/modules/ai-chat/application/services/ai-chat.service.ts:1453` |
| Client | `useChat` + `DefaultChatTransport` with a custom fetch | `apps/web/src/features/workspace/lib/use-ai-chat.ts:166-220`; `apps/web/src/features/workspace/lib/status-preserving-chat-transport.ts` |
| Turn admission | per-actor slot (max 3), turn key `ai-chat:{chatId}:{requestId}` with 409 `AI_CHAT_TURN_ACTIVE`, cross-replica lease TTL 5 min / heartbeat 60 s | `ai-chat.service.ts:180-201`, `:455-483`, `:601-621` |
| Background work | Trigger.dev `generate-page` task, `machine: "medium-1x"`, `maxDuration: 1800`, `retry.maxAttempts: 1` | `docs/v2/research/inspect-ai-pipeline.md` §5 (`apps/server/src/trigger/generate-page.task.ts:82-91`) |
| Progress to browser | `useRealtimeRun(runId, { accessToken })` + 5 s `useRun` poll fallback, reads `run.metadata.progress` | `apps/web/src/features/workspace/lib/use-live-run.ts:73-93` |
| Stall watchdog | abort controller combined with the task signal; production builds stalled 13 min; OpenRouter idle-times at ~3 min | `docs/v2/research/inspect-ai-pipeline.md` §6.3 (`generate-page.task.ts:1472-1544`) |
| Resumable SSE (legacy) | Redis Streams `XADD` per event, `XREAD BLOCK 5000` relay, `Last-Event-ID` replay | `apps/worker/src/infrastructure/redis/chat-events.publisher.ts:152-153`; `chat-stream-relay.service.ts:26-127`; `apps/server/src/modules/generation/presentation/http/controllers/chats.controller.ts:138-191` |
| Screenshots | Playwright Chromium in the Trigger.dev image; page listeners for `pageerror`, `console`, `requestfailed`, `response` | `apps/server/src/modules/ai-chat/agent/site-builder/screenshot.ts:80`, `:110-122`, `:189` |
| Versioning | immutable `versions` rows in Postgres, HTML in R2 under `sites/{projectId}/{versionId}/` | `docs/v2/research/inspect-ai-pipeline.md` §0 |
| Redis | Railway `redis:8.2.9` in `sfo`; API in `europe-west4` (cross-Atlantic round trips) | `docs/v2/research/inspect-infra-ops.md` line 113 |
| Dependencies | `ai@^7.0.19`, `@trigger.dev/sdk@4.5.3`, `bullmq@^5.79.2`, `ioredis@^5.11.1`, `@nestjs/platform-fastify@^11.1.27` | `apps/server/package.json:23-54` |

Two consequences. First, the admission, lease, and 409 code is reusable as the per-project lock (section 6). Second, the legacy Redis Stream relay is a working template for a resumable event log (section 4.3). The `apps/worker` BullMQ service has no Railway deployment (`docs/v2/research/inspect-infra-ops.md` line 14), so the relay code would move into the API or a Trigger.dev task.

---

## 2. Where the harness process runs

### 2.1 Three patterns

**Pattern A — harness inside the sandbox, host relays.** The host creates the sandbox, installs the harness, and talks to it over a socket. This is the AI SDK harness model: "The adapter runs a bridge inside the sandbox and streams Claude Code events back to the host over a sandbox-exposed WebSocket" (https://ai-sdk.dev/providers/ai-sdk-harnesses/claude-code). The bridge bootstrap installs `@anthropic-ai/claude-agent-sdk@0.3.245` + `@anthropic-ai/claude-code@2.1.245` inside the sandbox with `pnpm install --frozen-lockfile` (`docs/v2/research/ai-sdk-harness.md` §2.9). Claude Code on the web runs "in an isolated, Anthropic-managed VM" and the browser only follows the session (https://code.claude.com/docs/en/claude-code-on-the-web). OpenCode: "When you run `opencode` it starts a TUI and a server. Where the TUI is the client that talks to the server" (https://opencode.ai/docs/server/).

**Pattern B — agent loop on the app server, tools call into the sandbox.** The model loop runs in the API or job process. Each tool (`read`, `write`, `bash`) is an RPC into the sandbox (`sandbox.runCommand`, `sandbox.fs.writeFile`, https://vercel.com/docs/sandbox/sdk-reference). This is V1's `ToolLoopAgent` with an in-memory VFS (`docs/v2/research/inspect-ai-pipeline.md` §5). `@ai-sdk/sandbox-just-bash` is the AI SDK version of this for harnesses that do not need a network sandbox; Claude Code is not one of them (`docs/v2/research/ai-sdk-harness.md` §2.9).

**Pattern C — hosted agent service.** Anthropic Managed Agents (agent + environment + session, $0.08 per session-hour plus tokens, beta, no harness adapter) and Claude Code on the web (no public API for third-party products; "Rate limits: Claude Code on the web shares rate limits with all other Claude and Claude Code usage within your account") (`docs/v2/research/ai-sdk-harness.md` §4; https://code.claude.com/docs/en/claude-code-on-the-web). Not usable as the engine of a product that bills its own users.

### 2.2 Trade-offs

| Criterion | A: harness in sandbox | B: server-side loop + remote tools |
|---|---|---|
| Tool latency | Local disk and shell; one round trip per turn event | One network round trip per tool call; a 40-step turn is 40+ RPCs |
| Tool coverage | Full Claude Code toolset (Read, Write, Edit, Bash, Glob, Grep, Agent, WebFetch, hooks, skills, subagents) for free | Every tool is hand-built; V1 has 5 builder tools and 7 edit tools (`inspect-ai-pipeline.md` §3.3, §5) |
| Host process load | Small: one WebSocket per active session | Large: the model loop, tool execution, and repair logic run in the host; V1 needs a 1 h undici timeout for it (`apps/server/src/modules/ai-chat/agent/gateway-fetch.ts:12-38`) |
| Host crash mid-turn | Harness keeps running in the sandbox; the bridge buffers with `lastSeenEventId` and the host can reattach with `resumeFrom` (`ai-sdk-harness.md` §2.7). Host-tool calls in flight are lost. | Turn dies with the host; needs its own checkpoint/replay |
| Sandbox pause | Session files are on the sandbox disk; a snapshot restores them | State lives in the host DB; sandbox is stateless |
| Secrets | Model key must reach the sandbox or be proxied; the adapter supports `credentialForwarding` and placeholder rewriting (`ai-sdk-harness.md` §2.9) | Model key never leaves the host |
| Lock-in | Adapter ties you to the harness's event shapes; `@ai-sdk/harness` is "experimental. Expect breaking changes" (https://ai-sdk.dev/docs/ai-sdk-harnesses/overview) | Own code; slow to extend |
| Cost | Sandbox CPU while the harness thinks (it is mostly idle waiting on the model; Vercel bills Active CPU, `sandboxes.md` §5.1) | Host CPU |
| Observability | `PostToolUse`/`Stop` hooks, `stream_event` partial messages, `total_cost_usd` estimates (`ai-sdk-harness.md` §3.3, §3.9) | Full control, but nothing is free |

Verdict: Pattern A for the code-editing agent. Keep Pattern B only for wandit product tools that must run on the host (credits, leads, publish, connectors); the harness exposes host tools to Claude as the `mcp__harness-tools__<name>` in-process MCP server (`ai-sdk-harness.md` §2.5).

### 2.3 Where the *host* of Pattern A runs

The host is the process that holds the `HarnessAgent` session object and the WebSocket to the bridge. Options for this stack:

1. **Inside the API request** (V1 style). Simple, but a Fastify request cannot outlive a Railway deploy or a client disconnect, and the 1 h undici timeout in V1 shows how fragile this is (`gateway-fetch.ts:12-38`).
2. **Inside a Trigger.dev task** (recommended). The task is a long-lived Node process with `signal`, `onCancel`, `maxDuration`, and `machine` (https://trigger.dev/docs/tasks/overview). Trigger.dev already bundles from `apps/server/src/trigger` (`docs/v2/research/inspect-infra-ops.md` line 126). Caveat: a task that calls `wait.*` for longer than "a few seconds" gets checkpointed and its machine stopped; open WebSockets die (https://trigger.dev/docs/wait). So the turn task must not use `wait.forToken` for approvals while the bridge socket is open; use `session.detach()` first (section 5.4).
3. **A dedicated "session host" service** (a Railway service that keeps sessions attached across turns). Best latency, but a new deployable and a new failure domain. Defer.

---

## 3. Keeping Claude Code session state across turns and pauses

### 3.1 What state exists

- **Conversation transcript**: `~/.claude/projects/<encoded-cwd>/<session-id>.jsonl` (or `$CLAUDE_CONFIG_DIR/projects/`). `resume: sessionId`, `continue: true`, `forkSession: true`. (https://code.claude.com/docs/en/agent-sdk/sessions; `ai-sdk-harness.md` §3.7)
- **Harness bridge state**: `claudeSessionId`, `bridge.port`, `bridge.token`, `bridge.lastSeenEventId`, `sandboxCredentialEnvironment` in the opaque resume state (`ai-sdk-harness.md` §2.7).
- **Filesystem**: the project checkout, `node_modules`, `.harness-bootstrap/claude-code/` (installed CLI), and the dev server's cache.
- **Processes**: dev server, Playwright, Metro. Processes never survive a snapshot: Vercel snapshots "capture the state of a running sandbox, including the filesystem and installed packages" and nothing else is claimed (https://vercel.com/docs/sandbox/concepts/snapshots, last_updated 2026-08-26). Claude Code on the web says the same about expiry: "Background work that was still running when the VM was reclaimed, such as subagents and shell commands, isn't restored" (https://code.claude.com/docs/en/claude-code-on-the-web).

### 3.2 Lifecycle mapping

| Situation | Harness call | Sandbox state | Cost |
|---|---|---|---|
| Between two chat turns, user still active | `session.detach()` → resume state; "parks the runtime and sandbox, returns resume state, and keeps the sandbox warm for a later attach" (https://ai-sdk.dev/docs/ai-sdk-harnesses/harness-agent) | Running; dev server stays up | Full sandbox billing |
| User idle N minutes | `session.stop()` → "saves resume state, then stops the runtime and sandbox" | Persistent sandbox auto-snapshots on stop (https://vercel.com/docs/sandbox/concepts/persistent-sandboxes) | Snapshot storage $0.08/GB-month (`sandboxes.md` §5.1) |
| User returns | `createSession({ sessionId: chatId, resumeFrom })`; provider must implement `resumeSession` (`ai-sdk-harness.md` §2.7). `Sandbox.get({ name })` then "any SDK call auto-resumes" | New session boots from the last snapshot with a fresh session timeout | Boot time + re-start of dev server via `onResume` hook |
| Host process died mid-turn | `createSession({ sessionId, continueFrom })` after `suspendTurn()`; `hasUnfinishedTurn()` (https://ai-sdk.dev/docs/ai-sdk-harnesses/harness-agent). The docs do not describe an unplanned host death; treat as UNVERIFIED and design for "abort and retry the turn" | Unchanged | — |
| Project abandoned > 30 days | delete sandbox | Snapshots expire "30 days after their last use" by default; sandboxes that cannot resume are removed after 14 days of inactivity (https://vercel.com/docs/sandbox/concepts/persistent-sandboxes) | 0 |

Set `keepLastSnapshots: { count: 1 }` on every project sandbox; it is "the recommended setting when you only care about the latest snapshot" (same page).

### 3.3 Transcript durability outside the sandbox

Two reasons to mirror the transcript out of the sandbox: (a) the snapshot can expire or fail (`status: failed`), and (b) moving a project to another region or provider. The Claude Agent SDK `SessionStore` adapter (`append`, `load`, `delete`...) dual-writes the transcript to S3/Redis/Postgres and a run resumed from the store deletes its local copy; it conflicts with `persistSession: false` and with file checkpointing (https://code.claude.com/docs/en/agent-sdk/session-storage; `ai-sdk-harness.md` §3.7). The harness bridge calls `query()` itself, so whether `sessionStore` can be passed through the adapter is UNVERIFIED. Fallback: `tar` the `~/.claude/projects/<cwd>` directory to R2 at the end of every turn from the task (cheap, provider-neutral).

### 3.4 Important semantic

"A harness session owns its native conversation history. When you pass `messages`, `HarnessAgent` takes the latest user message as fresh input" (https://ai-sdk.dev/docs/ai-sdk-harnesses/harness-agent). So V2 must **not** resubmit the full transcript as V1 does (`ai-chat.controller.ts:122-132`). Postgres keeps the display copy of messages; the harness keeps the model copy.

---

## 4. Streaming agent events to the browser and reconnecting

### 4.1 The AI SDK v7 client contract

`ChatTransport` has exactly two methods (https://raw.githubusercontent.com/vercel/ai/main/packages/ai/src/ui/chat-transport.ts):

```ts
sendMessages(options: { trigger: 'submit-message' | 'regenerate-message'; chatId: string; messageId: string | undefined; messages: UI_MESSAGE[]; abortSignal: AbortSignal | undefined } & ChatRequestOptions): Promise<ReadableStream<UIMessageChunk>>;
reconnectToStream(options: { chatId: string; abortSignal?: AbortSignal } & ChatRequestOptions): Promise<ReadableStream<UIMessageChunk> | null>;
```

`useChat({ resume: true })` calls `reconnectToStream` on mount; `DefaultChatTransport` maps it to `GET /api/chat/[id]/stream` and accepts `prepareReconnectToStreamRequest` to change the URL and headers (https://ai-sdk.dev/docs/ai-sdk-ui/chatbot-resume-streams, https://ai-sdk.dev/docs/ai-sdk-ui/transport). `useChat` also exposes `stop()`, `resume()`, `status: 'submitted' | 'streaming' | 'ready' | 'error'`, `addToolApprovalResponse({ id, approved })`, `addToolOutput`, `onData`, and `throttle` (https://ai-sdk.dev/docs/reference/ai-sdk-ui/use-chat). Custom parts: `writer.write({ type: 'data-<name>', id, data })` reconciles by `id`; `transient: true` parts are delivered to `onData` and not persisted (https://ai-sdk.dev/docs/ai-sdk-ui/streaming-data).

Consequence: any server transport that can (1) return a `ReadableStream<UIMessageChunk>` for a new turn and (2) return the same stream from a cursor for a reconnect fits `useChat` without touching the React components. The transport is the swap point.

### 4.2 Option A — `resumable-stream` on Redis (Vercel's own answer)

- Server: `createUIMessageStreamResponse({ stream, consumeSseStream({ stream }) { ctx.createNewResumableStream(streamId, () => stream); saveChat({ activeStreamId }) } })`; GET route returns `ctx.resumeExistingStream(activeStreamId)` with `UI_MESSAGE_STREAM_HEADERS` or 204 (https://ai-sdk.dev/docs/ai-sdk-ui/chatbot-resume-streams).
- Package: `resumable-stream`, with `resumable-stream/ioredis` for ioredis and `resumable-stream/generic` for a custom pub/sub. It uses Redis pub/sub plus buffered chunks, "designed for serverless, non-sticky load-balanced environments", and "Producer completes streams independent of reader connection status" (https://raw.githubusercontent.com/vercel/resumable-stream/main/README.md). Version not shown on the README; check npm before pinning.
- Fit: good for a turn that runs inside the API process. Weak for a turn that runs in a Trigger.dev task, because the producer must hold the Redis publisher; the task can do that, but then the API's GET route and the task share the Redis key prefix and the `activeStreamId` row. Feasible.
- Caveat: pub/sub + the Railway Redis in `sfo` with the API in `europe-west4` adds ~150 ms per hop (`inspect-infra-ops.md` line 113). Move Redis next to the API before V2.

### 4.3 Option B — own Redis Stream per turn (V1 legacy relay pattern)

- Producer: `XADD turn:{turnId} MAXLEN ~ 20000 * event <json>` per UI message chunk. Consumer: `XRANGE` from `Last-Event-ID` for replay, then `XREAD BLOCK 5000 STREAMS turn:{turnId} <last>` to tail. Entry ids are `<ms>-<seq>` and monotonic (https://redis.io/docs/latest/develop/data-types/streams/). wandit already implements this loop with a dedicated blocking connection and `Last-Event-ID` validation (`chat-stream-relay.service.ts:26-127`; `chats.controller.ts:138-191`; publisher `chat-events.publisher.ts:152-153`).
- Fit: best match for a Trigger.dev producer, because the task can `XADD` from any machine and the API can serve GET from any replica without pub/sub state. `EXPIRE` the stream after the turn (the legacy publisher already does; `chat-events.publisher.ts:152`).
- Cost: one Redis round trip per chunk. Batch chunks every ~50 ms in the task to keep the count low. `smoothStream` re-slicing (V1 uses 15 ms, `ai-chat.service.ts:1210-1213`) should happen on the client side of the relay, not before `XADD`.

### 4.4 Option C — Trigger.dev Realtime streams v2

- Task side: `const aiStream = streams.define<UIMessageChunk>({ id: 'ui' }); const { waitUntilComplete } = aiStream.pipe(result.toUIMessageStream()); await waitUntilComplete();` Limits: max stream length unlimited, active streams per run unlimited, max size 300 MiB, retention 28 days. "Connections resume from the last successful chunk". Needs SDK ≥ 4.1.0; wandit is on 4.5.3 (https://trigger.dev/docs/tasks/streams; `apps/server/package.json:37`).
- Client side: `useRealtimeStream(runId, 'ui', { accessToken, lastEventId: saved, refreshAccessToken, from: 'latest', maxParts, throttleInMs })`; `useRealtimeRunWithStreams` is legacy (https://trigger.dev/docs/realtime/react-hooks/streams). Run updates are "powered by Electric SQL (HTTP-based PostgreSQL syncing). Streams use their own transport" (https://trigger.dev/docs/realtime/overview).
- Server side, outside the task: `streams.read(runId, 'ui', { startIndex, timeoutInSeconds, signal })` can pipe to an HTTP response as SSE (https://trigger.dev/docs/realtime/streams). So the API can implement `reconnectToStream` on top of Trigger streams without Redis.
- Limits that matter: Realtime concurrent connections Free 10 / Hobby 50 / Pro 500+; API rate 1,500 requests/minute (https://trigger.dev/docs/limits). Every open builder tab that subscribes directly from the browser is one connection. For a product with many concurrent users, subscribe from the API (one connection per active turn) and fan out to browsers over SSE, or use Option B for the browser leg.
- Fit: the simplest producer. The consumer choice is between "browser → Trigger.dev" (fewer moving parts, connection cap) and "browser → API → Trigger.dev" (no cap, one more hop). V1 already mints read-scoped public tokens at queue time and uses `useRealtimeRun` (`use-live-run.ts:73-93`; `inspect-web-builder-ui.md` §8).

### 4.5 Option D — WebSocket on Cloudflare Durable Objects / Agents SDK

- Durable Objects WebSocket Hibernation: `state.acceptWebSocket(ws)`, `webSocketMessage`, `webSocketClose`, `serializeAttachment` (≤ 16,384 bytes) survive hibernation; "Billable Duration (GB-s) charges do not accrue during hibernation"; one DO can hold "thousands of clients per instance" (https://developers.cloudflare.com/durable-objects/best-practices/websockets/).
- Agents SDK: one DO per agent name ("given the same name (or ID), you will always get the same instance of an agent"), `AIChatAgent` with "Built-in message persistence" and "Automatic resumable streaming (reconnect mid-stream)", `useAgentChat()` on the client, package `@cloudflare/ai-chat` (https://developers.cloudflare.com/agents/api-reference/agents-api/).
- Fit: wandit already has an edge Worker for serving and leads (`inspect-infra-ops.md` line 12). A DO per project as the fan-out point is a clean architecture, but it moves the chat protocol to a third runtime (Worker) and the AI SDK harness would still run elsewhere (a DO cannot hold a Node WebSocket to a sandbox bridge with the same guarantees, and Node APIs in Workers are partial — UNVERIFIED for the harness package). Keep as a later option for multi-user presence, not for V2 day one.

### 4.6 Choice

Producer in a Trigger.dev task. Two sinks: Trigger.dev stream `ui` (durable, dashboard-visible, 28 days) and Redis Stream `turn:{turnId}` (low-latency browser leg via the API, replay by `Last-Event-ID`). If the Redis leg is missing, the API falls back to `streams.read(runId, 'ui', { startIndex })`. This reuses V1's relay code and V1's token minting and keeps the browser off the Trigger.dev connection cap. Section 16 has the message flow.

---

## 5. Running the turn as a background job with cancel/stop

### 5.1 Trigger.dev (already in the stack)

- `run(payload, { signal, ctx })` receives an `AbortSignal`; pass it to `agent.stream({ abortSignal: signal })`. `onCancel({ runPromise })` gets "up to 30 seconds"; it "only runs if the run is actively executing" (https://trigger.dev/docs/tasks/overview).
- Cancel from the API: `await runs.cancel(runId)` returns `{ id }`; "If the run is already completed, this will have no effect" (https://trigger.dev/docs/management/runs/cancel). `onFailure` does not fire for `Canceled` (https://trigger.dev/docs/tasks/overview).
- `maxDuration` in seconds per task; cloud TTL 14 days per run (https://trigger.dev/docs/limits). V1 uses 1800 s (`inspect-ai-pipeline.md` §5); Lovable's Build mode runs "up to 10 hours" (https://docs.lovable.dev/features/modes). Start V2 at 3600 s and a `maxBudgetUsd` on the harness side.
- `idempotencyKey` on `trigger()` returns "the original run's handle" for a duplicate within the TTL (default 30 days; scope `run` | `attempt` | `global`) (https://trigger.dev/docs/idempotency). Use `turnId` as the key with a short TTL (`"1h"`), so a double POST cannot start two turns.
- `metadata.set/append/flush` is synchronous, flushed in the background, 256 KB cap; `metadata.parent/root` for child tasks (https://trigger.dev/docs/runs/metadata). Good for the changed-files list and the phase (`booting | installing | editing | verifying | committing`).
- Machines: `micro` 0.25 vCPU/0.25 GB up to `large-2x` 8 vCPU/16 GB; default `small-1x`; `retry.outOfMemory.machine` bumps on OOM (https://trigger.dev/docs/machines). The turn task is a relay (WebSocket + Redis + git RPCs), so `small-2x` (1 vCPU/1 GB) should be enough; the heavy work is in the sandbox. V1 needed `medium-1x` only because Chromium ran in the task.
- Waits: "we automatically pause execution of tasks when they are waiting for longer than a few seconds"; the concurrency slot is released "60 seconds into the wait" for `wait.for/until` (https://trigger.dev/docs/wait). A checkpoint kills the process memory, so the bridge WebSocket dies. Rule: detach the harness session before any wait longer than a few seconds.
- `wait.forToken` for human approval: default timeout "10m", completion from SDK, browser (with `publicAccessToken`), or webhook (https://trigger.dev/docs/wait-for-token). Use it only after `session.detach()`.

### 5.2 Inngest

`step.realtime.publish()` (durable) and `inngest.realtime.publish()` (non-durable), channels/topics with schemas, `useRealtime` hook, subscription tokens (https://www.inngest.com/docs/features/realtime). Cancellation: "Cancelling a function that has a currently executing step will not stop the step's execution. Any actively executing steps will run to completion" (https://www.inngest.com/docs/features/inngest-functions/cancellation). A single long harness turn is one step, so "Stop" cannot interrupt it. Not a fit.

### 5.3 BullMQ

`worker.cancelJob(jobId, reason)` and `worker.cancelAllJobs()`; the processor receives `(job, token, signal)`; standard package, no Pro needed (https://docs.bullmq.io/guide/workers/cancelling-jobs). Active locked jobs cannot be removed (https://docs.bullmq.io/guide/jobs/removing-job). Works, but it requires a worker service, and wandit's `apps/worker` has no live Railway service and `QUEUE_ENABLED` defaults to false (`inspect-infra-ops.md` lines 14, 189). Trigger.dev also gives the dashboard, realtime, and machine sizing for free. Keep BullMQ out of V2.

### 5.4 Stop semantics (what "Stop" must do)

1. Client: `useChat.stop()` aborts the fetch. That alone stops nothing on the server when the producer is a background task.
2. API: `POST /v2/projects/:id/turns/:turnId/cancel` → `runs.cancel(runId)` and writes `builder_turns.status = 'cancelling'`.
3. Task: `signal` aborts `agent.stream()`; the Claude Code bridge passes `abortSignal` to `query()` (`ai-sdk-harness.md` §2.9), which interrupts the CLI. In `onCancel` (≤ 30 s): `git add -A && git commit -m "wip: cancelled turn"` (or `git stash`) so partial edits are not lost, write the changed-file list to metadata, `session.detach()` if the bridge is still alive, `XADD` a terminal `{type:'finish', reason:'cancelled'}` chunk.
4. Client re-reads the turn row and the versions list.

What happens to the harness if the host aborts without `detach()` is not documented; assume the bridge process keeps running until the sandbox timeout. Always kill it explicitly (UNVERIFIED that abort alone terminates the bridge).

---

## 6. Per-project concurrency locks

Requirements: one active turn per project; a second user (or a double click) gets a clear 409; a crashed host must not leave a permanent lock; the lock must be visible to both the API (admission) and the task (execution).

Layers:

1. **Queue-level**: `queue({ name: 'builder-turn', concurrencyLimit: 1 })` with `trigger(payload, { queue: 'builder-turn', concurrencyKey: projectId })`. "Only actively executing runs count towards concurrency limits" and `concurrencyKey` creates one queue instance per key (https://trigger.dev/docs/queue-concurrency). This serializes turns per project even when the API admits two.
2. **Admission-level (API)**: `SET builder:lock:{projectId} {turnId} NX PX 300000`; release with the Redis 8.4 `DELEX key IFEQ token` or the Lua compare-and-delete script; extend with a heartbeat (https://redis.io/docs/latest/develop/clients/patterns/distributed-locks/). wandit runs `redis:8.2.9` (`inspect-infra-ops.md` line 113), so use the Lua script. V1's lease (TTL 5 min, heartbeat 60 s, `AI_CHAT_TURN_ACTIVE` 409) is this exact pattern (`ai-chat.service.ts:196-201`, `:455-483`). Alternative without Redis: `pg_try_advisory_xact_lock(hashtext(projectId))` inside the admission transaction; session-level locks are "held until explicitly released or the session ends" (https://www.postgresql.org/docs/current/explicit-locking.html, https://www.postgresql.org/docs/current/functions-admin.html). Transaction-level locks do not fit a lock that must span an HTTP request and a task, so Redis with TTL + heartbeat from the task is the better fit.
3. **Data-level**: `builder_turns` has a partial unique index `(project_id) WHERE status IN ('queued','running')`. This is the last line of defence and is what the UI reads.
4. **Fencing**: the task writes `turnId` into every `XADD`, every `versions` row, and the git commit message. A late task from an expired lock cannot overwrite a newer version (V1 has the same rule: "move `activeVersionId` unless a newer attempt already succeeded", `inspect-ai-pipeline.md` §5). This matches the Redis docs' warning to "implement fencing tokens".

Queueing instead of 409: Lovable and v0 let the user type while a turn runs. Claude Code's streaming input mode supports "Queued messages: send multiple messages that process sequentially, with ability to interrupt" and single-message mode does not (https://code.claude.com/docs/en/agent-sdk/streaming-vs-single-mode). The harness bridge exposes mid-turn steering since `@ai-sdk/harness@1.0.78` (`ai-sdk-harness.md` §2.7), but the HarnessAgent page does not document the API (https://ai-sdk.dev/docs/ai-sdk-harnesses/harness-agent). For V2 day one: 409 + a "queued message" row that the client auto-submits when the turn finishes. Steering is a follow-up.

---

## 7. Checkpointing partial work

| Mechanism | Covers | Granularity | Restore | Source |
|---|---|---|---|---|
| git commit per turn (in sandbox) | all files, including Bash edits and `npm install` changes to lockfiles | one commit per turn (plus a `wip` commit on cancel/crash) | `git checkout <sha>` or `git revert`; diff between versions is free | v0: "Every code-changing message auto-commits" (https://vercel.com/blog/introducing-the-new-v0); Lovable versions per change, revert restores code only (https://docs.lovable.dev/features/projects/history) |
| Claude Agent SDK file checkpointing | Write/Edit/NotebookEdit only, "not Bash or subagent edits" | per tool call (`rewindFiles(uuid)`) | inside the same session | https://code.claude.com/docs/en/agent-sdk/file-checkpointing |
| Sandbox snapshot | whole filesystem incl. `node_modules` | per stop or manual `snapshot()` (the manual call shuts the sandbox down) | new sandbox from `snapshotId` | https://vercel.com/docs/sandbox/concepts/snapshots |
| Trigger.dev metadata | small JSON (≤ 256 KB) | continuous | read from `useRealtimeRun` | https://trigger.dev/docs/runs/metadata |
| `versions` row + R2 build artifact | the published output | per successful turn | activate old version | V1 pattern (`inspect-ai-pipeline.md` §5) |

Design: git is the primary checkpoint. The task runs `git add -A && git commit --allow-empty -m "turn <turnId>: <summary>"` in `Stop`/end of turn and on cancel. A `versions` row stores `{ turnId, commitSha, filesChanged, summary, screenshotKey }`. Restore = `git checkout -B work <sha>` in the sandbox + a new version row that points at the same sha (Lovable's "Back to latest leaves a preview snapshot" behaviour). Do not rely on the sandbox snapshot as the checkpoint; use it as the cache.

Mid-turn checkpoints for very long turns: a `PostToolBatch` hook ("A full batch of tool calls resolves, once per batch before the next model call", TypeScript only) is the right moment for a lightweight `git add -A && git commit -q -m wip` every N batches; squash at the end (https://code.claude.com/docs/en/agent-sdk/hooks).

---

## 8. Mapping harness events to the UI

### 8.1 Event sources

- **AI SDK harness stream parts**: `text-start/delta/end`, `reasoning-*`, `tool-input-start/delta/end`, `tool-call`, `tool-result` (with `providerExecuted: true` for built-ins), `tool-approval-request`, `step-finish`, `finish` (`finishReason`, `totalUsage`), dynamic parts `fileChange` and `compaction`, `raw` (`ai-sdk-harness.md` §2.4-2.6). `toUIMessageStream` turns these into `UIMessageChunk`s; `useChat` renders `tool-bash`, `tool-read`, `tool-write`, `tool-edit`, `dynamic-tool` parts (https://ai-sdk.dev/docs/ai-sdk-harnesses/ui).
- **Agent SDK hooks** (fire inside the bridge; visible to the host only if the adapter forwards them — UNVERIFIED for the harness; certain when using the Agent SDK directly): `PostToolUse` with `tool_name`, `tool_input`, `tool_response`, `tool_use_id`, `agent_id`; `SubagentStart/Stop`; `PreCompact/PostCompact`; `Stop`; `Notification` (https://code.claude.com/docs/en/agent-sdk/hooks).
- **Product events** written by the task itself as `data-*` parts: `data-phase`, `data-files` (reconciled by `id`), `data-preview` (URL + ready flag), `data-screenshot`, `data-logs` (transient), `data-credits`, `data-ai-error` (V1 already uses `data-ai-error`, `ai-chat.service.ts:1029`).

### 8.2 Mapping table

| UI element | Source parts | Notes |
|---|---|---|
| Assistant text (streamdown) | `text-*` | same as V1 |
| "Thinking…" collapsed block | `reasoning-*` | hide by default |
| File edits list (live) | `tool-write`, `tool-edit` input `file_path`; `dynamic-tool` `fileChange` | keep one `data-files` part with `id: 'files-<turnId>'`, update it on every edit; final list from git (section 9) |
| Commands run | `tool-bash` input `command`, output tail | truncate output to 2 KB in the UI part; full log to R2 |
| Diff per file | computed after turn by the task: `git diff <base>..<head> -- <path>` | Claude Code web shows `+42 -18` from "raw git blob content" (https://code.claude.com/docs/en/claude-code-on-the-web) |
| Preview status | `data-preview` | `booting | installing | starting | ready | crashed` |
| Screenshot card | `data-screenshot` with R2 URL | one per verification pass |
| Approval prompt | `tool-approval-request` → `addToolApprovalResponse` | only if `permissionMode` ≠ `allow-all` |
| Ask-user question | `AskUserQuestion` via `canUseTool` (`ai-sdk-harness.md` §3.4) | surfaces as a client tool part like V1 `ask_user` |
| Credits / cost | `finish.totalUsage` + own price table | `total_cost_usd` is a client-side estimate, not billing data (https://code.claude.com/docs/en/agent-sdk/cost-tracking) |
| Errors | `data-ai-error` + `getHarnessErrorMessage` | section 10 |

Lovable's Details view shows the same set: "Current step being executed", "Files being modified", "Tools being used", then "file diffs and summaries" (https://docs.lovable.dev/features/modes). v0's API returns "ordered `parts`: text, thinking, file reads and edits, searches, bash commands, tool calls, and agent actions" (https://vercel.com/blog/introducing-the-new-v0-api, 2026-08-05). Claude Code web shows a diff indicator per session with inline comments that feed the next message (https://code.claude.com/docs/en/claude-code-on-the-web). OpenCode emits `message.part.updated`, `session.updated`, `file.edited` on `GET /event` (https://opencode.ai/docs/server/).

---

## 9. Getting the list of changed files

Three sources, in order of trust:

1. **Git after the turn** (truth). `git status --porcelain=v2 -z --untracked-files=all` gives typed entries (`1` changed, `2` renamed with score, `u` unmerged, `?` untracked) with NUL separators (https://git-scm.com/docs/git-status). Then `git diff --numstat <base>` for `+/-` counts. Exclude `node_modules`, lockfiles are included on purpose.
2. **Hooks during the turn** (live). `PostToolUse` with matcher `Write|Edit|MultiEdit|NotebookEdit` → `tool_input.file_path`; `Bash` → run `git status --porcelain -z` after the command (cheap) or parse nothing and rely on step 1. `PostToolUse` timeouts keep the tool result and continue (https://code.claude.com/docs/en/agent-sdk/hooks).
3. **Harness dynamic parts** (`fileChange`) — opaque; use for the spinner, not for the list (`ai-sdk-harness.md` §2.5).

OpenCode exposes `file.status()` that "returns changed files" plus `session.revert/unrevert` (https://opencode.ai/docs/sdk/). Claude Code web computes diffs from git blobs (https://code.claude.com/docs/en/claude-code-on-the-web). Both confirm git as the base.

Watch out: the `FileChanged` hook is "A watched file is modified, created, or deleted" for config reload, TypeScript only, and is not a general file watcher (https://code.claude.com/docs/en/agent-sdk/hooks).

---

## 10. Errors and retries

Failure classes and the response for each:

| Class | Detect | Response |
|---|---|---|
| Sandbox create/resume failed (capacity, expired snapshot) | provider error; `Session creation failed` is Anthropic's own wording for this (https://code.claude.com/docs/en/claude-code-on-the-web) | retry the task attempt (Trigger `retry.maxAttempts: 2` for this phase only); if the snapshot is gone, re-clone from the git remote |
| Bootstrap failed (`pnpm install` of the bridge) | bootstrap step error | retry once; pre-bake the bridge in a custom image / snapshot (`sandboxes.md` §6.2) |
| Model error / rate limit | `finish.finishReason = 'error'`, `result.subtype: error_during_execution` (`ai-sdk-harness.md` §3.3) | surface `data-ai-error`, do not auto-retry the whole turn (side effects exist); offer "Retry" which starts a new turn with `resume` |
| Stall (no events for N min) | own watchdog on the UI stream, as V1 (`generate-page.task.ts:1472-1544`) | abort, `wip` commit, mark `stalled`, allow retry |
| Max turns / budget | `error_max_turns`, `error_max_budget_usd` | finish gracefully; commit; tell the user |
| Cancel | `signal` | section 5.4 |
| Task crash / OOM | Trigger `Crashed`, `retry.outOfMemory` (https://trigger.dev/docs/machines) | the sandbox is still there; a fresh attempt does `git status`, commits `wip`, and marks the turn `failed`; do not re-run the prompt automatically |
| Dev server crash | detached command `exitCode !== null` | restart via `onResume`/task; feed the last 200 lines of stderr to the next turn |
| Preview build error (Vite overlay, TS error) | dev-server log grep + browser `pageerror` | "Try to fix" (section 13) |

Trigger-level rules: keep `retry.maxAttempts: 1` for the turn task as V1 does (`inspect-ai-pipeline.md` §5) because a turn is not idempotent; make the *phases* (boot, bootstrap, commit) idempotent and retry them inside the task. `onFailure` does not fire for `Canceled` or `Crashed` (https://trigger.dev/docs/tasks/overview), so the terminal state must also be reconciled by a cron (V1 has a 40-minute stranded-recovery line, `ai-chat.service.ts:196-199`).

---

## 11. Multi-user editing of one project

Facts:

- Lovable: "each of you can work in your own draft: a separate copy of the project with its own chat and preview", "a draft's edits reach the project only when someone accepts it"; roles Viewer/Editor/Admin/Owner; "Collaborators will use credits from the project owner's workspace" (https://docs.lovable.dev/features/collaboration).
- v0: one chat = one app state; a repo can have many chats; each chat has its own branch and PR (https://vercel.com/blog/introducing-the-new-v0; https://vercel.com/blog/introducing-the-new-v0-api).
- Claude Code web: shared sessions are read-only for recipients ("their view doesn't update in real time"); Remote Control keeps "the conversation and the progress of subagents ... in sync across all connected devices" through a transcript stored on Anthropic servers (https://code.claude.com/docs/en/claude-code-on-the-web; https://code.claude.com/docs/en/remote-control).
- wandit V1 already supports team workspaces with a per-actor stream slot and a per-chat turn key (`ai-chat.service.ts:180`, `:455-483`).

Design: **one project = one main branch + one active turn**; a second person sees the running turn live (SSE replay by turn id is user-independent) and can queue a message. Drafts (a second sandbox from a `Sandbox.fork` / snapshot on a git branch, then merge) are a V2.x feature; git makes the merge possible. Do not build CRDT co-editing; the product is chat-driven and the harness owns the files.

---

## 12. Keeping the dev server alive and hot-reloading the preview

- Start as a detached command: `sandbox.runCommand({ cmd: 'pnpm', args: ['dev', '--host', '0.0.0.0', '--port', '3000'], detached: true })`; keep `cmd.cmdId`; `sandbox.getCommand(cmdId)` later; `for await (const log of command.logs())`; `command.kill('SIGTERM')` (https://vercel.com/docs/sandbox/sdk-reference). E2B: `commands.run(cmd, { background: true, onStdout })`, `commands.connect(pid)`, `command.kill()` (https://docs.e2b.dev/commands/background).
- Expose the port at create time: `ports: [3000]`, then `sandbox.domain(3000)` → `https://<name>.vercel.sh`; up to 15 ports (https://vercel.com/docs/sandbox/sdk-reference). One port is taken by the harness bridge (`ai-sdk-harness.md` §2.10).
- Vite behind the sandbox domain: set `server.host: true`, `server.allowedHosts: ['.vercel.sh']` (never `true`: "security risk through DNS rebinding attacks"), and if the preview is proxied, `server.ws.clientPort`/`protocol: 'wss'` and `server.strictPort: true`; reverse proxies "are expected to support proxying WebSocket" (https://vite.dev/config/server-options.html). Write these into the generated template's `vite.config.ts`.
- Keep-alive: the sandbox session timeout defaults to 5 min; call `sandbox.extendTimeout(ms)` from a heartbeat while the user has the tab open (client pings API → API extends, max 24 h per session). v0 uses "30 min initial, +10 min while active, 24 h absolute max" (https://v0.app/docs/sandbox). On stop, the persistent sandbox snapshots; on resume, `onResume` restarts the dev server ("Use it to restart background services or rehydrate caches", https://vercel.com/docs/sandbox/concepts/persistent-sandboxes).
- Preview URL in the iframe: v0 recommends "Fetch it from a server route and proxy browser requests through it" with a loading route while the sandbox boots (https://vercel.com/blog/introducing-the-new-v0-api). Vercel Sandbox port auth for iframes is discussed in `sandboxes.md` §6.3.
- HMR does the reload; the agent's Write/Edit triggers Vite's watcher. No product code needed. If the file watcher misses edits (WSL-style problems do not apply on Linux), `server.watch.usePolling` is the fallback at a CPU cost (https://vite.dev/config/server-options.html).
- Expo/Metro in a sandbox is covered in `sandboxes.md` §6.4 and `inspect-native-and-simulator.md`.

---

## 13. Dev-server logs, browser console errors, and the auto-fix loop

### 13.1 Inputs

1. **Dev server stdout/stderr**: ring buffer of the last N KB from `command.logs()` (Vercel) or `onStdout/onStderr` (E2B). Also greppable inside the sandbox by the agent itself if the task tees logs to `/tmp/dev.log`.
2. **Browser console + runtime errors**: a headless Playwright page in the sandbox on the preview URL with `page.on('console')` (`type()`, `text()`, `location()`), `page.on('pageerror')` (Error), `page.on('requestfailed')`, `page.waitForLoadState('networkidle')` (https://playwright.dev/docs/api/class-page). V1 already does this in `screenshot.ts:110-122`.
3. **The user's own iframe**: inject a tiny script into the dev template that forwards `window.onerror`, `unhandledrejection`, and `console.error` to the parent with `postMessage`; the web app posts them to the API as `preview_errors` for the turn. This covers errors that only happen on the user's interactions. UNVERIFIED that Lovable does exactly this; its docs say the agent "can inspect errors, logs, and console output, and test your app in a browser" (https://docs.lovable.dev/tips-tricks/troubleshooting).
4. **Typecheck/build**: `pnpm tsc --noEmit` and `pnpm build` run by the agent (Bash) or by the task's verify phase.

### 13.2 The loop

- **Agent-initiated** (default): give the harness a host tool `read_preview_diagnostics()` that returns `{ devServerTail, consoleErrors, pageErrors, failedRequests, lastScreenshotUrl }` and a skill that says "after edits, call it once and fix errors before finishing". Host tools receive `experimental_sandbox` so they can run `git`/`tail` without a second connection (`ai-sdk-harness.md` §2.5).
- **User-initiated "Try to fix"**: the UI shows the button when the diagnostics are non-empty after a turn. Click → new turn with a canned prompt that includes the diagnostics. Lovable: the button "scans the logs, finds the issue, and attempts a fix", "10 free fixes" per 24 h, then "runs as a normal chat message that uses credits" (https://docs.lovable.dev/tips-tricks/troubleshooting).
- **Bounded auto-loop**: at most 2 automatic fix turns per user turn, each with a `maxBudgetUsd`, and never when the diff is empty. Lovable states "Most of these tools run only when you ask for them" (https://docs.lovable.dev/features/modes), so a fully automatic loop is not the market default; keep it opt-in.

### 13.3 What the agent should see

Format the diagnostics as a short text block: the last 40 dev-server lines with ANSI stripped, up to 10 unique console errors with `url:line`, and failed requests as `status method url`. Cap at 4 KB; put the full log in R2 and give the path. V1's `consoleErrors` "prefixed with their viewport" is a good template (`screenshot.ts:23`).

---

## 14. Screenshots for visual verification (Playwright in the sandbox)

- Run Chromium **inside the sandbox**, not in the Trigger.dev task: it removes the `medium-1x` requirement and the custom `playwrightChromium()` build layer (`inspect-infra-ops.md` line 126), and it can reach `http://localhost:3000` without the port auth problem. The Vercel `universal` image ships Node, Python, and "coding agents"; Chromium is UNVERIFIED — bake it into a custom image or snapshot (`npx playwright install --with-deps chromium`) (https://vercel.com/docs/sandbox/concepts/images referenced from https://vercel.com/docs/sandbox).
- Keep one long-lived Playwright server process per sandbox (detached command) with a tiny HTTP API (`/screenshot?route=/&viewport=mobile`), the same "one headless Chromium per build: launched lazily on the first capture" idea as V1 (`screenshot.ts:4`). The harness calls it through a host tool or plain `curl` in Bash.
- Capture: `page.setViewportSize`, `page.waitForLoadState('networkidle')`, `page.screenshot({ fullPage, type: 'jpeg' })` (https://playwright.dev/docs/api/class-page). Upload to R2 with the turn id; emit `data-screenshot`.
- Return the image to the model as an image content block (MCP tool `content: [{ type: 'image' }]`, `ai-sdk-harness.md` §3.6) so the model can judge layout; V1 does this and requires at least one screenshot pass before `finish` (`site-builder-agent.ts:203-227`).
- Mobile apps: the simulator stream is a separate concern (`inspect-native-and-simulator.md`); Expo web in the same Playwright page is the cheap verification path.

---

## 15. How the reference products do it

### 15.1 Vercel v0

- Runs the agent against a Vercel Sandbox per chat; filesystem persists across sessions for the same chat; lifetime 30 min + 10 min while active, 24 h max (https://v0.app/docs/sandbox).
- API: `v0-sdk`, `https://api.v0.dev`, `v0.messages.sendStream()` for live parts, chats as persistent workspaces ("Keep each chat's ID and send its follow-up messages to that chat"), preview token fetched server-side and proxied, loading route while the sandbox boots (https://v0.app/docs/api/platform; https://vercel.com/blog/introducing-the-new-v0-api, 2026-08-05).
- Git: one branch per chat, auto-commit per code-changing message, publish = PR (https://vercel.com/blog/introducing-the-new-v0, 2026-02-03).
- Generation quality tricks (dynamic system prompt, stream-time autofixers within 250 ms) are in https://vercel.com/blog/how-we-made-v0-an-effective-coding-agent (2026-01-07).
- Vercel's own durable path for AI SDK turns is `@ai-sdk/workflow-harness` (one `stream()` per workflow step or a 750 s time slice, `persistResumeStep`) on Workflow DevKit, not Trigger.dev (`ai-sdk-harness.md` §2.7).

### 15.2 Lovable

- Build mode up to 10 hours per message; verification tools (browser testing, console/network inspection, build errors) mostly on request; live "Details" view with steps, files, tools; diffs and summaries at the end (https://docs.lovable.dev/features/modes).
- "Try to fix" scans logs and proposes a fix; 10 free fixes per 24 h (https://docs.lovable.dev/tips-tricks/troubleshooting).
- Version per change, code-only revert (https://docs.lovable.dev/features/projects/history); two-way GitHub sync with `lovable-sync` fallback branch (https://docs.lovable.dev/integrations/github).
- Collaboration through drafts (separate copy + chat + preview, accepted into the project) (https://docs.lovable.dev/features/collaboration).
- Infra: Firecracker microVMs (Fly.io reported `OLD`, Modal reported, Molnett acquired 2025-11-25) (`competitor-architectures.md` §2.1).
- Architecture: "a primary agent delegates to specialised sub-agents, each matched to a Claude model" (https://claude.com/customers/lovable).

### 15.3 OpenCode

- Client/server split: `opencode serve` (port 4096, `OPENCODE_SERVER_PASSWORD`), OpenAPI 3.1 at `/doc`, `POST /session/:id/message` (await), `POST /session/:id/prompt_async` (204), `GET /event` SSE with `server.connected` first then `message.part.updated`, `session.updated`, `file.edited` (https://opencode.ai/docs/server/).
- SDK `@opencode-ai/sdk`: `createOpencode()` / `createOpencodeClient({ baseUrl })`, `session.prompt`, `event.subscribe()`, `session.abort`, `session.revert/unrevert`, `file.status()` (https://opencode.ai/docs/sdk/).
- The AI SDK OpenCode adapter boots this server inside the sandbox (`ai-sdk-harness.md` §2.3). Lesson: an HTTP+SSE server inside the sandbox with an abort endpoint and a file-status endpoint is a clean contract; the Claude Code bridge is the same idea over WebSocket.

### 15.4 Claude Code on the web and Remote Control

- Web: Anthropic-managed VM per session, "Sessions persist even if you close your browser", environment expiry reclaims the VM and a reopen "provision[s] a fresh VM with your conversation history restored" minus background processes; per-session `+42 -18` diff from git blobs; inline diff comments feed the next message; `claude -p "msg" --cloud <session-id>` queues a follow-up into a running session; `--teleport` pulls the branch and transcript to a terminal (https://code.claude.com/docs/en/claude-code-on-the-web).
- Remote Control: local process stays the executor; "All traffic travels through the Anthropic API over TLS"; transcript "stored on Anthropic servers" to sync devices and "reconnect after a network drop"; messages, permission prompts, and status updates are queued while the link rebuilds; the device requests the diff and "Claude Code computes it on your machine"; server mode resumes sessions "for about four hours after the server stopped"; forwarded dialogs expire after five minutes by default (https://code.claude.com/docs/en/remote-control).
- Lessons for wandit: (1) transcript in a server store, executor near the files; (2) queued messages and a "session offline" state as first-class UI; (3) diff on demand from git, not from a stream; (4) an explicit expiry policy for permission dialogs.

---

## 16. Recommended design for the wandit stack

Stack given: NestJS 11 on Fastify 5 (API), Trigger.dev 4.5.x (jobs), Redis (Railway), AI SDK 7 (`ai@7.0.91+` required by `@ai-sdk/harness`, `ai-sdk-harness.md` §1), React web with `@ai-sdk/react`.

### 16.1 Components

```
Browser (React, useChat + BuilderTransport)
   │ POST /v2/projects/:id/turns          (submit)      ─┐
   │ GET  /v2/projects/:id/turns/:turnId/stream (SSE, Last-Event-ID)  │ NestJS + Fastify (apps/server)
   │ POST /v2/projects/:id/turns/:turnId/cancel                         │  - admission, lock, credits hold
   │ POST /v2/projects/:id/preview/heartbeat                            │  - Redis Stream relay (reuse legacy code)
   ▼                                                                   ─┘
Redis  ── turn:{turnId} stream (events) ── builder:lock:{projectId}
   ▲
Trigger.dev task `builder-turn` (queue per projectId, limit 1, small-2x)
   - HarnessAgent (Claude Code adapter) session per chat
   - XADD every UIMessageChunk; streams.define('ui').pipe(...) as durable copy
   - metadata: phase, files, previewUrl
   - end: git commit, git status, screenshot, versions row, detach/stop
   │  WebSocket bridge (port A)          preview (port B)      playwright svc (localhost)
   ▼
Sandbox (persistent, name = projectId)
   - /workspace (git repo, branch `main`), .harness-bootstrap/, ~/.claude/projects/
   - detached: dev server, playwright server
```

### 16.2 Data model (new tables, Postgres)

- `builder_sessions` (`project_id` PK, `sandbox_provider`, `sandbox_name`, `harness_resume_state` jsonb encrypted, `claude_session_id`, `dev_server_cmd_id`, `preview_port`, `state: cold|warm|running`, `last_active_at`).
- `builder_turns` (`id`, `project_id`, `chat_id`, `user_message_id`, `trigger_run_id`, `status: queued|running|cancelling|succeeded|failed|stalled|cancelled`, `phase`, `started_at`, `finished_at`, `usage` jsonb, `error_code`, `commit_sha`, `files_changed` jsonb, partial unique index on `(project_id) where status in ('queued','running','cancelling')`).
- `versions` (reuse; add `turn_id`, `commit_sha`, `screenshot_key`).
- `preview_diagnostics` (`turn_id`, `kind: console|pageerror|request|devserver|build`, `payload`, `created_at`).

### 16.3 Turn sequence

1. **Submit**: client `sendMessages` → `POST /v2/projects/:id/turns { chatId, message, metadata }`. API: auth + workspace scope (V1 controller checks), credit hold (V1 `reserveWithReplay`), Redis lock `SET builder:lock:{projectId} {turnId} NX PX 600000` else 409 `AI_CHAT_TURN_ACTIVE` (plus enqueue the message as `queued_messages` if the user asked to queue), insert `builder_turns`, `tasks.trigger('builder-turn', payload, { queue: 'builder-turn', concurrencyKey: projectId, idempotencyKey: turnId, idempotencyKeyTTL: '1h', tags: [projectId] })`, store `runId`, respond `202 { turnId, runId, streamUrl }`. The transport then opens the SSE `GET` immediately (so `sendMessages` returns the relay stream, not a hijacked POST).
2. **Boot** (task): `Sandbox.getOrCreate({ name: projectId, ports: [4000, 3000], timeout: 30 min, keepLastSnapshots: { count: 1 }, onCreate: clone template + pnpm install + playwright install, onResume: restart dev server + playwright })`. Emit `data-phase`.
3. **Attach**: `agent.createSession({ sessionId: chatId, resumeFrom })` if resume state exists, else `createSession({ sessionId: chatId })`. Provider: `@ai-sdk/sandbox-vercel` first; a custom `HarnessV1SandboxProvider` for E2B/Daytona later (`sandboxes.md` §7).
4. **Stream**: `const result = await agent.stream({ session, prompt, abortSignal: signal })`; `const ui = toUIMessageStream({ stream: result.stream })`; tee into (a) `XADD turn:{turnId}` per chunk (batched 50 ms) and (b) `uiStream.pipe(ui)`. Host tools: `read_preview_diagnostics`, `take_screenshot`, `publish_preview`, wandit product tools. Lock heartbeat every 60 s (`PEXPIRE` if token matches).
5. **Watchdog**: if no chunk for 4 min, abort with `stalled` (V1 pattern).
6. **Finish**: in the sandbox `git add -A && git commit -m "turn {turnId}"`; `git status --porcelain=v2 -z` before the commit for the file list; `git diff --numstat HEAD~1`; screenshot; insert `versions`; write `files_changed`, `usage`, `commit_sha`; `XADD` terminal chunk; `session.detach()` and store `harness_resume_state`; release lock with the compare-and-delete script; settle the credit hold from `totalUsage` × price table.
7. **Idle policy**: a cron (Trigger schedule, 1 min) stops sandboxes with `last_active_at` > 20 min (`session.stop()` → snapshot) and archives `builder_sessions.state = cold`. Heartbeat from the open tab extends `last_active_at` and calls `sandbox.extendTimeout`.

### 16.4 Reconnect sequence

1. Client mounts with `useChat({ id: chatId, resume: true, transport: new BuilderTransport(...) })`.
2. `reconnectToStream({ chatId })` → `GET /v2/projects/:id/turns/active/stream` with header `Last-Event-ID: <redis id>` (kept in `sessionStorage`). API: if no active turn → 204 → `null`. Else `XRANGE turn:{turnId} (<last> +` then `XREAD BLOCK` until the terminal chunk; each SSE `id:` is the Redis entry id (the legacy relay already validates this format, `chats.controller.ts:191`).
3. If Redis has no stream (expired) but the run is still active: `streams.read(runId, 'ui', { startIndex })` from Trigger.dev as fallback.
4. The transport returns a `ReadableStream<UIMessageChunk>`; `useChat` reconciles parts by id.

### 16.5 Cancel sequence

Client `stop()` → transport aborts the SSE and calls `POST .../cancel` → API `runs.cancel(runId)`, `status = cancelling` → task `signal` → `onCancel` (≤ 30 s): `wip` commit, files list, `detach()`, terminal chunk `finishReason: 'cancelled'`, release lock → API marks `cancelled`, refunds unused hold.

### 16.6 Decisions and why

| Decision | Choice | Reason |
|---|---|---|
| Harness location | inside sandbox (AI SDK Claude Code adapter) | sections 2, 15 |
| Turn host | Trigger.dev task, `small-2x` | `signal`, `onCancel`, queues per project, dashboard; already deployed from `apps/server/src/trigger` |
| Browser transport | SSE via API + Redis Stream replay; Trigger stream as durable copy | reuse V1 relay; no Trigger connection cap; `useChat` untouched |
| Lock | Redis `SET NX PX` + heartbeat + DB partial unique index + Trigger `concurrencyKey` | belt and braces; V1 has the code |
| Checkpoint | git commit per turn + `versions` row | works for Bash edits; diff and restore for free |
| Diagnostics | Playwright server in sandbox + dev-server tail + iframe `postMessage` | feeds "Try to fix" and the agent's verify step |
| Approvals | `permissionMode: 'allow-all'` for built-ins inside the sandbox; `toolApproval` only for host tools that spend money or publish | the sandbox is the blast radius; approvals on shell would make the agent unusable for non-technical users |
| Messages of record | Postgres for display; harness transcript for the model; nightly tar of `~/.claude/projects` to R2 | section 3 |
| Steering mid-turn | not in V2.0; queue a message instead | API not documented in the harness yet |

### 16.7 Things to build first (thin slice)

1. `builder-turn` task with `HarnessAgent` + Vercel Sandbox, `XADD` sink, git commit, no screenshots.
2. `BuilderTransport` with `sendMessages` (POST → then GET stream) and `reconnectToStream` (GET with `Last-Event-ID`).
3. Lock + 409 + cancel.
4. Dev server as detached command + preview URL + heartbeat.
5. Playwright service + `read_preview_diagnostics` host tool + "Try to fix" button.
6. Idle stop/resume cron and `onResume` restart.

---

## 17. Risks

1. `@ai-sdk/harness` is experimental with breaking changes between releases; the bridge pins the Agent SDK 14 patches behind the public one (`ai-sdk-harness.md` §2.2, §2.9).
2. The only shipped sandbox provider is Vercel Sandbox; it needs `VERCEL_OIDC_TOKEN` or an access token even off-Vercel (`ai-sdk-harness.md` §2.9).
3. A Trigger.dev checkpoint kills the bridge WebSocket; any `wait.*` over a few seconds inside the turn task breaks the session unless detached first (https://trigger.dev/docs/wait).
4. Behaviour of the bridge when the host aborts without `detach()` is undocumented (UNVERIFIED); a runaway CLI could burn tokens until the sandbox times out. Always kill the bridge and set `maxBudgetUsd`.
5. Redis in `sfo` with the API in `europe-west4` doubles every relay hop (`inspect-infra-ops.md` line 113).
6. Vite `allowedHosts` and HMR over a proxied preview domain need per-template config; a wrong config shows a blank iframe with no error (https://vite.dev/config/server-options.html).
7. Snapshots are region-bound; a provider outage in one region means re-clone from git (https://vercel.com/docs/sandbox/concepts/snapshots).
8. `total_cost_usd` is an estimate; bill from token counts and the gateway (https://code.claude.com/docs/en/agent-sdk/cost-tracking).
9. Trigger.dev Realtime connection caps (Pro 500+) forbid a direct browser subscription per open tab at scale (https://trigger.dev/docs/limits).
10. Multi-user: without drafts, two editors serialize on one lock; expect 409s and build the "queued message" UX from day one.

---

## 18. Unverified claims

- Whether the AI SDK Claude Code adapter forwards Agent SDK hook events (`PostToolUse`, `Stop`) to the host, or accepts `hooks`/`sessionStore` options through `harnessMetadata`. The bridge calls `query()` with `hooks` (`ai-sdk-harness.md` §2.9) but the public option surface is not documented.
- What happens to the in-sandbox bridge and CLI when the host aborts `stream()` without `detach()`.
- Whether the Vercel `universal` image includes Chromium/Playwright browsers.
- The mid-turn steering API of `@ai-sdk/harness` (CHANGELOG mentions it; docs do not).
- Lovable's exact mechanism for capturing runtime console errors from the user's iframe.
- Whether Trigger.dev `runs.cancel` cascades to child runs (docs page silent).
- `resumable-stream` current npm version and its behaviour across multiple Redis regions.
- Cloudflare Agents SDK ability to host `@ai-sdk/harness` (Node WebSocket client) inside a Durable Object.

---

## 19. Sources

Repo (branch `feat/v2-builder` @ `1b2a9a1e`):
- `apps/server/src/modules/ai-chat/application/services/ai-chat.service.ts:180-201, 455-483, 601-621, 1029, 1210-1213, 1453`
- `apps/server/src/modules/ai-chat/presentation/http/controllers/ai-chat.controller.ts:122-132, 149`
- `apps/server/src/modules/generation/application/services/chat-stream-relay.service.ts:26-127`
- `apps/server/src/modules/generation/presentation/http/controllers/chats.controller.ts:138-191`
- `apps/worker/src/infrastructure/redis/chat-events.publisher.ts:152-153`
- `apps/server/src/modules/ai-chat/agent/site-builder/screenshot.ts:4, 23, 80, 110-122, 189`
- `apps/server/src/modules/ai-chat/agent/site-builder/site-builder-agent.ts:203-227`
- `apps/server/src/modules/ai-chat/agent/gateway-fetch.ts:12-38`
- `apps/web/src/features/workspace/lib/use-live-run.ts:73-93`
- `apps/web/src/features/workspace/lib/use-ai-chat.ts:166-220`
- `apps/server/package.json:23-54`
- `docs/v2/research/ai-sdk-harness.md`, `sandboxes.md`, `competitor-architectures.md`, `inspect-ai-pipeline.md`, `inspect-infra-ops.md`, `inspect-web-builder-ui.md`

Web (fetched 2026-09-03):
- https://ai-sdk.dev/docs/ai-sdk-ui/chatbot-resume-streams
- https://ai-sdk.dev/docs/ai-sdk-ui/transport
- https://raw.githubusercontent.com/vercel/ai/main/packages/ai/src/ui/chat-transport.ts
- https://ai-sdk.dev/docs/reference/ai-sdk-ui/use-chat
- https://ai-sdk.dev/docs/ai-sdk-ui/streaming-data
- https://ai-sdk.dev/docs/ai-sdk-harnesses/harness-agent
- https://ai-sdk.dev/docs/ai-sdk-harnesses/overview
- https://ai-sdk.dev/docs/ai-sdk-harnesses/ui
- https://ai-sdk.dev/providers/ai-sdk-harnesses/claude-code
- https://raw.githubusercontent.com/vercel/ai/main/packages/harness-claude-code/src/claude-code-bootstrap.ts
- https://raw.githubusercontent.com/vercel/resumable-stream/main/README.md
- https://trigger.dev/docs/tasks/overview
- https://trigger.dev/docs/tasks/streams
- https://trigger.dev/docs/realtime/streams
- https://trigger.dev/docs/realtime/react-hooks/streams
- https://trigger.dev/docs/realtime/overview
- https://trigger.dev/docs/queue-concurrency
- https://trigger.dev/docs/management/runs/cancel
- https://trigger.dev/docs/wait
- https://trigger.dev/docs/wait-for-token
- https://trigger.dev/docs/idempotency
- https://trigger.dev/docs/runs/metadata
- https://trigger.dev/docs/machines
- https://trigger.dev/docs/limits
- https://www.inngest.com/docs/features/realtime
- https://www.inngest.com/docs/features/inngest-functions/cancellation
- https://docs.bullmq.io/guide/workers/cancelling-jobs
- https://docs.bullmq.io/guide/jobs/removing-job
- https://developers.cloudflare.com/agents/api-reference/agents-api/
- https://developers.cloudflare.com/durable-objects/best-practices/websockets/
- https://vercel.com/docs/sandbox (last_updated 2026-08-27)
- https://vercel.com/docs/sandbox/sdk-reference
- https://vercel.com/docs/sandbox/concepts/persistent-sandboxes (last_updated 2026-08-25)
- https://vercel.com/docs/sandbox/concepts/snapshots (last_updated 2026-08-26)
- https://docs.e2b.dev/commands/background
- https://code.claude.com/docs/en/claude-code-on-the-web
- https://code.claude.com/docs/en/remote-control
- https://code.claude.com/docs/en/agent-sdk/hooks
- https://code.claude.com/docs/en/agent-sdk/streaming-vs-single-mode
- https://code.claude.com/docs/en/agent-sdk/sessions
- https://code.claude.com/docs/en/agent-sdk/session-storage
- https://code.claude.com/docs/en/agent-sdk/file-checkpointing
- https://code.claude.com/docs/en/agent-sdk/cost-tracking
- https://opencode.ai/docs/server/
- https://opencode.ai/docs/sdk/
- https://v0.app/docs/api/platform
- https://v0.app/docs/sandbox
- https://vercel.com/blog/introducing-the-new-v0-api (2026-08-05)
- https://vercel.com/blog/introducing-the-new-v0 (2026-02-03)
- https://vercel.com/blog/how-we-made-v0-an-effective-coding-agent (2026-01-07)
- https://docs.lovable.dev/tips-tricks/troubleshooting
- https://docs.lovable.dev/features/modes
- https://docs.lovable.dev/features/collaboration
- https://docs.lovable.dev/features/projects/history
- https://docs.lovable.dev/integrations/github
- https://claude.com/customers/lovable
- https://playwright.dev/docs/api/class-page
- https://vite.dev/config/server-options.html
- https://redis.io/docs/latest/develop/data-types/streams/
- https://redis.io/docs/latest/develop/clients/patterns/distributed-locks/
- https://www.postgresql.org/docs/current/explicit-locking.html
- https://www.postgresql.org/docs/current/functions-admin.html
- https://git-scm.com/docs/git-status
