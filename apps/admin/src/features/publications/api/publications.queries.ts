import { keepPreviousData, useQuery } from "@tanstack/react-query";

import type { ListPublicationsParams } from "./publications.dto";
import { listPublications } from "./publications.services";

export const publicationKeys = {
	all: ["admin-publications"] as const,
	lists: () => [...publicationKeys.all, "list"] as const,
	list: (params: ListPublicationsParams) =>
		[...publicationKeys.lists(), params] as const,
};

export function usePublicationsQuery(params: ListPublicationsParams) {
	return useQuery({
		queryKey: publicationKeys.list(params),
		queryFn: () => listPublications(params),
		placeholderData: keepPreviousData,
	});
}
