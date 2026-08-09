import { keepPreviousData, useQuery } from "@tanstack/react-query";

import type { ListAdminProjectVersionsParams } from "./projects.dto";
import {
	getAdminProject,
	getAdminProjectVersionHtml,
	listAdminProjectVersions,
} from "./projects.services";

export const adminProjectKeys = {
	all: ["admin-project"] as const,
	detail: (projectId: string) => [...adminProjectKeys.all, projectId] as const,
	versions: (projectId: string) =>
		[...adminProjectKeys.detail(projectId), "versions"] as const,
	versionList: (params: ListAdminProjectVersionsParams) =>
		[
			...adminProjectKeys.versions(params.projectId),
			{ page: params.page, pageSize: params.pageSize },
		] as const,
	versionHtml: (projectId: string, versionId: string) =>
		[...adminProjectKeys.versions(projectId), versionId, "html"] as const,
};

export function useAdminProjectQuery(projectId: string | undefined) {
	return useQuery({
		queryKey: adminProjectKeys.detail(projectId ?? "none"),
		queryFn: () => getAdminProject(projectId as string),
		enabled: Boolean(projectId),
	});
}

export function useAdminProjectVersionsQuery(
	params: ListAdminProjectVersionsParams,
) {
	return useQuery({
		queryKey: adminProjectKeys.versionList(params),
		queryFn: () => listAdminProjectVersions(params),
		placeholderData: keepPreviousData,
	});
}

export function useAdminProjectVersionHtmlQuery({
	projectId,
	versionId,
	enabled,
}: {
	projectId: string | undefined;
	versionId: string | undefined;
	enabled: boolean;
}) {
	return useQuery({
		queryKey: adminProjectKeys.versionHtml(
			projectId ?? "none",
			versionId ?? "none",
		),
		queryFn: () =>
			getAdminProjectVersionHtml(projectId as string, versionId as string),
		enabled: enabled && Boolean(projectId && versionId),
		staleTime: Number.POSITIVE_INFINITY,
	});
}
