# Composer modes — marketing, images, assets

## The contract (unchanged philosophy, now fully wired)

The prompt box is a **routing form stapled to a chat message**. Three layers:

1. **Mode** = which factory the message goes to (`page` / `marketing` /
   `image` / `video`). A mode is an input contract + an output type. `auto`
   means the Brain routes from the words — it owns every tool, so auto is
   fully capable.
2. **Output** = which product from that factory (`ad-copy` vs
   `video-script`; `landing-page` vs `site-vitrine`).
3. **Options** = knobs on that product (platform, variants, motion…).

Selections are **cargo, never law**: every message snapshots the pickers
into `metadata.composer`, the server renders them into the
"## This request" block (`request-context.ts`), and the user's words always
win. Nothing is locked per conversation; switching modes mid-chat is a
feature — marketing written in a conversation that already built the page
knows the whole business.

Rule enforced by design: **every mode/output/option the UI offers must
produce a line in the request context.** `request-context.ts` now covers all
marketing and image outputs, renders known option keys with human labels,
and falls back to a generic `key: value` line for unknown ones — a new UI
option can never silently vanish again. `quality` (standard/max) is
snapshotted into generation specs for later model swapping; no generator
reads it yet.

## Marketing assets (Marketing tab)

- Chat tool `generate_marketing_asset` (title, assetType, brief) → row in
  `marketing_assets` → Trigger task `generate-marketing-asset` → one
  `generateText` call (env `AI_MARKETING_MODEL`, falls back to
  `AI_CHAT_MODEL`) writes a self-contained HTML document → R2 under
  `marketing/{projectId}/{assetId}/index.html`.
- Asset types match the composer output ids verbatim: `ad-copy`,
  `marketing-strategy`, `video-script`, `creative-brief`, `html-asset`.
- The generator sees ONLY the Brain's MARKETING BRIEF (facts are cargo here
  too). Billing: 5 credits, reserve/refund like image animation.
- Web: the Marketing tab lists named cards
  (`GET /v1/projects/:id/marketing-assets`, polled while any card is
  building); clicking opens the HTML in a sandboxed iframe
  (`GET /v1/marketing-assets/:id/html`, JSON envelope) with a download
  route beside it.

## Standalone images (chat + Assets tab)

- Chat tool `generate_image` (title, prompt, aspect, count 1-4,
  sourceImageUrls) → `image_generation_attempts` → Trigger task
  `generate-image`.
- Two paths in one attempt:
  - **Text-only** → `generateImage` with `AI_IMAGE_MODEL` (gpt-image
    canvases; 7 contract aspects map onto square/portrait/landscape).
  - **Edit** (sourceImageUrls present) → `generateText` with
    `AI_IMAGE_EDIT_MODEL` (multimodal image-out model, e.g. Gemini image):
    the user's real product photo/logo is edited so outputs stay faithful.
    Source URLs must exactly match user attachments (same ownership rule as
    animate_image).
- The Brain's law: when an image should feature the user's product/logo, it
  asks for the photo first (ask_user attachments) and passes it as a
  source. The page BUILDER got the same power: its in-build `generate_image`
  accepts `sourceImageUrls` from the brief's BRAND ASSETS.
- Storage: `images/{projectId}/{attemptId}/img-{n}.{ext}` — deliberately
  NOT under `sites/{projectId}/assets/` so the Assets tab prefix listing
  never double-counts. Billing: 5 credits per attempt.

## Assets tab

One ownership-checked list (`GET /v1/projects/:id/assets`) merging three
sources: succeeded image attempts (one entry per image), succeeded
animations, and an R2 prefix listing of `sites/{projectId}/assets/` (build
images/videos have no DB rows — the bucket is their source of truth), with
animation keys deduped. Downloads go through
`/v1/projects/:id/assets/download?key=` which re-validates the key prefix —
public R2 URLs cannot force a download cross-origin.

## Video mode rename

"Image en vidéo" → **"Animer une image"**: the mode's real contract is
animate-a-photo (source image required, text optional). The internal id
stays `video`. When true text-to-video ships someday it becomes a second
output of this mode; the composer's OutputPicker already supports that.

## Deliberately not here (yet)

- `quality` model swapping (snapshotted only).
- Marketing asset regeneration/versioning — a new ask produces a new card.
- Reconcilers for marketing/image stale rows (animation has one; these are
  cheap and short — revisit with real traffic).
- Charging per image instead of per attempt.
