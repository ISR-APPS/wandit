/**
 * Lead-scrape contracts (outbound prospect discovery).
 *
 * NOT the same thing as v1/leads.ts: that file is INBOUND leads captured by
 * deployed landing pages. This one is the background job that finds real
 * businesses (Google Maps + their websites) so the user can prospect them,
 * and exports the result as a downloadable .xlsx.
 *
 * Same architecture as page generation: the chat tool queues a background
 * task and answers immediately; the chat card polls the attempt endpoint
 * until the attempt settles, then offers the download.
 */
import { z } from "zod";
// Shared UUID/date validators.
import { isoDateTimeSchema, uuidSchema } from "./shared/primitives";

// Terminal states are succeeded/failed; the web polls until it sees one.
// Mirrors lead_scrape_status in packages/db/src/schema/lead-scrape-attempts.ts.
export const leadScrapeStatusSchema = z.enum([
	"queued",
	"running",
	"succeeded",
	"failed",
]);

export type LeadScrapeStatus = z.infer<typeof leadScrapeStatusSchema>;

// Pipeline position while status is queued/running — drives the checklist
// rows in the chat progress card. A succeeded attempt renders every row done
// regardless of the last stage written.
export const leadScrapeStageSchema = z.enum([
	"queued",
	"searching",
	"extracting",
	"verifying",
	"exporting",
]);

export type LeadScrapeStage = z.infer<typeof leadScrapeStageSchema>;

// Three sample rows for the result card's mini table. Empty strings mean the
// field was not found for that business (never invented).
export const leadScrapePreviewRowSchema = z.object({
	business: z.string(),
	phone: z.string(),
	email: z.string(),
});

export type LeadScrapePreviewRow = z.infer<typeof leadScrapePreviewRowSchema>;

// Everything the chat card needs in one polled request.
export const leadScrapeAttemptSchema = z.object({
	id: uuidSchema,
	status: leadScrapeStatusSchema,
	stage: leadScrapeStageSchema,
	// 0-100, computed by the task as stages advance.
	progress: z.number().int().min(0).max(100),
	// Echo of what the scrape is looking for ("gyms" / "Alger") so the card
	// can label itself after a reload without re-reading the tool input.
	query: z.string(),
	location: z.string().nullable(),
	// Data sources actually used (e.g. ["google-maps"]) — the card renders
	// one chip per source, never a decorative fake list.
	sources: z.array(z.string()),
	// Businesses discovered so far (the "147 found" badge).
	foundCount: z.number().int().nonnegative(),
	// Set on success only.
	rowCount: z.number().int().nonnegative().nullable(),
	columnCount: z.number().int().positive().nullable(),
	fileName: z.string().nullable(),
	fileSize: z.number().int().nonnegative().nullable(),
	previewRows: z.array(leadScrapePreviewRowSchema),
	// Human-readable failure reason, shown in the card's error state.
	error: z.string().nullable(),
	createdAt: isoDateTimeSchema,
	completedAt: isoDateTimeSchema.nullable(),
});

export type LeadScrapeAttempt = z.infer<typeof leadScrapeAttemptSchema>;

// Route path builders. These return strings; they do not make network calls.
export const leadScrapesRoutes = {
	// GET — one attempt's status (poll while queued/running).
	attempt: (attemptId: string) => `/api/v1/lead-scrapes/${attemptId}`,
	// GET — the finished workbook as an attachment (ownership-checked).
	download: (attemptId: string) => `/api/v1/lead-scrapes/${attemptId}/download`,
} as const;
