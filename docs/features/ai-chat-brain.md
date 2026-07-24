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

- **Brain → Art Director → Builder.** The chat Brain gathers business facts. The Art Director first writes a free-form Creative Capsule, then extracts the unchanged validated `CreativeSpec` from it. A tool-loop Builder implements both handoffs.
- **AI SDK 7.** The Brain and Builder use `ToolLoopAgent`. Art Direction uses plain `generateText` so concept exploration is not constrained by a large JSON shape; Spec Extraction then uses a second `generateText` with `Output.object`.
- **Vercel AI Gateway** routes every model through swappable `provider/model` environment values.
- **Trigger.dev** runs the Art Director and Builder in one background task after chat queues a page attempt.
- **Permanent focused prompts, not a design skill.** These agents exist for one product workflow, so the role-specific methods live in their system prompts. The Art Director's prompt also carries a concrete technique lexicon distilled from the three maintained design exemplars.
- **One tool loop, three enforced review passes.** The Builder must complete at least three screenshot passes (correctness, fidelity/ambition, final verification) AND the final revision must be the one captured — any rewrite invalidates both review gates, so the count can never bless a stale draft.
- **Web app first.** Native chat streaming remains unchanged.

## Quality and variety engine

Variety comes from project-specific reasoning, not from choosing a preset style:

1. The Brain preserves facts and user preferences but makes no visual decisions.
2. Creative Direction privately compares three materially different concepts, rejects the most generic one, then resolves one winner as a fixed 13-section Creative Capsule. Controlled restraint may win.
3. The Capsule's binding rule makes philosophy and implementation travel together: every adjective must name observable values such as pixel offsets, `clamp()` scales, easing curves, scrub settings, or a specific CSS technique.
4. Spec Extraction faithfully maps that Capsule into the typed `CreativeSpec`, which preserves opening architecture and silhouette, business connection, navigation, page spine, scene topology, transitions, tempo, visual peak, visual system, media, motion, closing experience, conversion, and mobile recomposition.
5. Silent gates test whether the design survives without its best image, whether it could be reused for another industry, whether adjacent scenes repeat, and whether it is feasible as one HTML file.
6. The Builder receives the factual brief, Creative Capsule, and Creative Specification as separate authorities. The Capsule governs design language; the spec governs structured ids, exact token values, and media guards.
7. The Builder re-reads the final source and completes at least three screenshot review passes over evenly spaced desktop/mobile frames — correctness, then creative fidelity/ambition, then final verification. `finish` refuses fewer than three passes, stale source, or a stale screenshot review. Text-only models and unavailable Chromium degrade explicitly to code review.

## Algeria layer (no source covers this — we write it)

AR-RTL + FR bilingual, mobile-first; COD forms phone-first with wilaya/commune; WhatsApp/phone trust patterns; page contract: single-file HTML+Tailwind, form posts to our lead endpoint with project form ID, pixel injection.

## Current generation flow

The plumbing that turns a chat brief into a real page. Flow, in words:

1. The chat Brain composes a factual content brief and calls the **`generate_page` tool** once.
2. The tool checks credentials at CALL time (`isR2Configured()` + `TRIGGER_SECRET_KEY`). Unconfigured → it answers `status: "unavailable"` and the model relays that honestly; nothing breaks at boot.
3. Configured → it snapshots the brief, Creative Direction prompt, Spec Extraction prompt, Builder prompt, and both model values into a versioned **`page_generation_attempts`** row, then fires the Trigger task with only the attempt id.
4. The task runs snapshotted Creative Direction and Spec Extraction. It validates the `CreativeSpec` and persists it together with the Capsule before implementation starts, so a manual retry reuses the exact direction without another model call.
5. The Builder receives the original factual brief, Capsule, and serialized `CreativeSpec` as separate authorities. It generates only approved shots, writes one self-contained `index.html`, re-reads it, and captures desktop 1440×900 plus mobile 390×844 screenshots. It fixes all source/render defects across at least three screenshot passes and must visually verify the final write before finishing.
6. The task validates the file, uploads it to **R2**, then transactionally creates the immutable version, updates the active artifact pointer, and marks the attempt `succeeded`. Errors mark it `failed` with stage-specific text.
7. The web polls **`GET /api/v1/projects/:id/page`** until the attempt settles, then fetches the active HTML and renders it in a sandboxed iframe.

Pieces and where they live:
- Brain prompt: `apps/server/src/modules/ai-chat/agent/system-prompt.ts`.
- Art Director method, schema, and AI call: `apps/server/src/modules/ai-chat/agent/art-director/`.
- Builder method and tool loop: `apps/server/src/modules/ai-chat/agent/site-builder/builder-prompt.ts` and `site-builder-agent.ts`.
- R2 storage (plain functions, shared by Nest + task): `apps/server/src/infrastructure/storage/r2.ts`.
- Pages read API + attempt writes: `apps/server/src/modules/pages/**` (PagesRepository is what the tool uses).
- Trigger task: `apps/server/src/trigger/generate-page.task.ts`.
- Models: `AI_CHAT_MODEL`, `AI_ART_DIRECTOR_MODEL`, and `AI_PAGE_BUILDER_MODEL`. `AI_PAGE_DESIGN_MODEL` remains the Builder fallback during migration.
- Infrastructure: `TRIGGER_SECRET_KEY`, `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`.

Deliberately NOT here: novelty memory or past-generation fingerprints, multi-candidate judging, preview-generation galleries, billing gate, regenerate/version switcher, deploy/publish, Trigger Realtime.

## Working rules

- Fable plans/synthesizes; **codex implements** (use-codex skill, model `gpt-5.6-sol` — verified working 2026-07-11; plain `gpt-5.6` is rejected, `gpt-5.5` is the fallback).
- Never commit; Zack reviews diffs in his editor.
- Zack edits live alongside — re-read files before editing.
- Plain English with Zack: simple words, define terms, cause→effect.
