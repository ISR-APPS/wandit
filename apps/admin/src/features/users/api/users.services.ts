import {
	adminProjectVersionHtmlResponseSchema,
	adminRoutes,
	adminUserPagesQuerySchema,
	adminUserPagesResponseSchema,
	adminUserProjectsQuerySchema,
	adminUserProjectsResponseSchema,
} from "@wandit/contracts";

import { apiGet, apiPost } from "@/lib/api-client";

import type {
	AdminListUsersResponse,
	AdminProjectVersionHtmlResponse,
	AdminUserPagesResponse,
	AdminUserProjectsResponse,
	ChangeUserRoleInput,
	GrantUserCreditsInput,
	ListUserPagesParams,
	ListUserProjectsParams,
	ListUsersParams,
	SetUserBannedInput,
	UserDetail,
} from "./users.dto";

function serializeMultiValueFilter(
	values: readonly string[] | undefined,
): string | undefined {
	return values && values.length > 0 ? values.join(",") : undefined;
}

export function listUsers(
	params: ListUsersParams,
): Promise<AdminListUsersResponse> {
	return apiGet<AdminListUsersResponse>(adminRoutes.users, {
		page: params.page,
		pageSize: params.pageSize,
		q: params.q || undefined,
		sort: params.sort,
		plan: serializeMultiValueFilter(params.plan),
		role: serializeMultiValueFilter(params.role),
		status: serializeMultiValueFilter(params.status),
		verified: serializeMultiValueFilter(params.verified),
		published: serializeMultiValueFilter(params.published),
		creditsUsedMin: params.creditsUsedMin,
		creditsUsedMax: params.creditsUsedMax,
	});
}

export function getUser(userId: string): Promise<UserDetail> {
	return apiGet<UserDetail>(adminRoutes.user(userId));
}

export async function listUserPages(
	params: ListUserPagesParams,
): Promise<AdminUserPagesResponse> {
	const query = adminUserPagesQuerySchema.parse({
		page: params.page,
		pageSize: params.pageSize,
		sort: params.sort,
	});
	const payload = await apiGet<unknown>(adminRoutes.userPages(params.userId), {
		page: query.page,
		pageSize: query.pageSize,
		sort: query.sort,
	});

	return adminUserPagesResponseSchema.parse(payload);
}

export async function listUserProjects(
	params: ListUserProjectsParams,
): Promise<AdminUserProjectsResponse> {
	const query = adminUserProjectsQuerySchema.parse({
		page: params.page,
		pageSize: params.pageSize,
		sort: params.sort,
	});
	const payload = await apiGet<unknown>(
		adminRoutes.userProjects(params.userId),
		{
			page: query.page,
			pageSize: query.pageSize,
			sort: query.sort,
		},
	);

	return adminUserProjectsResponseSchema.parse(payload);
}

export async function getProjectVersionHtml(
	projectId: string,
	versionId: string,
): Promise<AdminProjectVersionHtmlResponse> {
	const payload = await apiGet<unknown>(
		adminRoutes.projectVersionHtml(projectId, versionId),
	);

	return adminProjectVersionHtmlResponseSchema.parse(payload);
}

export function grantUserCredits({
	userId,
	amount,
	reason,
	requestId,
}: GrantUserCreditsInput): Promise<UserDetail> {
	return apiPost<UserDetail>(adminRoutes.grantCredits(userId), {
		amount,
		reason,
		requestId,
	});
}

export function changeUserRole({
	userId,
	role,
}: ChangeUserRoleInput): Promise<UserDetail> {
	return apiPost<UserDetail>(adminRoutes.setRole(userId), { role });
}

export function setUserBanned({
	userId,
	banned,
	reason,
}: SetUserBannedInput): Promise<UserDetail> {
	return apiPost<UserDetail>(adminRoutes.setBanned(userId), {
		banned,
		reason,
	});
}
