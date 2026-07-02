import { z } from "zod";

// Leads & Order CRM contracts (docs/features/leads-crm.md). Structural stub —
// schemas land with the feature slice. Phones cross the wire in canonical
// E.164 (+213…); the capture endpoint normalizes raw form input before insert.

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

// Draft route map — finalize with the feature slice.
export const leadsRoutes = {
	// Public endpoint the published page's form posts to — rate-limited +
	// honeypot, addressed by the project's unguessable publicFormId. Lives in
	// the /api/public namespace (docs/features/leads-crm.md), deliberately
	// outside the authenticated /api/v1 space: this exact URL is baked into
	// published pages by the generation system prompt.
	capture: (publicFormId: string) => `/api/public/leads/${publicFormId}`,
	listByProject: (projectId: string) => `/api/v1/projects/${projectId}/leads`,
	updateStatus: (projectId: string, leadId: string) =>
		`/api/v1/projects/${projectId}/leads/${leadId}/status`,
	exportCsv: (projectId: string) =>
		`/api/v1/projects/${projectId}/leads/export`,
} as const;
