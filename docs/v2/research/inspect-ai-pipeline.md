# V1 AI generation pipeline — end-to-end map

Date: 2026-09-03. Branch: `feat/v2-builder` (identical to `dev` at commit `1b2a9a1e`).
Author: Claude Fable research agent (read-only; no code changed).

Evidence marks: `path:line` = read in this worktree. `UNVERIFIED` = not confirmed in code or docs. Paths are repo-relative.

Stack facts: `ai@^7.0.19`, `@ai-sdk/gateway@4.0.15`, `@openrouter/ai-sdk-provider@^3.0.0`, `@trigger.dev/sdk@4.5.3`, `playwright@1.61.1`, `cheerio@^1.2.0`, `undici@^8.8.0` (`apps/server/package.json:23-63`).

---

## 0. One-paragraph summary

A user message goes to `POST /v1/chats/:chatId/ai-stream`. The Nest server builds a per-request AI SDK `ToolLoopAgent` (the "Brain"). The Brain talks to the user, samples design worlds, writes one text brief, and calls the `generate_page` tool. That tool snapshots the brief plus a large builder system prompt into a `page_generation_attempts` row and triggers the Trigger.dev task `generate-page`. The task runs a second `ToolLoopAgent` (the "Builder") with hand-built tools (`write_file`, `edit_file`, `screenshot_page`, `generate_image`, `finish`) against an in-memory virtual file system. The Builder writes one `index.html`. The task post-processes the HTML, uploads it to R2 under `sites/{projectId}/{versionId}/index.html`, inserts an immutable `versions` row, and moves `artifacts.activeVersionId`. The web client streams the chat over the AI SDK UI-message SSE protocol, follows the build over Trigger.dev Realtime plus polling, and renders the HTML in a sandboxed `srcDoc` iframe. Edits to an existing page go through seven surgical chat tools that run cheerio DOM operations on the server and write a new version. Every step is hand-built: the tools, the file system, the edit engine, the validation, the stall watchdog, the metering, and the error taxonomy.

---

## 1. Entry point: from the browser to the Brain

### 1.1 Client transport

- Web: `useChat` from `@ai-sdk/react` with a `DefaultChatTransport` that points at the chat stream URL (`apps/web/src/features/workspace/lib/use-ai-chat.ts:1`, `:166-180`, `:211-220`). A custom fetch (`createStatusPreservingChatFetch`) adds the workspace header (`:171-177`).
- Native (Expo): the same `useChat` + `DefaultChatTransport` with `expo/fetch` (`apps/native/features/workspace/lib/use-ai-chat.ts:1-28`).
- The AI SDK resubmits the full transcript on every turn. The server keeps the truth in Postgres and re-validates the transcript on each call (`apps/server/src/modules/ai-chat/presentation/http/controllers/ai-chat.controller.ts:122-132`).

### 1.2 Controller

`AiChatController.stream` (`ai-chat.controller.ts:89-168`):

1. Loads the chat with a project-scope check (`:101-109`).
2. Rejects any `system` message from the client (`:115-120`).
3. Validates messages with `validateUIMessages` against execute-less "schema-only" tool twins (`:184-192`, twins at `apps/server/src/modules/ai-chat/agent/chat-agent.ts:615-632`).
4. Checks that every file part is an R2 upload owned by the acting user (`:218-255`).
5. Calls `AiChatService.prepareStream` (admission), then `reply.hijack()` and `AiChatService.stream` (`:133-163`). The AI SDK owns the raw response after that point.

### 1.3 Project creation

Project creation (`apps/server/src/modules/projects/application/services/projects.service.ts:108-204`) writes project + chat + first user message in one transaction and reserves a "bundled" chat hold. The browser then opens the workspace and starts the first stream itself (`:199-203`). The first stream claims that bundled hold (`apps/server/src/modules/ai-chat/application/services/ai-chat.service.ts:317-340`).

---

## 2. Admission: reservations, turn keys, leases

`AiChatService.prepareStream` (`ai-chat.service.ts:283-414`) does all of this before the model runs:

- Per-actor concurrency slot, max 3 streams (`:180`, `:1504-1535`).
- A turn key `ai-chat:{chatId}:{requestId}`. `requestId` is a hash of transcript shape (`turnRequestId`, `:2813-2839`). A duplicate POST of the same turn gets `409 AI_CHAT_TURN_ACTIVE` (`:453-483`).
- A credit hold (`reserveWithReplay`) sized from a character-count estimate: `(JSON(messages) + system prompt + 8000 chars tool schema allowance) / 4` input tokens, 2048 output tokens (`apps/server/src/modules/ai-chat/agent/chat-metering.ts:41-56`; `ai-chat.service.ts:1650-1681`).
- Retry logic that walks key generations `#2..#4` when an earlier hold was refunded or stale (`:498-598`).
- A cross-replica execution lease on the hold, TTL 5 min, heartbeat 60 s (`:200-201`, `:605-621`, `:1546-1596`). Lease loss aborts the stream (`:693-698`).
- `GENERATION_BILLING_MODE=off` skips holds (`:349-383`).

All of this is hand-built product logic. None of it depends on the model.

---

## 3. Stream: context, agent, and SSE

### 3.1 Per-request context

`AiChatService.stream` (`ai-chat.service.ts:662-1501`) runs three reads in parallel (`:766-770`):

- `collectManualEditTrail` — wids the user edited in the visual editor since the last AI version (`apps/server/src/modules/pages/infrastructure/persistence/pages.repository.ts:1111-1155`).
- MCP connector tools for the user (`mcpChatToolsService.resolveToolsForUser`, `:718-722`).
- The active page outline: it downloads the active version HTML from R2, stamps it, and extracts the section list, with a 1.5 s timeout (`:2861-2908`).

It then builds one text block, `## This request (set by the app, not the user's words)` (`apps/server/src/modules/ai-chat/agent/request-context.ts:207-426`). The block carries:

- composer mode/output/options lines (`:213-328`),
- the page outline with one line per section: `data-wid | <tag> | snippet` plus the instruction "edit it with the surgical tools" (`:330-347`),
- the click-to-target selection (`selectedWid` / `selectedWids`) (`:349-378`),
- the manual-edit warning ("never overwrite those elements") (`:389-401`),
- the team-workspace note (`:403-416`).

MCP notices and the ads playbook block are appended (`ai-chat.service.ts:799-818`).

### 3.2 Transcript transforms (model-bound copy only)

Five transforms run before the agent is built (`ai-chat.service.ts:819-850`):

1. `completeDanglingToolCalls` — closes tool calls that never got a result so providers do not 400 (`:2219`).
2. `elideRetiredToolOutputs` — blanks old `read_skill` outputs (`:2773`).
3. `annotateUserFileParts` — adds a text marker with the URL after each file part.
4. `annotateGeneratedAssets` — adds a `[Generated …]` marker with the hosted URL after each settled generation tool part (`apps/server/src/modules/ai-chat/agent/annotate-generated-assets.ts:10-19`).
5. `annotateAskUserAnswerFiles` — exposes files from `ask_user` answers.

### 3.3 The Brain agent

`createChatAgent` (`apps/server/src/modules/ai-chat/agent/chat-agent.ts:413-607`) returns `new ToolLoopAgent({...})`:

- `model`: `createLlmModel(env.AI_CHAT_MODEL, { fetch: chatGatewayFetch, reasoningEffort: "high", task: "chat" })` (`:429-434`).
- `instructions`: `WANDIT_SYSTEM_PROMPT` (+ `INSPECT_VIDEO_BRAIN_GUIDANCE`) + the per-request block (`:436-447`).
- `maxOutputTokens: 16_000`, `stopWhen: isStepCount(12)` (`chat-metering.ts:9-10`; `chat-agent.ts:448`, `:473`).
- `providerOptions`: `anthropic.toolStreaming=false`, `gateway` routing pin, `google.thinkingConfig.thinkingLevel=medium`, `openai.reasoningEffort=high`, `zai.reasoningEffort=medium`, plus gateway attribution tags (`:450-472`).
- `experimental_repairToolCall`: a hand-built repair that re-asks the model with `generateObject` and meters the repair call (`:162-268`).
- `toolApproval: approvalMap` for MCP tools (`:476`).
- `telemetry.functionId: "chat.agent"` (`:474`).

Tools (`:477-605`): `animate_image`, `ask_user` (no execute; the UI answers), `edit_video`, `extend_video`, `generate_image`, `generate_marketing_asset`, `generate_page`, `generate_video`, `get_direction_candidates`, `inspect_video`, `product_video`, `read_attachment`, `read_lead_performance`, `read_skill`, `scrape_leads`, the seven page-edit tools, and dynamic MCP tools.

The chat gateway leg uses a dedicated undici `Agent` with 1 h header/body idle timeouts, because high-reasoning models stay silent for minutes (`apps/server/src/modules/ai-chat/agent/gateway-fetch.ts:12-15`, `:28-38`).

### 3.4 The Brain system prompt

`WANDIT_SYSTEM_PROMPT` lives in `apps/server/src/modules/ai-chat/agent/system-prompt.ts:22-212`. Sections: Language, What you can do, Connector conduct, Ads method, Asking questions (`ask_user`), Decide what to ask, COD intake, Art direction (two modes), The brief is the product, Building a page, Marketing, Images, Leads, Video, Boundaries (`:24-211`).

Key rules:

- The Brain never writes code. It must call `generate_page` with a brief (`:110` region, "HARD RULE — you direct, you never build").
- The brief has fixed labeled sections: BUSINESS, AUDIENCE, PAGE TYPE, PAGE GOAL, OFFER, LANGUAGE, BRAND ASSETS, ART DIRECTION, PAGE STORY / PAGE STRUCTURE, SIGNATURE INTERACTION, MOTION, SECTIONS, SHOT LIST, CONTENT FACTS (`:117-140`).
- Build steps 1-7, including the **edit ladder** for changes: `apply_element_ops` → `insert_section` → `read_section` + `replace_section` → `generate_page` only for a full redesign (`:141-148`).

Variety mechanism: `get_direction_candidates` samples a random menu of "design worlds" on the server (`apps/server/src/modules/ai-chat/agent/tools/get-direction-candidates.tool.ts:11-21`; worlds library `apps/server/src/modules/ai-chat/agent/worlds/index.ts:1-14`; world shape `worlds/types.ts:10-38`). There are ~27 website worlds, ~58 landing worlds, and ~50 COD worlds, each a long prose "bible" (`ls apps/server/src/modules/ai-chat/agent/worlds`). `directions.ts` (2848 lines) holds curated palettes/fonts/skeletons but is "unplugged" since 2026-07-27 (`get-direction-candidates.tool.ts:16-21`).

### 3.5 Streaming to the client

The transport is the AI SDK UI-message stream over SSE, not Trigger Realtime and not the legacy Redis relay:

- `createUIMessageStream` → `createAgentUIStream({ agent, uiMessages, abortSignal, ... })` → `writer.merge(agentStream)` → `pipeUIMessageStreamToResponse({ response: reply.raw, stream })` (`ai-chat.service.ts:1020`, `:1203-1354`, `:1358`, `:1453-1463`).
- `smoothStream({ delayInMs: 15 })` re-slices deltas into words (`:1210-1213`).
- A `TransformStream` inspects every part: it turns billing errors into a typed `data-billing-error` part and stops the stream; it classifies `tool-error` parts (`:1150-1202`).
- Custom data parts: `data-ai-error` (transient or id-reconciled), `data-billing-error`, `data-credits-settled` (`:933-983`, `:1092-1100`, `:1102-1115`).
- `messageMetadata` writes `model`, `finishReason`, `rawFinishReason`, `provider`, `gatewayGenerationId`, `stepCount`, `usage`, `lastStepUsage` onto the assistant message at `finish` (`:1214-1279`; contract `packages/contracts/src/v1/ai-chat.ts:107-120`).
- The outer `onEnd` persists the user row and the assistant row (`insertUiMessagesIfAbsent`, or `upsertUiMessage` for continuations after `ask_user`/approval), with failure columns (`:1394-1444`; columns in `packages/db/src/schema/chats.ts:69-77`).
- Abort composition: client close, `AbortSignal.timeout(35 min)`, and lease loss (`:182`, `:693-698`).

The web hook also handles `regenerate({ messageId })` for a failed turn (`use-ai-chat.ts:412-425`) and `addToolResult` for `ask_user` (`:427-`).

---

## 4. `generate_page`: from brief to background build

`createGeneratePageTool` (`apps/server/src/modules/ai-chat/agent/tools/generate-page.tool.ts:156-437`):

1. Returns `status: "unavailable"` if R2 or `TRIGGER_SECRET_KEY` is missing (`:178-187`).
2. Resolves world ids; a COD build without `productSku` returns `needs-input` (`:194-224`).
3. Composes the Builder system prompt at queue time and snapshots it (`:245-277`):
   - website: `buildSiteBuilderSystemPrompt()` + optional world doc under a "departure point" heading;
   - COD max: `buildCodSiteBuilderSystemPrompt()` + `COD_GENRE_DOC` + `FUSION_CONTRACT` + world docs;
   - COD simple: `buildSimpleCodSiteBuilderSystemPrompt()` + `COD_GENRE_DOC` + `SIMPLE_COD_STYLE_DOC` + a server-sampled recipe.
4. Picks the builder model: composer override → `AI_PAGE_BUILDER_MODEL` → `AI_PAGE_DESIGN_MODEL` (`:278-281`; allow-list in `apps/server/src/modules/ai-chat/agent/tools/builder-model-options.ts:7-20`).
5. Appends deterministic "READY MEDIA ASSETS" and "USER LINKS" blocks to the brief (`:106-152`, `:282-285`).
6. Inserts a `page_generation_attempts` row with `spec = { brief, designerSystemPrompt, title, pageKind, codMode?, productSku? }` and `model` (`:286-299`).
7. Triggers the task with 3 bounded retries, a 14-day global idempotency key, and a 35 min TTL (`apps/server/src/modules/pages/application/page-build-handoff.ts:37-86`).
8. Stores the run id and mints a read-scoped Trigger Realtime public token (2 h) for the chat card (`generate-page.tool.ts:381`, `:403`; `page-build-handoff.ts:111-132`).
9. Returns `{ status: "queued", attemptId, builderModel, realtime, versionNumber }` (`:424-434`).

The Builder prompt files are the founder's "tweak surface" (`apps/server/src/modules/ai-chat/agent/site-builder/builder-prompt.ts:1-14`). Sections: design world law, Tool protocol, PHOTO QUALITY GATE, brief handling, composition, hero, craft, color, motion (GSAP), conversion craft, Engineering constraints (design-token contract, allowed external requests, brand markers), assets, ban list, content rules, Review passes, and Anthropic's `frontend-design` skill embedded verbatim (`builder-prompt.ts:29-189`; skill at `apps/server/src/modules/ai-chat/agent/site-builder/frontend-design-skill.ts:1-9`).

---

## 5. The Trigger.dev task `generate-page`

`apps/server/src/trigger/generate-page.task.ts`:

- Task config: `machine: "medium-1x"` (2 GB, for Chromium), `maxDuration: 1800`, `retry.maxAttempts: 1` (`:82-91`). Project config installs Chromium into the deployed image and raises undici timeouts to 1 h process-wide (`apps/server/trigger.config.ts:15-40`, `:43-60`; `apps/server/src/trigger/undici-timeouts.ts:13-22`).
- No Nest DI. A fresh Drizzle pool per run (`:104-105`).
- Atomic claim: `status queued|failed → generating`, clears failure columns, records `triggerRunId` (`:150-181`).
- Reserves the `page_build` hold (`:197-205`).
- Parses `spec`, appends the project logo to the brief (`:207-216`).
- Creates the progress tracker: every builder event folds into one `PageBuildProgress` object pushed with `metadata.set("progress", ...)` (`:234-244`; `apps/server/src/modules/ai-chat/agent/site-builder/build-progress.ts:1-40`).
- Calls `runSiteBuild` (`:258-296`).
- Flushes generation captures, settles metering (`:301-312`).
- Uploads files to R2: `sites/{projectId}/{versionId}/index.html` (`:320-349`; key at `apps/server/src/infrastructure/storage/r2.ts:65`).
- Uploads a JPEG thumbnail from the desktop screenshot (`:351-369`).
- One transaction: lock artifact, next version number, insert `versions` row with `meta { builderSummary, builderSteps, files, generationModels, source: "builder", pageKind, title }`, move `activeVersionId` unless a newer attempt already succeeded, mark attempt `succeeded` (`:377-482`).
- Failure path: classify, capture to Sentry, write `failureCode` + normalized columns + `lastProgressPercent`, status `failed`; a cancel writes `canceled` (`:519-632`).

Stop, retry, and dead-run settlement live in `apps/server/src/modules/pages/application/services/pages.service.ts:129-317` (stop = row flip then `runs.cancel`; retry = same row back to `queued` with a fresh idempotency nonce).

---

## 6. The Builder agent (`runSiteBuild`)

`apps/server/src/modules/ai-chat/agent/site-builder/site-builder-agent.ts`:

### 6.1 Loop shape

- `new ToolLoopAgent({ instructions: params.system, maxOutputTokens: 64_000, model: createLlmModel(model, { task: "page_build", reasoningEffort, routingOrder }), providerOptions, stopWhen: [isStepCount(64), state.finishAccepted], tools, telemetry.functionId: "page_build.agent" })` (`:1650-1706`; constants `:145-165`).
- `agent.stream(...)`, not `generate`, because a full-page write exceeds the 5 min undici header timeout on a buffered call (`:1708-1735`). The stream is drained with `for await (const part of stream.fullStream)`; nothing consumes deltas except the watchdog and a per-step provider log (`:1762-1784`).
- Start message: `Build the landing page now. TITLE … BRIEF …`, with the user's photos attached as image file parts when the model can see images (`:1713-1735`; `build-start-messages.ts:3-31`).
- `prepareStep` overrides for models that drop images inside tool results (Kimi, Qwen, Inkling → relocate to a user message; DeepSeek → strip) (`:1669-1688`; `relocate-tool-images.ts:27-47`).

### 6.2 Tools (all hand-built)

`createBuilderTools` (`:486-1384`):

| Tool | What it does | Guards |
|---|---|---|
| `write_file(path, content)` | Writes the whole `index.html` into the in-memory VFS. Byte-identical content is "unchanged". Fires `write-start` on `onInputStart`. | Only `index.html`; refused after `finish` (`:346-364`, `:1320-1382`). |
| `edit_file(path, search, replace)` | Exact-match search/replace with two whitespace-tolerant whole-line fallback tiers; must match once; returns 8 lines of context around the edit. | Repeat-failure detector; 5 total failures → "stop snippet-editing" (`:669-844`). |
| `read_file`, `list_files` | VFS reads (`:1128-1156`). | — |
| `generate_image(role, prompt, aspect, sourceImageUrls?)` | Calls the gateway image model (or the edit model with source photos), uploads to R2 under `sites/{projectId}/assets/…`, returns URL + pixel size; `toModelOutput` attaches the image bytes so the model sees it. | Max 6 per build; per-image child credit hold (`:901-1127`; `generate-image.ts:32`). |
| `animate_image(imageUrl, motionPrompt, aspect)` | Kling i2v ~5 s loop via the gateway video model; child credit hold. | Max videos per build (`:506-668`). |
| `screenshot_page()` | Playwright Chromium renders desktop 1440×900 and mobile 390×844, up to 7 shots per viewport, plus console errors, failed requests, and overflow px; `toModelOutput` attaches JPEGs. | Min 2, max 4 passes; degrades to code review if Chromium is unavailable (`:1157-1319`; `screenshot.ts:14-60`). |
| `finish(summary)` | Accepts only when `index.html` exists, ≥2 screenshot passes were recorded, and `assertValidSite` passes. | (`:845-900`) |

The VFS is a `Map<string,string>` with path normalization (`virtual-files.ts:15-73`).

### 6.3 Stall watchdog

Added in commit `1b2a9a1e`. `STALL_TIMEOUT_MS = 180_000` (`:151-153`). Mechanism (`:1472-1544`, `:1716-1809`):

- A `stallAbortController` is combined with the task's abort signal into the stream's `abortSignal` (`:1472-1477`).
- `lastProgressAt` resets on every `fullStream` part and on every tool execution end (`:1527-1536`, `:1763`).
- The timer is paused while any tool is executing (`inFlightTools > 0`) because image/video/screenshot calls take minutes (`:1502`, `:1537-1543`).
- On 3 min without a stream part, it creates `BuilderStallError(idleMs, modelId)` and aborts the stream (`:1521-1522`; class at `apps/server/src/modules/pages/domain/build-failure.ts:14-27`).
- After the loop, the stall error becomes the terminal `streamError`; the task still tries to publish the last valid revision if one exists (`:1797-1817`, `:1849-1882`).

The watchdog exists because production builds stalled for 13 min and OpenRouter idle-times at ~3 min (`:151-152`).

### 6.4 Post-processing and validation

After the loop, the HTML is rewritten deterministically (`:1849-1863`):
`inlineKnownCdnScripts` (vendored GSAP 3.12.5 replaces CDN tags) → `optimizeFontLoading` → `optimizeImageMarkup` → `stampHtml` (adds `data-wid` to every editable leaf and container) → `ensureDocumentTitle`.

`assertValidSite` (`:2211-2440`) is a hand-written contract checker: exactly one file, starts with `<!doctype`/`<html`, ends with `</html>`, ≥2000 chars; COD pages need zero `<nav>`, exactly one `<form>`, a `tel` input, a name input, a `wandit:lead` CustomEvent dispatch, exactly one honeypot, and a `wandit:lead:result` listener; brand markers (`data-brand="nav"|"footer"`) rules; no external scripts except inlined GSAP; a `:root` block in the first `<style>` that declares all `PAGE_TOKEN_NAMES` tokens and consumes at least `background, foreground, primary, font-body, radius`.

Failures are tagged `PageValidationError` with the provider error as `cause` so the UI blames the right party (`:1866-1882`).

---

## 7. Progress and preview on the client

- The chat card subscribes to the run with `useRealtimeRun` from `@trigger.dev/react-hooks` (public token, `skipColumns: ["payload","output"]`) plus a 5 s `useRun` poll as a safety net (`apps/web/src/features/workspace/lib/use-live-run.ts:1-80`). It reads `run.metadata.progress` (`generate-page-part.tsx:194-245`).
- The Page tab polls `GET /v1/projects/:id/page` every 1.5 s while `latestAttempt.status` is `queued|generating` (`apps/web/src/features/workspace/api/pages.queries.ts:41-52`). The attempt card polls the attempt row every 1.6 s (`:60-73`).
- Version HTML: `GET /v1/pages/versions/:versionId/html` returns `{ versionId, html: stampHtml(html) }` (`pages.service.ts:402-422`; routes at `pages.controller.ts:51-197`).
- Render: `<iframe srcDoc={html} sandbox="allow-scripts allow-forms">` with the preview-editor script injected at render time (`apps/web/src/features/workspace/components/page/page-tab.tsx:9-14`, `:707-708`).

---

## 8. Edits to an existing page (the founder's pain point)

### 8.1 The surgical tool set

Seven tools, one factory (`apps/server/src/modules/ai-chat/agent/tools/page-edit.tools.ts:101-375`):

- Read: `get_page_outline`, `read_elements(wids)`, `read_theme`, `read_section(wid)`. Each downloads the active version from R2, stamps it, and extracts with cheerio (`:76-99`; `stamp.ts:317`, `:354`, `:369`; `ops.ts:1071`).
- Write: `apply_element_ops(ops[1..20])`, `insert_section(anchorWid, position, html)`, `replace_section(wid, html)`. All three call `PageEditsService.applyAiOps` (`:155-160`, `:302-312`, `:350-353`).

### 8.2 The op engine

`PageEditsService.mutate` (`apps/server/src/modules/pages/application/services/page-edits.service.ts:332-431`): download base HTML from R2 → `stampHtml` → `applyOps` → `reconcileFeatureShelf` → `stampHtml` again → upload to a NEW R2 key → `insertVersionAndActivate` with an optimistic `expectedActiveVersionId` CAS (`pages.repository.ts:1007-1103`). A conflict returns "The page changed mid-edit" to the model (`:317-323`). The same path serves the inline editor / theme panel over HTTP (`applyClientOps`, `:75-186`) and version restore (`:190-262`).

`applyOps` (`apps/server/src/modules/pages/domain/ops.ts:45-98`) walks ops in order. Op kinds (`packages/contracts/src/v1/page-edits.ts:145-343`): `text`, `image-src`, `brand-logo`, `placeholder-image`, `element-style`, `set-tokens`, `reset-tokens`, `set-page-title`, `remove-element`, `set-link-href`, `set-placeholder`, `section-style`, `insert-element`, `replace-section`, `insert-section`. Each op targets a unique `data-wid` (`ops.ts:130-138`).

Safety rules in surgery: replacement and inserted HTML may contain no active content (no scripts) except constrained YouTube/Vimeo/Google Maps iframes (`ops.ts:405-458`, `:747-757`). Interactive behavior comes from `data-wandit-*` marker attributes that `reconcileFeatureShelf` pairs with vendored runtime payloads (toast, carousel, lightbox, counter, phone mask, confetti, countdown, stock counter, WhatsApp float) (`apps/server/src/modules/pages/domain/feature-shelf.ts:1-40`; tool description at `page-edit.tools.ts:333-345`). Hosted asset URLs must be Wandit-hosted (`page-edits.service.ts:445-481`).

### 8.3 How the model knows what to edit

- The outline is injected into every request (§3.1). The Brain must not call `get_page_outline` again when the outline is present (`request-context.ts:341-344`).
- Click-to-target: the preview posts the clicked `data-wid`; the message metadata carries `selectedWid(s)`; the context block tells the model "this" means that element (`:349-378`).
- Manual edits: `collectManualEditTrail` walks versions back from the active one while `meta.source` is `inline|theme` and collects `editedWids`; the context block forbids overwriting them (`pages.repository.ts:1111-1155`; `request-context.ts:389-401`).

### 8.4 What a big change does

A multi-section redesign is `generate_page` again: a new attempt row, a full Builder run (minutes), a new version. The Builder never sees the previous HTML; it sees only the new brief (`builder-prompt.ts:9-13`). There is no "edit the existing file with an agent" path today. The Builder's `edit_file` exists only inside one build run.

### 8.5 Why this is the pain point

Every edit capability is a hand-written op kind with its own cheerio code, zod schema, tool description, and UI part (`page-edit-part.tsx`). Adding "change the form to two steps" or "add a pricing table with a toggle" needs new op kinds or a full rebuild. Surgical replacements cannot add JavaScript. The model works on a stamped outline and HTML snippets, not on a real file tree with a real editor.

---

## 9. Models and providers

### 9.1 Environment knobs

`packages/env/src/server.ts:72-151`:

| Var | Default | Used by |
|---|---|---|
| `AI_CHAT_MODEL` | `openai/gpt-4o-mini` | Brain (`chat-agent.ts:429`) |
| `AI_PAGE_BUILDER_MODEL` → `AI_PAGE_DESIGN_MODEL` | `anthropic/claude-sonnet-5` | Builder (`generate-page.tool.ts:278-281`) |
| `AI_PAGE_DESIGN_REASONING` | `high` (`auto|minimal|low|medium|high|xhigh`) | Builder reasoning (`site-builder-agent.ts:178-187`) |
| `AI_IMAGE_MODEL`, `AI_IMAGE_EDIT_MODEL` | unset | Builder + chat `generate_image` |
| `AI_TITLE_MODEL`, `AI_PROMPT_REFINER_MODEL` | `openai/gpt-5.6-luna` | titles, Higgsfield prompt refine |
| `AI_MARKETING_MODEL` | falls back to chat model | marketing HTML |
| `AI_VIDEO_INSPECT_MODEL` | `google/gemini-3.7-flash` | `inspect_video` |
| `AI_TRANSCRIPTION_MODEL` | `openai/gpt-4o-mini-transcribe` | voice input |
| `AI_PROVIDER` | `vercel` (`vercel|openrouter`) | all text tasks |
| `AI_PROVIDER_OVERRIDES` | — | `task=provider,…` for `chat, marketing, page_build, project_title, prompt_refine, video_inspect` (`packages/env/src/llm-routing.ts:11-18`) |
| `AI_GATEWAY_API_KEY`, `OPENROUTER_API_KEY` | optional | keys |

Local `apps/server/.env` in this checkout: `AI_CHAT_MODEL=openai/gpt-5.6-terra`, `AI_PAGE_BUILDER_MODEL=xai/grok-4.5`, `AI_IMAGE_MODEL=openai/gpt-image-2`, `AI_IMAGE_EDIT_MODEL=google/gemini-3-pro-image`, `AI_VIDEO_INSPECT_MODEL=stealth/ox-alpha`, `AI_PROVIDER_OVERRIDES=video_inspect=openrouter`. Production values: UNVERIFIED.

The composer has a dev-only builder picker with this allow-list: Gemini 3.1 Pro / 3.5 Flash / 3.5 Flash Lite / 3.6 Flash, GPT-5.6 luna / sol, Grok 4.5, Kimi K3 fast, MiMo v2.5, MiniMax M3, Muse Spark 1.1, Claude Sonnet 5 (`builder-model-options.ts:7-20`).

### 9.2 Provider seam

`createLlmModel` (`apps/server/src/modules/ai-provider/domain/llm-provider.ts:163-189`):

- Vercel path: a bare model string (resolved by the AI SDK default gateway provider) or `createGateway({ fetch })(modelId)` when a custom fetch is needed.
- OpenRouter path: `createOpenRouter().chat(toOpenRouterModelId(id), { reasoning: { effort }, provider: { order }, user })`, wrapped in middleware that copies the OpenRouter generation id into `providerMetadata` and tags it onto errors (`:260-364`). Creator prefix translation table at `:106-113`.
- Media (image, video, transcription) always stays on the Vercel gateway (`:9-12`; pinned tasks at `llm-routing.ts:29-36`).

### 9.3 Gateway routing and reasoning

- `gatewayRoutingForModel`: `openai/*` → `{ only: ["openai"] }` (no Azure/Bedrock fallback; a 13 min failure on 2026-08-24 caused this); `zai/*` (GLM) → `{ order: ["friendli", "baseten", "fireworks"] }` (`llm-provider.ts:231-243`).
- Builder-side extra order preferences: Kimi K2 → `novita`, Qwen → `fireworks`, GLM → `baseten, fireworks` (`site-builder-agent.ts:1572-1587`).
- Reasoning is vendor-scoped `providerOptions`: `openai.reasoningEffort`, `google.thinkingConfig.thinkingLevel` (2 levels), `xai.reasoningEffort` (3 levels, clamped), `zai.reasoningEffort`; on OpenRouter it becomes the unified `reasoning.effort` model setting (`site-builder-agent.ts:1588-1635`; `chat-agent.ts:450-472`).
- Gateway attribution: `gateway.tags = ["op:<operation>", "ws:org|ws:personal"]`, `gateway.user = userId` (`apps/server/src/modules/metering/domain/gateway-metering.ts:166-186`).

---

## 10. Where things are stored

Postgres (Drizzle):

- `chats`, `messages` — AI SDK UI parts as JSONB plus `metadata` (model, usage) and failure columns (`packages/db/src/schema/chats.ts:29-89`).
- `artifacts` — one `landing_page` artifact per project with `activeVersionId` (`packages/db/src/schema/artifacts.ts:21-61`).
- `versions` — immutable, `(artifactId, number)` unique, `r2Key`, `meta` (`:65-106`).
- `page_generation_attempts` — lifecycle row: `queued|generating|succeeded|failed|canceled`, `spec` JSONB snapshot, `model`, `triggerRunId`, `versionId`, failure columns, `lastProgressPercent`, `dismissedAt` (`packages/db/src/schema/page-attempts.ts:19-84`).
- Metering: `ai_usage_events`, `ai_usage_generation_refs`, `ai_provider_call_evidence`, `model_prices`, credit ledger tables (`packages/db/src/schema/credits.ts:55-460`).

R2 (`apps/server/src/infrastructure/storage/r2.ts:65-257`):

- Draft: `sites/{projectId}/{versionId}/index.html`; build assets `sites/{projectId}/assets/…`; review shots; thumbnails.
- Published: `published/{projectId}/current.html` plus archives (`:83-97`). Publish inlines CDN scripts, injects pixels and the leads runtime, then writes the key (`apps/server/src/modules/sites/application/services/sites.service.ts:292-347`). The edge Worker resolves Host → KV pointer → R2 object (`apps/edge/src/index.ts:1-22`).

---

## 11. Token usage and cost tracking

Per chat turn:

1. Estimate and hold (§2).
2. `onStepEnd`: `captureGeneration(eventId, { providerMetadata, stepUsage })` inserts an `ai_usage_generation_refs` row keyed by the gateway/OpenRouter generation id; failed captures are retried in `onEnd` (`ai-chat.service.ts:1334-1352`, `:1616-1647`; `metering.service.ts:985-1035`).
3. Errors carry generation ids too (`llmGenerationCaptureFromError`, `gateway-metering.ts:146-163`); the service queues those captures (`ai-chat.service.ts:725-761`).
4. `onEnd`: `settle(eventId, { modelId, pricing: "token", usage })` and a transient `data-credits-settled` part with the new balance (`:1281-1333`).
5. Message metadata stores `usage`, `lastStepUsage`, `stepCount`, `provider`, `gatewayGenerationId` (`:1262-1275`).
6. A Trigger cron every minute reconciles settled events against gateway cost (`apps/server/src/trigger/reconcile-metering.task.ts:13-20`; `metering.service.ts:1149-`). Model prices refresh hourly from the gateway (`apps/server/src/trigger/refresh-model-prices.task.ts:8-11`).

Per page build: a `page_build` hold; every Builder step is captured through a retry buffer (`generation-capture-buffer.ts:41-97`); images and videos get child holds (`site-builder-agent.ts:1391-1437`); settlement sums step usage including cache read/write tokens (`generate-page.task.ts:639-699`). A build with no steps but with provider evidence keeps the hold open for the sweep (`:646-656`).

UI: the web shows per-message and context-window usage (`apps/web/src/features/workspace/lib/token-usage.ts:1-60`); staff can call `GET /v1/chats/:chatId/usage` (`apps/server/src/modules/generation/presentation/http/controllers/chats.controller.ts:94-112`); admins have a conversation inspector with messages, calls, AI failures, and generation attempts (`apps/server/src/modules/admin/presentation/http/controllers/admin-conversations.controller.ts:44-115`).

---

## 12. Error normalization

Module `apps/server/src/modules/ai-errors/domain` (commit `db7e7954`):

- `classifyAiError(error, context)` returns `NormalizedAiError | null` (`classify-ai-error.ts:92-`; type at `normalized-ai-error.ts:40-67`). Order: abort → billing → `TaggedBuildError` → gateway auth → `RetryError` → SDK classes → status codes → provider signatures.
- Kinds (16): `internal, auth_config, invalid_request, model_not_found, rate_limited, capacity, provider_error, content_moderated, timeout, network, cancelled, billing, connector_unreachable, connector_account, connector_rejected, unknown` (`packages/contracts/src/v1/ai-errors.ts:3-20`). Sources: `ours | gateway | openrouter | higgsfield | provider:<slug> | unknown` (`:26-29`).
- `captureAiError` sends one tagged Sentry event and returns its id (`ai-error-sentry.ts`).
- `renderAiErrorSentence` maps kinds to user copy (`ai-error-copy.ts:5-56`).
- Chat: `data-ai-error` parts and message failure columns (§3.5). Page build: `classifyPageTaskFailure` = old `classifyBuildFailure` code + normalized columns (`apps/server/src/trigger/generate-page-failure.ts:21-61`; codes `packages/contracts/src/v1/pages.ts:36-58`).
- `finishReason` is classified too (`content-filter`, empty output) (`ai-chat.service.ts:1235-1260`).

The UI error string on the SDK error chunk stays `"An error occurred."`; the typed data part carries the real classification (`:1767-1769`).

---

## 13. Legacy path still in the tree

- `POST /v1/chats/:chatId/messages` + `GET /v1/chats/:chatId/stream` = BullMQ job → `apps/worker` → Redis Streams → SSE relay (`chats.controller.ts:114-146`; `apps/worker/src/processors/ai-generation.processor.ts:1-60`; `apps/server/src/modules/generation/application/services/chat-stream-relay.service.ts:1-40`). Both routes are `@PersonalWorkspaceOnly()`.
- The web chat pane uses the AI SDK path (`ai-chat-context.tsx`, `use-ai-chat.ts`). `use-project-chat.tsx` (EventSource) is still imported by `store.tsx`/`generation-card.tsx`; whether any mounted surface still opens the legacy stream: UNVERIFIED. `docs/features/chat-generation.md` describes only this legacy design and is out of date.

---

## 14. Hand-built pieces that a coding harness would replace

| Piece | Where | What the harness gives instead |
|---|---|---|
| Builder tool loop (`ToolLoopAgent` + 8 tools) | `site-builder-agent.ts:486-1706` | The harness's own agent loop with file tools |
| Virtual file system | `virtual-files.ts` | A real sandbox file system |
| `write_file` / `edit_file` with search-replace tiers and failure budgets | `site-builder-agent.ts:669-844`, `:1320-1382` | Harness `Edit`/`Write`/`Read` tools |
| `read_file` / `list_files` | `:1128-1156` | Harness read/glob/grep |
| `screenshot_page` Playwright session and shot budgeting | `screenshot.ts`, `:1157-1319` | Harness browser/preview tools or a sandbox-side preview server (still needs a screenshot capability) |
| `finish` gate with pass counting and revision invariants | `:845-900`, `BuildLoopState :193-233` | Harness stop conditions; validation moves to a post-build check |
| Stall watchdog | `:1472-1544` | Harness/sandbox timeouts (verify the harness exposes an idle-progress signal) |
| Model-quirk `prepareStep` (image relocation/stripping) | `relocate-tool-images.ts` | Harness owns provider quirks |
| Tool-call repair via `generateObject` | `chat-agent.ts:162-268` | Harness owns tool-call validation |
| `completeDanglingToolCalls`, `elideRetiredToolOutputs`, asset markers | `ai-chat.service.ts:2219-2900` | Harness session/transcript management |
| Surgical edit tools + op engine (15 op kinds, cheerio) | `page-edit.tools.ts`, `ops.ts`, `page-edits.service.ts` | The harness edits real files; wids become unnecessary for AI edits (still useful for the visual editor) |
| Outline / `selectedWid` / manual-edit context injection | `request-context.ts:330-401` | Selection can map to a file path + line range or component |
| Single-file HTML contract and `assertValidSite` | `site-builder-agent.ts:2211-2440` | Replaced by build/typecheck/lint in the sandbox |
| Post-processing (inline GSAP, fonts, images, stamp, title) | `:1849-1863` | Build tooling (Vite/Next/Expo) |
| Prompt snapshot + world/COD prompt composition | `generate-page.tool.ts:245-277` | Keep as project context files or system prompt inputs |
| Per-model routing/reasoning tables | `llm-provider.ts:231-243`, `site-builder-agent.ts:1572-1635` | Harness model config; keep the gateway seam |
| Metering capture inside `onStepEnd` | `ai-chat.service.ts:1334-1352`, `generate-page.task.ts:282-288` | Needs a harness hook for per-step usage (open question) |
| Progress tracker over Trigger metadata | `build-progress.ts` | Harness event stream forwarded to the client |

---

## 15. Pieces V2 can reuse as-is

- `llm-provider.ts` (gateway/OpenRouter seam, generation-id middleware, routing pins).
- `ai-errors` domain (classification, Sentry capture, copy).
- Metering service and Trigger sweeps (holds, captures, settle, reconcile, price refresh).
- `page-build-handoff.ts` pattern (idempotent Trigger handoff + Realtime token).
- `page_generation_attempts` lifecycle pattern (claim CAS, stop/retry/dead-run settle).
- `artifacts`/`versions` immutable versioning and the R2 key layout; publish pipeline and edge Worker.
- AI SDK UI-message streaming plumbing in `ai-chat.service.ts` (data parts, metadata, persistence, admission, leases).
- Brain prompt structure, design worlds, `get_direction_candidates`, `ask_user`, `read_skill`.
- Transcript annotation helpers (file/asset markers).
- Chromium-in-Trigger build config (`trigger.config.ts`) if screenshots stay in Trigger.
- Web `use-live-run.ts`, page polling hooks, generate-page card.

---

## 16. V2 implications

1. Keep the Brain → handoff → background job shape. Replace the Builder body with a harness session in a sandbox (`runSiteBuild` becomes "start harness with these files and this prompt").
2. Keep `createLlmModel` and gateway attribution so cost tracking and routing pins survive. Confirm the harness can take an AI SDK `LanguageModel` or the gateway config.
3. Metering needs a per-step usage hook from the harness. Without it, fall back to gateway generation reconciliation only.
4. The edit story changes from ops-on-wids to "the agent edits files in the project repo". Keep `data-wid` stamping only for the visual editor and publish, or drop it for web apps.
5. Validation moves from `assertValidSite` to build/typecheck/preview checks; the COD lead contract (`wandit:lead` event, honeypot, tel input) should become a library or component, not a regex check.
6. The 1 h undici timeout, 35 min stream cap, 30 min task cap, and 3 min stall watchdog are the current latency envelope; a harness run may need longer and needs its own progress signal.
7. Realtime progress: keep Trigger metadata for the card, or forward harness events through the same channel.
8. Retire the BullMQ worker path and `chat-generation.md`.

---

## 17. Open questions

- Which production model ids are live (`AI_CHAT_MODEL`, `AI_PAGE_BUILDER_MODEL`)? Local `.env` says gpt-5.6-terra and grok-4.5; production UNVERIFIED.
- Does the AI SDK "harness" feature expose per-step `providerMetadata`/usage for metering capture? UNVERIFIED.
- Can the harness run inside a Trigger.dev `medium-1x` machine, or does V2 need a separate sandbox provider (E2B, Vercel Sandbox, Cloudflare Sandbox)? UNVERIFIED.
- Is the legacy EventSource chat path still reachable from any mounted web surface? UNVERIFIED.
- Is `directions.ts` (2848 lines) still needed, or only the worlds library?
- How should click-to-target map to a file location once pages are React/Expo components?

---

## 18. Evidence index (key files)

- Controller: `apps/server/src/modules/ai-chat/presentation/http/controllers/ai-chat.controller.ts`
- Service: `apps/server/src/modules/ai-chat/application/services/ai-chat.service.ts`
- Brain agent: `apps/server/src/modules/ai-chat/agent/chat-agent.ts`, `system-prompt.ts`, `request-context.ts`, `chat-metering.ts`, `gateway-fetch.ts`
- Tools: `apps/server/src/modules/ai-chat/agent/tools/generate-page.tool.ts`, `page-edit.tools.ts`, `ask-user.tool.ts`, `get-direction-candidates.tool.ts`, `read-skill.tool.ts`, `builder-model-options.ts`
- Builder: `apps/server/src/modules/ai-chat/agent/site-builder/site-builder-agent.ts`, `builder-prompt.ts`, `cod-builder-prompt.ts`, `simple-cod-builder-prompt.ts`, `virtual-files.ts`, `screenshot.ts`, `build-progress.ts`, `generation-capture-buffer.ts`, `relocate-tool-images.ts`, `build-start-messages.ts`, `generate-image.ts`, `generate-video.ts`
- Worlds: `apps/server/src/modules/ai-chat/agent/worlds/**`, `directions/directions.ts`
- Provider: `apps/server/src/modules/ai-provider/domain/llm-provider.ts`, `packages/env/src/llm-routing.ts`, `packages/env/src/server.ts`
- Trigger: `apps/server/src/trigger/generate-page.task.ts`, `generate-page-failure.ts`, `generate-page-metering.ts`, `undici-timeouts.ts`, `reconcile-metering.task.ts`, `refresh-model-prices.task.ts`, `apps/server/trigger.config.ts`
- Pages: `apps/server/src/modules/pages/application/page-build-handoff.ts`, `application/services/page-edits.service.ts`, `pages.service.ts`, `domain/ops.ts`, `domain/stamp.ts`, `domain/build-failure.ts`, `domain/feature-shelf.ts`, `domain/inline-cdn-scripts.ts`, `infrastructure/persistence/pages.repository.ts`, `presentation/http/controllers/pages.controller.ts`
- Errors: `apps/server/src/modules/ai-errors/domain/*`, `packages/contracts/src/v1/ai-errors.ts`
- Metering: `apps/server/src/modules/metering/domain/gateway-metering.ts`, `application/services/metering.service.ts`
- Schema: `packages/db/src/schema/chats.ts`, `artifacts.ts`, `page-attempts.ts`, `credits.ts`
- Contracts: `packages/contracts/src/v1/ai-chat.ts`, `pages.ts`, `page-edits.ts`
- Storage/publish: `apps/server/src/infrastructure/storage/r2.ts`, `apps/server/src/modules/sites/application/services/sites.service.ts`, `apps/edge/src/index.ts`
- Web: `apps/web/src/features/workspace/lib/use-ai-chat.ts`, `use-live-run.ts`, `token-usage.ts`, `api/pages.queries.ts`, `components/page/page-tab.tsx`, `components/chat/parts/generate-page-part.tsx`
- Legacy: `apps/server/src/modules/generation/**`, `apps/worker/src/processors/ai-generation.processor.ts`
- Docs: `docs/features/ai-chat-brain.md`, `chat-generation.md` (legacy), `composer-modes.md`, `v2-generation-improvements.md` (retired), `ai-error-normalization-and-observability.md`
