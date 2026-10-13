/**
 * TanStack Query hooks and cache keys of the admin users feature.
 * The users pages, detail cards, and dialogs call the hooks. The hooks call users.services.ts.
 */
import { keepPreviousData, useQuery } from "@tanstack/react-query";

import type {
	ListUserPagesParams,
	ListUserProjectsParams,
	ListUsersParams,
} from "./users.dto";
import {
	getProjectVersionHtml,
	getUser,
	getUserRefundPreview,
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
	refundPreview: (userId: string) =>
		[...userKeys.detail(userId), "refund-preview"] as const,
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

/** The refund preview of a user. The refund dialog mounts it only while the dialog is open. */
export function useUserRefundPreviewQuery(userId: string) {
	return useQuery({
		queryKey: userKeys.refundPreview(userId),
		queryFn: () => getUserRefundPreview(userId),
		// Money: no cache. Each open starts in the loading state and shows the live Stripe amounts.
		staleTime: 0,
		gcTime: 0,
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
