# V1 builder UI map (`apps/web`) — research for V2

Date: 2026-09-03
Worktree: `.claude/worktrees/v2-builder` (branch `feat/v2-builder`, same as `dev`)
Author: Claude Fable (research agent, `web-builder-ui` task)

All file paths are repo-relative. Line numbers refer to the files on this branch.
Items marked UNVERIFIED were not run or confirmed in this pass.

Related reports (same folder): `inspect-ai-pipeline.md` (server agent and stream),
`inspect-data-model.md` (DB), `inspect-publish-serve.md` (R2, edge worker),
`inspect-native-and-simulator.md` (Expo app). This report stays on the web UI.

---

## 0. Summary

- The builder lives at `/p/$projectId`. The route file is thin. It lazy-loads
  `WorkspacePage` (`apps/web/src/routes/_auth/p.$projectId.tsx:28-30`).
- `WorkspacePage` mounts three React context providers, one inside the other:
  `WorkspaceProvider` (project, versions, deployment, tab, viewport, publish),
  `PageEditorProvider` (inline editor state), and `AiChatProvider` (one AI SDK
  `useChat` instance) (`apps/web/src/features/workspace/pages/workspace-page.tsx:54-62`).
- Layout: a 52 px header, then a resizable split. Left card = chat pane (or the
  edit panel, CSS-toggled). Right card = main pane with tabs
  Page | Assets | Marketing | Leads | Settings
  (`apps/web/src/features/workspace/lib/constants.ts:32-52`).
- The live chat uses **AI SDK v7 `useChat`** with `DefaultChatTransport` that
  POSTs to `/api/v1/chats/:chatId/ai-stream`
  (`apps/web/src/features/workspace/lib/use-ai-chat.ts:166-200`,
  `packages/contracts/src/v1/ai-chat.ts:1062-1065`). The server answers with the
  AI SDK UI-message SSE protocol
  (`apps/server/src/modules/ai-chat/presentation/http/controllers/ai-chat.controller.ts:89-168`).
- Message rendering is a **typed part registry**. Text parts render with
  **Streamdown** (`apps/web/src/features/workspace/components/chat/real-message.tsx:81-94`).
  Tool parts render as cards (page build, page edit, media, MCP, ask_user)
  (`apps/web/src/features/workspace/components/chat/parts/message-parts.tsx:335-455`).
- The preview is a **sandboxed `srcDoc` iframe** with
  `sandbox="allow-scripts allow-forms"` and no `allow-same-origin`
  (`apps/web/src/features/workspace/components/page/page-tab.tsx:694-717`).
  HTML comes from `GET /api/v1/pages/versions/:id/html` as JSON
  (`packages/contracts/src/v1/pages.ts:149-156, 211-213`).
- Page generation does not stream HTML. The chat tool `generate_page` queues a
  Trigger.dev run. The client follows the run with `@trigger.dev/react-hooks`
  (`apps/web/src/features/workspace/lib/use-live-run.ts`) and polls
  `GET /api/v1/projects/:id/page` every 1.5 s while a build runs
  (`apps/web/src/features/workspace/api/pages.queries.ts:42-52`).
- Inline editing runs inside the iframe through an injected script and a
  postMessage protocol. That code is the shared package
  `packages/preview-editor` (also used by the Expo app).
- There is **no file tree, no code view, no terminal, no logs view, no backend
  dashboard** in V1. There are no WebSockets. The only realtime channels are:
  the AI SDK SSE stream, Trigger.dev Realtime, and TanStack Query polling.
- Legacy code still in the tree: `use-project-chat.tsx` (EventSource + BullMQ
  path) has no importers. `chat-message.tsx` `ChatMessageView` has no importers.
  `docs/features/chat-generation.md` describes that old path.

---

## 1. Method

I read the route entry and followed imports. I read every file under
`apps/web/src/features/workspace/{pages,lib,api,components/{shell,chat,page,
assets,leads,publish,settings}}` that the flow touches, plus
`packages/preview-editor/src/*`, key files in `packages/contracts/src/v1/*`,
`apps/web/src/lib/*`, `apps/web/src/routes/*`, and the three docs the task
named. I did not run the app. I did not run tests.

Sizes (lines): `workspace` feature = 43,155 lines total including specs
(`wc -l`); `prompt-box.tsx` = 2,722; `use-page-editor.tsx` = 1,460;
`element-panel.tsx` = 1,607; `page-tab.tsx` = 840; `publish-popover.tsx` = 873;
`domain-purchase-dialog.tsx` = 1,029; `editor-script.ts` (preview-editor) = 1,518;
`ai-chat.ts` (contracts) = 1,065.

---

## 2. Route entry and shell

### 2.1 Route file

`apps/web/src/routes/_auth/p.$projectId.tsx`

- `createFileRoute("/_auth/p/$projectId")` (line 39).
- `validateSearch` keeps only a valid `?tab=` value (lines 40-41, guard
  `isWorkspaceTab` in `apps/web/src/features/workspace/lib/helpers.ts:20-25`).
- `WorkspacePage` is `React.lazy` so `/` and `/dashboard` stay light (lines 28-30).
- Renders `<WorkspacePage projectId tab={tab ?? "page"} />` inside `Suspense`
  (lines 52-57).
- Parent layout `apps/web/src/routes/_auth/route.tsx:7-40` checks the session in
  `beforeLoad`, redirects to `/` with `auth=required` when signed out, and to
  `/onboarding` when onboarding is not done.

### 2.2 Root providers

`apps/web/src/routes/__root.tsx:49-96`: `QueryClientProvider` → `AppI18nProvider`
→ `ThemeProvider` (next-themes, class attribute, default light) →
`DirectionProvider` (RTL) → `AuthModalProvider` → `WorkspaceProvider`
(teams/org scope, not the builder store) → `BillingModalProvider` → `Outlet`,
plus `Toaster` (sonner).

Note: two different things are called `WorkspaceProvider`:
- `@/features/workspaces/lib/workspace-provider` = the active org/team scope.
- `@/features/workspace/lib/store` = the builder page state.

### 2.3 Workspace page and layout

`apps/web/src/features/workspace/pages/workspace-page.tsx`

- `WorkspacePage` (lines 44-64): `WorkspaceProvider key={projectId}` →
  `PageEditorProvider` → `AiChatProvider` → `WorkspaceLayout`.
  The `key` remounts everything on project switch.
- `WorkspaceLayout` (lines 66-109): full-height flex column. A gradient band
  behind the header (lines 97-100). `WorkspaceHeader`, then `MobileSplit` or
  `DesktopSplit` by `useIsMobile()`, then `PublishConfirmDialog`.
  Leaving the Page tab forces editor mode back to `browse` (lines 77-79).
- `DesktopSplit` (lines 146-230): `ResizablePanelGroup` from `@wandit/ui`
  (wraps `react-resizable-panels` 4.x, `packages/ui/package.json:25`).
  Chat panel: default and min width 430 px, max 42 %, collapsible to 0
  (lines 143-144, 191-200). Layout is persisted to localStorage under
  `wandit-workspace-panels` (`helpers.ts:30-54`, `constants.ts:61`).
  Chat pane and edit panel are both mounted and CSS-toggled by `hidden`
  (lines 203-210). This keeps the stream, the scroll, and the draft alive.
- `MobileSplit` (lines 111-137): chat or edit panel as a full-screen overlay
  over the main pane; both stay mounted.
- `WorkspaceMain` (lines 232-286): `MainPaneHeader` + tab bodies. The Page tab
  stays mounted across tab switches (`hidden` toggle) so the iframe keeps state
  (lines 254-263). Other tabs mount only when active. A `pageReloadKey` counter
  remounts the iframe from the header reload button (lines 239-252).

### 2.4 Header and tab chrome

- `components/shell/workspace-header.tsx:27-78`: logo → `/dashboard`,
  `WorkspaceSwitcher` (org), `ProjectSwitcher`, "autosaved" dot, academy link,
  `FeedbackButton`, `CreditsChip`, `UpgradeButton`, `PublishButton`, `UserMenu`.
- `components/shell/main-pane-header.tsx:23-67`: chat re-open button when
  collapsed, `WorkspaceTabs`, and per-tab controls (`PageControls` for Page,
  `MarketingControls` for Marketing).
- `components/shell/workspace-tabs.tsx:12-67`: segmented pill control. Tabs
  navigate by search param (`setTab` in `store.tsx:179-188`). Leads shows a
  count badge from `project.leadCount` (lines 57-61).
- `components/shell/project-switcher.tsx:71-150`: dropdown of the user's
  projects with status dot and lead count; "All projects" link.
- Labels: `packages/internationalization/dictionaries/en/workspace.json:15-21`
  (`Page`, `Assets`, `Marketing`, `Leads`, `Settings`).

### 2.5 The builder store (`lib/store.tsx`)

Plain React context, not Zustand (`store.tsx:18-19`). `WorkspaceProvider`
(lines 143-531) composes:

- Queries: `useProjectQuery`, `useDeploymentCurrentQuery`,
  `usePageOverviewQuery`, `usePageVersionsQuery` (lines 155-158).
- Mutations: publish, unpublish, rollback, restore version, update pixels
  (lines 160-164).
- UI state: `chatOpen` (localStorage `wandit-workspace-chat-open`),
  `viewport` (`"mobile" | "desktop"`, default mobile), `manualVersion`,
  `publishCandidate`, `draftSlug` (lines 166-177).
- Derived: `previewVersion` (manual pin or server active),
  `isPreviewingHistorical`, `generationPhase` / `isGenerating` /
  `pendingVersionNumber` from `overview.latestAttempt.status`
  (`lib/page-version-state.ts:23-91`).
- Context value type: `WorkspaceContextValue` (lines 73-131).

---

## 3. Chat panel

### 3.1 One AI SDK chat instance

`apps/web/src/features/workspace/lib/ai-chat-context.tsx`

- `AiChatProvider` calls `useAiChat(projectId)` once (line 24) and exposes two
  contexts: the full chat (`useSharedAiChat`) and a stable subset
  (`useAiChatControls`: `status`, `error`, `sendText`, `aiTargets`) for the
  preview and inspector (lines 8-11, 27-35).

### 3.2 `useAiChat` (`lib/use-ai-chat.ts`)

- Dependencies: `useChat` from `@ai-sdk/react` 4.x and `ai` 7.x
  (`apps/web/package.json:15,31`).
- Resolve chat id: `useChatByProjectQuery(projectId)` →
  `GET /api/v1/chats/by-project/:projectId` (`api/chat.queries.ts:69-74`,
  `packages/contracts/src/v1/chats.ts:177`). Then
  `useChatMessagesQuery(chatId)` → `GET /api/v1/chats/:chatId/messages`
  (`chat.queries.ts:82-101`).
- Hydration: `hydrateAiChatMessages` turns persisted rows into `UIMessage`
  objects; drops system and empty messages; parses metadata with
  `aiChatMessageMetadataSchema` (lines 63-82, 498-510).
- Message type: `WanditUIMessage = UIMessage<AiChatMessageMetadata,
  AiChatDataParts, AiChatTools>` (lines 41-45).
- Transport (lines 166-200): `new DefaultChatTransport({ api:
  buildStreamUrl(chatId), credentials: "include", fetch:
  createStatusPreservingChatFetch(), prepareSendMessagesRequest })`.
  `prepareSendMessagesRequest` adds the workspace-scope header
  (`workspaceScopeHeaders()`, `features/workspaces/lib/workspace-scope.ts:56-60`)
  and a `metadata` body field with `composer` and `selectedWids` read from a
  ref (`metaRef`, lines 94-97). The ref survives the SDK's automatic resubmits.
- `useChat` options (lines 202-276):
  - `id: chatId ?? "project:<id>"`.
  - `messageMetadataSchema`, `dataPartSchemas` for `ai-error`,
    `billing-error`, `credits-settled`.
  - `sendAutomaticallyWhen`: continue after client tool output or approval
    responses (lines 221-223).
  - `onFinish`: invalidates page versions, page overview, credits, project
    list and detail (lines 105-122, 226-234).
  - `onError`: billing error dispatch (lines 235-244).
  - `onData`: routes `data-ai-error` to a banner or a notice list; applies
    `credits-settled` to the balance cache (lines 245-275).
- Autostart (lines 278-330): when the last message is a user message and
  `chatAutostart.consume(projectId, chatId)` is true, it primes `metaRef` from
  the persisted composer and calls `regenerate()`. This is how a project created
  from the dashboard prompt starts its first AI turn without a second send.
  The flag is set in `features/projects/lib/chat-autostart.ts:27-53`.
- Mid-turn preview refresh (lines 339-354): when a new applied
  `tool-apply_element_ops` / `tool-insert_section` / `tool-replace_section`
  part appears during an active turn, it invalidates page data so the iframe
  updates before the turn ends. Predicate: `isAppliedPageEditPart`
  (lines 594-612).
- `sendText(text, { files, composer, selectedWids, selectedTargets })`
  (lines 356-410): writes `metaRef`, resets errors, sets `aiTargets`, calls
  `sendMessage({ text, metadata, files })`. Returns `true` only when `onFinish`
  reported a clean end (`lastSendSucceededRef`).
- `retryTurn` (lines 412-425): `regenerate({ messageId })` for the last
  terminal error message. `answerAskUser` (lines 427-441): `addToolOutput` for
  `ask_user`.
- Returned API (lines 443-461): `messages, status, error, billingError,
  aiError, notices, aiTargets, chatId, regenerate, retryTurn, composerPrefill,
  prefillComposer, sendText, answerAskUser, addToolApprovalResponse,
  isResolvingChat, isLoadingMessages`.

### 3.3 Status-preserving fetch

`lib/status-preserving-chat-transport.ts:13-38`: wraps `fetch`. On non-2xx it
throws `ApiClientError` built from the server error envelope. This is how 402
(credits) and 403 (member limit) reach `useChat` with typed codes.

### 3.4 Server side of the stream (for context only)

`apps/server/src/modules/ai-chat/presentation/http/controllers/ai-chat.controller.ts`

- `POST v1/chats/:chatId/ai-stream` with `@SkipResponseEnvelope()` (lines 89-90).
- Body: `{ id?, messageId?, messages, metadata?, trigger? }` (lines 42-48).
- Validates messages with `validateUIMessages` and the shared tool map
  (lines 183-192). Rejects system messages (lines 115-120).
- `reply.hijack()` then `aiChatService.stream(...)` owns the raw SSE response
  (lines 148-163).
- The service builds a `createUIMessageStream` and a `createAgentUIStream` over
  a `ToolLoopAgent` with `smoothStream({ delayInMs: 15 })`
  (`apps/server/src/modules/ai-chat/application/services/ai-chat.service.ts:1020,
  1203-1212`; agent in `apps/server/src/modules/ai-chat/agent/chat-agent.ts:440`).
  Details are in `inspect-ai-pipeline.md`.

### 3.5 ChatPane (`components/chat/chat-pane.tsx`)

- Reads the shared chat, the editor, the token-usage flag, and the staff usage
  query (lines 65-101).
- Derived UI: retry visibility (lines 107-125), thinking indicator until the
  reply has a visible part (lines 156-160, predicate in
  `parts/visible-reply-part.ts`), auto-scroll to bottom (lines 223-226).
- When a `tool-generate_page` output with `status: "queued"` appears, it
  invalidates the page overview so polling starts (lines 232-255).
- Body states: `MockChatThread` (flag `MOCK_CHAT_THREAD_ENABLED = false`,
  `mock-thread.tsx:17`), skeleton while loading, empty state with suggestion
  chips, else the message list (lines 362-473).
- Message list: `MessageParts` per message with `isStreaming` for the last
  message when `status === "streaming"` (lines 399-421).
- Error banner with Retry or a "queued work" hint (lines 426-471).
- Composer area (lines 476-563): staff token meters, click-to-target chip,
  `OutOfCreditsBanner`, `PromptBox` (`variant="compact"`, `attachmentsEnabled`,
  `clearOnSubmit`, `submitOverride` when an ask is docked, `topSlot` = the
  request tray).
- Submit routing (`handleComposerSubmit`, lines 170-200): if an ask is docked,
  the text answers it. Else it sends with the composer metadata, the uploaded
  files, and the selected element (`editor.selection` in `select` mode) as
  `selectedWids` + `selectedTargets`.

### 3.6 Message rendering

`components/chat/parts/message-parts.tsx`

- `coalesceMessageParts` (lines 562-711) groups parts into entries:
  `image-run` (consecutive image file parts), `image-batch` (several
  `generate_image` calls), `page-edit-run` (page-edit tools), `mcp-run`
  (`dynamic-tool` parts), `ask-run` (`tool-ask_user`), or single `part`.
  Transparent parts (`step-start`, `reasoning`, `tool-read_skill`,
  `tool-read_attachment`, `tool-inspect_video`, `tool-read_lead_performance`,
  `tool-get_direction_candidates`, `data-billing-error`,
  `data-credits-settled`) never render (lines 47-65).
- `orderMessagePartEntries` (lines 156-188): conversational first, async
  deliverable cards last, settled MCP receipts folded to the bottom when the
  turn is done.
- `MessageParts` (lines 192-495): one Wandit header per assistant turn, target
  chips on user turns (lines 461-482), then the switch (lines 335-455):
  - `data-ai-error` → `PersistedAiErrorPart`.
  - `text` → `TextPart` → `RealChatMessage`.
  - `file` → `FilePart`.
  - `tool-generate_page` → `GeneratePagePart`.
  - `tool-generate_marketing_asset`, `tool-generate_image`,
    `tool-scrape_leads`, `tool-animate_image`, `tool-generate_video`,
    `tool-product_video`, `tool-edit_video`, `tool-extend_video` → cards.
  - Unknown → dev console warning (lines 449-454, 713-718).
- `real-message.tsx:50-97`: user turn = right-aligned bubble; assistant turn =
  `Streamdown` with `mode="streaming"`, `isAnimating`, `caret="block"`, default
  remark plugins plus `remark-breaks` (lines 13-17). Streamdown 2.5
  (`apps/web/package.json:46`). Table wrappers get a sticky header and a max
  height (line 91).
- `text-part.tsx:8-40`: `useAnimatedText` keeps a typewriter catch-up after the
  stream ends.
- `chat-message.tsx:49-133`: `ChatMessageView` is dead code (header comment
  lines 20-24). Only `ThinkingIndicator` (lines 140-162) is live.

### 3.7 Tool cards

- **Page build** (`parts/generate-page-part.tsx`): states `input-streaming`
  ("Working on your page brief…"), `input-available` ("Queueing the build…"),
  `output-error`, then `output-available` (lines 70-137). With `status:
  "queued"` it renders `PageBuildCard` (lines 176+), which uses `useLiveRun`
  on the `realtime` handle and `usePageAttemptQuery` as durable truth
  (imports lines 38-52). Progress shape: `pageBuildProgressSchema` in
  `packages/contracts/src/v1/ai-chat.ts:553-587` (percent, phase, headline,
  images, sections, shots, findings, fixes, done). Stop / Retry / Dismiss hit
  `pagesRoutes.stopAttempt|retryAttempt|dismissAttempt`
  (`api/pages.queries.ts:75-131`).
- **Page edits** (`parts/page-edit-part.tsx`): groups
  `tool-get_page_outline`, `tool-apply_element_ops`, `tool-read_elements`,
  `tool-read_theme`, `tool-read_section`, `tool-insert_section`,
  `tool-replace_section` into one collapsible activity card with rows and a
  "updated to vN" receipt (lines 16-41, 67-118).
- **MCP connectors** (`parts/mcp-tool-part.tsx`): `dynamic-tool` parts with
  approval states (`approval-requested|approved|denied`), receipt rows, media
  deliverables, and `ConnectorGenerationCard` for queued background runs
  (lines 28-60; card in `parts/connector-generation-card.tsx:1-60`).
- **ask_user** (`request-tray/*`): the first unanswered `ask_user` of the last
  assistant message docks into the composer `topSlot`
  (`use-request-tray.ts:1-10`). Body kinds in `request-tray/types.ts:43+`
  (free-text, single-choice, multi-select, world-pick, segmented, visual-pick,
  attachments, …). Answers complete the client tool via `addToolOutput`
  (`use-ai-chat.ts:427-441`); the SDK then resubmits automatically.
- **Media** (`parts/generate-image-part.tsx`, `generate-video-part.tsx`,
  `animate-image-part.tsx`, `product-video-part.tsx`, `chat-media.tsx`): cards
  that follow Trigger runs and render galleries. Not read in detail.

### 3.8 Composer (`features/projects/components/prompt-box.tsx`)

- Shared by the landing hero, the dashboard, and the chat pane (`variant:
  "hero" | "compact"`, line 1833).
- Props (lines 1819-1867): `onSubmit(prompt, composer, attachments)`,
  `attachmentsEnabled`, `placeholder`, `isSubmitting`, `disabled`,
  `initialValue`, `initialComposer`, `clearOnSubmit`, `topSlot`,
  `submitOverride`, `onValueChange`, `onBuilderModelChange`.
- Internal state (lines 1900-1946): text, `routeMode`
  (`auto|page|marketing|image|video`, line 95), selected output id, output
  options, dev-only builder model (localStorage), skill ids (six ads skills,
  lines 120-126), attachments (R2 uploads via
  `features/projects/api/attachments.services.ts`), source image for video,
  connectors dialog, voice dictation (`lib/use-voice-dictation.ts`).
- Output contract: `ComposerMetadata = { mode, output?, skills?, options? }`
  (`packages/contracts/src/v1/chats.ts:51-60`). The server renders it into the
  request context; see `docs/features/composer-modes.md:1-30`.

### 3.9 Legacy chat path (still in the tree, not used)

- `lib/use-project-chat.tsx` (380 lines): `EventSource` on
  `/api/v1/chats/:chatId/stream`, BullMQ job model, optimistic user rows. No
  importer in `apps/web/src` (grep shows only comments referencing it).
- `api/chat.services.ts:105-116` `sendChatMessage` (POST `/messages`) belongs
  to that path. `chatStreamEventSchema` in `contracts/v1/chats.ts:141-172` too.
- `api/dto.ts:39-89` still declares mock `ChatMessage`/`GenerationPart` types
  used only by the dead `ChatMessageView` and `generation-card.tsx`.
- `docs/features/chat-generation.md` describes this legacy design (BullMQ +
  Redis + SSE deltas). `docs/PRD.md` §7 also. The live design is documented in
  `docs/features/ai-chat-brain.md` (Brain → Builder, Trigger.dev, AI SDK 7).

---

## 4. Preview (Page tab)

### 4.1 Component tree

`components/page/page-tab.tsx`

- `PageTab` (lines 161-180): `SaveBar` → `HistoricalVersionBanner` → stage →
  `DiscardConfirmDialog` → `ConflictDialog`.
- `PreviewStage` (lines 353-687):
  - Data: `useVersionHtmlQuery(previewVersion?.id)` (line 376,
    `staleTime: Infinity` in `api/pages.queries.ts:140-151`).
  - `previewHtml = injectPreviewEditor(html)` in a `useMemo` (lines 393-396).
    The cache keeps canonical HTML. The editor script is added at render time only.
  - Bridge: `usePreviewBridge({ iframeRef, onSelect, onDeselect,
    onSelectionRect, onEscape, onAskAiShortcut, onTextEdited, onReady })`
    (lines 426-478). `onReady` re-sends mode, comment pins, AI targets, and
    suspended state, then replays pending edits (lines 465-477).
  - Effects mirror editor mode, comment pins, AI target pulses, and
    "suspended" into the iframe (lines 481-505).
  - Loading: skeleton phone frame (lines 539-545). No version: generating panel
    or failed panel or empty state (lines 547-562).
  - Stage: `motion.div` with a dark phone bezel (304 × 632 px) or a desktop
    frame (max 1440 px) (lines 603-644). A generating overlay covers the
    iframe while a build runs in `browse` mode (lines 639-643).
  - `PreviewFrame` key = `${versionId}-${reloadKey}-${viewport}-${discardCount}`
    (line 624) so a version switch, reload, viewport change, or discard remounts
    the iframe.
  - Target comment popover and review bar (lines 645-684).
- `PreviewFrame` (lines 694-717): `<iframe srcDoc sandbox="allow-scripts
  allow-forms" />`, fades in on load.
- `GeneratingPanel` (lines 719-770): spark, rotating step captions from the
  dictionary, an indeterminate bar. `FailedPanel` (lines 775-812) uses
  `buildFailureCopy(failureCode)` (`lib/build-failure-copy.ts`).

### 4.2 Page data and polling

`api/pages.queries.ts` and `api/pages.services.ts`

- `pageKeys`: `overview(projectId)`, `versions(projectId)`,
  `versionHtml(versionId)`, `attempt(projectId, attemptId)` (lines 30-40).
- `usePageOverviewQuery`: polls every 1.5 s while `latestAttempt.status` is
  `queued` or `generating` (lines 42-52). Shape: `pageOverviewSchema`
  (`contracts/v1/pages.ts:79-96`): `artifactId`, `activeVersion {id, number,
  createdAt}`, `latestAttempt {id, status, error, failure, failureCode,
  versionId, createdAt}`.
- `usePageAttemptQuery`: polls one attempt every 1.6 s while running
  (lines 59-72).
- `usePageVersionsQuery` → `GET /projects/:id/page/versions` →
  `PageVersionListItem[]` with `label`, `isLive`, `source`
  (`builder|ai-edit|inline|theme|restore`), `isBuilderOrigin`
  (`contracts/v1/pages.ts:158-187`).
- `useRestorePageVersion` → `POST .../versions/:id/restore` with
  `expectedActiveVersionId` (CAS) (lines 166-197).
- `applyPageOps` → `POST /projects/:id/page/ops`; 409 → `PageOpsConflictError`,
  422 → `PageOpsFailedError` (`pages.services.ts:180-214`).

### 4.3 Versions and history

- `components/page/version-switcher.tsx:18-80`: dropdown, newest first, with
  `vN`, label, relative time, `Live` badge, `Latest` badge.
- Selecting a non-active version pins it (`store.tsx:256-262`); the banner
  offers "Restore this version" or "Back to latest" (`page-tab.tsx:182-229`).
- Publish history with rollback is in Settings → Publishing
  (`components/settings/publish-section.tsx:1-3`).

### 4.4 Page toolbar

`components/page/page-toolbar.tsx:66-204`: generating pill, `VersionSwitcher`,
viewport segmented control (desktop/mobile), "Cibler" (select) and "Modifier"
(edit) toggles (disabled on historical versions or while a build runs), reload,
open in new tab (`openHtmlInNewTab` writes the version HTML into a new tab).

### 4.5 Inline editor

- Modes: `browse | select | edit` (`packages/preview-editor/src/messages.ts:15`).
- `lib/use-page-editor.tsx` (`PageEditorProvider`): single source of truth for
  selection, the pending op batch, Save/Discard, conflicts, target comments,
  and the Ask-AI dispatch lock. Invariants in the header (lines 1-18): the
  client never edits canonical HTML; one op batch → one new immutable version;
  `baseVersionId` captured on the first dirty op; a foreign version change
  while dirty drops the batch with a toast.
- Save (`applyPageOps` call around the `buildPendingOps` block): sends
  `{ baseVersionId, source, ops }`; prunes only what the batch persisted;
  edits made during the request stay pending and rebase onto the new version.
- Op kinds (`packages/contracts/src/v1/page-edits.ts:145-322`): `text`,
  `image-src`, `brand-logo`, `placeholder-image`, `element-style`,
  `set-tokens`, `reset-tokens`, `set-page-title`, `remove-element`,
  `set-link-href`, `set-placeholder`, `section-style`; server/AI-only:
  `insert-element`, `replace-section`, `insert-section`.
- `components/page/edit-panel.tsx:32-149`: replaces the chat in the left pane
  in `edit` mode. `ElementPanel` when a target is selected, then tabs
  `Theme` (`theme-panel.tsx`: 8 hex tokens, radius, two curated fonts, presets,
  WCAG contrast warnings) and `Data` (`data-panel.tsx`: phone / WhatsApp /
  email / social links found in the HTML, edited in one place).
- `SaveBar` (`page-tab.tsx:254-291`): "N changes", Discard, Save.
- Target comments (`select` mode): the user pins up to 10 comments on elements
  and sends them as one AI message (`lib/use-target-comments.ts`,
  `@wandit/preview-editor/target-comments`, dispatch in
  `page-tab.tsx:521-537`). The dispatch first saves pending manual edits, then
  calls `sendText`, and freezes the iframe (`set-suspended`) during the turn.

### 4.6 Security model of the preview

- Opaque origin: `event.origin === "null"`. The bridge accepts a child message
  only when `event.source === iframe.contentWindow` and the payload parses
  against the Zod schema (`lib/preview-editor/use-preview-bridge.ts:1-6, 45-50`).
- Parent → child uses `targetOrigin "*"`; payloads carry no secrets
  (`messages.ts:1-7`).
- Same-frame forgery guard: page JS shares the realm with the editor script, so
  `page-tab.tsx:416-425` gates what each message may do (selections only in a
  targeting mode; text edits only for the last user-selected wid).
- The server strips any element whose id starts with `__wandit-` on save
  (`packages/preview-editor/src/editor-script.ts:1-3`).

---

## 5. `packages/preview-editor`

`packages/preview-editor/src/index.ts:1-13` says: "Shared preview-editor runtime
for generated landing pages. The web app's sandboxed iframe and the native app's
WebView inject the SAME editor script and speak the SAME postMessage protocol."

Files (`wc -l`):

| File | Lines | Role |
|---|---|---|
| `editor-script.ts` | 1,518 | The ES2017 script + CSS injected into the page. Hover/select boxes, section ladder, contentEditable text, comment pins, AI target pulse. Exports `EDITOR_SCRIPT`, `EDITOR_STYLE`, ids `__wandit-editor`, `__wandit-editor-style` (lines 9-12). |
| `inject.ts` | 25 | `injectPreviewEditor(html)` inserts the block before the last `</body>` (lines 21-25). |
| `messages.ts` | 545 | Zod protocol. Envelope `{ source: "wandit-preview", v: 1 }` (lines 12-13). Child → parent: `ready`, `select` (rich payload with computed styles, ladder, flags), `deselect`, `selection-rect`, `escape`, `ask-ai-shortcut`, `text-edited` (lines 110-139). Parent → child: `set-mode`, `set-suspended`, `select-target`, `apply-style`, `swap-image`, `set-brand-logo`, `set-comment-pins`, `set-ai-targets`, `placeholder-image`, `set-text`, `remove-element`, `set-link-href`, `set-placeholder`, `apply-section-style`, `set-tokens`, `clear-selection` (lines 199-241). Message builders (lines 420-545). |
| `parse-tokens.ts` | 226 | Parses the `:root` token block and Google Font links from canonical HTML. |
| `pending.ts` | 445 | Pending-op batch model: `PendingOpsSnapshot`, `buildPendingOps` in dependency-safe order (lines 52-80). |
| `target-comments.ts` | 228 | Queue model for pinned comments and `dispatchTargetComments`. |
| `contrast.ts` | 240 | WCAG contrast helpers for the theme panel. |

The web files under `apps/web/src/features/workspace/lib/preview-editor/*.ts`
are shims that re-export this package (each is 3-5 lines). The native app
wraps the same script with an adapter that forwards child messages to
`ReactNativeWebView.postMessage`
(`apps/native/features/workspace/lib/page-preview/preview-document.ts:1-60`).

What it is not: it is not a DOM-to-source mapper. It works on `data-wid`
attributes that the server stamps on the HTML
(`editor-script.ts:89-90` refers to `apps/server/src/modules/pages/domain/stamp.ts`).
It only makes sense for single-file static HTML that the server owns.

---

## 6. `packages/contracts`

- Zod schemas + inferred types + route maps, consumed as raw TS source
  (`packages/contracts/README.md:1-40`). One file per domain under `src/v1/`,
  flat barrel in `src/index.ts:1-98`.
- Idiom: `export const xSchema = z.object(...)`; `export type X = z.infer<...>`;
  enums as `as const` tuples; route maps `xRoutes` with full `/api/v1/...`
  paths; envelope `{ data, meta }` stays out of domain schemas
  (`README.md:29-46`, `src/http/envelope.ts`).
- Web services call `apiClient.get<unknown>(route)` then `schema.parse(data)`
  (example `api/chat.services.ts:65-71`). `apiClient` = axios wrapper that adds
  cookies, `/api/v1`, and unwraps the envelope (`apps/web/src/lib/api-client.ts:15-20`).
- Builder-relevant files: `ai-chat.ts` (1,065 lines: data parts, message
  metadata, every tool input/output, `AiChatTools` map lines 1010-1060,
  `aiChatRoutes.stream` line 1064), `chats.ts` (composer metadata, chat rows,
  routes), `pages.ts` (overview, attempts, versions, routes), `page-edits.ts`
  (op kinds, wid schema), `page-theme.ts` (tokens, fonts, presets),
  `deployments.ts` (publish state machine and routes), `leads.ts`,
  `project-assets.ts`, `marketing-assets.ts`, `attachments.ts`,
  `shared/trigger-realtime.ts` (`{ runId, publicAccessToken }` handle).
- Sizes: `admin.ts` 1,445, `affiliates.ts` 1,214, `ai-chat.ts` 1,065,
  `admin-analytics.ts` 878, `billing.ts` 666, `leads.ts` 629, `domains.ts` 509.

---

## 7. Other tabs and the publish flow

### 7.1 Assets tab

`components/assets/assets-tab.tsx:37-135`: filter chips (all / images /
videos), refresh, grid of `AssetTile`, lightbox. Data from
`useProjectAssetsQuery` → `GET /v1/projects/:id/assets`. Download through
`/v1/projects/:id/assets/download?key=` (`docs/features/composer-modes.md`,
"Assets tab"). The grid pieces are shared with the dashboard `/assets` page
(`features/assets/pages/workspace-assets-page.tsx`).

### 7.2 Marketing tab

`components/marketing/marketing-tab.tsx:1-6`: card grid of generated marketing
documents; clicking opens the HTML in a sandboxed iframe; polls while
generating.

### 7.3 Leads tab

`components/leads/leads-tab.tsx:1-3`: counters, search, status and source
filters, date filter, desktop table / mobile cards, call and WhatsApp links,
inline status pipeline (`to_confirm → confirmed → shipped → delivered →
returned → cancelled`, `constants.ts:67-74`), archive, CSV export, keyset
pagination. Data: `useLeadsQuery` polls every 15 s and refetches on focus
(`api/leads.queries.ts:20-29`). Services: `listLeads`, `listAllLeads`
(export), `updateLeadStatus`, `updateLeadArchive`
(`api/leads.services.ts:20-101`). Extras: Google Sheet sync and COD Pilot sync
buttons. A cross-project Leads page exists at `/leads`
(`routes/_auth/leads.tsx`, `features/leads/pages/workspace-leads-page.tsx`).

### 7.4 Settings tab

`components/settings/settings-tab.tsx:15-71`: `GeneralSection` (rename,
pixels), `PublishSection` (live URL, slug editor with debounced availability
check, publish history with rollback), `DomainsSection` (custom domains),
`DangerZone`.

### 7.5 Publish flow

- Header button → `PublishPopover` (`components/publish/publish-popover.tsx`).
  It reads `deployment.uiState` (`draft | publishing | published | failed`,
  `contracts/v1/deployments.ts:24-33`), shows the subdomain
  `{slug}.wandit.app` (`constants.ts:55`), domain cards, and a publish CTA
  (lines 81-140). Purchase and external-domain dialogs open from it.
- `publish()` in the store sets a candidate; `PublishConfirmDialog` then
  `confirmPublish()` → `POST /projects/:id/deployments { slug?, versionId }`
  (`store.tsx:301-336`, `api/deployments.services.ts:85-95`).
- `useDeploymentCurrentQuery` polls every 2.5 s while `publishing`
  (`api/deployments.queries.ts:15, 30-39`).
- After success the mutation refreshes deployment, slugs, list, versions
  (`isLive` flags), and project caches (`api/deployments.mutations.ts:53-76`).
- Unpublish = `DELETE .../deployments/active`; rollback = `POST
  .../deployments/rollback { deploymentId }`.
- Serving is one Cloudflare Worker: Host → KV pointer → R2
  `published/{projectId}/current.html` (`apps/edge/src/index.ts:1-22`).
  Details in `inspect-publish-serve.md`.

---

## 8. Streaming and realtime state in the browser

| Channel | Where | Notes |
|---|---|---|
| AI SDK UI-message stream (SSE over `fetch`) | `use-ai-chat.ts:166-200` | The only chat channel. One POST per turn. Auto-resubmit for client tools. |
| Trigger.dev Realtime | `lib/use-live-run.ts:61-148` | `useRealtimeRun(runId, { accessToken })` + `useRun` poll every 5 s as a safety net. Read-scoped token minted at queue time (`triggerRealtimeHandleSchema`). Terminal rows are sticky. Used by page build, video, marketing, scrape, and connector cards. |
| TanStack Query polling | `pages.queries.ts:46-50, 67-70`; `deployments.queries.ts:34-38`; `leads.queries.ts:26-27` | Overview 1.5 s during build; attempt 1.6 s; deployment 2.5 s while publishing; leads 15 s. |
| `EventSource` | `use-project-chat.tsx:260` | Legacy. Not mounted. |
| WebSockets / socket.io | none | grep found no usage in `apps/web/src`. |

Query client defaults: `staleTime 30 s`, one retry except 401, no refetch on
window focus (`apps/web/src/lib/query-client.ts:60-77`).

---

## 9. State flow: from send to rendered preview

1. The user types in `PromptBox` inside `ChatPane`. On submit, `PromptBox`
   calls `onSubmit(prompt, composer, attachments)` (`prompt-box.tsx:1824-1829`).
2. `handleComposerSubmit` (`chat-pane.tsx:170-200`) calls `sendText` with
   `composer`, `files`, and the selected element if the editor is in `select`
   mode.
3. `sendText` (`use-ai-chat.ts:356-410`) writes `metaRef`, clears errors, and
   calls `useChat().sendMessage({ text, metadata, files })`.
4. `DefaultChatTransport.prepareSendMessagesRequest` builds the body
   `{ id, messages, trigger, messageId, metadata: { composer, selectedWids } }`
   and adds the workspace header (`use-ai-chat.ts:175-197`). It POSTs to
   `/api/v1/chats/:chatId/ai-stream`.
5. The server validates, runs the `ToolLoopAgent`, and streams UI-message
   parts back (`ai-chat.controller.ts:89-168`). `useChat` updates `messages`
   and `status` (`submitted → streaming → ready`).
6. `ChatPane` renders each message through `MessageParts`. Text streams through
   `Streamdown`. Tool parts show cards.
7. Path A — new page: the agent calls `generate_page`. The tool output
   `{ status: "queued", attemptId, realtime, versionNumber }` arrives
   (`contracts/v1/ai-chat.ts:505-519`). `GeneratePagePart` mounts
   `PageBuildCard`, which subscribes with `useLiveRun` and polls the attempt.
   `ChatPane` invalidates the page overview (`chat-pane.tsx:232-255`).
   `usePageOverviewQuery` now polls every 1.5 s. `PreviewStage` shows the
   generating overlay (`page-tab.tsx:639-643`).
8. When the Trigger run finishes, the server writes the new version and moves
   `activeVersion`. The next overview poll returns the new `activeVersion.id`.
   `store.tsx` refreshes the version list (lines 246-254). `previewVersion`
   changes. `useVersionHtmlQuery` fetches the HTML once. `PreviewFrame`
   remounts with a new key and renders the `srcDoc` with the injected editor.
9. Path B — AI edit of the existing page: the agent calls page-edit tools
   (`apply_element_ops`, `replace_section`, `insert_section`). The server
   applies the ops and mints a new version during the turn. The client sees an
   applied output part and invalidates page data immediately
   (`use-ai-chat.ts:339-354`). The overview returns the new active version and
   the iframe remounts, before the turn ends.
10. On `onFinish`, the client invalidates versions, overview, credits, and
    project caches (`use-ai-chat.ts:226-234`).
11. Path C — manual edit: the user clicks an element in `edit` mode. The
    iframe posts `select`. `PageEditorProvider` records ops and posts live
    patches back (`apply-style`, `set-text`, …). Save posts one batch to
    `/page/ops`; the server returns a new version; the store follows it; the
    iframe remounts with the saved HTML and pending leftovers replay on `ready`.

---

## 10. Dashboard, project creation, and shared shell

- `/dashboard` (`features/projects/pages/dashboard-page.tsx:96-120`): projects
  grid with search and status filter, a `PromptBox`, out-of-credits banner,
  pending invites banner, `DashboardShell` with a sidebar. Sidebar nav
  (`features/projects/lib/nav-config.ts:47-101`): Projects, Leads, Assets,
  Analytics (soon), Apps, Academy, Affiliates.
- Create with prompt (`features/projects/lib/hooks.ts:50-120`): precheck the
  credit balance, `POST /projects { prompt, composer, attachments }`, stash the
  autostart flag, navigate to `/p/:projectId`. The server creates the project
  and the chat and stores the prompt as the first user message
  (`projects.services.ts:47-57`, `docs/features/projects-dashboard.md:18`).
- Project shape: `projectSchema` with `prompt`, `status`, `leadCount`,
  `publishedSlug` (`contracts/v1/projects.ts:36-51`).
- Auth: Better Auth session, Google OAuth; `/_auth` layout guard
  (`routes/_auth/route.tsx`).
- UI kit: `packages/ui/src/components` (shadcn-style on base-ui): accordion,
  alert-dialog, avatar, badge, breadcrumb, button, card, checkbox, collapsible,
  command, dialog, direction, dropdown-menu, empty, field, input-group, input,
  kbd, label, popover, progress, resizable, scroll-area, select, separator,
  sheet, sidebar, skeleton, slider, sonner, switch, table, tabs, textarea,
  toggle-group, toggle, tooltip. Hook: `use-mobile`.
- i18n: `@wandit/internationalization` JSON dictionaries per locale
  (`packages/internationalization/dictionaries/{en,ar,...}/*.json`), RTL via
  `DirectionProvider`.
- Observability: Sentry from `@wandit/observability/browser` in the query
  client (`query-client.ts:30-58`).

---

## 11. What V2 can reuse as-is

These parts do not depend on "the page is one static HTML file".

1. Route and shell: `p.$projectId.tsx`, `WorkspacePage`, `DesktopSplit`,
   `MobileSplit`, resizable panels with persisted layout, header,
   `MainPaneHeader`, `WorkspaceTabs`, `ProjectSwitcher`, `WorkspaceSwitcher`.
   Only the tab list (`constants.ts:32-52`) and the tab bodies change.
2. Chat transport pattern: `useAiChat` (`use-ai-chat.ts`) with
   `DefaultChatTransport`, `prepareSendMessagesRequest`, `dataPartSchemas`,
   `sendAutomaticallyWhen`, error/billing routing, autostart, retry, and
   `createStatusPreservingChatFetch`. The V2 endpoint can be a new route in
   `aiChatRoutes` and a new `AiChatTools` map.
3. Chat rendering: `ChatPane` layout, `MessageParts` coalescer and registry,
   `RealChatMessage` + Streamdown, `TextPart` animated reveal,
   `ThinkingIndicator`, `StatusMessageHeader`, `PersistedAiErrorPart`, the
   `ask_user` request tray, the MCP `dynamic-tool` card with approvals,
   `TargetChip`, token usage meters.
4. Composer: `PromptBox` in full (modes, attachments to R2, dictation, skills,
   `topSlot`, `submitOverride`). V2 may add modes (`app`, `mobile`) in
   `composerModes` (`contracts/v1/chats.ts:32-38`).
5. Background-job cards: `useLiveRun` + the "durable row as terminal truth"
   pattern (`generate-page-part.tsx`, `connector-generation-card.tsx`). Any V2
   long job (sandbox build, deploy, migration) can use the same card model.
6. Data layer idiom: `api/*.services.ts` (fetch + Zod parse), `api/*.queries.ts`
   (keys + polling by status), `api/*.mutations.ts` (cache invalidation),
   `@wandit/contracts` route maps, `apiClient`, `queryClient`.
7. Leads tab and the `/leads` page, lead contracts, CSV export, status pipeline.
   V2 apps that post to the same lead endpoint keep this tab unchanged
   (see `inspect-publish-serve.md` §8 for the capture endpoint).
8. Assets tab and asset tiles (R2-backed media list).
9. Settings: general, danger zone, domains section, publish history UI
   (the publish API may change for V2 apps; the UI shape can stay).
10. Publish popover and confirm dialog as a UI pattern (slug, domains,
    publishing state machine `draft | publishing | published | failed`).
11. Versions UI: `VersionSwitcher`, historical banner, restore CAS pattern.
    V2 versions can map to sandbox snapshots or git commits behind the same
    `PageVersionListItem`-like shape.
12. Dashboard, project creation with autostart, credits banners, auth,
    i18n/RTL, theme, UI kit, Sentry wiring.

---

## 12. What V2 needs new

1. **Preview by URL.** V1 renders `srcDoc` from a JSON HTML body. V2 previews a
   running dev server in a sandbox. `PreviewFrame` needs `src={sandboxUrl}`,
   a loading/handshake state, HMR-safe reload, and error overlays. The
   `srcDoc` + `injectPreviewEditor` path cannot inject into a cross-origin URL.
   The V1 select/edit inspector cannot work on a React app without a new
   in-app agent script (a Vite plugin or a runtime overlay) and a source map to
   files. Treat the inline editor as V1-only in the first V2 cut.
2. **File tree and code view.** None exists. Needs a tree component, a code
   viewer (Shiki or CodeMirror; neither is a dependency today), diff view per
   turn, and a "files changed" receipt card. Sources: the sandbox filesystem
   through a new API, not the page-version HTML endpoint.
3. **Terminal and logs.** None exists. Needs a log stream (build output, dev
   server output, harness tool calls). Candidate channels: the same UI-message
   stream (custom `data-*` parts) or a second SSE / Trigger Realtime stream.
   `useLiveRun` and `dataPartSchemas` are the existing hooks to extend.
4. **Harness tool parts.** The harness (Claude Code / Agent SDK through the AI
   SDK harness feature) emits tool calls such as read/write/edit/bash. The
   `MessageParts` registry needs cards for them (grouped like
   `PageEditActivityCard`). `TRANSPARENT_PART_TYPES` needs new entries.
5. **Mobile simulator stream.** None exists in `apps/web`. See
   `inspect-native-and-simulator.md` for the simulator work. The Page tab needs
   a "device" viewport mode that shows a video/WebRTC stream and forwards input.
6. **Backend dashboard tabs** (database, users, storage, secrets, logs,
   functions, jobs, emails, connectors). None exist. V1 only has Leads,
   Assets, Marketing, Settings. Each needs new contracts, services, queries,
   and a tab body. The tab bar, the polling idiom, and the table/empty/skeleton
   primitives exist.
7. **Version model.** V1 versions are immutable HTML files with a server
   pointer. V2 needs a snapshot or commit model per project, plus restore that
   restarts the sandbox. The store's `previewVersion` / `isPreviewingHistorical`
   logic can stay if the shape is kept.
8. **Publish.** V1 publishes one HTML file to R2 and a KV pointer. V2 must
   build the app (static export or worker) and deploy. See
   `inspect-publish-serve.md` §12 for the serving assessment. The UI popover
   can stay; the mutation body and the `uiState` machine may need more states
   (building, deploying).
9. **Contracts.** A new `v2/*` domain (or `ai-builder.ts`) with the harness
   tool map, sandbox status, file APIs, log stream parts, and backend resource
   shapes. Keep the same Zod idiom.
10. **Composer modes.** `composerModes` and `PromptBox` route-mode config need
    `app` / `mobile` entries and their outputs/options.

---

## 13. Gotchas and risks found

- Two sets of `ChatMessage`/`MessagePart` types coexist (`api/dto.ts:16-22`).
  The live path uses `WanditUIMessage`. Do not import the dto ones.
- `chat.queries.ts`, `chat.services.ts`, `api-client.ts`, `server-url.ts`
  header comments still describe the legacy SSE path. The code is fine; the
  comments are stale.
- The `Page` tab stays mounted forever. Any V2 preview that holds a WebSocket
  or a video stream inherits this and must handle background tabs.
- The iframe remount key includes `viewport`. A URL-based preview will reload
  the app on each desktop/mobile toggle unless the key drops `viewport`.
- `useLiveRun` comments say the Trigger Electric stream "can die silently";
  the 5 s poll is required, not optional (`use-live-run.ts:1-9`).
- `PromptBox` is 2,722 lines and owns the mode/output/option catalog. Adding
  V2 modes means editing it, not a config file.
- `MOCK_CHAT_THREAD_ENABLED` exists in `mock-thread.tsx:17`. It is `false`.
- Message history loads in one GET with no pagination
  (`chat.services.ts:79-85`). Long V2 harness transcripts will be heavy.
- The transport resubmits the whole transcript on every turn (AI SDK default;
  server comment `ai-chat.controller.ts:211-216`). Harness turns with many tool
  parts will grow request bodies fast.
- No feature flag or route split exists for a V2 module. The plan says V2 is a
  separate module/endpoint. On the web side the simplest cut is a new route
  (`/v2/p/$projectId` or a project `kind` field) that mounts a new page and
  reuses the providers.

---

## 14. Open questions

1. Which AI SDK version does the harness feature require, and does
   `@ai-sdk/react` 4.0.x `useChat` accept its stream unchanged? UNVERIFIED.
2. Will V2 keep one chat per project (`GET /chats/by-project`) or add a chat
   per session/branch? The autostart flag is keyed by `projectId + chatId`.
3. Where will the sandbox preview URL come from and how is auth on it handled
   (cookie, token in URL, Cloudflare Access)? Cross-origin iframes cannot share
   the app session.
4. Does V2 keep the V1 inline editor for "website" projects, or drop it?
   The `packages/preview-editor` package only works on server-stamped HTML.
5. Do V2 projects still produce "page versions" for `VersionSwitcher`, or a
   different history object (commits)? This decides whether `store.tsx` stays.
6. Which log channel: UI-message `data-*` parts, Trigger Realtime, or a new SSE
   endpoint? The first keeps one transport; the others need new hooks.
7. `docs/features/chat-generation.md` and `PRD.md` §7 describe the old BullMQ
   path. Should they be marked superseded before V2 docs are written?
8. Native parity: `apps/native` has its own `use-ai-chat.ts` copy with
   `expo/fetch`. Any V2 transport change must be mirrored there, or V2 must be
   web-only at first.

---

## 15. Evidence index

Web routes and shell
- `apps/web/src/routes/_auth/p.$projectId.tsx:28-58`
- `apps/web/src/routes/_auth/route.tsx:7-53`
- `apps/web/src/routes/__root.tsx:49-96`
- `apps/web/src/features/workspace/pages/workspace-page.tsx:44-308`
- `apps/web/src/features/workspace/lib/store.tsx:73-131, 143-531`
- `apps/web/src/features/workspace/lib/constants.ts:32-61`
- `apps/web/src/features/workspace/lib/helpers.ts:20-54`
- `apps/web/src/features/workspace/components/shell/*.tsx`

Chat
- `apps/web/src/features/workspace/lib/ai-chat-context.tsx:17-62`
- `apps/web/src/features/workspace/lib/use-ai-chat.ts:41-612`
- `apps/web/src/features/workspace/lib/status-preserving-chat-transport.ts:13-38`
- `apps/web/src/features/workspace/components/chat/chat-pane.tsx:65-567`
- `apps/web/src/features/workspace/components/chat/parts/message-parts.tsx:47-718`
- `apps/web/src/features/workspace/components/chat/real-message.tsx:13-97`
- `apps/web/src/features/workspace/components/chat/parts/text-part.tsx:8-40`
- `apps/web/src/features/workspace/components/chat/parts/generate-page-part.tsx:1-200`
- `apps/web/src/features/workspace/components/chat/parts/page-edit-part.tsx:16-118`
- `apps/web/src/features/workspace/components/chat/parts/mcp-tool-part.tsx:1-60`
- `apps/web/src/features/workspace/components/chat/request-tray/use-request-tray.ts:1-60`
- `apps/web/src/features/workspace/components/chat/request-tray/types.ts:1-60`
- `apps/web/src/features/projects/components/prompt-box.tsx:95-140, 1806-1946`
- Legacy: `apps/web/src/features/workspace/lib/use-project-chat.tsx`,
  `components/chat/chat-message.tsx:20-24`, `api/dto.ts:9-22`

Preview and editor
- `apps/web/src/features/workspace/components/page/page-tab.tsx:161-840`
- `apps/web/src/features/workspace/components/page/page-toolbar.tsx:66-204`
- `apps/web/src/features/workspace/components/page/version-switcher.tsx:18-80`
- `apps/web/src/features/workspace/components/page/edit-panel.tsx:32-149`
- `apps/web/src/features/workspace/lib/use-page-editor.tsx:1-230` and the
  `applyPageOps` save block
- `apps/web/src/features/workspace/lib/preview-editor/use-preview-bridge.ts:34-90`
- `apps/web/src/features/workspace/api/pages.queries.ts:30-197`
- `apps/web/src/features/workspace/api/pages.services.ts:34-214`
- `packages/preview-editor/src/{index,inject,messages,editor-script,pending,target-comments}.ts`
- `apps/native/features/workspace/lib/page-preview/preview-document.ts:1-60`

Realtime and polling
- `apps/web/src/features/workspace/lib/use-live-run.ts:1-148`
- `apps/web/src/features/workspace/api/deployments.queries.ts:15-39`
- `apps/web/src/features/workspace/api/leads.queries.ts:20-29`
- `apps/web/src/lib/query-client.ts:26-78`

Contracts
- `packages/contracts/README.md`
- `packages/contracts/src/index.ts:1-98`
- `packages/contracts/src/v1/ai-chat.ts:1-140, 460-590, 1008-1065`
- `packages/contracts/src/v1/chats.ts:31-184`
- `packages/contracts/src/v1/pages.ts:20-233`
- `packages/contracts/src/v1/deployments.ts:9-192`
- `packages/contracts/src/v1/page-edits.ts:1-80, 145-322`

Server (context)
- `apps/server/src/modules/ai-chat/presentation/http/controllers/ai-chat.controller.ts:42-230`
- `apps/server/src/modules/ai-chat/application/services/ai-chat.service.ts:1020, 1203-1212`
- `apps/server/src/modules/ai-chat/agent/chat-agent.ts:418-440`
- `apps/edge/src/index.ts:1-44`

Docs
- `docs/frontend-structure.md`
- `docs/features/foundation-app-shell.md`
- `docs/features/projects-dashboard.md`
- `docs/features/ai-chat-brain.md:1-120`
- `docs/features/composer-modes.md:1-80`
- `docs/features/chat-generation.md` (legacy design)
- `docs/PRD.md` §4, §7, §8
- `docs/native-structure.md`
