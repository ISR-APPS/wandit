import { useQuery } from "@tanstack/react-query";

import { getConnectors } from "./connectors.requests";

export const connectorKeys = {
	all: ["connectors"] as const,
	list: () => [...connectorKeys.all, "list"] as const,
};

export function useConnectors(options?: { enabled?: boolean }) {
	return useQuery({
		enabled: options?.enabled ?? true,
		queryFn: getConnectors,
		queryKey: connectorKeys.list(),
	});
}
