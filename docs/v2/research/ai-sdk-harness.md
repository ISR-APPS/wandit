# Running a coding harness through the Vercel AI SDK — research report

Date: 2026-09-03. Branch: `feat/v2-builder` (identical to `dev` at commit `1b2a9a1e`).
Author: Claude Fable research agent (read-only; no code changed).

Evidence marks: `path:line` = read in this worktree. URL = fetched on 2026-09-03. `UNVERIFIED` = not confirmed from a primary source.

Scope: (a) the AI SDK v7 "harness" feature, (b) the Claude Agent SDK, (c) Anthropic Managed Agents. The last section maps the three options to the wandit V2 builder.

---

## 0. Summary in ten sentences

1. The AI SDK v7 ships an experimental `HarnessAgent` (`@ai-sdk/harness@1.0.100`) that runs an existing coding harness and returns AI SDK streams that `useChat` already understands.
2. Ten adapters exist today: Claude Code, Codex, OpenCode, Pi, Deep Agents, Cline, Cursor, fx, Grok Build, and a generic ACP adapter. Amp, Goose, and Mastra are "coming soon".
3. Every bridge-backed adapter runs the harness **inside a sandbox**, not on your server. The only officially supported network sandbox is Vercel Sandbox (`@ai-sdk/sandbox-vercel`). A custom provider must implement `HarnessV1SandboxProvider`.
4. The Claude Code adapter installs `@anthropic-ai/claude-agent-sdk@0.3.245` plus the `@anthropic-ai/claude-code@2.1.245` CLI inside the sandbox and talks to it over a WebSocket on one exposed port.
5. Sessions can be detached (sandbox stays warm), stopped (sandbox snapshot), or destroyed; the opaque resume state holds the Claude session id and the bridge coordinates.
6. Tool approvals work for built-in tools (`permissionMode: 'allow-reads' | 'allow-edits' | 'allow-all'`) and for host tools (`toolApproval`); the `useChat` approval flow is reused.
7. Usage is reported as token counts on the `finish` part; USD cost is not surfaced by the adapter. You must price tokens yourself.
8. The Claude Agent SDK (`@anthropic-ai/claude-agent-sdk@0.3.259`) is the layer under the adapter. It gives permission modes, `canUseTool`, hooks, in-process MCP tools, subagents, session resume/fork, a `SessionStore` for cross-host resume, file checkpointing, and `total_cost_usd` estimates. It spawns a `claude` subprocess and needs a Linux container with ~1 GiB RAM per agent.
9. Managed Agents is Anthropic's hosted alternative: agent + environment + session, Claude-only, $0.08 per session-hour plus tokens, beta, no Zero Data Retention, no documented preview port on cloud sandboxes. It has no AI SDK harness adapter.
10. For wandit V2 the practical path is `HarnessAgent` + Claude Code adapter for the chat and session semantics, with the sandbox provider treated as a swappable dependency; the Agent SDK direct path is the fallback that reuses the same skills and prompts.

---

## 1. What the repo does today (baseline for V2)

- AI SDK versions in use: `ai@^7.0.19` (`apps/server/package.json:45`, `apps/web/package.json:31`), `@ai-sdk/react@^4.0.17` (`apps/web/package.json:15`), `@ai-sdk/gateway@4.0.15` (`apps/server/package.json:23`), `@ai-sdk/mcp@2.0.10` (`apps/server/package.json:24`). Root package manager: `pnpm@11.7.0` (`package.json:36`).
- The chat "Brain" is a per-request `ToolLoopAgent` (`apps/server/src/modules/ai-chat/agent/chat-agent.ts:418-440`). It already passes a `toolApproval` map (`chat-agent.ts:476`) and `stopWhen: isStepCount(...)` (`chat-agent.ts:473`).
- The response is built with `createUIMessageStream<WanditUIMessage>` (`apps/server/src/modules/ai-chat/application/services/ai-chat.service.ts:84`, `:1020`). Custom data parts such as `data-ai-error` are written on the same writer (`ai-chat.service.ts:1029`).
- The builder agent is a second `ToolLoopAgent` with hand-built tools (`apps/server/src/modules/ai-chat/agent/site-builder/site-builder-agent.ts`; full map in `docs/v2/research/inspect-ai-pipeline.md`).
- Latest published `ai` is `7.0.91` (https://registry.npmjs.org/ai/latest). `@ai-sdk/harness` pins `ai@7.0.91` as a hard dependency, so a V2 module must move the server to `ai@7.0.91` or newer to avoid two copies of `ai`.

---

## 2. AI SDK v7 harness feature

### 2.1 Release status and dates

- 2026-06-12: Vercel changelog "Program Claude Code, Codex, Pi and other agent harnesses with AI SDK". `HarnessAgent` was on the AI SDK canary channel (https://vercel.com/changelog/program-agent-harnesses-with-ai-sdk; WebFetch failed on the page body, summary taken from search snippet — UNVERIFIED wording).
- 2026-06-25: "AI SDK 7 is now available". Harnesses shipped as "experimental harness abstractions and HarnessAgent" (https://vercel.com/blog/ai-sdk-7).
- 2026-06-25: "Deep Agents and OpenCode are now available in the AI SDK Harness" (https://vercel.com/changelog/deepagents-and-opencode-harness-adapters).
- Docs state: "Harness packages are experimental. Expect breaking changes between releases as this early API gets further refined." (https://ai-sdk.dev/docs/ai-sdk-harnesses/overview).
- Both `@ai-sdk/harness` and the adapters are published on the `latest` npm tag today (https://registry.npmjs.org/@ai-sdk/harness/latest resolves to 1.0.100).

### 2.2 Package names and versions (npm, 2026-09-03)

| Package | Version | Notes | Source |
|---|---|---|---|
| `ai` | 7.0.91 | deps: `@ai-sdk/gateway@4.0.73`, `@ai-sdk/provider@4.0.10`, `@ai-sdk/provider-utils@5.0.36` | https://registry.npmjs.org/ai/latest |
| `@ai-sdk/harness` | 1.0.100 | Apache-2.0. deps: `ai@7.0.91`, `@ai-sdk/provider@4.0.10`, `@ai-sdk/provider-utils@5.0.36`. peer: `ws@^8.21.0` (optional), `zod@^3.25.76 \|\| ^4.1.8`. Exports: `.`, `./agent`, `./utils`, `./bridge` | https://registry.npmjs.org/@ai-sdk/harness/latest ; https://raw.githubusercontent.com/vercel/ai/main/packages/harness/package.json |
| `@ai-sdk/harness-claude-code` | 1.0.104 | Apache-2.0. deps: `@ai-sdk/harness@1.0.100`, `@ai-sdk/provider-utils@5.0.36`, `ws@^8.21.0` | https://registry.npmjs.org/@ai-sdk/harness-claude-code/latest |
| `@ai-sdk/harness-codex` | (not fetched) | Codex adapter | https://ai-sdk.dev/providers/ai-sdk-harnesses/codex |
| `@ai-sdk/harness-opencode` | (not fetched) | OpenCode adapter; bootstraps `@opencode-ai/sdk` and `opencode-ai` in the sandbox | https://ai-sdk.dev/providers/ai-sdk-harnesses/opencode |
| `@ai-sdk/harness-pi` | (not fetched) | wraps `@earendil-works/pi-coding-agent` | https://ai-sdk.dev/providers/ai-sdk-harnesses/pi |
| `@ai-sdk/harness-acp` | (not fetched) | any Agent Client Protocol v1 agent | https://ai-sdk.dev/providers/ai-sdk-harnesses/acp |
| `@ai-sdk/harness-deepagents`, `-cline`, `-cursor`, `-fx`, `-grok-build` | (not fetched) | listed in `packages/` | https://github.com/vercel/ai/tree/main/packages |
| `@ai-sdk/sandbox-vercel` | (not fetched) | recommended network sandbox provider | https://ai-sdk.dev/providers/ai-sdk-harnesses/claude-code |
| `@ai-sdk/sandbox-just-bash` | (not fetched) | host-runtime alternative, no network sandbox | https://ai-sdk.dev/docs/ai-sdk-harnesses/harness-agent (README summary) |
| `@ai-sdk/workflow-harness` | (not fetched) | durable turns on Vercel Workflow | https://ai-sdk.dev/docs/ai-sdk-harnesses/workflow-utilities |

Install command from the Claude Code page: `pnpm add @ai-sdk/harness @ai-sdk/harness-claude-code @ai-sdk/sandbox-vercel` (https://ai-sdk.dev/providers/ai-sdk-harnesses/claude-code).

### 2.3 Supported harnesses

From https://ai-sdk.dev/providers/ai-sdk-harnesses and https://ai-sdk.dev/docs/ai-sdk-harnesses/harness-adapters:

| Harness | Package | Runs where | Built-in tool approvals | Built-in tool filtering | Notes |
|---|---|---|---|---|---|
| Claude Code | `@ai-sdk/harness-claude-code` | sandbox bridge | yes (`allow-reads`, `allow-edits`) | yes (adapter sends `builtinToolFiltering`) | backed by `@anthropic-ai/claude-agent-sdk` |
| Codex | `@ai-sdk/harness-codex` | sandbox bridge | **no** ("use `permissionMode: 'allow-all'`") | no | `reasoningEffort` low..max, `webSearch`, `codexConfig` |
| OpenCode | `@ai-sdk/harness-opencode` | sandbox bridge (boots an OpenCode server) | yes | UNVERIFIED | multi-provider: Anthropic, OpenAI, AI Gateway, OpenAI-compatible |
| Pi | `@ai-sdk/harness-pi` | sandbox | yes | UNVERIFIED | provider env keys (OpenAI, Anthropic, Mistral, ...) |
| Deep Agents | `@ai-sdk/harness-deepagents` | sandbox | yes | UNVERIFIED | LangChain Deep Agents |
| Cline, Cursor, fx, Grok Build | `@ai-sdk/harness-*` | sandbox / ACP | varies | varies | listed, not evaluated |
| ACP (generic) | `@ai-sdk/harness-acp` | sandbox via ACP | three permission modes mapped to ACP modes | no portable filtering | documented targets: Claude Code ACP, Codex ACP, Cursor ACP, Grok Build ACP |
| Amp, Goose, Mastra | — | — | — | — | "coming soon" |

Gemini CLI: not listed as a first-party adapter. Gemini CLI exposes an ACP mode (`gemini --experimental-acp`, JSON-RPC over stdio) (https://github.com/google-gemini/gemini-cli/blob/main/docs/cli/acp-mode.md). It should be reachable through `@ai-sdk/harness-acp` with a custom `executable`, but Vercel does not document it as a tested target. UNVERIFIED.

Managed Agents: no AI SDK harness adapter exists in the packages list. UNVERIFIED that one is planned.

### 2.4 API surface — `HarnessAgent`

Source: https://ai-sdk.dev/docs/ai-sdk-harnesses/harness-agent, plus the `packages/harness` README (https://raw.githubusercontent.com/vercel/ai/main/packages/harness/README.md).

Import: `import { HarnessAgent } from '@ai-sdk/harness/agent'`.

Constructor options:

```ts
new HarnessAgent({
  harness,            // adapter instance, e.g. claudeCode
  model?,             // harness-specific model string, e.g. 'claude-sonnet-4-6'
  sandbox,            // HarnessV1SandboxProvider (required unless caller-owned sandboxSession)
  id?, instructions?, // instructions are appended to the system prompt or prepended to user input
  output?,            // Output.object({ schema }) — typed structured output per turn
  tools?,             // host-executed AI SDK tools (same shape as ToolLoopAgent)
  activeTools?, inactiveTools?,   // allow / deny list (cannot combine)
  skills?,            // [{ name, description, content, files? }]
  permissionMode?,    // 'allow-all' (default) | 'allow-edits' | 'allow-reads'  (built-in tools)
  toolApproval?,      // { toolName: 'user-approval' | 'approved' | 'denied' | 'not-applicable' } (host tools)
  stopWhen?,          // e.g. isStepCount(1)
  callOptionsSchema?, prepareCall?,  // per-turn dynamic settings (model, instructions, tools, skills)
  sandboxConfig?: { workDir?, bootstrapHash?, onBootstrap?, onSession? },
  telemetry?, debug?, onLog?,
})
```

Sessions:

```ts
const session = await agent.createSession({ sessionId?: chatId });
await agent.createSession({ sessionId: chatId, resumeFrom: resumeState });     // after detach()/stop()
await agent.createSession({ sessionId: chatId, continueFrom: continuationState }); // after suspendTurn()
await agent.createSession({ sandboxSession });                                   // caller-owned sandbox
```

Turns:

```ts
const result = await agent.generate({ session, prompt?, messages?, options?, abortSignal? });
// { text, output?, usage?, finishReason }
const result = await agent.stream({ session, prompt?, messages?, options?, abortSignal? });
// result.stream: AsyncIterable<StreamPart>; result.output; result.partialOutputStream
await agent.continueGenerate({ session }); await agent.continueStream({ session, toolResultContinuations? });
```

Lifecycle:

- `session.detach()` → returns opaque `resumeState`, keeps sandbox warm ("parks bridge and sandbox").
- `session.stop()` → saves state and stops the sandbox (snapshot path).
- `session.destroy()` → cleanup, no resume.
- `session.suspendTurn()` → serializable continuation state for a process hand-off; `session.hasUnfinishedTurn()`.

Important semantic: "A harness session owns its native conversation history. When you pass `messages`, `HarnessAgent` takes the latest user message as fresh input" and does not replay history. Persist and resume sessions instead of replaying (https://ai-sdk.dev/docs/ai-sdk-harnesses/harness-agent).

Stream parts documented on the HarnessAgent page: `text-delta`, `tool-call`, `tool-result`, `step-finish`, `finish` (with `finishReason`). The README adds `text-start`/`text-end` and `finish.totalUsage`. The Claude Code bridge also emits `reasoning-start/delta/end`, `tool-input-start/delta/end`, `finish-step`, `raw`, and `compaction` (https://raw.githubusercontent.com/vercel/ai/main/packages/harness-claude-code/src/claude-code-harness.ts, summary).

### 2.5 Tools, permissions, and approvals

Source: https://ai-sdk.dev/docs/ai-sdk-harnesses/tools.

- Three tool surfaces: built-in harness tools (`read`, `write`, `edit`, `bash`, `glob`, `grep`, `webSearch` on Claude Code), host-executed AI SDK tools (`tools: { ... }`), and external MCP tools (adapter `mcpServers`).
- Built-in calls run in the harness runtime; their stream parts carry `providerExecuted: true`.
- Host tools run in your server process; results are submitted back to the runtime. Host tools receive `experimental_sandbox` (a restricted sandbox session: `readTextFile`, `writeTextFile`, `run`) so a wandit tool can read the workspace without stopping the sandbox.
- Client-side tools: omit `execute`; the turn pauses; use `session.hasUnfinishedTurn()` / `suspendTurn()` or `continueStream({ toolResultContinuations })`.
- `permissionMode` values: `allow-all` (default; reads, edits, shell), `allow-edits` (approval for shell), `allow-reads` (approval for edits and shell). When approval is needed the stream pauses after a `tool-approval-request`; `useChat` handles the response in UI flows.
- `toolApproval` for host tools uses the same `'user-approval' | 'approved' | 'denied' | 'not-applicable'` statuses as `ToolLoopAgent`, so the existing `approvalMap` pattern (`chat-agent.ts:476`) carries over.
- Dynamic tool parts: `fileChange` (opaque workspace file mutations) and `compaction` (runtime context compaction). Check `part.dynamic` before assuming a typed tool.
- The Claude Code adapter maps `permissionMode` to the Agent SDK like this (from the bridge source, https://raw.githubusercontent.com/vercel/ai/main/packages/harness-claude-code/src/bridge/index.ts):
  - `allow-all` → `permissionMode: 'bypassPermissions', allowDangerouslySkipPermissions: true`
  - `allow-edits` → `permissionMode: 'acceptEdits'` + `canUseTool` that gates bash
  - `allow-reads` → `permissionMode: 'default'` + `canUseTool` that denies edit and bash tools
- Host tools are exposed to Claude as an in-process MCP server named `harness-tools` (`type: 'sdk'`), so their tool names inside Claude are `mcp__harness-tools__<name>`.

### 2.6 Mapping to UI message streams / `useChat`

Source: https://ai-sdk.dev/docs/ai-sdk-harnesses/ui.

- Client: `useChat({ id, transport: new DefaultChatTransport({ api: '/api/chat' }) })` — unchanged from V1 (`docs/v2/research/inspect-ai-pipeline.md` §1.1 cites `apps/web/src/features/workspace/lib/use-ai-chat.ts:166-220`).
- Server route pattern:

```ts
createUIMessageStreamResponse({
  stream: createUIMessageStream({
    execute: async ({ writer }) => {
      const session = await resumeOrCreateSession({ agent, chatId }); // by chat id
      const result = await agent.stream({ session, messages: convertToModelMessages(uiMessages) });
      writer.merge(toUIMessageStream({ stream: result.stream, /* ... */ }));
    },
    onEnd: async () => { resumeState = await session.detach(); /* persist by chatId */ },
  }),
});
```

- "Persist only the opaque resume state returned by `session.detach()`", keyed by chat id. Use the chat id as the session id "for sandbox stability across requests".
- Message parts on the client: `text`, `reasoning`, typed tools (`tool-bash`, `tool-read`, ...), and `dynamic-tool` for file changes and compaction. Infer UI tool types from `agent.tools`.
- `getHarnessErrorMessage` converts harness errors into client-safe error parts.
- `@ai-sdk/harness@1.0.37` added the message-level `start` part so `toUIMessageStream` persistence mode can inject the response message id (https://raw.githubusercontent.com/vercel/ai/main/packages/harness/CHANGELOG.md).
- This is the same `createUIMessageStream` writer that wandit uses today (`ai-chat.service.ts:1020`), so custom `data-*` parts (credits, errors, build progress) can be merged into the same stream.

### 2.7 Session resume

- In-process: `session.detach()` keeps the sandbox warm; `createSession({ sessionId, resumeFrom })` reattaches.
- Across restarts: `session.stop()` saves state and stops the sandbox; resume rehydrates it. Requires a provider that implements `resumeSession` (Vercel Sandbox with persistent sandboxes/snapshots).
- Claude Code resume state schema (adapter source): `claudeSessionId` ("the exact Claude conversation to rehydrate on resume ... instead of relying on the SDK's `continue` flag"), `bridge` (`port`, `token`, `lastSeenEventId`, optional `sandboxId`), and `sandboxCredentialEnvironment`.
- The bootstrap keeps `~/.claude/projects/<dir>/*.jsonl` and bridge state under the sandbox default working directory "so snapshot-capable providers can preserve the installed CLI, bridge, and recipe marker" across detach→attach and stop→snapshot→resume (https://raw.githubusercontent.com/vercel/ai/main/packages/harness-claude-code/src/claude-code-bootstrap.ts).
- Durable execution: `@ai-sdk/workflow-harness` runs one `stream()` per workflow step (`stopWhen: isStepCount(1)`) or by time slice (750 s default, `timeSliceSeconds`); persist `resumeFrom` by `sessionId` with `loadResumeStep`/`persistResumeStep` (https://ai-sdk.dev/docs/ai-sdk-harnesses/workflow-utilities). This targets Vercel Workflow DevKit, not Trigger.dev.
- Mid-turn steering: `@ai-sdk/harness@1.0.78` added "experimental support for steering agent conversations mid-turn" (CHANGELOG).

### 2.8 Cost and usage reporting

- `finish` carries `totalUsage` (README) and `result.usage` on `generate()`.
- The Claude Code bridge reads `msg.usage ?? msg.message?.usage` and `msg.total_cost_usd`, aggregates token counts with a recursive `addUsage()`, and emits `finish` (bridge source summary). The adapter itself performs "no mapping to `total_cost_usd`, `usage`, or `modelUsage`" (adapter source summary). Whether `total_cost_usd` reaches the host in `harnessMetadata['claude-code']` is UNVERIFIED; plan to price token counts yourself with the Anthropic price table (§4.6).
- `@ai-sdk/harness@1.0.62`: "Expose provider metadata on language-model-call end callbacks and telemetry spans" (CHANGELOG). `telemetry` option exists on `HarnessAgent`; AI SDK 7 `registerTelemetry(new OpenTelemetry())` and `onStart/onEnd` callbacks with `usage` are documented for the core (https://vercel.com/blog/ai-sdk-7).

### 2.9 Where the harness process runs (server vs sandbox)

- "The adapter runs a bridge inside the sandbox and streams Claude Code events back to the host over a sandbox-exposed WebSocket" (https://ai-sdk.dev/providers/ai-sdk-harnesses/claude-code).
- Host = your Node server running `HarnessAgent`. Sandbox = a Vercel Sandbox microVM (`createVercelSandbox({ runtime: 'node24', ports: [4000] })`). "Claude Code requires a network sandbox with at least one exposed port." The bridge port is `sandbox.ports[0]` or `settings.port`; auth is a random 32-byte hex token (`mintBridgeToken`) passed as `BRIDGE_CHANNEL_TOKEN`.
- Bootstrap inside the sandbox (`claude-code-bootstrap.ts`): writes `.harness-bootstrap/claude-code/{package.json,pnpm-lock.yaml,pnpm-workspace.yaml,bridge.mjs}`, runs `pnpm install --frozen-lockfile --store-dir .pnpm-store`, then `./node_modules/.bin/claude --version`.
- Bridge lockfile pins (https://raw.githubusercontent.com/vercel/ai/main/packages/harness-claude-code/src/bridge/package.json): `@anthropic-ai/claude-agent-sdk@0.3.245`, `@anthropic-ai/claude-code@2.1.245`, `@modelcontextprotocol/sdk@1.30.0`, `ws@8.21.0`, `zod@4.4.3`. The public Agent SDK is at 0.3.259, so the harness lags by ~14 patch releases.
- The bridge calls `query()` with: `model`, `maxTurns`, `env`, `skills`, `tools`, `disallowedTools`, `systemPrompt`, `thinking`, `effort`, `outputFormat`, `includePartialMessages`, `hooks`, `resume`/`continue`, `permissionMode`, `allowDangerouslySkipPermissions`, `settings`, `canUseTool`, `mcpServers`, `cwd`, `abortSignal` (bridge source summary).
- Sandbox provider contract (https://raw.githubusercontent.com/vercel/ai/main/packages/harness/src/v1/harness-v1-sandbox-provider.ts): `specificationVersion: 'harness-sandbox-v1'`, `providerId`, `createSession({ sessionId?, abortSignal?, identity?, onFirstCreate? })` and optional `resumeSession({ sessionId })`, both returning a `HarnessV1NetworkSandboxSession`. `identity` + `onFirstCreate` support snapshot-based reuse. A custom provider for Cloudflare Sandbox, E2B, Daytona, or Docker is possible in principle; effort is UNVERIFIED and there is no public third-party provider found.
- `@ai-sdk/sandbox-just-bash` is a host-runtime option "only" for adapters that do not need a network sandbox; Claude Code needs the network sandbox.
- Credentials: `auth` modes `auto` (AI Gateway first, then direct Anthropic), `direct`, `ai-gateway`, or an explicit env object such as `{ ANTHROPIC_API_KEY }`. Env vars read: `VERCEL_OIDC_TOKEN`, `AI_GATEWAY_API_KEY`, `AI_GATEWAY_BASE_URL`, `ANTHROPIC_API_KEY`, `ANTHROPIC_AUTH_TOKEN`, `ANTHROPIC_BASE_URL`. `credentialForwarding` lets you rewrite credentials before they are forwarded; with request-transforming sandboxes the bridge sees placeholders and the adapter injects secrets on outbound requests (https://ai-sdk.dev/providers/ai-sdk-harnesses/claude-code).
- `VERCEL_OIDC_TOKEN` is required for Vercel Sandbox (same page). This ties the runtime to a Vercel account even when the app server is not on Vercel.

### 2.10 Vercel Sandbox facts (the default runtime)

Source: https://vercel.com/docs/sandbox/pricing (last updated 2026-08-21).

- Pro/Enterprise prices (iad1): Active CPU $0.128/hour, Provisioned Memory $0.0212/GB-hour, Creations $0.60 per 1M, egress $0.15/GB (downloads free), snapshot storage $0.08/GB-month.
- Limits: Pro max 8 vCPU / 16 GB, Enterprise 32 vCPU / 64 GB; max 15 open ports; 64 GB ephemeral NVMe; max session duration 24 h (Pro), resets on stop/resume so persistent sandboxes are unbounded; 10,000 concurrent sandboxes; default timeout 5 min (`timeout`, `extendTimeout()`); snapshots expire 30 days after last use by default.
- Regions: `iad1`, `sfo1`, `cle1`, `cdg1`.
- Worked example: 30 min build-and-test on 4 vCPU/8 GB ≈ $0.34 at 100% CPU.
- Consequence for a Lovable-style preview: one port is taken by the bridge; the app dev server needs a second exposed port. Port traffic is billable at $0.15/GB.

### 2.11 Other AI SDK 7 features that matter here

- Tool approvals with optional HMAC-signed approvals; the SDK revalidates tool inputs (https://vercel.com/blog/ai-sdk-7). `ToolLoopAgentSettings` still does not expose `experimental_toolApprovalSecret` (`chat-agent.ts:475`).
- `WorkflowAgent` (`@ai-sdk/workflow`) for durable execution across restarts.
- `SandboxSession` abstraction for portable command execution in tools.

---

## 3. Claude Agent SDK (`@anthropic-ai/claude-agent-sdk`)

### 3.1 Package facts

Source: https://registry.npmjs.org/@anthropic-ai/claude-agent-sdk/latest.

- Version 0.3.259. License field: "SEE LICENSE IN README.md" (governed by Anthropic Commercial Terms, see §3.10). Engines: Node >= 18.
- Peer deps: `zod@^4.0.0`, `@anthropic-ai/sdk@>=0.93.0`, `@modelcontextprotocol/sdk@^1.29.0`.
- Optional deps ship native CLI binaries: `@anthropic-ai/claude-agent-sdk-{linux-x64,linux-arm64,linux-x64-musl,linux-arm64-musl,darwin-x64,darwin-arm64,win32-x64,win32-arm64}`. Installs with `--omit=optional` get no binary; then set `pathToClaudeCodeExecutable` (https://code.claude.com/docs/en/agent-sdk/quickstart).
- "The bundled binary is pinned to the SDK package version, so updating the SDK is how you update the CLI." (https://code.claude.com/docs/en/agent-sdk/hosting)
- Docs moved: `platform.claude.com/docs/en/agent-sdk/*` redirects (307) to `https://code.claude.com/docs/en/agent-sdk/*`.

### 3.2 Headless mode and the `query()` API

Source: https://code.claude.com/docs/en/agent-sdk/typescript.

```ts
import { query } from "@anthropic-ai/claude-agent-sdk";
for await (const message of query({ prompt, options })) { ... }
```

- `prompt`: `string` (single-message mode) or `AsyncIterable<SDKUserMessage>` (streaming input mode).
- Core options: `cwd`, `model`, `fallbackModel`, `effort` (`low..max`), `thinking` (`adaptive` | `enabled { budgetTokens }` | `disabled`), `maxTurns`, `maxBudgetUsd`, `outputFormat: { type: 'json_schema', schema }`, `systemPrompt` (string | array | `{ type: 'preset', preset: 'claude_code', append?, excludeDynamicSections? }`), `settings`, `settingSources: ('user'|'project'|'local')[]`, `managedSettings`.
- Permissions: `permissionMode`, `allowedTools`, `disallowedTools`, `allowDangerouslySkipPermissions`, `canUseTool`, `tools` (availability list).
- Sessions: `resume`, `continue`, `forkSession`, `sessionId`, `persistSession` (default true), `resumeSessionAt`, `sessionStore`, `sessionStoreFlush`.
- MCP: `mcpServers: Record<string, McpServerConfig>` (stdio, sdk in-process, http), `strictMcpConfig`, `skills`.
- Hooks: `hooks`, `includeHookEvents`, `onElicitation`.
- Subagents: `agents: Record<string, AgentDefinition>`, `agent`, `forwardSubagentText`, `agentProgressSummaries`.
- Streaming: `includePartialMessages`, `promptSuggestions`.
- Process: `env` (TypeScript: replaces the subprocess env, spread `process.env`), `executable` (`bun`|`deno`|`node`), `executableArgs`, `extraArgs`, `pathToClaudeCodeExecutable`, `spawnClaudeCodeProcess`, `debug`, `stderr`.
- Advanced: `abortController`, `additionalDirectories`, `enableFileCheckpointing`, `sandbox`, `betas`, `plugins`.
- `Query` object: `interrupt()`, `setPermissionMode()`, `setModel()`, `streamInput()` (hosting page), `rewindFiles()`.
- `startup({ options })` pre-warms a subprocess and returns `WarmQuery.query(prompt)`.
- Session helpers: `listSessions`, `getSessionMessages`, `getSessionInfo`, `renameSession`, `tagSession`, `deleteSession`, `forkSession`, `listSubagents`, `getSubagentMessages`.
- Non-JS languages: run the CLI as a subprocess with `-p --output-format json` (https://code.claude.com/docs/en/agent-sdk/overview).

### 3.3 Streaming JSON events

Source: https://code.claude.com/docs/en/agent-sdk/streaming-output.

- Default: complete `assistant` messages plus a final `result`.
- `includePartialMessages: true` adds `{ type: 'stream_event', event: BetaRawMessageStreamEvent, parent_tool_use_id, uuid, session_id, ttft_ms? }` with raw API events: `message_start`, `content_block_start`, `content_block_delta` (`text_delta`, `input_json_delta`, thinking deltas), `content_block_stop`, `message_delta` (usage), `message_stop`.
- Order: stream events → `assistant` (complete) → tool executes → more stream events → `result`.
- Subagent token deltas are not forwarded; subagent complete messages carry `parent_tool_use_id`.
- Other message types: `system` (`init` with `session_id`, `compact_boundary`, `mirror_error`), `user` (tool results; with `extraArgs: { 'replay-user-messages': null }` you also get user message UUIDs for checkpoints), `result` (`subtype: 'success' | 'error_max_turns' | 'error_max_budget_usd' | 'error_during_execution' ...`).
- Structured output appears only in `result.structured_output`, not as deltas.

### 3.4 Permission modes and `canUseTool`

Source: https://code.claude.com/docs/en/agent-sdk/permissions and https://code.claude.com/docs/en/agent-sdk/user-input.

- Modes: `default` (no auto-approvals; unmatched tools go to `canUseTool`), `dontAsk` (deny instead of prompt), `acceptEdits` (auto-approve Edit/Write and fs commands `mkdir`, `touch`, `rm`, `rmdir`, `mv`, `cp`, `sed` inside `cwd`/`additionalDirectories`), `bypassPermissions` (approve everything except critical-path removals; requires `allowDangerouslySkipPermissions: true`), `plan` (read-only; edits go to `canUseTool`), `auto` (model classifier).
- Evaluation order: hooks → deny rules → ask rules → permission mode → allow rules → `canUseTool`. Deny rules and hooks apply even in `bypassPermissions`. `allowedTools` does not constrain `bypassPermissions`.
- `canUseTool(toolName, input, { signal, suggestions })` returns `{ behavior: 'allow', updatedInput, updatedPermissions? }` or `{ behavior: 'deny', message }`. It can stay pending indefinitely. For long waits use a `PreToolUse` hook that returns `permissionDecision: 'defer'` so the process can exit and resume later.
- `AskUserQuestion` (1-4 questions, 2-4 options each) also arrives through `canUseTool`; `toolConfig.askUserQuestion.previewFormat: 'html' | 'markdown'` adds option previews. Not available in subagents.
- Subagents inherit the parent mode; `bypassPermissions`, `acceptEdits`, `auto` cannot be overridden per subagent.
- Rule syntax: bare names (`Bash`) remove the tool; scoped rules (`Bash(rm *)`, `Edit(//secrets/**)`) deny matching calls; `mcp__server__*` globs for MCP.

### 3.5 Hooks

Source: https://code.claude.com/docs/en/agent-sdk/hooks.

- Register with `hooks: { PreToolUse: [{ matcher: 'Write|Edit', hooks: [cb], timeout? }] }`.
- Events (TypeScript column "Yes" unless noted): `PreToolUse`, `PostToolUse`, `PostToolUseFailure`, `PostToolBatch`, `UserPromptSubmit`, `MessageDisplay`, `Stop`, `StopFailure`, `SubagentStart`, `SubagentStop`, `PreCompact`, `PostCompact`, `PermissionRequest`, `PermissionDenied`, `SessionStart`, `SessionEnd`, `Notification`, `Setup`, `TeammateIdle`, `TaskCreated`, `Elicitation`, `ElicitationResult`, `ConfigChange`, `InstructionsLoaded`, `WorktreeCreate`, `WorktreeRemove`, `CwdChanged`, `FileChanged`, `DirectoryAdded`.
- `PreToolUse` returns `hookSpecificOutput.permissionDecision: 'allow' | 'deny' | 'ask' | 'defer'`, `permissionDecisionReason`, `updatedInput`. `PostToolUse` can set `additionalContext` or `updatedToolOutput`. `async: true` runs a hook without blocking.
- Hooks run before every other permission step and a hook deny applies even in `bypassPermissions`.

### 3.6 Custom tools and MCP

Source: https://code.claude.com/docs/en/agent-sdk/custom-tools.

- `tool(name, description, zodShape, handler, { annotations?, searchHint?, alwaysLoad? })` + `createSdkMcpServer({ name, version?, instructions?, tools, alwaysLoad?, timeout? })` run in-process. Pass as `mcpServers: { weather: server }`; tool names become `mcp__weather__get_temperature`; pre-approve with `allowedTools: ['mcp__weather__*']`.
- Handlers return `{ content: [{ type: 'text' | 'image' | 'audio' | 'resource' | 'resource_link', ... }], structuredContent?, isError? }`.
- Tool search is on by default and defers SDK MCP tool schemas; `alwaysLoad: true` keeps a schema in the initial prompt.
- `tools: []` removes all built-ins so Claude only sees your MCP tools.
- External MCP servers (stdio, HTTP) via `mcpServers` config (https://code.claude.com/docs/en/agent-sdk/mcp — not fetched; referenced from custom-tools page).

### 3.7 Sessions, resume, and cross-host storage

Sources: https://code.claude.com/docs/en/agent-sdk/sessions, https://code.claude.com/docs/en/agent-sdk/session-storage.

- Session id: from `system` `init` message (TypeScript) and on every `result`.
- `resume: sessionId`, `continue: true` (most recent in cwd), `forkSession: true` (copy history to a new id).
- Storage: `~/.claude/projects/<encoded-cwd>/<session-id>.jsonl` or `$CLAUDE_CONFIG_DIR/projects/`. `CLAUDE_CODE_PROJECT_DIR_NAME` (SDK >= 0.3.234) shortens the project dir name.
- The experimental V2 `createSession()` API was removed in 0.3.142.
- `SessionStore` adapter (`append`, `load`, optional `listSessions`, `listSessionSummaries`, `delete`, `listSubkeys`) mirrors transcripts to S3/Redis/Postgres for resume on another host. Reference adapters live in `examples/session-stores/` (not published to npm). Dual-write: local first, store second; a run resumed from the store deletes its local copy; mirror failures emit `{ type: 'system', subtype: 'mirror_error' }`. `persistSession: false` and file checkpointing conflict with a store.
- Sessions persist the conversation, not the filesystem. File checkpointing (`enableFileCheckpointing`, `rewindFiles(uuid)`) tracks Write/Edit/NotebookEdit only, not Bash or subagent edits (https://code.claude.com/docs/en/agent-sdk/file-checkpointing).

### 3.8 Subagents

Source: https://code.claude.com/docs/en/agent-sdk/subagents.

- `agents: { name: { description, prompt, tools?, disallowedTools?, model?, skills?, memory?, mcpServers?, maxTurns?, background?, effort?, permissionMode? } }`.
- Detect via `tool_use` blocks named `Agent` (older: `Task`); messages inside a subagent carry `parent_tool_use_id`.
- Caps: `CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH` (default 3), `CLAUDE_CODE_MAX_CONCURRENT_SUBAGENTS` (default 20), `maxBudgetUsd`. Opus 5 delegates more readily; the `claude_code` preset adds a "do not call Agent unless asked" line for Opus 5.
- `CLAUDE_AGENT_SDK_DISABLE_BUILTIN_AGENTS=1` removes the built-in `general-purpose` subagent.

### 3.9 Cost fields

Source: https://code.claude.com/docs/en/agent-sdk/cost-tracking.

- `result.total_cost_usd` and `modelUsage[model].costUSD` are "client-side estimates, not authoritative billing data" computed from a bundled price table (or a `modelPricing` settings table). Do not bill end users from them. Authoritative: Usage and Cost API.
- `result.usage` covers only the main loop; `total_cost_usd` and `modelUsage` include subagents. Per-step assistant `usage.output_tokens` is a placeholder; read output tokens from `result.usage` or `modelUsage`.
- Cache fields: `cache_creation_input_tokens`, `cache_read_input_tokens`. `ENABLE_PROMPT_CACHING_1H=1`, `CLAUDE_CODE_PROMPT_CACHE_TTL=5m|1h`.
- Streaming input mode: each turn emits its own `result`; `total_cost_usd` is a running total for the call.

### 3.10 Env vars for routing through a proxy or gateway

Sources: https://code.claude.com/docs/en/env-vars, https://code.claude.com/docs/en/agent-sdk/secure-deployment, https://vercel.com/docs/ai-gateway/coding-agents/claude-code (updated 2026-08-18).

- `ANTHROPIC_API_KEY`: sent as `X-Api-Key`. When set (non-empty) it wins over `ANTHROPIC_AUTH_TOKEN`.
- `ANTHROPIC_AUTH_TOKEN`: value for `Authorization: Bearer ...`.
- `ANTHROPIC_BASE_URL`: override endpoint (proxy/gateway). Disables MCP tool search by default for non-first-party hosts (`ENABLE_TOOL_SEARCH=true` to re-enable). The SDK appends `/v1/messages` itself, so no `/v1` suffix.
- `ANTHROPIC_CUSTOM_HEADERS`: `Name: Value` lines (v2.1.227+).
- Model aliases: `ANTHROPIC_MODEL`, `ANTHROPIC_DEFAULT_{HAIKU,SONNET,OPUS,FABLE}_MODEL`.
- Providers: `CLAUDE_CODE_USE_BEDROCK=1`, `CLAUDE_CODE_USE_VERTEX=1`, `CLAUDE_CODE_USE_FOUNDRY=1`, `CLAUDE_CODE_USE_ANTHROPIC_AWS=1` + `ANTHROPIC_AWS_WORKSPACE_ID`. Set `CLAUDE_CODE_DISABLE_EXPERIMENTAL_BETAS=1` on Bedrock/Vertex.
- Vercel AI Gateway recipe for the Agent SDK: `env: { ...process.env, ANTHROPIC_BASE_URL: 'https://ai-gateway.vercel.sh/claude-code', ANTHROPIC_AUTH_TOKEN: '<gateway key>', ANTHROPIC_API_KEY: '' }`; model ids like `anthropic/claude-sonnet-5`; `CLAUDE_CODE_ENABLE_GATEWAY_MODEL_DISCOVERY=1` for the picker. The gateway page confirms "The Agent SDK spawns Claude Code as a subprocess, so the same environment variables apply."
- Isolation/proxy: `HTTP_PROXY`/`HTTPS_PROXY` for all traffic (opaque TLS), `ANTHROPIC_BASE_URL` for plaintext sampling proxy with credential injection. `NODE_USE_ENV_PROXY=1` for Node 24 fetch.
- Multi-tenant: `settingSources: []`, `CLAUDE_CONFIG_DIR=<per-tenant>`, `CLAUDE_CODE_DISABLE_AUTO_MEMORY=1`, per-tenant `cwd`.
- Telemetry: `CLAUDE_CODE_ENABLE_TELEMETRY=1`, `CLAUDE_CODE_ENHANCED_TELEMETRY_BETA=1`, standard `OTEL_*` exporters; `DISABLE_TELEMETRY`, `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC`.
- Timeouts: `API_TIMEOUT_MS` (default 600000), `CLAUDE_STREAM_IDLE_TIMEOUT_MS`, `CLAUDE_BYTE_STREAM_IDLE_TIMEOUT_MS`, `CLAUDE_ASYNC_AGENT_STALL_TIMEOUT_MS`.

### 3.11 Running inside Linux containers

Source: https://code.claude.com/docs/en/agent-sdk/hosting and https://code.claude.com/docs/en/agent-sdk/secure-deployment.

- "The Agent SDK spawns and supervises a `claude` CLI subprocess that owns a shell, a working directory, and session files on disk." One session = one subprocess.
- Resources: "1 GiB RAM, 5 GiB disk, and 1 CPU per agent is a reasonable starting point". Memory grows with session length. `agents per host = (host RAM - overhead) / per-session RAM ceiling`.
- Runtime: Node 18+ (TypeScript SDK); bundled native binary; outbound HTTPS to `api.anthropic.com` or your gateway.
- Patterns: ephemeral container per task; long-running container with `streamInput()` and `startup()` pre-warm (the doc names "a site builder that hosts a per-user editable site through container ports" as an example); hybrid containers that hydrate from a `SessionStore`; multi-agent container.
- Known limits: no top-level session timeout (use `maxTurns`), memory growth over long sessions, subagent fan-out hits rate limits, no per-subagent wall-clock deadline.
- Cost: "A minimally provisioned container runs roughly $0.05 per hour, while a single long agent session can spend dollars in tokens."
- Isolation options: `@anthropic-ai/sandbox-runtime` (bubblewrap/seatbelt + domain allowlist proxy), hardened Docker (`--cap-drop ALL`, `--network none` + Unix socket proxy), gVisor, Firecracker. Cookbook has Dockerfiles for Docker, Modal, Kubernetes (https://github.com/anthropics/claude-cookbooks/tree/main/claude_agent_sdk/hosting).

### 3.12 Licensing and terms for a commercial product

Sources: https://code.claude.com/docs/en/agent-sdk/overview, https://code.claude.com/docs/en/legal-and-compliance, https://code.claude.com/docs/en/agent-sdk/quickstart.

- Agent SDK: "Use of the Claude Agent SDK is governed by Anthropic's Commercial Terms of Service, including when you use it to power products and services that you make available to your own customers and end users".
- Authentication: "Anthropic does not allow third party developers to offer claude.ai login or rate limits for their products, including agents built on the Claude Agent SDK. Use the API key authentication methods". Developers "may not collect, store, or intermediate Claude.ai credentials or session tokens".
- Claude Code in products (the CLI as a product): binary must be unmodified; "Customers may not pay for, resell, or intermediate Claude usage on their end users' behalf. Each end user must authenticate with their own Anthropic API key, Claude subscription plan credentials, or 3P inference provider credential."
- Reading: the Agent SDK clause covers a product like wandit that pays for tokens with its own API key and sells credits. The Claude Code clause covers shipping the interactive Claude Code CLI to end users. The AI SDK bridge installs the `@anthropic-ai/claude-code` CLI package inside the sandbox as the Agent SDK's runtime. The boundary between "Agent SDK powering a product" and "running Claude Code in a hosted sandbox" is not spelled out for this exact setup. UNVERIFIED — confirm with Anthropic sales before launch.
- Branding: allowed "Claude Agent", "{YourAgentName} Powered by Claude"; not permitted "Claude Code" or "Claude Code Agent" or Claude Code-styled ASCII art. "Your product should maintain its own branding".
- Usage Policy applies. BAA only with ZDR on API traffic.

---

## 4. Anthropic Managed Agents

### 4.1 What it is

Source: https://platform.claude.com/docs/en/managed-agents/overview.

- "Pre-built, configurable agent harness that runs in managed infrastructure. Best for long-running tasks and asynchronous work." Four concepts: Agent (model, system prompt, tools, MCP servers, skills), Environment (cloud sandbox or self-hosted), Session (running instance with persistent filesystem and history), Events (user turns, tool results, status).
- Beta. All requests need the `managed-agents-2026-04-01` beta header (memory stores: `agent-memory-2026-07-22`). Enabled by default for API accounts. MCP tunnels and "dreaming" are research preview (request access).
- Not eligible for Zero Data Retention or HIPAA BAA (cloud sandboxes). Self-hosted sandboxes are ZDR/BAA eligible.
- Launch: 2026-04-08 per third-party posts (https://www.verdent.ai/guides/claude-managed-agents-pricing) — UNVERIFIED against a primary source; the beta header date `2026-04-01` is primary.
- Self-hosted sandboxes and MCP tunnels announced 2026-05-19 (https://claude.com/blog/claude-managed-agents-updates). Partners named: Cloudflare, Daytona, Modal, Vercel; docs also list AWS Lambda MicroVMs, Blaxel, E2B, Fly.io, GKE Agent Sandbox, Namespace, Superserve (https://platform.claude.com/docs/en/managed-agents/self-hosted-sandboxes).

### 4.2 API and SDK surface

Sources: https://platform.claude.com/docs/en/managed-agents/quickstart, /sessions, /events-and-streaming, /session-operations.

- SDK: `@anthropic-ai/sdk` (`npm install @anthropic-ai/sdk`), CLI `ant` (v1.29.0). Methods: `client.beta.agents.create`, `client.beta.environments.create`, `client.beta.sessions.create({ agent, environment_id, title?, initial_events?, resources?, vault_ids?, budget? })`, `client.beta.sessions.events.stream(sessionId, { event_deltas? })`, `client.beta.sessions.events.send(sessionId, { events })`, `client.beta.sessions.events.list`, `sessions.update/archive/delete/retrieve/list`.
- Session statuses: `idle`, `running`, `rescheduling`, `terminated`. Sessions "persist indefinitely with conversation history. Sandbox state is preserved for 30 days" (events page summary).
- Events you send: `user.message`, `user.interrupt`, `user.custom_tool_result`, `user.tool_confirmation`, `user.define_outcome`, `user.tool_result` (self-hosted), `system.message`. Events you receive: `agent.message`, `agent.thinking`, `agent.tool_use`, `agent.tool_result`, `agent.mcp_tool_use/_result`, `agent.custom_tool_use`, `agent.thread_context_compacted`, `session.status_*`, `session.error`, `session.usage`, `span.model_request_start/end` (with `model_usage`), stream-only `event_start`/`event_delta` for token-level text (opt-in `event_deltas[]=agent.message`, best effort, never persisted).
- Agent overrides per session (`type: 'agent_with_overrides'`: `model`, `system`, `tools`, `mcp_servers`, `skills`), pinned versions, `budget: { type: 'limit', max_list_cost: { amount: '2500', currency: 'USD' } }` → stop reason `budget_reached`.
- Tools: `agent_toolset_20260401` = `bash`, `read`, `write`, `edit`, `glob`, `grep`, `web_fetch`, `web_search`; per-tool `enabled` and `permission_policy` (`always_allow` default for agent toolset, `always_ask` default for MCP toolsets). Custom tools are client-executed: the session goes `idle` with `stop_reason.type: 'requires_action'`, you send `user.custom_tool_result`. Tool outputs > 100k chars are written to a sandbox file.
- MCP: remote HTTP MCP servers only (streamable HTTP; SSE fallback); private servers via MCP tunnels or by wrapping them as custom tools on a self-hosted worker.
- Files: uploads mount at `/mnt/session/uploads/<path>` (read-only copies, max 500 per session); outputs written to `/mnt/session/outputs/` are listed via `client.beta.files.list({ scope_id })`. `github_repository` resources exist for cloud sandboxes (not on self-hosted).
- Rate limits: 300 create requests/min, 1,200 read requests/min per org, plus normal spend/usage-tier limits (https://platform.claude.com/docs/en/managed-agents/reference).

### 4.3 Cloud sandbox specs

Source: https://platform.claude.com/docs/en/managed-agents/cloud-sandboxes-reference and /environments.

- Ubuntu 24.04, x86_64, up to 8 GB RAM, up to 10 GB disk, fresh container per session. Networking `unrestricted` (default via API, with safety blocklist) or `limited` (`allowed_hosts`, `allow_package_managers`, `allow_mcp_servers`).
- Pre-installed: Node 20/21/22 with npm, yarn, pnpm, bun; Python 3.10-3.13; Go, Rust, Java 21, Ruby, PHP, C/C++; PostgreSQL 16 and Redis 7 (installed, not running); Playwright + Chromium; git, ripgrep, ffmpeg, ImageMagick, pandoc, LibreOffice, TeX Live; `docker` "limited availability".
- `packages` field pre-installs apt/cargo/gem/go/npm/pip packages, cached per environment.
- No documented way to expose an HTTP port or preview URL from a cloud sandbox. The self-hosted blog mentions Daytona sandboxes "accessed while a session runs over SSH or an authenticated preview URL" (provider feature, not a Managed Agents API). UNVERIFIED that any cloud-sandbox port exposure exists.

### 4.4 Pricing

Source: https://platform.claude.com/docs/en/about-claude/pricing (Managed Agents section).

- Tokens at standard model rates (prompt caching applies; batch discount and partner cloud pricing do not; fast mode and `inference_geo: "us"` 1.1x apply).
- Session runtime: $0.08 per session-hour, metered to the millisecond, only while status is `running`. Idle, rescheduling, terminated time is free. Replaces code-execution container-hour billing.
- Web search $10 per 1,000 searches.
- Worked example: one hour of Opus 5 with 50k input / 15k output tokens = $0.705; with 40k cached reads = $0.525.
- Third-party posts quoting $0.25/session-hour (https://tygartmedia.com/claude-managed-agents-pricing-cost-analysis/) are older or wrong; the primary page says $0.08.

### 4.5 Fit for a Lovable-style product

- Pros: no sandbox or session infra; server-side event history; interrupts and steering; budgets; permission policies with allow/deny events; skills and memory stores; 30-day sandbox retention; Vercel Chat SDK, assistant-ui, and CopilotKit AG-UI quickstarts exist (https://github.com/anthropics/claude-quickstarts/tree/main/managed-agents).
- Cons: beta; Claude-only; not an AI SDK stream (an adapter from events to UI message parts must be written — none found); custom tools are client-executed only; no documented preview port for cloud sandboxes (blocks in-iframe previews of a running dev server unless the app is built and published elsewhere); no Expo simulator path; no ZDR; sandbox spec is fixed (8 GB/10 GB); self-hosted mode gives previews but returns the infra work.

### 4.6 Anthropic model prices (for cost estimates)

Source: https://platform.claude.com/docs/en/about-claude/pricing. Per MTok input / output: Fable 5.1 $10 / $50 (cache read $0.25), Opus 5 and Opus 4.8 $5 / $25, Sonnet 5 $2 / $10 (introductory price now permanent), Sonnet 4.6 $3 / $15, Haiku 4.5 $1 / $5. Claude 4.7+ tokenizer yields ~30% more tokens for the same text.

---

## 5. Options for wandit V2

### Option A — AI SDK `HarnessAgent` + Claude Code adapter + Vercel Sandbox

- What you write: one Nest endpoint that creates or resumes a `HarnessAgentSession` per chat, merges `toUIMessageStream` into the existing `createUIMessageStream` writer, persists `resumeState` per chat, and host tools for wandit-specific actions (publish, leads, connectors, Supabase provisioning).
- What you get free: token streaming, reasoning parts, tool parts, file-change parts, approvals with `useChat`, compaction, session park/resume, skills, structured output, model switching per turn.
- Costs: Vercel Sandbox compute (§2.10) + Anthropic tokens. Roughly $0.15-0.35 per active builder hour of sandbox on 2-4 vCPU at typical CPU use, plus tokens.
- Risks: experimental API; hard dependency on Vercel Sandbox and `VERCEL_OIDC_TOKEN`; a custom sandbox provider is an unmeasured effort; bridge pins Agent SDK 0.3.245; USD cost must be computed from tokens; the bridge takes one exposed port; wandit's hosting is Cloudflare + Trigger.dev, so this adds a second cloud.

### Option B — Claude Agent SDK directly in wandit-controlled containers

- What you write: a container image with Node + the SDK, a per-chat `query()` runner in streaming input mode, a mapper from SDK messages (`stream_event`, `assistant`, `user`, `result`) to UI message stream parts, `canUseTool` → approval parts, a `SessionStore` (Postgres adapter from the examples), container lifecycle and port exposure for previews.
- What you get: every SDK feature (hooks, checkpointing, `SessionStore`, subagents, `maxBudgetUsd`, `total_cost_usd` estimate, `AskUserQuestion` previews), full control of the sandbox (Cloudflare Containers or Fly/Railway), cheaper compute.
- Risks: you own the process supervision (1 subprocess per session, memory growth, no session timeout), the SSE mapping (~the size of Vercel's bridge, 27 KB TS), and multi-tenant isolation.

### Option C — Managed Agents

- What you write: an event-to-UI adapter, custom tools for wandit actions, and a separate build/publish path because the cloud sandbox has no documented preview port.
- What you get: zero sandbox infra at $0.08/h, durable server-side sessions, budgets, permission policies.
- Risks: beta, Claude-only, no ZDR, no preview URL, no Expo path; self-hosted mode removes the infra benefit.

### Recommendation

Prototype Option A in the V2 module because it reuses `useChat`, `createUIMessageStream`, and `toolApproval` exactly as V1 does, and because the Claude Code adapter already encodes the permission/resume/compaction plumbing. Two checks decide whether it goes to production: (1) can a second exposed sandbox port serve the app preview to the iframe reliably and at acceptable egress cost, and (2) is a custom `HarnessV1SandboxProvider` feasible if Vercel Sandbox is rejected. Keep Option B as the fallback; it uses the same Agent SDK, the same skills, and the same prompts, so the prompts and host tools transfer. Treat Option C as a later option for background jobs rather than the interactive builder.

---

## 6. Open questions (UNVERIFIED)

1. Does `harnessMetadata['claude-code']` expose `total_cost_usd` to the host? Read `create-emit-stream-event.ts` in the bridge to confirm.
2. Effort and support for a non-Vercel `HarnessV1SandboxProvider` (Cloudflare Sandbox SDK, E2B, Daytona).
3. Whether Vercel documents Gemini CLI as an ACP adapter target.
4. Exact Anthropic legal position on running the Claude Code CLI package inside a hosted sandbox for a product that pays for tokens with its own key.
5. Managed Agents cloud sandbox port exposure / preview URL.
6. Managed Agents public launch date (2026-04-08 comes from third-party posts).
7. The 2026-06-12 Vercel changelog body (fetch failed); the canary-only statement comes from a search snippet.

---

## 7. Source list

AI SDK / Vercel
- https://vercel.com/changelog/program-agent-harnesses-with-ai-sdk (2026-06-12; body fetch failed)
- https://vercel.com/blog/ai-sdk-7 (2026-06-25)
- https://vercel.com/changelog/deepagents-and-opencode-harness-adapters (2026-06-25)
- https://ai-sdk.dev/docs/ai-sdk-harnesses (index) ; /overview ; /harness-agent ; /tools ; /skills ; /harness-adapters ; /workflow-utilities ; /ui
- https://ai-sdk.dev/providers/ai-sdk-harnesses ; /claude-code ; /codex ; /opencode ; /acp ; /pi
- https://github.com/vercel/ai/tree/main/packages
- https://raw.githubusercontent.com/vercel/ai/main/packages/harness/README.md
- https://raw.githubusercontent.com/vercel/ai/main/packages/harness/package.json
- https://raw.githubusercontent.com/vercel/ai/main/packages/harness/CHANGELOG.md
- https://raw.githubusercontent.com/vercel/ai/main/packages/harness/src/v1/harness-v1-sandbox-provider.ts
- https://raw.githubusercontent.com/vercel/ai/main/packages/harness-claude-code/package.json
- https://raw.githubusercontent.com/vercel/ai/main/packages/harness-claude-code/CHANGELOG.md
- https://raw.githubusercontent.com/vercel/ai/main/packages/harness-claude-code/src/claude-code-harness.ts
- https://raw.githubusercontent.com/vercel/ai/main/packages/harness-claude-code/src/claude-code-bootstrap.ts
- https://raw.githubusercontent.com/vercel/ai/main/packages/harness-claude-code/src/bridge/package.json
- https://raw.githubusercontent.com/vercel/ai/main/packages/harness-claude-code/src/bridge/index.ts
- https://registry.npmjs.org/ai/latest ; /@ai-sdk/harness/latest ; /@ai-sdk/harness-claude-code/latest
- https://vercel.com/docs/sandbox/pricing (2026-08-21)
- https://vercel.com/docs/ai-gateway/coding-agents/claude-code (2026-08-18)

Claude Agent SDK
- https://code.claude.com/docs/en/agent-sdk/overview ; /quickstart ; /typescript ; /permissions ; /user-input ; /hooks ; /custom-tools ; /subagents ; /sessions ; /session-storage ; /cost-tracking ; /streaming-output ; /streaming-vs-single-mode ; /file-checkpointing ; /hosting ; /secure-deployment
- https://code.claude.com/docs/en/env-vars
- https://code.claude.com/docs/en/legal-and-compliance
- https://registry.npmjs.org/@anthropic-ai/claude-agent-sdk/latest
- https://github.com/google-gemini/gemini-cli/blob/main/docs/cli/acp-mode.md

Managed Agents
- https://platform.claude.com/docs/en/managed-agents/overview ; /quickstart ; /sessions ; /session-operations ; /events-and-streaming ; /tools ; /permission-policies ; /environments ; /cloud-sandboxes-reference ; /self-hosted-sandboxes ; /files ; /reference
- https://platform.claude.com/docs/en/about-claude/pricing
- https://claude.com/blog/claude-managed-agents-updates (2026-05-19)
- Third-party (pricing cross-check only): https://www.verdent.ai/guides/claude-managed-agents-pricing ; https://www.truefoundry.com/blog/claude-managed-agents-pricing

Repo
- `apps/server/package.json:23-67`, `apps/web/package.json:15,31`, `apps/native/package.json:15,31`, `package.json:36`
- `apps/server/src/modules/ai-chat/agent/chat-agent.ts:418-476`
- `apps/server/src/modules/ai-chat/application/services/ai-chat.service.ts:84,1020-1029`
- `docs/v2/research/inspect-ai-pipeline.md` (sibling report, V1 pipeline map)
