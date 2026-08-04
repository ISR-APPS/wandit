/**
 * Leads & Order CRM contracts (docs/features/leads-crm.md).
 *
 * A lead is one form submission captured from a published page (a COD order,
 * a booking, an inquiry). Capture is public and fire-and-forget: the runtime
 * script injected at publish time posts the body as a CORS simple request
 * (text/plain JSON — no preflight, no cookies) and never reads the response.
 * Phones cross the wire raw; the capture endpoint normalizes them to
 * canonical E.164 (+213…) before insert and keeps the raw value in extras.
 */
import { z } from "zod";
import { cursorPaginationQuerySchema } from "../http/pagination";
import { isoDateTimeSchema, uuidSchema } from "./shared/primitives";

// The COD phone-confirmation pipeline. Mirrors lead_status in
// packages/db/src/schema/leads.ts — cancelled = confirmation failed,
// returned = shipped but refused (shipping cost incurred).
export const leadStatuses = [
	"to_confirm",
	"confirmed",
	"shipped",
	"delivered",
	"returned",
	"cancelled",
] as const;

export const leadStatusSchema = z.enum(leadStatuses);

export type LeadStatus = z.infer<typeof leadStatusSchema>;

// Where the buyer came from — derived server-side from attribution
// (fbclid/utm_source → facebook, ttclid → tiktok, otherwise direct), never
// sent by the page.
export const leadSources = ["facebook", "tiktok", "direct"] as const;

export const leadSourceSchema = z.enum(leadSources);

export type LeadSource = z.infer<typeof leadSourceSchema>;

// Ad attribution the page runtime forwards from the landing URL. A strict
// whitelist — unknown keys are stripped at the boundary, so the page can
// never smuggle arbitrary data into the attribution column.
export const leadAttributionSchema = z.object({
	fbclid: z.string().max(1_000).optional(),
	landing_url: z.string().max(2_000).optional(),
	referrer: z.string().max(2_000).optional(),
	ttclid: z.string().max(1_000).optional(),
	utm_campaign: z.string().max(500).optional(),
	utm_content: z.string().max(500).optional(),
	utm_medium: z.string().max(500).optional(),
	utm_source: z.string().max(500).optional(),
	utm_term: z.string().max(500).optional(),
});

export type LeadAttribution = z.infer<typeof leadAttributionSchema>;

// Anything else the page's form collects (product options, quantity, size…).
// Scalar values only, both key count and sizes capped — this lands in a jsonb
// column on an unauthenticated endpoint.
export const leadExtrasSchema = z
	.record(
		z.string().max(80),
		z.union([z.string().max(500), z.number(), z.boolean(), z.null()]),
	)
	.refine((value) => Object.keys(value).length <= 40, {
		message: "Too many extra fields",
	});

export type LeadExtras = z.infer<typeof leadExtrasSchema>;

export type LeadExtraScalar = string | number | boolean | null;

/**
 * Public order fields suitable for owner-facing UI and exports.
 *
 * Capture-only metadata uses underscore-prefixed keys (for example
 * `_rawPhone`) and must not leak into order details. Sorting with direct
 * code-unit comparison makes the result stable across server and browser
 * locales.
 */
export function publicLeadExtraEntries(
	extras: unknown,
): Array<[string, LeadExtraScalar]> {
	if (!extras || typeof extras !== "object" || Array.isArray(extras)) {
		return [];
	}

	return Object.entries(extras)
		.filter(
			(entry): entry is [string, LeadExtraScalar] =>
				!entry[0].startsWith("_") &&
				(entry[1] === null ||
					typeof entry[1] === "string" ||
					typeof entry[1] === "number" ||
					typeof entry[1] === "boolean"),
		)
		.sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0));
}

/** Compact deterministic JSON for the single Order details export column. */
export function serializeLeadOrderDetails(extras: unknown): string {
	const entries = publicLeadExtraEntries(extras);
	if (entries.length === 0) {
		return "";
	}

	// Building the object JSON directly preserves code-unit order even for
	// integer-like keys, which JSON.stringify(object) is allowed to reorder.
	return `{${entries
		.map(([key, value]) => `${JSON.stringify(key)}:${JSON.stringify(value)}`)
		.join(",")}}`;
}

// Body of the public capture POST. `_hp` is the honeypot decoy: humans never
// see the field, so a non-empty value means a bot — the server answers 200 and
// silently discards, indistinguishable from success.
export const leadCaptureBodySchema = z.object({
	_hp: z.string().max(500).optional(),
	attribution: leadAttributionSchema.optional(),
	commune: z.string().trim().max(120).optional(),
	extras: leadExtrasSchema.optional(),
	name: z.string().trim().min(1).max(200),
	phone: z.string().trim().min(6).max(40),
	wilaya: z.string().trim().max(120).optional(),
});

export type LeadCaptureBody = z.infer<typeof leadCaptureBodySchema>;

// Deliberately carries no signal: success, honeypot discard, and duplicate
// drop all look identical to the caller.
export const leadCaptureResponseSchema = z.object({ ok: z.literal(true) });

export type LeadCaptureResponse = z.infer<typeof leadCaptureResponseSchema>;

// Everything the Leads tab needs for one row.
export const leadSchema = z.object({
	commune: z.string().nullable(),
	createdAt: isoDateTimeSchema,
	extras: z.record(z.string(), z.unknown()).nullable(),
	id: uuidSchema,
	name: z.string(),
	phone: z.string(),
	source: leadSourceSchema,
	status: leadStatusSchema,
	wilaya: z.string().nullable(),
});

export type Lead = z.infer<typeof leadSchema>;

export const leadsQuerySchema = cursorPaginationQuerySchema.extend({
	q: z.string().trim().max(200).optional(),
	status: leadStatusSchema.optional(),
});

export type LeadsQuery = z.infer<typeof leadsQuerySchema>;

export const leadTotalsSchema = z.object({
	cancelled: z.number().int().nonnegative(),
	confirmed: z.number().int().nonnegative(),
	last7Days: z.number().int().nonnegative(),
	today: z.number().int().nonnegative(),
	total: z.number().int().nonnegative(),
});

export type LeadTotals = z.infer<typeof leadTotalsSchema>;

export const leadsResponseSchema = z.object({
	leads: z.array(leadSchema),
	nextCursor: z.string().nullable(),
	total: z.number().int().nonnegative(),
	totals: leadTotalsSchema,
});

export type LeadsResponse = z.infer<typeof leadsResponseSchema>;

export const leadStatusUpdateBodySchema = z.object({
	status: leadStatusSchema,
});

export type LeadStatusUpdateBody = z.infer<typeof leadStatusUpdateBodySchema>;

export const leadResponseSchema = z.object({
	lead: leadSchema,
});

export type LeadResponse = z.infer<typeof leadResponseSchema>;

export const leadsRoutes = {
	// Public endpoint the published page's runtime posts to — rate-limited +
	// honeypot, addressed by the project's unguessable publicFormId. Lives in
	// the /api/public namespace (docs/features/leads-crm.md), deliberately
	// outside the authenticated /api/v1 space: this exact URL is embedded in
	// published pages by the publish-time runtime injection.
	capture: (publicFormId: string) => `/api/public/leads/${publicFormId}`,
	listByProject: (projectId: string) => `/api/v1/projects/${projectId}/leads`,
	updateStatus: (projectId: string, leadId: string) =>
		`/api/v1/projects/${projectId}/leads/${leadId}/status`,
} as const;
