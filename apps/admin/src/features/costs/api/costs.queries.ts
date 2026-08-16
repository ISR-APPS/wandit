import { useQuery } from "@tanstack/react-query";
import type { ListMonthlyCostsQuery } from "@wandit/contracts";
import { listMonthlyCostsQuerySchema } from "@wandit/contracts";

import {
	listMonthlyCosts,
	type MonthlyCostsQueryInput,
} from "./costs.services";

function monthlyCostsRangeKey(query: MonthlyCostsQueryInput = {}) {
	const parsed = listMonthlyCostsQuerySchema.parse(query);

	return [parsed.fromMonth ?? null, parsed.toMonth ?? null] as const;
}

export const monthlyCostsKeys = {
	all: ["admin-costs"] as const,
	lists: () => [...monthlyCostsKeys.all, "list"] as const,
	list: (query: MonthlyCostsQueryInput = {}) =>
		[...monthlyCostsKeys.lists(), ...monthlyCostsRangeKey(query)] as const,
};

export function useMonthlyCostsQuery(
	query: Partial<ListMonthlyCostsQuery> = {},
) {
	return useQuery({
		queryKey: monthlyCostsKeys.list(query),
		queryFn: () => listMonthlyCosts(query),
	});
}
