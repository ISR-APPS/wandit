/**
 * TanStack Query hook and keys for the credit grant log.
 * The log page reads the hook. The user and organization grant mutations
 * invalidate creditGrantKeys.all so a new grant shows at once.
 */
import { keepPreviousData, useQuery } from "@tanstack/react-query";

import type { AdminListCreditGrantsQuery } from "./credit-grants.dto";
import { listCreditGrants } from "./credit-grants.services";

/** Query keys. The first element also tags Sentry reports for this feature. */
export const creditGrantKeys = {
	all: ["admin-credit-grants"] as const,
	list: (query: AdminListCreditGrantsQuery) =>
		[...creditGrantKeys.all, "list", query] as const,
};

/** Keeps the previous page on screen while the next page loads. */
export function useCreditGrantsQuery(query: AdminListCreditGrantsQuery) {
	return useQuery({
		queryKey: creditGrantKeys.list(query),
		queryFn: () => listCreditGrants(query),
		placeholderData: keepPreviousData,
	});
}
