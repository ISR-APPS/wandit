/**
 * TanStack queries of the coding-agents feature. The consent page and the /coding-agents page read them.
 * They call coding-agents.services.ts. A grant belongs to the user, not to a workspace, so no key holds a workspace id.
 */
import { useQuery } from "@tanstack/react-query";

import { getPublicClient, listConnectedAgents } from "./coding-agents.services";

/** Query keys of this feature. `signOut` in the user menu clears the whole cache, so no key holds a user id. */
export const codingAgentKeys = {
	all: ["coding-agents"] as const,
	list: () => [...codingAgentKeys.all, "list"] as const,
	publicClient: (clientId: string) =>
		[...codingAgentKeys.all, "public-client", clientId] as const,
};

/** The connected agents of the signed-in user, for the /coding-agents page. */
export function useConnectedAgentsQuery() {
	return useQuery({
		queryKey: codingAgentKeys.list(),
		queryFn: listConnectedAgents,
	});
}

/** The public fields of the client that asks for consent. `clientId` is the `client_id` of the signed query. */
export function usePublicClientQuery(clientId: string) {
	return useQuery({
		queryKey: codingAgentKeys.publicClient(clientId),
		queryFn: () => getPublicClient(clientId),
	});
}
