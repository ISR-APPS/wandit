# Design Worlds — the taste library

## Why

Every generated website converged to the same page: eyebrow label → serif
headline → gray paragraph → accent CTA → photo on the right, then a linear
stack of sections. A deep audit found the causes:

- The direction catalog sampled **fragments** (a palette, four motion-move
  names, a finish) and left **composition** — hero form, page chassis, how
  sections meet — to the model's defaults. Unspecified means template.
- The builder prompt's only concrete numbers *were* the generic hero
  (11px eyebrow, 1px rule, `clamp(3rem,8vw,7rem)` headline), constant across
  every build.
- The quality bar (`design/examples/*.html`) was read by zero code.
- Ambitious motion was gated behind a low-probability `[GSAP]` tag draw, and
  the screenshot review pass treated mid-animation frames as bugs — so the
  cheapest "fix" was deleting the animation.
- `AI_BUILDER_REASONING=high` in `.env` was a misnamed no-op (the code reads
  `AI_PAGE_DESIGN_REASONING`), so the builder ran at default effort.

The counter-example: one 5,000-word style prompt (a "neo-brutalism" design
system doc) makes even an ordinary layout feel branded, because nothing is
left to guess. Depth of instruction, not number of options, is what kills
the template look. And a live art-director *agent* was already tried (July
15–25) and removed — an agent improvising a plan has the same defaults as
the builder. The fix is a **library written once with care, delivered whole
every time**.

## What

A **design world** (`apps/server/src/modules/ai-chat/agent/worlds/`) is a
complete visual universe written as one deep document: philosophy, color
physics, typography system, page chassis, hero forms, a seam vocabulary
(how scenes hand off to each other), motion identity with real values
(durations, eases, staggers), components, editorial voice, its own ban
list, and an intensity clause. Every world declares a `kind` — `website`,
`cod` (single-product COD pages, with a mandatory Conversion objects
section), or `both`.

Three worlds are distilled from the target-quality examples with their
exact measured values: `monographe` (dark architectural monograph, from
`real-estate.html`), `cinetique` (kinetic concept studio, from
`agency.html`), `atelier` (crafted commerce, from `ecommerce.html`, kind
both).

Twenty more were authored from concept briefs and adversarially critiqued
(every file reviewed and patched by a second agent for depth, value
specificity, executability, RTL coverage, and distinctness):

- Websites: `clarte` (light porcelain editorial — clinics/wellness),
  `fournil` (warm artisan food), `beton` (neo-brutalist punk), `riviera`
  (Mediterranean coastal, horizon-line system), `precis` (blueprint
  precision — tech/consulting/finance), `zellige` (Maghreb heritage
  lattice), `palestre` (training-floor energy), `nocturne` (candlelight
  fine dining), `pellicule` (film contact-sheet portfolio), `ribambelle`
  (paper-collage storybook — kids/family).
- COD product pages: `vitrine` (museum case for one object), `souk`
  (bazaar heat), `laboratoire` (spec-bench tech, exploded view), `cocon`
  (dewy beauty ritual), `heritage` (artisan lineage cold-open), `cargo`
  (streetwear drop), `verger` (terroir harvest food), `forge` (industrial
  tools), `sillage` (perfume vapor luxury), `nid` (baby trust softness).

## How it flows

1. `get_direction_candidates` now returns the **world menu first**, SAMPLED
   per call: 6 website worlds + 6 product-page worlds drawn fresh from the
   library, shuffled, with industry-affine worlds guaranteed at most 3
   seats (fit never crowds out surprise) and `avoidFor` filtering wrong
   matches. The randomness lives server-side — same anti-convergence
   contract as the palette/font sampler, one level up.
2. The Brain picks **exactly one world per website** (optional for COD pages
   when one fits), instantiates it (palette hexes mapped into the world's
   physics, font pairing, signature interaction), and writes a **PAGE
   STORY** — scenes with jobs, named seams, a traveling motif, quiet/loud
   rhythm, one showpiece — instead of a section list. Collected data (phone,
   prices, hours) is **cargo, never blueprint**: it lands in CONTENT FACTS
   and must not dictate structure.
3. `generate_page` takes an optional `worldId`. The queue tool appends the
   world's doc verbatim to the builder system-prompt **snapshot** — the
   Trigger task and build loop never know worlds exist.
4. The builder prompt was rewritten: world = design authority, brief =
   content authority; scenes + seams replace sections; the marketplace hero
   and default navbar are banned by name; a color-derivation rule (all
   secondary text/borders are alpha of ink); GSAP + ScrollTrigger load on
   every build with the examples' timing bands; review passes treat
   mid-scroll animation frames as correct and a fully static page as a
   finding.
5. `screenshot.ts` drives `window.__lenis` when present (smooth-scroll pages
   used to collapse every shot into the same frame).
6. `AI_PAGE_DESIGN_REASONING` now defaults to `high` in the env schema, and
   the `.env` var was renamed to the name the code actually reads.

## Authoring a new world

Copy `monographe.ts` as the format exemplar. Rules of the genre:

- Physics is law, tokens are instantiated: write "the palette's dark pole",
  not a hex, unless the value *is* the physics (durations, alphas, ratios).
- Every number real — distill from a torn-down reference, never invent.
- No backticks or `${` inside the doc (it ships in a template literal).
- End with an intensity clause: a world at 60% reads broken, at 100% reads
  branded.
- Register it in `worlds/index.ts`.

## Deliberately not here (yet)

- Cooldown/memory of served worlds per vertical (sampler accepts
  `cooldownIds`; a `served_directions` table is a later iteration).
- Brief validation/observability (`analyzeBrief`) — measure first.
- `scripts/test-build-world.ts` is throwaway experiment tooling: it runs
  `runSiteBuild` directly on a fixed dental-clinic brief in Monographe so
  before/after can be judged on the complaint's own subject.
