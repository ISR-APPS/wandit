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

// Lifecycle of one background build. Mirrors page_generation_status in
// packages/db/src/schema/page-attempts.ts.
export const pageAttemptStatusSchema = z.enum([
	"queued",
	"generating",
	"succeeded",
	"failed",
]);

export type PageAttemptStatus = z.infer<typeof pageAttemptStatusSchema>;

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
			versionId: uuidSchema.nullable(),
			createdAt: isoDateTimeSchema,
		})
		.nullable(),
});

export type PageOverview = z.infer<typeof pageOverviewSchema>;

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
} as const;
