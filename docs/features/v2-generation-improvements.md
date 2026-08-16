# V2 Generation Improvements — Spec (RETIRED, historical record)

> **Status (2026-07-24): RETIRED.** The Art Director pipeline this spec
> describes was removed — it burned tokens, added latency, and failed too
> often. Generation is back to the two-agent flow (Brain → Builder); see
> `ai-chat-brain.md` for the current architecture. This file is kept only as
> the historical record of what was tried. Do not implement from it.

Decisions agreed with Zack on 2026-07-20. Every implementation agent reads this
file first. **Never commit — leave all changes uncommitted for review.**

## 1. Swappable generation models

- The chat Brain uses `AI_CHAT_MODEL`.
- The Art Director uses `AI_ART_DIRECTOR_MODEL`.
- The Builder uses `AI_PAGE_BUILDER_MODEL`. During migration,
  `AI_PAGE_DESIGN_MODEL` remains its fallback.
- All values are Vercel AI Gateway model strings and may be changed in
  `apps/server/.env` without code changes.
- Chat model stays `xai/grok-4.5`. Image model stays `openai/gpt-image-2`.
- Remove the dead `AI_BUILDER_REASONING` var from `.env` (read by nothing).

## 2. Two-stage direction + three-pass visual review

- The Art Director uses two calls to the same snapshotted
  `AI_ART_DIRECTOR_MODEL`:
  1. **Creative Direction** is plain `generateText` with a 32,000-token
     ceiling and no structured decoder. It writes one fixed-format Creative
     Capsule after privately comparing three divergent routes. The Capsule
     binds every design adjective to an observable CSS/GSAP value in the same
     breath.
  2. **Spec Extraction** uses `generateText` +
     `Output.object(creativeSpecSchema)` with a 24,000-token ceiling. It
     faithfully transcribes the Capsule into the unchanged validated schema;
     it does not invent or soften the direction.
- The Creative Direction prompt includes a technique lexicon distilled from
  `design/examples/agency.html`, `real-estate.html`, and `ecommerce.html`.
  The lexicon is compositional vocabulary, never a checklist or house style.
  It gives the Art Director concrete implementation coordinates while leaving
  every project free to invent beyond them.
- The Capsule and validated `CreativeSpec` are persisted together inside the
  attempt's existing JSON spec blob. Retries reuse both exact handoffs.
- Browser review is back as three enforced screenshot passes
  (`REQUIRED_SCREENSHOT_PASSES = 3`) with distinct jobs — correctness,
  creative fidelity/ambition, final verification — combined with a
  final-revision invariant. The Builder writes and re-reads `index.html`,
  captures desktop and mobile screenshots, fixes what each pass finds, and
  captures again after any rewrite. Three passes is a floor, not a ceiling.
- `finish` accepts only when at least three successful screenshot passes are
  recorded AND both `reviewedRevision` and `screenshotRevision` equal the
  latest `writeRevision` — so pass counting alone can never bless a stale
  draft. Text-only Builder models degrade explicitly to code review, and a
  runtime without Playwright/Chromium logs the downgrade instead of failing
  the whole build. Structural validation remains mandatory in every mode.

## 3. Builder output contract (prompt revision, one consolidated change)

The builder prompt gains three hard requirements. Models comply reliably —
no enforcement linting needed beyond the existing finish guard.

### 3a. Semantic section IDs
Every top-level section carries `data-wid="<semantic-slug>"` (e.g. `hero`,
`benefits`, `order-form`, `footer`). Short, unique, kebab-case.

### 3b. Design-token schema (tweakcn-style)
Every page declares its design system as CSS custom properties in `:root`
with **fixed names, free values**:
`--background, --foreground, --primary, --primary-foreground, --secondary,
--secondary-foreground, --accent, --accent-foreground, --muted,
--muted-foreground, --border, --radius, --font-heading, --font-body,
--font-utility`.
All styling references the variables. The model chooses values freely per
design (diversity preserved); it never renames or skips tokens. Google Fonts
`<link>` tags correspond to the two font tokens.

### 3c. COD genre (Algerian market)
COD = single-page cash-on-delivery e-commerce funnel. Reference screenshots:
`design/cod/`. The prompt encodes a **genre contract, not a template**:

Non-negotiable skeleton:
1. One product, one goal: the whole page funnels to an embedded order form.
   No cart/checkout/payment. Form submit → phone confirmation message.
2. Algerian order form: name + phone (placeholder `05xx xx xx xx`, no email)
   + wilaya + baladiya; optional variant/quantity pickers; delivery method
   (bureau vs domicile, different fees); live order summary
   (product + delivery = total). Form is display/markup only for now —
   no backend submission (explicitly out of scope).
3. COD trust markers, delivery coverage, local-product signals, and return
   rules appear only when the merchant supplied those facts.
4. Original prices, discounts, bundles, and downsells appear only when the
   merchant supplied the exact values.
5. Never invent urgency, limited stock, countdown deadlines, reviews, ratings,
   testimonials, or delivery claims.
7. Language: RTL Arabic, MSA blended with Algerian darija; emojis in
   headlines/CTAs are genre-appropriate.
8. Multiple CTAs, all anchoring to the form. Mobile-first.

Free variables (MUST vary per brand/product — producing the same look twice
is failure): palette (derived from product/brand), light vs dark, typography,
hero structure (poster / image-overlay / stacked), copy register, which
urgency/proof devices and their intensity.

## 4. Element stamping pass (server-side, deterministic)

After generation AND after every edit, a server pass (cheerio) walks the HTML
and stamps every editable leaf (`h1–h6, p, img, a, button`, CTA-like elements)
with `data-wid="e-<number>"` (stable counter per version). The model is never
asked to do this. Section-level semantic wids from 3a are preserved.

## 5. AI surgical edits (chat agent tools)

New tools on the chat agent (runs inline in conversation, seconds not
minutes):
- `get_page_outline` — section map of the active version (wid + tag + short
  text snippet). Cheap (~200 tokens).
- `read_section(wid)` — that section's HTML only.
- `apply_element_ops(ops)` — bounded targeted edits, including inserting one
  inert element before, after, or inside an existing stamped target.
- `insert_section(anchorWid, position, html)` — inserts one new section before
  or after an existing outlined section; the server assigns all new wids.
- `replace_section(wid, html)` — server applies DOM surgery on a copy of the
  current version files, re-runs the stamping pass, writes a **new immutable
  version**, flips `activeVersionId`.
Escalation: use `apply_element_ops` for small changes or additions inside an
existing section, `insert_section` for one new section, `replace_section` to
restructure one existing section, and the full builder only for broader
redesigns or new pages. After manual (inline) edits, the chat context gets a
quiet note listing user-edited wids so the AI doesn't clobber them.

## 6. Click-to-target

In the Page tab preview iframe: click highlights an element/section, iframe
postMessages the wid to the app, the next chat message carries
`selected: data-wid=...` metadata so "change this" is unambiguous.

## 7. Inline editor (zero tokens)

Preview-only script injected into the iframe (never in published output):
- Text: click → `contentEditable`.
- Image: click → swap dialog (upload → R2).
- Element-level style: color, font size, font family (curated font list
  only) — applied as inline style pinned to the element's wid.
- Edits accumulate client-side as ops `{wid, op, value}`; explicit **Save**
  POSTs the op batch → server loads current HTML from R2, applies with
  cheerio, re-stamps, writes ONE new version per save session.
- Client never sends HTML — server is the only writer (XSS surface,
  auditability, canonical file).

## 8. Theme panel (tweakcn-style)

- App parses `:root` tokens from the active version → renders pickers per
  token (colors, radius, curated font selects).
- Live preview via `setProperty` on the iframe document — instant, free.
- Save = `{op: "set-tokens", values}` through the same ops pipeline → server
  rewrites the `:root` block (+ swaps Google Fonts links) → new version.
- **15–20 static curated preset palettes** shipped with the app (values-maps
  over the fixed token names). One-click apply. AI-suggested palettes:
  explicitly later, not now.
- Live contrast-ratio warnings in the panel (client-side).
- Per-element overrides (§7) beat tokens: tokens cascade, overrides pin.

## 9. Chat tone fix

The chat agent's replies must stop using markdown-asterisk styling
(`**bold**`, bullet-asterisks) — it reads AI-ish/sloppy in the product UI.
System-prompt directive: plain conversational prose (French default),
no asterisks, no markdown emphasis. Keep answers short and human.

## 10. Modes become real (prompt box)

Current modes UI exists but is ignored by the agent. Wire it end-to-end:
selected mode + sub-options flow into the chat request metadata and into the
agent's system context. Structure (labels in French in the UI):

- **Auto** (default): model infers everything from the query.
- **Site web** (rename from "Page"):
  - Output: **Landing page** (single-page COD-style funnel) or
    **Site vitrine** (multi-section site).
  - Objectif: Vente COD | Capture de leads | Service | Promo.
- **Marketing**: unchanged behavior for now (research documents what exists).
- **Image**: unchanged.
- **Vidéo**: reframed as **image → video animation** (we never generate
  video from scratch). Outputs: UGC / Démo produit — implementer may refine
  labels for UX, keeping the image-animation framing.
- The skills attach button ("+"): ignore entirely for now.

## 11. Attachments (user-provided assets)

- **Initial-message attachments**: user can attach images/docs with their
  first message (AI SDK file parts; the prompt box already has unused UI
  states for image/video attachment — wire them). Files upload to R2 and are
  passed to the agent/builder.
- **Ask-user flow**: the ask-user tool gains an attachment-request type
  (mapping to the existing prompt-box UI states) so the AI can ask for logo /
  product photos mid-conversation.
- Downstream use: builder places assets directly, or the image tool edits
  them (resize, background, integrate into design) so final assets match the
  design quality.

## 12. Optional animated heroes (image → video)

- New builder tool `animate_image` (name flexible): takes a generated or
  uploaded image, produces a short ambient video via an image-to-video model
  (gateway model from research), stores in R2, returns a URL the builder
  embeds as a section background `<video>` (muted, loop, playsinline, poster
  = source image).
- **The model decides** when a section merits animation — never mandatory.
  Prompt guidance: only when it elevates the design.
- If no viable gateway video model exists: implement behind the same
  graceful-unavailable pattern as `generate_image` (tool answers
  "unavailable"), flag in final summary.

## 13. Out of scope (explicit)

- Order-form submission backend (revisit after generation is perfect).
- AI-suggested palettes (later, token-priced).
- Skills attachment in the prompt box.
- Form-builder/visual-builder beyond §7 scope.

## 14. Versioning invariant

Every mutation — AI edit, inline save, theme save — produces a new immutable
version and flips `activeVersionId`. No in-place file mutation, ever.
