/**
 * Page generation contracts (docs/features/ai-chat-brain.md).
 *
 * The web app never streams page HTML from the model. Generation runs in a
 * background task; the web polls the project overview until the latest
 * attempt settles, then fetches the finished version's HTML separately.
 */
import { z } from "zod";
// Shared UUID/date validators.
import { isoDateTimeSchema, uuidSchema } from "./shared/primitives";
// Realtime handle: same shape the generate_page tool returns at queue time.
// Deliberately from shared/ (leaf), NOT from ./ai-chat — that import closes
// the ESM cycle ai-chat → page-edits → pages and crashes at module load.
import { triggerRealtimeHandleSchema } from "./shared/trigger-realtime";

// Lifecycle of one background build. Mirrors page_generation_status in
// packages/db/src/schema/page-attempts.ts. "canceled" is the user's Stop
// button — a decision, not a failure.
export const pageAttemptStatusSchema = z.enum([
	"queued",
	"generating",
	"succeeded",
	"failed",
	"canceled",
]);

export type PageAttemptStatus = z.infer<typeof pageAttemptStatusSchema>;

/**
 * Bounded machine classification of WHY a build failed, written by the
 * Trigger task while the original error object still exists. The UI maps
 * each code to honest, user-friendly copy — provider_* codes mean "the AI
 * model's provider had the problem, not Wandit". Tolerant on the wire: an
 * unknown future code degrades to null rather than blanking the card.
 */
export const pageBuildFailureCodes = [
	// The model provider throttled us (HTTP 429).
	"provider_rate_limited",
	// The model provider is at capacity / overloaded (503, 529, "overloaded").
	"provider_overloaded",
	// The model call timed out (socket/headers/body timeouts).
	"provider_timeout",
	// Any other provider-side API failure (5xx/4xx from the model API).
	"provider_error",
	// The build's credit reservation failed — the workspace ran out.
	"insufficient_credits",
	// The acting member hit their per-member credit limit.
	"member_limit",
	// The builder finished without a shippable page (validation failed).
	"invalid_output",
	// Uploading the finished files to storage failed.
	"storage_failure",
	// Everything else on our side.
	"internal_error",
] as const;

export const pageBuildFailureCodeSchema = z.enum(pageBuildFailureCodes);

export type PageBuildFailureCode = z.infer<typeof pageBuildFailureCodeSchema>;

/** Wire-tolerant read: unknown codes become null instead of a parse failure. */
export const pageBuildFailureCodeReadSchema = pageBuildFailureCodeSchema
	.nullable()
	.catch(null);

// Just enough about a version for labels ("v3") — HTML is fetched separately.
export const pageVersionSummarySchema = z.object({
	id: uuidSchema,
	number: z.number().int().positive(),
	createdAt: isoDateTimeSchema,
});

export type PageVersionSummary = z.infer<typeof pageVersionSummarySchema>;

// Everything the Page tab needs in one request: what to show now
// (activeVersion) and whether a build is in flight (latestAttempt).
// Both nullable — a fresh project has neither.
export const pageOverviewSchema = z.object({
	artifactId: uuidSchema.nullable(),
	activeVersion: pageVersionSummarySchema.nullable(),
	latestAttempt: z
		.object({
			id: uuidSchema,
			status: pageAttemptStatusSchema,
			error: z.string().nullable(),
			// Defaulted: older server responses predate the field.
			failureCode: pageBuildFailureCodeReadSchema.default(null),
			versionId: uuidSchema.nullable(),
			createdAt: isoDateTimeSchema,
		})
		.nullable(),
});

export type PageOverview = z.infer<typeof pageOverviewSchema>;

/**
 * Durable state of ONE build attempt — the chat card's source of truth after
 * the Trigger Realtime stream ends (or when it never existed). Polled while
 * queued/generating; fetched once more after a terminal state.
 */
export const pageAttemptDetailSchema = z.object({
	id: uuidSchema,
	status: pageAttemptStatusSchema,
	error: z.string().nullable(),
	failureCode: pageBuildFailureCodeReadSchema.default(null),
	// Terminal snapshot only — live percent rides Trigger run metadata.
	lastProgressPercent: z.number().int().min(0).max(100).nullable(),
	// Set when the user dismissed/discarded the terminal chat card.
	dismissed: z.boolean(),
	// The CURRENT Trigger run of this attempt (null between a retry's reset
	// and its handoff). The chat card compares it with its Realtime handle's
	// runId so a dead handle from a superseded run can never paint terminal
	// state over a live rebuild. Defaulted for older server responses.
	triggerRunId: z.string().nullable().default(null),
	versionId: uuidSchema.nullable(),
	createdAt: isoDateTimeSchema,
	completedAt: isoDateTimeSchema.nullable(),
});

export type PageAttemptDetail = z.infer<typeof pageAttemptDetailSchema>;

/**
 * Stop body: the card sends the percent it last SAW so the stopped card can
 * freeze there even when the worker dies before persisting its own snapshot.
 */
export const stopPageAttemptBodySchema = z.object({
	observedPercent: z.number().int().min(0).max(100).optional(),
});

export type StopPageAttemptBody = z.infer<typeof stopPageAttemptBodySchema>;

/**
 * Retry/resume response: the SAME attempt row goes back to "queued" on a new
 * Trigger run; the fresh realtime handle lets the card follow it live again.
 */
export const retryPageAttemptResponseSchema = z.object({
	attempt: pageAttemptDetailSchema,
	realtime: triggerRealtimeHandleSchema.optional(),
});

export type RetryPageAttemptResponse = z.infer<
	typeof retryPageAttemptResponseSchema
>;

// Full HTML of one immutable version. JSON envelope on purpose: the web
// renders it in a sandboxed iframe (srcdoc), never as a raw document.
export const pageVersionHtmlSchema = z.object({
	versionId: uuidSchema,
	html: z.string(),
});

export type PageVersionHtml = z.infer<typeof pageVersionHtmlSchema>;

export const pageVersionSourceSchema = z.enum([
	"builder",
	"ai-edit",
	"inline",
	"theme",
	"restore",
]);

export type PageVersionSource = z.infer<typeof pageVersionSourceSchema>;

// One row of the version-history list (Settings history, version switcher,
// rollback picker). `label` is a human summary derived from the version's
// build metadata; `isLive` marks the currently published version.
export const pageVersionListItemSchema = pageVersionSummarySchema.extend({
	label: z.string().nullable(),
	isLive: z.boolean(),
	source: pageVersionSourceSchema.nullable().default(null),
	/** Server-derived because source=null also covers invalid/future metadata. */
	isBuilderOrigin: z.boolean().default(false),
});

export type PageVersionListItem = z.infer<typeof pageVersionListItemSchema>;

export const listPageVersionsResponseSchema = z.object({
	versions: z.array(pageVersionListItemSchema),
});

export type ListPageVersionsResponse = z.infer<
	typeof listPageVersionsResponseSchema
>;

export const restorePageVersionBodySchema = z.object({
	expectedActiveVersionId: uuidSchema,
});

export type RestorePageVersionBody = z.infer<
	typeof restorePageVersionBodySchema
>;

export const restorePageVersionResponseSchema = z.object({
	version: pageVersionSummarySchema,
});

export type RestorePageVersionResponse = z.infer<
	typeof restorePageVersionResponseSchema
>;

// Route path builders. These return strings; they do not make network calls.
export const pagesRoutes = {
	// POST — apply an inline-editor / theme-panel op batch (one new version per batch).
	applyOps: (projectId: string) => `/api/v1/projects/${projectId}/page/ops`,
	// GET — overview for the project's landing page (poll while building).
	overview: (projectId: string) => `/api/v1/projects/${projectId}/page`,
	// GET — HTML of one version (immutable, cache forever).
	versionHtml: (versionId: string) =>
		`/api/v1/pages/versions/${versionId}/html`,
	// GET — full version history for the project (newest first).
	versions: (projectId: string) =>
		`/api/v1/projects/${projectId}/page/versions`,
	// POST — copy an old immutable version forward as the new active version.
	restoreVersion: (projectId: string, versionId: string) =>
		`/api/v1/projects/${projectId}/page/versions/${versionId}/restore`,
	// GET — durable state of one build attempt (chat card fallback + terminal
	// truth). Project-scoped so ownership rides the same predicate as overview.
	attempt: (projectId: string, attemptId: string) =>
		`/api/v1/projects/${projectId}/page/attempts/${attemptId}`,
	// POST — stop a queued/generating build (cancels the Trigger run).
	stopAttempt: (projectId: string, attemptId: string) =>
		`/api/v1/projects/${projectId}/page/attempts/${attemptId}/stop`,
	// POST — retry a failed build / resume a stopped one on the same row.
	retryAttempt: (projectId: string, attemptId: string) =>
		`/api/v1/projects/${projectId}/page/attempts/${attemptId}/retry`,
	// POST — dismiss the terminal chat card (Discard); pure UI bookkeeping.
	dismissAttempt: (projectId: string, attemptId: string) =>
		`/api/v1/projects/${projectId}/page/attempts/${attemptId}/dismiss`,
} as const;
