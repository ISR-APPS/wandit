# AI Chat Brain — North Star

**Status:** rebuild in progress (v1–v3 deleted 2026-07-10) · **Started:** 2026-07-11 · **Owner:** Zack
Context-recovery doc for the agent working on this feature. Short on purpose — decisions and direction, not specs. Supersedes the conservative phasing in `PRD.md` §5–6 where they conflict (image/video generation is IN scope for the brain, not post-MVP).

## End goal

One agentic AI chat — Wandit's main selling point. The user types a thin prompt ("landing page for my sneaker store"); the brain turns it into real business output:

- **Pages** — websites / e-com landing pages / funnels with COD lead forms → leads land in the Leads tab.
- **Assets** — images and videos: user uploads adapted/optimized/varied, or generated via **Higgsfield MCP** / AI Gateway (ad creatives, UGC/commercial videos, variations).
- **Marketing** — video scripts, marketing angles, strategies as viewable HTML-ish docs in the Marketing tab.

The brain decides what to build and which tools to use. It must NOT be a template machine: same prompt twice → two genuinely different pages.

## Settled architecture (do not relitigate)

- **AI SDK `ToolLoopAgent`** — never bare `generateText`. Step zero of any SDK work: verify installed `ai` version + bundled docs (`node_modules/ai/docs/`); APIs churn.
- **Vercel AI Gateway** for ALL model routing (text/image/video where possible). Models swappable via `provider/model` strings.
- **No queue for now.** NestJS endpoint → direct SSE streaming → `useChat` on web. (Old Redis/BullMQ path blocked `useChat` — removed.) **Trigger.dev comes later**, once the brain is proven locally; refactor then is cheap.
- **Web app only** for this rebuild; native chat streaming stays as-is.
- **Auto mode first.** Manual mode (user picks video type / size / duration) = constraints passed into the same brain, layered later.
- **Prompt layering:** small always-on system prompt (identity "designer using code", workflow ask→plan→build→verify, page contract) + **markdown skills loaded on demand** via a `read_skill` tool. Skill #1 = landing-page design. Frontend-design knowledge lives in skills, never in the system prompt.
- Chat-state UI already exists in the workspace (design-system work) — the brain plugs into it.

## The quality + variety engine (from the Claude Design inspection)

Sources: `docs/prompts/claude-design.md` (real production dump), `claude-design-light.md` (= repo `claude/system-prompt.md`, identical), Trystan-SA repo skills (reconstruction; use `claude/` variants — `codex/` ones weakened anti-sameness). Memory note: `claude-design-system-inspection.md`.

Variety does NOT come from prompt wording — it comes from mechanisms:

1. **Design seed** — server code randomly picks style direction / palette family / layout archetype / type mood per generation, injected into context. Code is random; the model isn't.
2. **Mandatory aesthetic-direction step** before any HTML ("NEVER converge across generations"; one off-distribution option).
3. **Anti-slop ban list** (no Inter/Roboto, no gradient abuse, no rounded-card-left-border, no emoji, no filler) + **review gates** as separate steps: slop-check, hierarchy-rhythm, polish.
4. **Structured questions tool** (à la `questions_v2`): options always include "Explore a few options" / "Decide for me" / "Other"; min 2 options; ask when ambiguous, skip when brief is complete. Ask-mode and auto-mode fill the SAME checklist — only who answers differs.
5. **Brief-drafter stage** — a cheap subagent call that expands thin prompt + discovery answers + seed into a rich Saraev-style creative brief before generation (the "25 websites" YouTube prompt, manufactured automatically).
6. **Verification loop** — later a Playwright `verify_landing_page` tool: render → console errors + screenshots → structured defects fed back to the agent.
7. **Curated section/starter library** beats free-drawing: COD form, WhatsApp CTA, trust strip, sticky mobile CTA, product grid, FAQ; image-slot concept (design around fillable image placeholders → R2).

## Algeria layer (no source covers this — we write it)

AR-RTL + FR bilingual, mobile-first; COD forms phone-first with wilaya/commune; WhatsApp/phone trust patterns; page contract: single-file HTML+Tailwind, form posts to our lead endpoint with project form ID, pixel injection.

## Build order

1. **Walking skeleton (current slice):** POST chat endpoint on NestJS → `ToolLoopAgent` (minimal system prompt, zero/trivial tools) → SSE stream → `useChat` in the workspace chat UI. "Hey" round trip, message persistence per existing schema. Nothing else.
2. System prompt v1 + skill registry (`read_skill` tool + markdown folder) + landing-page design skill.
3. Generation tools (write page version, patch fragment) + design seed + brief-drafter.
4. Review gates (slop/hierarchy/polish) + structured questions tool.
5. Higgsfield MCP + image slots.
6. Verification tool (Playwright).
7. Trigger.dev migration + credits metering.

## Generation foundation (built 2026-07-11)

The plumbing that turns a chat brief into a real page. Flow, in words:

1. The chat agent composes a brief and calls the **`generate_page` tool** (server-executed, built per request so it knows its project/chat).
2. The tool checks credentials at CALL time (`isR2Configured()` + `TRIGGER_SECRET_KEY`). Unconfigured → it answers `status: "unavailable"` and the model relays that honestly; nothing breaks at boot.
3. Configured → it finds-or-creates the project's one landing **artifact**, snapshots `{ title, brief, designerSystemPrompt }` into a **`page_generation_attempts` row** (status `queued`), and fires the **Trigger.dev task** `generate-page` with just the attempt id.
4. The task (`apps/server/src/trigger/generate-page.task.ts`, no Nest) loads the attempt, flips it to `generating`, runs **`generateText`** with the snapshotted designer prompt (`AI_PAGE_DESIGN_MODEL`, gateway string), sanity-checks the HTML, uploads to **R2** (`sites/{project}/{version}/index.html`), then in one transaction inserts the immutable **version row**, moves the artifact's active pointer, and marks the attempt `succeeded` (failures → `failed` + error text).
5. The web polls **`GET /api/v1/projects/:id/page`** (overview: artifact + active version + latest attempt) until the attempt settles, then fetches **`GET /api/v1/pages/versions/:id/html`** (JSON envelope) and renders it in a sandboxed iframe.

Pieces and where they live:
- Designer prompt (Zack's tweak surface): `apps/server/src/modules/ai-chat/agent/designer-prompt.ts` — short wrapper + the landing-page-design skill; snapshotted per attempt for reproducibility.
- R2 storage (plain functions, shared by Nest + task): `apps/server/src/infrastructure/storage/r2.ts`.
- Pages read API + attempt writes: `apps/server/src/modules/pages/**` (PagesRepository is what the tool uses).
- Trigger config: `apps/server/trigger.config.ts` (project ref is a TODO placeholder). Dev loop: `npx trigger.dev@latest dev` from `apps/server/` once `TRIGGER_SECRET_KEY` exists.
- Env (all optional, checked at call time): `TRIGGER_SECRET_KEY`, `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, `AI_PAGE_DESIGN_MODEL`.

Deliberately NOT here yet: billing gate (TODO stays in ai-chat.service), regenerate/version switcher, deploy/publish, screenshot verification loop, Trigger Realtime.

## Working rules

- Fable plans/synthesizes; **codex implements** (use-codex skill, model `gpt-5.6-sol` — verified working 2026-07-11; plain `gpt-5.6` is rejected, `gpt-5.5` is the fallback).
- Never commit; Zack reviews diffs in his editor.
- Zack edits live alongside — re-read files before editing.
- Plain English with Zack: simple words, define terms, cause→effect.
