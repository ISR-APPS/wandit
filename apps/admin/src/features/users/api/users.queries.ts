import { keepPreviousData, useQuery } from "@tanstack/react-query";

import type {
	ListUserPagesParams,
	ListUserProjectsParams,
	ListUsersParams,
} from "./users.dto";
import {
	getProjectVersionHtml,
	getUser,
	listUserPages,
	listUserProjects,
	listUsers,
} from "./users.services";

export const userKeys = {
	all: ["admin-users"] as const,
	lists: () => [...userKeys.all, "list"] as const,
	list: (params: ListUsersParams) => [...userKeys.lists(), params] as const,
	details: () => [...userKeys.all, "detail"] as const,
	detail: (userId: string) => [...userKeys.details(), userId] as const,
	pages: (userId: string) => [...userKeys.detail(userId), "pages"] as const,
	pageList: (params: ListUserPagesParams) =>
		[...userKeys.pages(params.userId), params] as const,
	projects: (userId: string) =>
		[...userKeys.detail(userId), "projects"] as const,
	projectList: (params: ListUserProjectsParams) =>
		[...userKeys.projects(params.userId), params] as const,
	versionHtml: (projectId: string, versionId: string) =>
		[
			...userKeys.all,
			"projects",
			projectId,
			"versions",
			versionId,
			"html",
		] as const,
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

export function useUserPagesQuery(params: ListUserPagesParams) {
	return useQuery({
		queryKey: userKeys.pageList(params),
		queryFn: () => listUserPages(params),
		placeholderData: keepPreviousData,
	});
}

export function useUserProjectsQuery(params: ListUserProjectsParams) {
	return useQuery({
		queryKey: userKeys.projectList(params),
		queryFn: () => listUserProjects(params),
		placeholderData: keepPreviousData,
	});
}

export function useProjectVersionHtmlQuery({
	projectId,
	versionId,
	enabled,
}: {
	projectId: string | undefined;
	versionId: string | undefined;
	enabled: boolean;
}) {
	return useQuery({
		queryKey: userKeys.versionHtml(projectId ?? "none", versionId ?? "none"),
		queryFn: () =>
			getProjectVersionHtml(projectId as string, versionId as string),
		enabled: enabled && Boolean(projectId && versionId),
	});
}
