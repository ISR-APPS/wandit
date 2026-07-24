/**
 * The jsonb `spec` snapshotted into a lead_scrape_attempts row at queue time,
 * plus the record shape the pipeline passes between its stages. Shared by the
 * scrape_leads chat tool (writes the spec) and the Trigger.dev task (parses
 * it back) — schema validation at the task boundary, same pattern as
 * page-attempt-spec.ts.
 */
import { z } from "zod";

// The only source wired today. The array form exists so Pages Jaunes / other
// directories can join later without a spec migration.
export const LEAD_SCRAPE_SOURCES = ["google-maps"] as const;

export const leadScrapeSpecSchema = z.object({
	version: z.literal(1),
	// The business niche to hunt for, e.g. "gyms".
	query: z.string().min(1),
	// City/region ("Alger"), or null when the user gave none.
	location: z.string().nullable(),
	// ISO 3166-1 alpha-2 country (lowercase, e.g. "dz") derived from the
	// request IP — biases the Maps search when the location alone is ambiguous.
	countryCode: z.string().length(2).nullable(),
	// Hard cap on collected businesses (already clamped by the tool).
	limit: z.number().int().min(5).max(200),
	sources: z.array(z.enum(LEAD_SCRAPE_SOURCES)).min(1),
});

export type LeadScrapeSpec = z.infer<typeof leadScrapeSpecSchema>;

// One prospect row as it flows through the pipeline and lands in the export.
// null = honestly unknown (never invented); the export renders empty cells.
export type LeadRecord = {
	name: string;
	phone: string | null;
	email: string | null;
	// True once the email's domain answered an MX lookup.
	emailVerified: boolean;
	website: string | null;
	address: string | null;
	source: (typeof LEAD_SCRAPE_SOURCES)[number];
};

// Shape of the jsonb preview_rows column (first rows of the export).
export type LeadScrapePreviewRows = Array<{
	business: string;
	phone: string;
	email: string;
}>;

export function toPreviewRows(
	records: readonly LeadRecord[],
	count = 3,
): LeadScrapePreviewRows {
	return records.slice(0, count).map((record) => ({
		business: record.name,
		phone: record.phone ?? "",
		email: record.email ?? "",
	}));
}
