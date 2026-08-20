# AI Chat Brain — North Star

**Status:** rebuild in progress (v1–v3 deleted 2026-07-10) · **Started:** 2026-07-11 · **Owner:** Zack
Context-recovery doc for the agent working on this feature. Short on purpose — decisions and direction, not specs. Supersedes the conservative phasing in `PRD.md` §5–6 where they conflict (image/video generation is IN scope for the brain, not post-MVP).

## End goal

One agentic AI chat — Wandit's main selling point. The user types a thin prompt ("landing page for my sneaker store"); the brain turns it into real business output:

- **Pages** — websites / e-com landing pages / funnels with COD lead forms → leads land in the Leads tab.
- **Assets** — images and videos: user uploads adapted/optimized/varied, or generated via **Higgsfield MCP** / AI Gateway (ad creatives, UGC/commercial videos, variations).
- **Marketing** — video scripts, marketing angles, strategies as viewable HTML-ish docs in the Marketing tab.

The brain decides what to build and which tools to use. It must NOT be a template machine: same prompt twice → two genuinely different pages.

## Settled generation architecture

- **Brain → Builder. Two agents, one handoff.** The chat Brain gathers business facts AND commits to the art direction (from server-sampled candidates), writing everything into one complete creative brief. A tool-loop Builder implements that brief. The intermediate Art Director stage was tried and retired (2026-07): it burned tokens, added latency, and failed too often — the two-agent flow is the baseline to iterate from.
- **AI SDK 7.** The Brain and Builder both use `ToolLoopAgent`.
- **Vercel AI Gateway** routes every model through swappable `provider/model` environment values.
- **Trigger.dev** runs the Builder in one background task after chat queues a page attempt.
- **Permanent focused prompts for the page workflow; skills for the ads workflow.** The Brain and Builder carry their page method in their system prompts. Ads knowledge (six playbooks, 2026-08) is too large and too conditional for that — it loads on demand through `read_skill` and a connector-gated request block; see `ads-brain.md`.
- **One tool loop, three enforced review passes.** The Builder must complete at least three screenshot passes (correctness, fidelity/ambition, final verification) AND the final revision must be the one captured — any rewrite invalidates both review gates, so the count can never bless a stale draft.
- **Web app first.** Native chat streaming remains unchanged.

## Quality and variety engine

Variety comes from server-side randomness plus project-specific reasoning, not from choosing a preset style:

1. `get_direction_candidates` samples a bounded random menu (palettes, font pairings, skeletons, layout moves, signature interactions, motion vocabularies, finishes) with industry-hint matching, so two identical prompts get materially different menus.
2. The Brain must commit to choices from that menu and write them into the brief's ART DIRECTION / PAGE STRUCTURE / SIGNATURE INTERACTION / MOTION / SHOT LIST sections — single-product pages adapt a skeleton, multi-section websites are composed from layout moves with one marked SHOWPIECE.
3. The brief is law for the Builder: palette hexes, fonts, structure, interaction, and motion are commitments; the Builder's ambition lives in execution (composition, craft, copy rhythm, detail).
4. The Builder re-reads the final source and completes at least three screenshot review passes over desktop/mobile frames — correctness, then design quality/ambition, then final verification. `finish` refuses fewer than three passes, stale source, or a stale screenshot review. Text-only models and unavailable Chromium degrade explicitly to code review.

## Algeria layer (no source covers this — we write it)

AR-RTL + FR bilingual, mobile-first; COD forms phone-first with wilaya/commune; WhatsApp/phone trust patterns; page contract: single-file HTML+Tailwind, form posts to our lead endpoint with project form ID, pixel injection.

## Current generation flow

The plumbing that turns a chat brief into a real page. Flow, in words:

1. The chat Brain samples direction candidates, composes one complete creative brief, and calls the **`generate_page` tool** once.
2. The tool checks credentials at CALL time (`isR2Configured()` + `TRIGGER_SECRET_KEY`). Unconfigured → it answers `status: "unavailable"` and the model relays that honestly; nothing breaks at boot.
3. Configured → it snapshots `{brief, designerSystemPrompt, title}` into a **`page_generation_attempts`** row, then fires the Trigger task with only the attempt id.
4. The task claims the attempt atomically and runs the Builder with the snapshotted brief and prompt. The Builder generates the brief's SHOT LIST images (and optionally animates one into ambient video), writes one self-contained `index.html`, re-reads it, and captures desktop 1440×900 plus mobile 390×844 screenshots. It fixes all source/render defects across at least three screenshot passes and must visually verify the final write before finishing.
5. The task validates the file, uploads it to **R2**, then transactionally creates the immutable version, updates the active artifact pointer, and marks the attempt `succeeded`. Errors mark it `failed` with stage-specific text.
6. The web polls **`GET /api/v1/projects/:id/page`** until the attempt settles, then fetches the active HTML and renders it in a sandboxed iframe.

Pieces and where they live:
- Brain prompt: `apps/server/src/modules/ai-chat/agent/system-prompt.ts`.
- Direction sampling: `apps/server/src/modules/ai-chat/agent/directions/directions.ts`.
- Builder method and tool loop: `apps/server/src/modules/ai-chat/agent/site-builder/builder-prompt.ts` and `site-builder-agent.ts`.
- R2 storage (plain functions, shared by Nest + task): `apps/server/src/infrastructure/storage/r2.ts`.
- Pages read API + attempt writes: `apps/server/src/modules/pages/**` (PagesRepository is what the tool uses).
- Trigger task: `apps/server/src/trigger/generate-page.task.ts`.
- Models: `AI_CHAT_MODEL` and `AI_PAGE_BUILDER_MODEL`. `AI_PAGE_DESIGN_MODEL` remains the Builder fallback during migration; `AI_PAGE_DESIGN_REASONING` is the optional builder reasoning knob.
- Infrastructure: `TRIGGER_SECRET_KEY`, `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`.

Deliberately NOT here: novelty memory or past-generation fingerprints, multi-candidate judging, preview-generation galleries, billing gate, regenerate/version switcher, deploy/publish, Trigger Realtime.

## Working rules

- Fable plans/synthesizes; **codex implements** (use-codex skill, model `gpt-5.6-sol` — verified working 2026-07-11; plain `gpt-5.6` is rejected, `gpt-5.5` is the fallback).
- Never commit; Zack reviews diffs in his editor.
- Zack edits live alongside — re-read files before editing.
- Plain English with Zack: simple words, define terms, cause→effect.
