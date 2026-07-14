// ─────────────────────────────────────────────────────────────────────────────
// WORKSPACE DTO TYPES (front-end only — no runtime code, just TypeScript types)
//
// "DTO" = Data Transfer Object: plain data shapes describing what the
// workspace screens pass around. There is no logic in this file; deleting it
// would only break type-checking, never runtime behavior (types are erased
// when TypeScript compiles).
//
// Where this sits in the chat flow:
//   - The MOCK/demo path uses these chat types: lib/mock-workspace.ts builds
//     fake data in these shapes, lib/store.tsx holds it, and
//     components/chat/chat-message.tsx + generation-card.tsx render it.
//   - The REAL chat path does NOT use these chat types. api/chat.services.ts
//     and lib/use-project-chat.tsx import `ChatMessage` / `MessagePart` from
//     @wandit/contracts instead (rendered by components/chat/real-message.tsx).
//
// NOTE (gotcha): that means TWO different `ChatMessage`/`MessagePart`/
// `MessageRole` types currently coexist under the same names — this local one
// (strict, mock UI) and the contracts one (looser, actual wire format, and it
// also allows a "system" role). Which one you get depends on the import path,
// which is easy to trip over. The plan (see the original note just below) is
// for this file to become pure re-exports of the contract types once the
// backend shapes settle, killing the duplication.
//
// "z.infer" below refers to Zod — a library whose schemas validate JSON at
// runtime AND derive ("infer") a matching TypeScript type from themselves.
// ─────────────────────────────────────────────────────────────────────────────

// Request/response types for the workspace api layer. Source of truth will
// be packages/contracts — once the backend lands these become derived
// re-exports (z.infer), never redeclared. Shapes mirror the planned contract:
// messages store AI SDK v7-style parts, versions are immutable pointers to
// generated files, deployments are slug → version pointers, leads carry the
// COD order pipeline.

// The five top-level tabs of the workspace screen (used by
// pages/workspace-page.tsx and components/shell/main-pane-header.tsx). A
// string-literal union like this means the compiler rejects any typo'd tab
// name anywhere it's passed around — safer than a bare `string`.
export type WorkspaceTab =
	| "page"
	| "assets"
	| "marketing"
	| "leads"
	| "settings";

// Who "said" a chat message. NOTE: the contracts version of this type also
// allows "system"; this mock-UI union is narrower because the workspace never
// renders system messages — but it's another spot where the two same-named
// types quietly diverge.
export type MessageRole = "user" | "assistant";

// A plain-text chunk of a chat message. Messages are stored as arrays of
// "parts" (AI SDK v7 style) instead of one big string, so text and rich
// widgets (like the generation card below) can interleave inside a single
// assistant turn.
export type TextPart = { type: "text"; text: string };

// A rich, non-text part: the "generating your page… / version ready" card
// shown inline inside an assistant message while the worker builds a page.
// In the real flow this data arrives over SSE (Server-Sent Events — a one-way
// HTTP stream the browser listens to via EventSource); this type mirrors that
// stream's event shape so the mock UI matches what the backend will send.
/** Inline generation card — mirrors the artifact-updated stream event. */
export type GenerationPart = {
	type: "generation";
	status: "running" | "complete";
	/** null while the generation job is still running. */
	versionId: string | null;
	versionNumber: number;
	summary: string;
};

// A part is EITHER text OR a generation card. This is a "discriminated
// union": every variant carries a `type` tag, so checking `part.type` lets
// TypeScript narrow to the exact shape (chat-message.tsx relies on this).
// Contrast with the contracts MessagePart, which is a loose record of unknown
// keys — this strict version only exists for the mock UI.
export type MessagePart = TextPart | GenerationPart;

// One chat turn as rendered by the mock path (chat-message.tsx +
// generation-card.tsx). `createdAt` is an ISO date STRING, not a Date object —
// JSON has no Date type, so API-shaped data keeps dates as strings and
// components format them at render time.
export type ChatMessage = {
	id: string;
	role: MessageRole;
	parts: MessagePart[];
	createdAt: string;
};

// Languages a generated landing page can be written in — French / Arabic /
// English, matching the Algerian market (Arabic pages render right-to-left).
export type PageLang = "fr" | "ar" | "en";

// Every generation produces a NEW immutable version rather than overwriting
// the previous one, so users can compare versions, roll back, and publish any
// past version safely. (R2 is Cloudflare's file storage, like Amazon S3 —
// in production each version will point at a stored HTML file there; for now
// `pageKey` points at a hardcoded mock page instead.)
/** Immutable generated-page version (points at an R2 key in production). */
export type PageVersion = {
	id: string;
	number: number;
	label: string;
	lang: PageLang;
	/** Mock renderer key resolved by lib/mock-pages. */
	pageKey: string;
	createdAt: string;
};

// Publish lifecycle of a project's page: not live yet → publish request in
// flight → live at its public URL.
export type DeploymentState = "draft" | "publishing" | "published";

// Where (and whether) the project's page is live. `slug` is the public URL
// path segment (the page ends up at something like wandit.app/<slug>). All
// the nullable fields stay null until the first publish happens.
export type Deployment = {
	state: DeploymentState;
	slug: string | null;
	publishedVersionId: string | null;
	/** Version a publish in flight is targeting — lets an interrupted
	 * publish/rollback recover onto the version that was requested. */
	pendingVersionId: string | null;
	publishedAt: string | null;
};

// Ad-tracking pixel IDs the user pastes into the Marketing/Settings UI.
// They get injected into the published page so Meta (Facebook) and TikTok can
// attribute ad conversions. Null means "not configured yet".
export type PixelSettings = {
	metaPixelId: string | null;
	tiktokPixelId: string | null;
};

// The whole workspace snapshot in one blob — messages, versions, deployment
// and pixels together. Fetching it as one unit (api/workspace.services.ts)
// keeps the loading UX simple: one spinner, one error path, instead of four
// requests that can each fail independently.
/** Everything the workspace needs for one project, fetched as one unit. */
export type WorkspaceState = {
	messages: ChatMessage[];
	versions: PageVersion[];
	deployment: Deployment;
	pixels: PixelSettings;
};

// The COD (cash-on-delivery) order pipeline, listed in the order a lead
// normally moves through it; "returned" and "cancelled" are the failure
// exits. The Leads tab groups and colors leads by this status.
export type LeadStatus =
	| "to_confirm"
	| "confirmed"
	| "shipped"
	| "delivered"
	| "returned"
	| "cancelled";

// Which channel brought the visitor who became this lead — used for
// filtering today, and for ad-campaign attribution later.
export type LeadSource = "facebook" | "tiktok" | "direct";

// One customer order/lead captured by the published page's order form.
// `wilaya` and `commune` are Algeria's province/municipality address units —
// the standard way delivery addresses are expressed there.
export type Lead = {
	id: string;
	name: string;
	/** Canonical E.164 (+213…). */
	phone: string;
	wilaya: string;
	commune: string;
	createdAt: string;
	status: LeadStatus;
	source: LeadSource;
};
