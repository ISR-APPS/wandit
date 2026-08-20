# Ads Brain — media-buying method for the chat agent

**Status:** v1 (skills + guard + leads tool) · **Started:** 2026-08-19 · **Owner:** Zack · **Source:** `wandit-referentiel-ads.pdf` (the co-founder's media-buying referential, August 2026)
Context-recovery doc for the agent working on this feature. Short on purpose.

## Why

The director could already press Meta Ads / TikTok Ads buttons through the MCP connectors, but it had no media-buying method: no order of work, no playbooks, no restraint rule, no view of the merchant's own results. The referential fixes that with six skills and three hard rules. The goal is a head of growth for Maghreb COD merchants who happens to have API access — not a chatbot with an ads button.

## The six skills

All six live as TypeScript constants in `apps/server/src/modules/ai-chat/agent/ads/` (never `.md`: the tsdown bundle carries no markdown assets). Registry + per-request block: `agent/ads/index.ts`. Slugs are the contract (`skillSlugSchema` in `@wandit/contracts`) and are also the composer chip ids — renaming one breaks old chats.

| Slug | Owns |
|---|---|
| `ads-fundamentals` | unit economics vocabulary, campaign / ad set / ad structure, CBO vs ABO and the Advantage+ / Smart+ shift, learning phase, bidding, scaling, delivery diagnostics, kill criteria, breakdowns |
| `ads-creative` | hook / hold / retention, CTR outbound vs all, fatigue, creative velocity, modular testing, first-3-seconds engineering, angle sources, what to brief to Wandit's generators |
| `ads-audiences` | broad-first prospecting, the warmth ladder, video / engager audiences, lookalikes, mandatory exclusions, overlap, phone-first customer files |
| `ads-measurement` | attribution windows, MER vs platform ROAS, incrementality, CAPI / EMQ, UTM + Leads tab as backend truth, statistics, media finance (contribution margin, break-even and marginal ROAS), cross-platform allocation |
| `ads-cod-maghreb` | COD economics (cost per delivered order), junk traffic, WhatsApp campaigns, no-card tracking, darija / FR / AR message match, seasonality, wilaya delivery reality, COD offer and post-click maths |
| `ads-diagnostic` | the method: restraint, tracking-first order, the symptom → cause → test → action tree, seven playbooks, policy pre-flight that informs but never forbids, recommendation tone |

## How the knowledge reaches the model (three layers)

1. **Always on** — `## Ads method (media buying)` in `agent/system-prompt.ts`: the spine (tracking first, restraint, diagnose before touching, Meta + TikTok depth, policy pre-flight, tone) and the pointer to `read_skill`. A few lines; it is paid on every turn so it stays short.
2. **Per request** — `composeAdsBlock()` (`agent/ads/index.ts`) is appended after the MCP notices in `ai-chat.service.ts` when an ads connector resolved tools for this user **or** the user picked ads chips in the composer. It carries: the connected platforms (or "none connected — never pretend"), three Wandit-side tracking facts (Meta pixel id set / TikTok pixel id set / page published, from `LeadsRepository.getAdsTrackingFacts`), the skill index, and the full text of the skills the user selected for this message (at most two inline; more are pointed to `read_skill`). The web composer clears the chips after submit so the playbooks do not travel on every later message; the native chips are visual-only until the native chat mutation sends composer metadata.
3. **On demand** — the `read_skill` tool is live again (`agent/tools/read-skill.tool.ts`, registry `agent/skills/index.ts`). The model loads at most two playbooks per turn. `elideRetiredToolOutputs` in `ai-chat.service.ts` blanks old skill outputs from the model-bound history, so a load costs ~0 later. `landing-page-design` stays in the enum as a retired slug (old chats validate; loading it returns a one-line note).

## The hard rules in code (prose is not enough — the referential is explicit)

- **USD budgets** — unchanged: `mcp-connectors/domain/ad-budget-guard.ts` at the execution choke point.
- **Money-based approvals** — `mcp-connectors/domain/ads-approval-policy.ts` (`classifyAdsToolApproval(connectorSlug, toolName, args)`), wired into the approval map (call-time closures for EVERY ads tool, reads included, so read-named status setters get their args inspected), `classifyPlatformToolApproval`, the ads `tool_execute` wrapper (which parses JSON-string `params` and fails closed on garbage; `wrapConnectorTool` also normalizes string params to objects before the choke point so the USD/72 h guards and telemetry are never blind), and the `requires_approval` search hint. For Meta/TikTok the old writes-always-pause heuristic showed 4–6 cards per campaign launch; now only money-moving calls keep the card: activating delivery at the campaign / ad set level (name verb or ACTIVE/ENABLE status value anywhere in args — single-AD activations run free, an ad has no budget of its own), creating/copying/adding a campaign/ad set/ad without the PLATFORM'S OWN delivery-status key paused (meta: `status`/`configured_status`/`status_option`; tiktok: `operation_status`/`opt_status` — a paused value under the wrong platform's key pauses nothing, so it cards), budget/bid changes outside a deliverable create (ancillary money creates like budget schedules card too), and deletes/archives (verb or status value). Paused creates, uploads, creatives, audiences, pixels, edits, and every PAUSE/DISABLE run without a card. Launch protocol ("Ads method" rule 7): build everything paused, ONE summary, then activate bottom-up in one turn — ads free, ad sets one card (bulk), campaign one card: a launch costs at most two approvals and zero refusals (pure activations are exempt from the 72 h window — they are the launch of what was built paused, and their own cards still gate them). Creates record the CREATED entity's id from the provider result (never the parent id from the args), so child creates cannot falsely arm the 72 h window against the parent.
- **72-hour change window** — `mcp-connectors/domain/ads-change-window-guard.ts` + `ads-target-entity.ts`, called in `McpChatToolsService.executeInlineConnectorTool` right after the USD guard. A write to a campaign / ad set / ad that Wandit itself created or changed less than 72 h ago (looked up in `connector_operation_events.target_entity_ids`, a `text[]` so bulk writes stay one telemetry row — migration `0040`; scope = organization when the actor has one, else the user; a create's new id is read from the provider result; platform-level failures are recorded as failed and never lock) is refused **once** with an instructive error (hours since, hours remaining, the rule in business terms). The model must explain and ask; if the user explicitly insists, the same call is allowed (30-minute in-memory acknowledgement) — the insistence is the approval (under the money-based policy most of these writes no longer show a card; a money-moving one still does). Creates are never blocked. The 3× target CPA half needs spend data Wandit does not store — it is prose in `ads-diagnostic`, and the doc says so.
- **Credit admission** — `prepareStream` passes the selected-skills part of the ads block to `estimateAiChatTokenUsage`, so a message with inline playbooks reserves for them.
- **Tracking first** — the tracking facts travel in the per-request block (zero tool calls), so the first branch of the diagnostic tree is answerable before any platform read.
- **Inform, never forbid** — policy is advisory prose in `ads-diagnostic`; the doc states which rules stay hard (USD, confirmation before spend, the 72 h window).

## The merchant's own numbers

`read_lead_performance` (`agent/tools/read-lead-performance.tool.ts`, `LeadsRepository.getFunnelCountsForProject`) gives the director counts and confirmation / delivery / return rates by source, campaign, or status over a window — the Leads tab truth. Registered in the three places every first-party tool needs (live map, `aiChatToolsForValidation`, `AiChatTools` in contracts) and rendered silently on web/native like `read_attachment`.

## Composer

The Skills picker now carries one `ads` group with the six slugs (web `prompt-box.tsx`, native `prompt.ts`, dictionaries en/fr/ar). Selected ids travel as `composer.skills` exactly as before; the server finally reads them (`composeAdsBlock`). The seven old decorative chips (accessibility, seo-review, …) were removed — nothing on the server ever read them.

## Known limits / next

- No scheduled spend ingestion: every CPA / ROAS the model states is read once inside a turn. A per-account report pull would make the 3× CPA rule enforceable.
- The Lead pixel event carries no value / currency / eventID (`leads-runtime-script.ts`), so platform-side ROAS is structurally unavailable; the measurement skill asks for AOV / margin inputs instead.
- A `wa.me` click is never a lead nor a pixel event; WhatsApp campaigns are judged by hand (the COD skill says so).
- Google Ads / Snapchat: no connector, principles only.
- `AI_CHAT_MAX_STEPS = 12` is global; a tracking-first tree over two platforms plus two skill loads is tight. Revisit per-mode budgets if diagnostics hit the cap.
- Merge hazard: `.claude/worktrees/facebook-ads-library` refactors `resolveConnectorTools` and carries a colliding migration `0030`; rebase whichever lands second.
