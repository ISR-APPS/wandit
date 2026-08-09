import { keepPreviousData, useQuery } from "@tanstack/react-query";

import type { ListOrganizationsParams } from "./organizations.dto";
import { getOrganization, listOrganizations } from "./organizations.services";

export const organizationKeys = {
	all: ["admin-organizations"] as const,
	lists: () => [...organizationKeys.all, "list"] as const,
	list: (params: ListOrganizationsParams) =>
		[...organizationKeys.lists(), params] as const,
	details: () => [...organizationKeys.all, "detail"] as const,
	detail: (organizationId: string) =>
		[...organizationKeys.details(), organizationId] as const,
};

export function useOrganizationsQuery(params: ListOrganizationsParams) {
	return useQuery({
		queryKey: organizationKeys.list(params),
		queryFn: () => listOrganizations(params),
		placeholderData: keepPreviousData,
	});
}

export function useOrganizationQuery(organizationId: string | undefined) {
	return useQuery({
		queryKey: organizationKeys.detail(organizationId ?? "none"),
		queryFn: () => getOrganization(organizationId as string),
		enabled: Boolean(organizationId),
	});
}
