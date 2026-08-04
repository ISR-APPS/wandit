// HTTP calls for team workspaces. The list endpoint is personal-scope
// callable and returns every org the user belongs to plus their role(s);
// member limits are org-scoped (the workspace header selects which org).
import {
	type ListWorkspacesResponse,
	listWorkspacesResponseSchema,
	type PutWorkspaceMemberLimitsBody,
	type WorkspaceMemberLimitsResponse,
	workspaceMemberLimitsResponseSchema,
	workspacesRoutes,
} from "@wandit/contracts";

import { apiClient } from "@/lib/api-client";

export async function listWorkspaces(): Promise<ListWorkspacesResponse> {
	const payload = await apiClient.get(workspacesRoutes.list);

	return listWorkspacesResponseSchema.parse(payload);
}

export async function getWorkspaceMemberLimits(): Promise<WorkspaceMemberLimitsResponse> {
	const payload = await apiClient.get(workspacesRoutes.memberLimits);

	return workspaceMemberLimitsResponseSchema.parse(payload);
}

export async function putWorkspaceMemberLimits(
	body: PutWorkspaceMemberLimitsBody,
): Promise<WorkspaceMemberLimitsResponse> {
	const payload = await apiClient.put(workspacesRoutes.memberLimits, body);

	return workspaceMemberLimitsResponseSchema.parse(payload);
}
