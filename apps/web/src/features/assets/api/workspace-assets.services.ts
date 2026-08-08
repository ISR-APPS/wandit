// Raw async functions for the dashboard Assets page — NO React in here.
// Responses are parsed with the @wandit/contracts Zod schemas at this
// boundary.

import {
	projectAssetsRoutes,
	type WorkspaceAssetsResponse,
	workspaceAssetsResponseSchema,
} from "@wandit/contracts";

import { apiClient } from "@/lib/api-client";

/**
 * The newest media across every project the active workspace can see,
 * with each asset's project attached. Capped server-side (`truncated`).
 */
export async function listWorkspaceAssets(): Promise<WorkspaceAssetsResponse> {
	const data = await apiClient.get<unknown>(
		projectAssetsRoutes.listForWorkspace,
	);
	return workspaceAssetsResponseSchema.parse(data);
}
