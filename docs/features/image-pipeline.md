# Image pipeline

Every image that a published page serves comes from R2. This document tells
how the bytes get there, what the server does to them, and what a client
receives.

## Paths into R2

| Path | Entry point | Key |
| --- | --- | --- |
| User upload | `POST /api/v1/attachments` → `UploadsService.uploadAttachment` | `uploads/{userId}/{uuid}/{filename}` |
| Builder image | `generate_image` tool → `generateBuildImage` | `sites/{projectId}/assets/{attemptId}/img-{n}.{ext}` |
| Standalone image | `generateStandaloneImage` | `images/{projectId}/{attemptId}/img-{n}.{ext}` |

`apps/server/src/infrastructure/storage/r2.ts` owns every key layout. Do not
build a key at a call site.

## Optimization

`optimizeImage` (`apps/server/src/infrastructure/storage/optimize-image.ts`)
recompresses one image to WebP q80 and caps its width at 1920.

It starts the recompression when ONE of these is true:

- the file is 150KB or larger, or
- the image is wider than 1920 pixels.

The width trigger is necessary: a well-compressed 269KB PNG of 3072x4342
pixels is small in bytes and very large in pixels. A byte threshold alone
lets it through.

The function never throws and never returns larger bytes than it received.
SVG, GIF, animated inputs, and formats sharp must not touch pass through
unchanged. It also answers the intrinsic `width` and `height` of the bytes it
returns (`null` when it cannot read them), so an `<img>` can reserve its box.

`UploadsService` sends EVERY raster attachment to `optimizeImage`. There is no
byte gate in the caller.

## Renditions (srcset)

`buildImageVariants` renders narrower WebP copies at 480, 960 and 1600 pixels.
It skips any width at or above the source width — it never upscales.

`storeImageVariants`
(`apps/server/src/infrastructure/storage/store-image-variants.ts`) uploads them
beside the primary object:

```
uploads/{userId}/{uuid}/hero-photo.webp        <- primary
uploads/{userId}/{uuid}/hero-photo.w480.webp   <- rendition
uploads/{userId}/{uuid}/hero-photo.w960.webp
uploads/{userId}/{uuid}/hero-photo.w1600.webp
```

Use `variantKey(baseKey, width)` to build these keys. The rendition stays in
the SAME directory, because `isUserUploadUrl`, `isWanditUploadUrl` and the
brief's user-photo extractor all require an `uploads/` key of exactly four
segments.

Rendition work is best effort. A rendition that fails to encode or to upload
is absent from the answer; it never fails the upload or the build.

The Assets tab hides renditions: `project-assets.service.ts` filters keys that
match `VARIANT_FILENAME_PATTERN` (`/\.w\d+\.webp$/`).

## Cache headers

`putSiteFile` takes an optional `cacheControl`. Uploads, build assets,
generated images and videos pass `IMMUTABLE_ASSET_CACHE_CONTROL`
(`public, max-age=31536000, immutable`). These keys carry a uuid and are
written exactly once.

Published HTML (`putPageHtml`), build screenshots and dashboard thumbnails get
no cache header.

**Warning for a future backfill:** never rewrite one of these keys in place.
Write a NEW key and repoint the HTML at it. The old bytes stay in edge and
browser caches for a year.

## Renditions in the page

`apps/server/src/modules/pages/domain/optimize-image-markup.ts` puts the
renditions to work. It has two pure functions.

`optimizeImageMarkup(html)` runs at generation finalize AND at publish. It
elects ONE LCP image and normalizes the rest:

- Candidates exclude `[data-wandit-brand-image]`, `[data-wandit-placeholder]`,
  and any image inside `<footer>`, `<nav>`, `<svg>` or a `[data-brand]`
  wrapper. "The first image in the document" is the LCP only half the time —
  on a measured page the first image is the 48x48 header logo.
- The search area is DOCUMENT POSITION: every candidate from the top of the
  page down to the END of the first top-level CONTENT section (the section
  model of `stamp.ts`, `topLevelSections`). Position, not containment: a hero
  written as `<main><div class="hero">` is inside no top-level section at all,
  and a containment test dropped it.
- A candidate that ALREADY carries `fetchpriority="high"` also competes, from
  wherever it sits. That attribute is the builder's own decision about its own
  layout and was correct on every live page measured, so the pass must not
  demote it to `loading="lazy"`.
- Ranking: largest DECLARED `width` x `height` first; then a declared
  `fetchpriority="high"`; then a candidate OUTSIDE `<header>`, because a
  header image is usually a logo; then document order. The last two only
  decide when no candidate declares a box.
- The winner gets `fetchpriority="high"`, `decoding="async"` and NO `loading`
  attribute. Every other image loses any `fetchpriority` and gets
  `loading="lazy"` + `decoding="async"`. Above-the-fold chrome (brand marks,
  `<nav>`, `[data-brand]`, SVG artwork) keeps its `loading` and `decoding`.
- If candidates exist but NONE of them sits in that region, the pass returns
  the page unchanged. It never marks an image `loading="lazy"` on a page whose
  LCP it could not find: a lazily loaded LCP is itself a Lighthouse failure,
  so a wrong guess costs more than doing nothing.
- The pass NEVER writes `width` or `height`. Wrong attributes on a published
  page define its layout, and a correction would reflow a live site. The
  model writes the true numbers instead — see "Dimensions the model sees".

`emitResponsiveImages(html, { exists })` runs at PUBLISH only. For each
eligible image whose `src` is a Wandit-hosted object, it computes the three
`variantKey` URLs, verifies each one with `exists()` (six probes in parallel,
5 s budget for the phase), and writes `srcset` from the renditions that
answer yes plus the primary at `1920w`, with `sizes="100vw"`. The elected
image also gets one `<link rel="preload" as="image">` in `<head>`, placed
before the inline `<style>`.

The preload does NOT depend on renditions. Objects written before the variant
pipeline existed have none until the backfill below runs, so tying the preload
to a rendition would give today's published sites nothing. It carries
`imagesrcset`/`imagesizes` only when the image really has a `srcset`.

## Backfill

`pnpm images:backfill-variants` (`apps/server/scripts/backfill-image-variants.ts`)
writes the missing renditions beside images stored before the pipeline
existed. Renditions are written on new writes only, so without it the `srcset`
reaches only sites built after that deploy.

It walks `uploads/` and `sites/`, skips keys that match
`VARIANT_FILENAME_PATTERN` or are not raster images, and skips a key that
already has one rendition — so a repeat run is cheap and an interrupted run
resumes. It writes NEW sibling keys only; it never rewrites a stored key,
which the cache rule above forbids. Use `--dry-run` first, and `--prefix`,
`--limit` and `--concurrency` to bound one run.

Two rules protect the publish:

- FAIL-OPEN. A probe that errors or times out gives that image no `srcset`.
  A storage problem must never block a publish.
- EMIT ONLY WHAT EXISTS. The publish preflight
  (`sites/domain/asset-validator.ts`) expands `img[srcset]` and
  `link[rel=preload][as=image]` and probes every URL over the network. An
  unverified rendition URL would fail the publish.

Drafts get no `srcset` on purpose: the editor's image swap strips `srcset`
and `sizes` when a user replaces an image, so a draft would lose them at the
first edit. The next publish rebuilds them for the new asset.

Both functions are idempotent and byte-stable. A document that needs no edit
comes back as the identical string, so a rollback that replays an archive
through the same chain writes the same bytes.

## Dimensions the model sees

- `POST /api/v1/attachments` answers optional `width`, `height` and
  `variants: [{ url, width }]`. The fields are optional, so an older client
  keeps validating.
- The `generate_image` tool result carries the real pixel size (for example
  `1536x1024px`), so the builder writes true `width`/`height` attributes.
- A USER UPLOAD's pixels never reach the model. The persisted file part holds
  only `url`, `mediaType` and `filename`, so the attachment marker
  (`annotateUserFileParts`) states no size. The three builder prompts
  therefore tell the model to write NO `width`/`height` on a user photo and to
  reserve its space in CSS (`aspect-ratio` plus `object-fit: cover`). A
  guessed attribute distorts the photo; a CSS box cannot.
- To make the upload's `width`/`height` usable, they must first travel on the
  message file part (contract, web composer, then the two
  `annotateUserFileParts` call sites in `ai-chat.service.ts`).
