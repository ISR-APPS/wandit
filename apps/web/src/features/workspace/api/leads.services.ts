// Raw async functions for the leads entity — NO React in here. Responses are
// parsed with the @wandit/contracts Zod schemas at this boundary so a drifted
// server payload fails loudly here instead of as undefined in a table row.

import {
	type Lead,
	type LeadStatus,
	type LeadStatusUpdateBody,
	leadResponseSchema,
	leadsResponseSchema,
	leadsRoutes,
} from "@wandit/contracts";

import { apiClient } from "@/lib/api-client";

/** Every lead of one owned project, newest first (server-ordered). */
export async function listLeads(projectId: string): Promise<Lead[]> {
	const data = await apiClient.get<unknown>(
		leadsRoutes.listByProject(projectId),
	);
	return leadsResponseSchema.parse(data).leads;
}

/** Move one lead through the COD pipeline; returns the updated row. */
export async function updateLeadStatus(
	projectId: string,
	leadId: string,
	status: LeadStatus,
): Promise<Lead> {
	const data = await apiClient.patch<unknown, LeadStatusUpdateBody>(
		leadsRoutes.updateStatus(projectId, leadId),
		{ status },
	);
	return leadResponseSchema.parse(data).lead;
}
