/**
 * HTTP calls for project invitations that the signed-in user received.
 * The invitations banner reads the list. The routes use the session email, not the workspace header.
 */
import {
	type ListReceivedProjectInvitationsResponse,
	listReceivedProjectInvitationsResponseSchema,
	projectSharingRoutes,
} from "@wandit/contracts";

import { apiClient } from "@/lib/api-client";

/** Pending project invitations to the caller's verified email. Each one has a server-computed `expired`. */
export async function listReceivedProjectInvitations(): Promise<ListReceivedProjectInvitationsResponse> {
	const payload = await apiClient.get(projectSharingRoutes.receivedInvitations);

	return listReceivedProjectInvitationsResponseSchema.parse(payload);
}
