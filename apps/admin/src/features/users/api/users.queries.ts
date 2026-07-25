import { useQuery } from "@tanstack/react-query";

import { getUser, listUsers } from "./users.services";

export const userKeys = {
	all: ["admin-users"] as const,
	lists: () => [...userKeys.all, "list"] as const,
	list: () => [...userKeys.lists()] as const,
	details: () => [...userKeys.all, "detail"] as const,
	detail: (userId: string) => [...userKeys.details(), userId] as const,
};

export function useUsersQuery() {
	return useQuery({
		queryKey: userKeys.list(),
		queryFn: listUsers,
	});
}

export function useUserQuery(userId: string | undefined) {
	return useQuery({
		queryKey: userKeys.detail(userId ?? "none"),
		queryFn: () => getUser(userId as string),
		enabled: Boolean(userId),
	});
}
