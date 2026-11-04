/**
 * TanStack Query layer for project invitations that the signed-in user received.
 * The invitations banner reads it. The key has no workspace segment: the list is the same in every workspace.
 */
import { useQuery } from "@tanstack/react-query";

import { listReceivedProjectInvitations } from "./project-invitations.services";

/**
 * Query keys of received project invitations. The feature barrel exports them:
 * the `/project-invite` page invalidates `received()` after an accept or a decline.
 */
export const projectInvitationsKeys = {
	all: ["project-invitations"] as const,
	received: () => [...projectInvitationsKeys.all, "received"] as const,
};

/** Pending project invitations of the signed-in user, for the invitations banner. */
export function useReceivedProjectInvitationsQuery(
	options: { enabled?: boolean } = {},
) {
	return useQuery({
		queryKey: projectInvitationsKeys.received(),
		queryFn: listReceivedProjectInvitations,
		enabled: options.enabled ?? true,
	});
}
