import { keepPreviousData, useQuery } from "@tanstack/react-query";

import type { ListUsersParams } from "./users.dto";
import { getUser, listUsers } from "./users.services";

export const userKeys = {
	all: ["admin-users"] as const,
	lists: () => [...userKeys.all, "list"] as const,
	list: (params: ListUsersParams) => [...userKeys.lists(), params] as const,
	details: () => [...userKeys.all, "detail"] as const,
	detail: (userId: string) => [...userKeys.details(), userId] as const,
};

export function useUsersQuery(params: ListUsersParams) {
	return useQuery({
		queryKey: userKeys.list(params),
		queryFn: () => listUsers(params),
		placeholderData: keepPreviousData,
	});
}

export function useUserQuery(userId: string | undefined) {
	return useQuery({
		queryKey: userKeys.detail(userId ?? "none"),
		queryFn: () => getUser(userId as string),
		enabled: Boolean(userId),
	});
}
