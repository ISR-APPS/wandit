// Raw async functions for the dashboard Leads page — NO React in here.
// Responses are parsed with the @wandit/contracts Zod schemas at this
// boundary so a drifted server payload fails loudly here instead of as
// undefined in a table row.

import {
	leadsRoutes,
	type WorkspaceLead,
	type WorkspaceLeadsQuery,
	type WorkspaceLeadsResponse,
	workspaceLeadsResponseSchema,
} from "@wandit/contracts";

import { apiClient } from "@/lib/api-client";

// The pageSize maximum of cursorPaginationQuerySchema. Fewer requests per export.
const EXPORT_PAGE_SIZE = 100;

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

/**
 * Every lead of the active workspace that matches `query`, for the CSV export
 * of the dashboard Leads page. It reads all keyset pages in order. A repeated
 * cursor throws, so a server bug cannot loop forever or give a partial export.
 */
export async function listAllWorkspaceLeads(
	query: Omit<WorkspaceLeadsQuery, "cursor" | "pageSize">,
): Promise<WorkspaceLead[]> {
	// LIMIT: all rows load into browser memory before the CSV is built. Upgrade: a streamed CSV route on the API.
	const leads: WorkspaceLead[] = [];
	const seenCursors = new Set<string>();
	let cursor: string | undefined;

	do {
		const page = await listWorkspaceLeads({
			...query,
			cursor,
			pageSize: EXPORT_PAGE_SIZE,
		});
		leads.push(...page.leads);

		const nextCursor = page.nextCursor ?? undefined;
		if (!nextCursor) break;
		if (seenCursors.has(nextCursor)) {
			throw new Error(
				"The workspace leads endpoint returned a repeated cursor",
			);
		}
		seenCursors.add(nextCursor);
		cursor = nextCursor;
	} while (cursor);

	return leads;
}
