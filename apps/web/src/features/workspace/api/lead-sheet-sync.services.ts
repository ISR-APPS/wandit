// Raw async functions for the Google Sheets lead sync — NO React in here.
// Responses are parsed with the @wandit/contracts Zod schemas at this
// boundary so a drifted server payload fails loudly here instead of as
// undefined in the Leads tab header button.

import {
	type LeadSheetSyncState,
	leadSheetSyncRoutes,
	leadSheetSyncStateSchema,
} from "@wandit/contracts";

import { apiClient } from "@/lib/api-client";

/** Google connection + sheet state driving the Leads tab sync button. */
export async function getSheetSyncState(
	projectId: string,
): Promise<LeadSheetSyncState> {
	const data = await apiClient.get<unknown>(
		leadSheetSyncRoutes.state(projectId),
	);
	return leadSheetSyncStateSchema.parse(data);
}

/** Create the sheet if needed, then full rewrite with all current leads. */
export async function syncSheetNow(
	projectId: string,
): Promise<LeadSheetSyncState> {
	const data = await apiClient.post<unknown>(
		leadSheetSyncRoutes.syncNow(projectId),
	);
	return leadSheetSyncStateSchema.parse(data);
}
