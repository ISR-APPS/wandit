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
import {
	isoDateSchema,
	isoDateTimeSchema,
	uuidSchema,
} from "./shared/primitives";

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

/**
 * One export cell for a dynamic form-field value. French Oui/Non on purpose —
 * exports are for Algerian merchants, matching the sheet's French labels.
 */
export function formatLeadExtraValue(value: LeadExtraScalar): string {
	if (value === null) {
		return "";
	}

	if (typeof value === "boolean") {
		return value ? "Oui" : "Non";
	}

	return String(value);
}

/**
 * Cap on distinct dynamic columns per export run. Extras keys are
 * attacker-chosen on the public capture endpoint (leadExtrasSchema caps keys
 * per lead, not per project), so without a bound, spam with unique keys would
 * grow the spreadsheet past Google's hard limits (18,278 columns, 10M cells)
 * and wedge every future sync. Keys past the cap collapse into one serialized
 * catch-all cell instead of getting lost.
 */
export const MAX_LEAD_EXTRA_COLUMNS = 100;

/** Header label of the catch-all overflow column. French on purpose, like the
 * sheet's fixed labels — exports are for Algerian merchants. */
export const LEAD_EXTRA_OVERFLOW_LABEL = "Autres champs";

export type LeadExtrasColumns = {
	/** Registers this lead's unseen keys, then returns its cells in column order
	 * ("" for columns the lead lacks). May return fewer cells than keys() will
	 * eventually hold — later-discovered columns are simply blank for this row. */
	buildCells(extras: unknown): string[];
	/** True once any lead spilled keys into the catch-all overflow column.
	 * Like keys(), only final after every lead went through buildCells(). */
	hasOverflow(): boolean;
	/** Dynamic header labels (the raw form-field names), in column order. */
	keys(): string[];
};

/**
 * Dynamic keys must not repeat a fixed header label (a form field named
 * "Date" would otherwise render two identical header cells and confuse
 * header-keyed consumers — Excel pivots, pandas, re-imports). Collisions get
 * a numeric suffix; cell positions are untouched.
 */
export function dedupeLeadExportHeaderLabels(
	fixedLabels: readonly string[],
	keys: readonly string[],
): string[] {
	const taken = new Set(fixedLabels);

	return keys.map((key) => {
		let label = key;
		for (let suffix = 2; taken.has(label); suffix++) {
			label = `${key} (${suffix})`;
		}

		taken.add(label);
		return label;
	});
}

/**
 * Column layout for the dynamic form fields of one export run.
 *
 * Every AI-generated page collects different fields, so the export cannot use
 * a fixed header: each public extras key gets its own column instead of the
 * old single JSON "Order details" cell. Columns are assigned in
 * first-appearance order across the leads seen (per lead, in
 * publicLeadExtraEntries order), which lets a streaming export emit rows
 * before the full key set is known — new keys only ever append to the right.
 */
export function createLeadExtrasColumns(): LeadExtrasColumns {
	const columnByKey = new Map<string, number>();
	let overflowSeen = false;

	return {
		buildCells(extras) {
			const entries = publicLeadExtraEntries(extras);

			for (const [key] of entries) {
				if (
					!columnByKey.has(key) &&
					columnByKey.size < MAX_LEAD_EXTRA_COLUMNS
				) {
					columnByKey.set(key, columnByKey.size);
				}
			}

			// Unassigned keys only exist once the cap is hit; they share the one
			// overflow cell that sits right after the last real column.
			const overflow = entries.filter(([key]) => !columnByKey.has(key));
			const cells = new Array<string>(
				columnByKey.size + (overflow.length > 0 ? 1 : 0),
			).fill("");
			for (const [key, value] of entries) {
				const column = columnByKey.get(key);
				if (column !== undefined) {
					cells[column] = formatLeadExtraValue(value);
				}
			}

			if (overflow.length > 0) {
				overflowSeen = true;
				// Compact deterministic JSON; entry order comes pre-sorted from
				// publicLeadExtraEntries.
				cells[columnByKey.size] = `{${overflow
					.map(
						([key, value]) => `${JSON.stringify(key)}:${JSON.stringify(value)}`,
					)
					.join(",")}}`;
			}

			return cells;
		},
		hasOverflow() {
			return overflowSeen;
		},
		keys() {
			return [...columnByKey.keys()];
		},
	};
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
	archivedAt: isoDateTimeSchema.nullable(),
	// utm_campaign as the ad link carried it — names WHICH campaign brought
	// this order, next to source's WHERE. Defaulted for older servers.
	campaign: z.string().nullable().default(null),
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

const leadArchiveVisibilitySchema = z.enum(["exclude", "only", "include"]);

const leadListFilterFields = {
	archived: leadArchiveVisibilitySchema.default("exclude"),
	createdFrom: isoDateSchema.optional(),
	createdTo: isoDateSchema.optional(),
	q: z.string().trim().max(200).optional(),
	source: leadSourceSchema.optional(),
	status: leadStatusSchema.optional(),
} as const;

function createdRangeIsOrdered(query: {
	createdFrom?: string;
	createdTo?: string;
}): boolean {
	return (
		!query.createdFrom ||
		!query.createdTo ||
		query.createdFrom <= query.createdTo
	);
}

export const leadsQuerySchema = cursorPaginationQuerySchema
	.extend(leadListFilterFields)
	.refine(createdRangeIsOrdered, {
		message: "createdFrom must be on or before createdTo",
		path: ["createdFrom"],
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

// Dashboard-level aggregate list: every lead the caller's workspace can see,
// across all of its projects. Same search/status semantics as the per-project
// list, plus optional project and source narrowing. Source filtering runs in
// SQL against the stored attribution and mirrors the read-time derivation.
export const workspaceLeadsQuerySchema = cursorPaginationQuerySchema
	.extend({
		...leadListFilterFields,
		projectId: uuidSchema.optional(),
	})
	.refine(createdRangeIsOrdered, {
		message: "createdFrom must be on or before createdTo",
		path: ["createdFrom"],
	});

export type WorkspaceLeadsQuery = z.infer<typeof workspaceLeadsQuerySchema>;

// A lead row with its project attached — the aggregate table shows which
// page captured each order and links back to it.
export const workspaceLeadSchema = leadSchema.extend({
	projectId: uuidSchema,
	projectName: z.string(),
});

export type WorkspaceLead = z.infer<typeof workspaceLeadSchema>;

export const workspaceLeadsResponseSchema = z.object({
	leads: z.array(workspaceLeadSchema),
	nextCursor: z.string().nullable(),
	total: z.number().int().nonnegative(),
});

export type WorkspaceLeadsResponse = z.infer<
	typeof workspaceLeadsResponseSchema
>;

export const leadStatusUpdateBodySchema = z.object({
	status: leadStatusSchema,
});

export type LeadStatusUpdateBody = z.infer<typeof leadStatusUpdateBodySchema>;

export const leadArchiveBodySchema = z.object({
	archived: z.boolean(),
});

export type LeadArchiveBody = z.infer<typeof leadArchiveBodySchema>;

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
	// Aggregate list across every project the active workspace can see —
	// the dashboard Leads page. No project id in the path: the workspace
	// header (or its absence, for personal) is the only scope input.
	listForWorkspace: "/api/v1/leads",
	archive: (projectId: string, leadId: string) =>
		`/api/v1/projects/${projectId}/leads/${leadId}/archive`,
	updateStatus: (projectId: string, leadId: string) =>
		`/api/v1/projects/${projectId}/leads/${leadId}/status`,
} as const;
