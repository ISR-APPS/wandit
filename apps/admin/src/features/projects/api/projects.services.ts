import {
	adminProjectVersionHtmlResponseSchema,
	adminProjectVersionsQuerySchema,
	adminProjectVersionsResponseSchema,
	adminRoutes,
} from "@wandit/contracts";

import { apiGet } from "@/lib/api-client";

import type {
	AdminProjectDetail,
	AdminProjectVersionHtmlResponse,
	AdminProjectVersionsResponse,
	ListAdminProjectVersionsParams,
} from "./projects.dto";

export function getAdminProject(
	projectId: string,
): Promise<AdminProjectDetail> {
	return apiGet<AdminProjectDetail>(adminRoutes.project(projectId));
}

export async function listAdminProjectVersions(
	params: ListAdminProjectVersionsParams,
): Promise<AdminProjectVersionsResponse> {
	const query = adminProjectVersionsQuerySchema.parse({
		page: params.page,
		pageSize: params.pageSize,
	});
	const payload = await apiGet<unknown>(
		adminRoutes.projectVersions(params.projectId),
		query,
	);

	return adminProjectVersionsResponseSchema.parse(payload);
}

export async function getAdminProjectVersionHtml(
	projectId: string,
	versionId: string,
): Promise<AdminProjectVersionHtmlResponse> {
	const payload = await apiGet<unknown>(
		adminRoutes.projectVersionHtml(projectId, versionId),
	);

	return adminProjectVersionHtmlResponseSchema.parse(payload);
}
