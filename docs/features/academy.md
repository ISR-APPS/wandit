# Academy

## Purpose

Educate users on how to get results with Wandit (run ads, build websites, write landing pages, …) without leaving the product. Admins (the founders) author "guides" — a YouTube video plus a rich-text post — from the admin panel; every signed-in user browses them in a library at `/academy`. This replaces the "ping Zack to ship content" loop: the co-founder publishes guides self-serve.

## Owns

- `academy_guides` table: id (uuid), title, description, category, youtube_url + derived youtube_video_id, body_html (server-sanitized), status (draft/published), published_at, created_by_user_id, timestamps. Index on (status, published_at). Migration `0031_burly_lester.sql`.
- Shared contracts `packages/contracts/src/v1/academy.ts`: guide schemas, create/update inputs (PATCH semantics), admin list query (pagination + q + status), `academyRoutes`, and pure YouTube helpers (`parseYouTubeVideoId`, `youtubeThumbnailUrl`, `youtubeEmbedUrl`, `youtubeWatchUrl`).
- Server module `apps/server/src/modules/academy/**`:
  - User reads (session required, no `@Public`): `GET /api/v1/academy/guides` (published only, newest first, no bodyHtml in list), `GET /api/v1/academy/guides/:id` (published only).
  - Admin CRUD (`@AdminOnly`, admin auth surface): `GET/POST /api/v1/admin/academy/guides`, `GET/PATCH/DELETE /api/v1/admin/academy/guides/:id` (hard delete).
  - `sanitizeAcademyGuideHtml`: strict sanitize-html allowlist (no scripts/iframes/styles/event handlers; https-only images; links forced to `target="_blank" rel="noopener noreferrer nofollow"`). Applied on every write; the stored HTML is trusted downstream.
  - Rules: youtube_video_id derived server-side from the URL; a guide needs a video or a non-empty body; first transition to published stamps `published_at` once (unpublish keeps it).
- Admin section `/academy` (`apps/admin/src/features/academy/**` + routes): guides table (search, status filter, thumbnail, status badge, pagination), publish/unpublish, delete with confirm, and a full-page editor (`/academy/new`, `/academy/$guideId`) with title/category/description fields, YouTube link with live embed preview + validation, and a TipTap WYSIWYG body (paragraph/H2/H3, bold, italic, strike, underline, lists, blockquote, code block, hr, link + image popovers, undo/redo). English-only, per admin convention.
- Web library (`apps/web/src/features/academy/**` + routes `_auth/academy*`): `/academy` grid of guide cards (YouTube thumbnail or gradient fallback, category badge, title, description, date) with category filter chips and count; `/academy/$guideId` reading page (16:9 nocookie embed, "Watch on YouTube", styled sanitized body). Entry points: sidebar Resources item, Academy button in the dashboard header, icon button in the workspace header. Localized in en/fr/ar (`academy.json` namespace).

## Working model

The co-founder opens Admin → Academy → New guide, pastes a YouTube link (preview renders immediately), writes the post in the WYSIWYG, and clicks Publish. The server validates against the shared Zod contracts, derives the video id, sanitizes the HTML, and stamps `published_at`. The web library queries published guides only (drafts never leave the admin surface); TipTap HTML renders via a styled wrapper — safe because sanitization happened at write time. Guides are global content, not workspace-scoped, so query keys ignore the active workspace.

## Does not own

- File/image uploads into guide bodies (images are by-URL only; the attachments/R2 pipeline is a separate surface with web-session auth).
- Course structure (sections, progress tracking, completion) — this is a flat library in v1.
- Localized guide content — guide bodies are authored in one language; only the UI chrome is translated.

## Acceptance criteria

- A non-admin session gets 404 from every `/api/v1/admin/academy/*` route; an anonymous request to `/api/v1/academy/*` gets 401.
- Draft guides never appear in web list/detail responses.
- `<script>`, event handlers, `javascript:` hrefs, and non-https images are stripped from stored body HTML (verified end-to-end).
- watch/shorts/youtu.be/live/embed YouTube URL forms all resolve to the same video id; lookalike hosts are rejected.
- Publish stamps `published_at` exactly once; unpublish hides the guide from web without losing the date.
- Web UI strings exist in en, fr, and ar; the ar layout is RTL-correct.

## Expected files

`packages/db/src/schema/academy.ts`, `packages/db/src/migrations/0031_*.sql`, `packages/contracts/src/v1/academy.ts`, `apps/server/src/modules/academy/**`, `apps/admin/src/features/academy/**`, `apps/admin/src/routes/_dashboard/academy*`, `apps/web/src/features/academy/**`, `apps/web/src/routes/_auth/academy*`, `packages/internationalization/dictionaries/{en,fr,ar}/academy.json`.

Source docs: DESIGN.md, docs/localization.md
