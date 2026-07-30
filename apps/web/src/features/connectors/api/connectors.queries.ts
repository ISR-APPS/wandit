import { useQuery } from "@tanstack/react-query";

import { listConnectors } from "./connectors.services";

export const connectorKeys = {
	all: ["mcp-connectors"] as const,
	list: () => [...connectorKeys.all, "list"] as const,
};

export function useConnectorsQuery({ enabled }: { enabled: boolean }) {
	return useQuery({
		queryKey: connectorKeys.list(),
		queryFn: listConnectors,
		enabled,
		refetchOnWindowFocus: true,
	});
}
