// Raw async functions for the leads entity — NO React in here. Responses are
// parsed with the @wandit/contracts Zod schemas at this boundary so a drifted
// server payload fails loudly here instead of as undefined in a table row.

import {
	type Lead,
	type LeadArchiveBody,
	type LeadStatus,
	type LeadStatusUpdateBody,
	type LeadsQuery,
	type LeadsResponse,
	leadResponseSchema,
	leadsResponseSchema,
	leadsRoutes,
} from "@wandit/contracts";

import { apiClient } from "@/lib/api-client";

/** One keyset page of an owned project's leads, newest first. */
export async function listLeads(
	projectId: string,
	query: LeadsQuery,
): Promise<LeadsResponse> {
	const data = await apiClient.get<unknown>(
		leadsRoutes.listByProject(projectId),
		{
			query: {
				archived: query.archived,
				cursor: query.cursor,
				createdFrom: query.createdFrom,
				createdTo: query.createdTo,
				pageSize: query.pageSize,
				q: query.q,
				source: query.source,
				status: query.status,
			},
		},
	);
	return leadsResponseSchema.parse(data);
}

type LeadExportQuery = Omit<LeadsQuery, "cursor" | "pageSize">;

/**
 * Fetch every row matching the active owner filters in bounded keyset pages.
 * A repeated cursor is treated as an invalid server response instead of
 * silently producing a partial export or looping forever.
 */
export async function listAllLeads(
	projectId: string,
	query: LeadExportQuery,
): Promise<Lead[]> {
	const leads: Lead[] = [];
	const seenCursors = new Set<string>();
	let cursor: string | undefined;

	do {
		const page = await listLeads(projectId, {
			...query,
			cursor,
			pageSize: 100,
		});
		leads.push(...page.leads);

		const nextCursor = page.nextCursor ?? undefined;
		if (!nextCursor) break;
		if (seenCursors.has(nextCursor)) {
			throw new Error("The leads endpoint returned a repeated cursor");
		}
		seenCursors.add(nextCursor);
		cursor = nextCursor;
	} while (cursor);

	return leads;
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

/** Archive or restore one owned-project lead; returns the updated row. */
export async function updateLeadArchive(
	projectId: string,
	leadId: string,
	archived: boolean,
): Promise<Lead> {
	const data = await apiClient.patch<unknown, LeadArchiveBody>(
		leadsRoutes.archive(projectId, leadId),
		{ archived },
	);
	return leadResponseSchema.parse(data).lead;
}
