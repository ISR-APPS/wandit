// Raw async functions for the dashboard Leads page — NO React in here.
// Responses are parsed with the @wandit/contracts Zod schemas at this
// boundary so a drifted server payload fails loudly here instead of as
// undefined in a table row.

import {
	leadsRoutes,
	type WorkspaceLeadsQuery,
	type WorkspaceLeadsResponse,
	workspaceLeadsResponseSchema,
} from "@wandit/contracts";

import { apiClient } from "@/lib/api-client";

/**
 * One keyset page of leads across every project the active workspace can
 * see, newest first. Scope travels in the workspace header the client
 * attaches to every request.
 */
export async function listWorkspaceLeads(
	query: WorkspaceLeadsQuery,
): Promise<WorkspaceLeadsResponse> {
	const data = await apiClient.get<unknown>(leadsRoutes.listForWorkspace, {
		query: {
			archived: query.archived,
			cursor: query.cursor,
			createdFrom: query.createdFrom,
			createdTo: query.createdTo,
			pageSize: query.pageSize,
			projectId: query.projectId,
			q: query.q,
			source: query.source,
			status: query.status,
		},
	});
	return workspaceLeadsResponseSchema.parse(data);
}
