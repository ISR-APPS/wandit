# Wandit kit — implementation brief

This folder contains the design system and prompts for upgrading Wandit's page generation from
single-pass generic output to an art-directed, self-reviewing pipeline. This README is the build
instruction: hand it, with the two `.ts` files, to the implementing agent.

**Context you can assume:** Wandit is an existing AI SDK app. There is a main chat agent (the
"director") with tools `ask_user`, `read_skill`, `generate_page`; `generate_page` queues a
background job (the "worker") where a tool-loop builder agent writes `index.html` via
`write_file` / `read_file` / `finish`. File storage is Cloudflare R2. The problem being solved:
every generated page converges to the same look and the same sections.

## Files

| File | What it is |
|---|---|
| `directions.ts` | The curated taste library (30 palettes, 28 font pairings w/ Arabic variants, 16 page skeletons, 20 signature interactions, 12 motion vocabularies — 106 entries) + `sampleCandidates()` + `formatCandidates()` |
| `prompts.ts` | `buildWanditSystemPrompt(skillList, opts)` (director), `buildSiteBuilderSystemPrompt()` (builder), `buildCritiquePrompt()` (reviewer — NOT used in v1, see §6) |
| `README.md` | This brief |

## Ground rules for the implementing agent

1. **Never write AI SDK code from memory.** Verify every API (tool definitions, multimodal tool
   results, image generation, message shapes) against `node_modules/ai/docs/` for the installed
   version. If the installed `ai` package is a major version behind latest, stop and report.
2. **Guards over prose.** Anything that must ALWAYS happen is enforced in code (counters,
   validators, rejections) — the prompts persuade, the handlers guarantee.
3. Every model/image call goes through one internal interface so backends can be swapped.
4. Log every call: stage, model, prompt, params, output ref, duration, token counts.

## Architecture

```
user chat
  └─ DIRECTOR (buildWanditSystemPrompt)
       ├─ ask_user …                (adaptive intake, completeness-driven)
       ├─ get_direction_candidates  ← NEW TOOL (§1): server-sampled design candidates
       └─ generate_page(title, brief)  → queues background job
                                          │
WORKER (background job) ──────────────────┘
  ├─ §3 asset pipeline: parse brief SHOT LIST → generate images (AI Gateway, parallel)
  │     → upload to R2 → append ASSETS manifest to brief
  ├─ §4 BUILDER agent (buildSiteBuilderSystemPrompt) with tools:
  │     write_file / read_file / screenshot_page ← NEW TOOL (§4) / finish (guarded)
  │     cadence: draft → 3 × (screenshot → review → rewrite) → finish
  └─ finalize: upload index.html + kept screenshots to R2, cleanup, mark job done
```

## §1 — `get_direction_candidates` tool (director)

New tool on the director agent. No parameters needed beyond what the server already knows about
the conversation/business. Handler (server side):

```ts
import { sampleCandidates, formatCandidates } from './directions';

execute: async () => {
  const cooldownIds = await loadCooldownIds(businessCategory);      // §2
  const candidates = sampleCandidates({ business: intakeSummary, cooldownIds });
  await recordServed(businessCategory, candidates);                 // feed cooldown
  return formatCandidates(candidates);                              // plain text for the model
}
```

The randomness lives in `sampleCandidates` — the model only ever sees 5-6 options per axis.
This is THE anti-convergence mechanism; do not let the model bypass it. The director prompt
already mandates calling this tool before composing any brief and choosing only from its output.

## §2 — Cooldown table

```sql
served_directions(category text, direction_id text, served_at timestamptz)
```

When sampling for a business category, exclude ids served to that category in the last 3
generations. Later upgrade (not v1): add a keep-rate score per direction (kept vs regenerated
pages) and weight sampling by freshness × keep-rate, with a neutral prior until an entry has
10+ uses.

## §3 — Asset pipeline (worker, before the builder starts)

The director writes a `SHOT LIST` section into the brief (role, prompt, aspect, GROUP per shot).
The worker:

1. Parse the SHOT LIST (or have the director emit it as structured output alongside the brief).
2. Generate every shot in PARALLEL via the AI Gateway image models (e.g. `bytedance/seedream-*`,
   `openai/gpt-image-*` — check current ids and the AI SDK image-generation API in the bundled
   docs). Shots sharing a GROUP: generate the first, pass its result as reference image to the
   rest (reference support varies per model — verify in docs).
3. Upload finished images to R2. Build the manifest and append it to the brief text:

```
ASSETS:
- url: https://…  · role: hero background · aspect: 16:9 · description: <the shot prompt>
```

Failure policy: a failed generation is dropped silently — the builder prompt already instructs
it to build CSS/SVG art for any role without an asset. Never block or fail a build on images.
Videos are out of scope for v1.

Product imagery: currently ALLOWED (testing mode — `buildWanditSystemPrompt`'s
`allowGeneratedProductImagery` defaults to true). When merchant photo uploads ship, pass
`{ allowGeneratedProductImagery: false }` and generated imagery becomes atmosphere-only.

## §4 — Builder loop with `screenshot_page` (the core of this upgrade)

### 4.1 Prerequisites (worker environment)

- `npm i playwright` and `npx playwright install chromium` in the worker image/container.
  Headless Chromium does NOT run in ordinary serverless functions — the worker must be a
  container/VM with the browser installed.
- Each job gets a temp dir, e.g. `/tmp/job-<id>/`, holding `index.html` and `shots/`.

### 4.2 The `screenshot_page()` tool handler

Called by the builder with no arguments. Algorithm:

```
launch chromium headless (reuse one browser instance across the job's passes — faster)
for [desktop 1440×900, mobile 390×844]:
    open page with that viewport
    collect console errors:   page.on('pageerror'), page.on('console' type=error)
    goto file:///tmp/job-<id>/index.html   (waitUntil networkidle, then wait ~2500ms
                                            — fonts + entrance animations)
    total = document.documentElement.scrollHeight
    for ~6-8 evenly spaced scroll positions from top to bottom:
        window.scrollTo(0, y); wait ~900ms          ← scroll animations settle
        screenshot → /tmp/job-<id>/shots/<viewport>-<n>.png
    overflow = scrollWidth − clientWidth            ← >1px means horizontal overflow bug
    close page
increment job.screenshotPasses                      ← the finish guard reads this (§4.3)
```

Then build the tool result — this is the multimodal part:

- **Text part:** `"Pass N of 3. Desktop: 7 shots, mobile: 7 shots. Console errors: <list|none>.
  Horizontal overflow: <Xpx|none>."`
- **Image parts:** the PNGs, downscaled to ~1000px width, capped at ~14 images total.
  (Downscaling matters: full-size screenshots waste tokens; the model reviews fine at 1000px.)

The exact shape for returning images inside a tool result is version-specific — copy it from
`node_modules/ai/docs/` ("multimodal tool results"). **Build a hello-world first:** one tool
returning one image, ask the model to describe it; only proceed when that works.

### 4.3 The `finish` guard (code, not prose)

```ts
finish: async ({ summary }) => {
  if (job.screenshotPasses < 3)
    return `Refused: ${job.screenshotPasses} of 3 required screenshot review passes done.
            Call screenshot_page, review the screenshots, fix what you find, then finish.`;
  // accept: end the tool loop
}
```

Also enforce: `write_file` only accepts path `index.html`; reject any other path with a clear
message (the prompt already says one file only — this makes it true).

### 4.4 Finalize

- Upload final `index.html` to R2/preview serving; upload the LAST pass's screenshots (and
  optionally each pass's first desktop shot, for the build-progress UX) to R2 keyed by job id.
- Optional UX: after each pass, update the job's status row (`stage`, `latestShotUrls`) so the
  frontend can show the page improving pass by pass.
- Delete `/tmp/job-<id>/`. Lifecycle rule on R2: intermediate shots expire after ~30 days.

### 4.5 Cost note

Each pass ≈ one full page rewrite (output tokens) + ~14 images (input tokens). Three passes ≈ 4×
single-shot cost. Record tokens per job from day one so pricing is informed by data.

## §5 — What is deliberately NOT in v1

The separate fresh-context reviewer (`buildCritiquePrompt` in `prompts.ts`) is kept for later:
same screenshots, a SEPARATE model call with no builder history, JSON findings fed back as a
revision task. When adopted, it replaces or augments pass 2. Do not delete the prompt; do not
wire it yet.

## §6 — Acceptance test (definition of done)

Run three fixture requests end to end:
1. a COD product (e.g. LED lamp, 3 500 DZD, French),
2. a services business (e.g. dental clinic, Arabic — RTL must be correct),
3. a portfolio (e.g. design agency, English).

Pass criteria:
- Three visibly different directions (different palettes, fonts, skeletons) — compare screenshots side by side.
- Each build: `get_direction_candidates` was called; the brief contains all labeled sections; the
  ASSETS manifest was produced (or shot list was legitimately 0); exactly ≥3 screenshot passes
  ran; `finish` succeeded only after pass 3; zero console errors; zero horizontal overflow at
  390/768/1440; the signature interaction exists and works.
- Logs show per-pass findings that actually changed the file between passes (diff the rewrites).
- Arabic fixture: `dir="rtl"`, Arabic font pair from the library, no italic Arabic.

## §7 — Library maintenance

- `directions.ts` is version-controlled taste. Editing it = a design decision; review like a
  design review. Deliberate exclusions baked in: no purple/violet anywhere, no Inter/Roboto/Open
  Sans. `product-stage` skeleton is flagged as the model's favorite — watch its serve rate.
- Grow each axis over time; prune entries whose pages users keep regenerating (keep-rate, §2).
