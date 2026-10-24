/**
 * HTTP calls of the admin users feature: list, detail, pages, projects, and staff actions.
 * The query and mutation hooks in this folder call them. They call the admin API through api-client.
 */
import {
	adminProjectVersionHtmlResponseSchema,
	adminRoutes,
	adminUserPagesQuerySchema,
	adminUserPagesResponseSchema,
	adminUserProjectsQuerySchema,
	adminUserProjectsResponseSchema,
	adminUserRefundInputSchema,
	adminUserRefundPreviewSchema,
	adminUserRefundResultSchema,
} from "@wandit/contracts";

import { apiGet, apiPost, apiPut } from "@/lib/api-client";

import type {
	AdminListUsersResponse,
	AdminProjectVersionHtmlResponse,
	AdminUserPagesResponse,
	AdminUserProjectsResponse,
	AdminUserRefundPreview,
	AdminUserRefundResult,
	ChangeUserRoleInput,
	GrantUserCreditsInput,
	ListUserPagesParams,
	ListUserProjectsParams,
	ListUsersParams,
	RefundUserInput,
	SetUserAdminViewsInput,
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
		country: serializeMultiValueFilter(params.country),
		freeCredits: serializeMultiValueFilter(params.freeCredits),
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
	...input
}: ChangeUserRoleInput): Promise<UserDetail> {
	return apiPost<UserDetail>(adminRoutes.setRole(userId), input);
}

export function setUserAdminViews({
	userId,
	views,
}: SetUserAdminViewsInput): Promise<UserDetail> {
	return apiPut<UserDetail>(adminRoutes.userAdminViews(userId), { views });
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

/** Reads the last Stripe plan payment of a user, with live Stripe amounts. Needs billing:manage. */
export async function getUserRefundPreview(
	userId: string,
): Promise<AdminUserRefundPreview> {
	const payload = await apiGet<unknown>(adminRoutes.userRefund(userId));

	return adminUserRefundPreviewSchema.parse(payload);
}

/** Refunds that payment through Stripe and cancels the Stripe plan now. A repeated call refunds once. */
export async function refundUser({
	userId,
	stripeInvoiceId,
}: RefundUserInput): Promise<AdminUserRefundResult> {
	const payload = await apiPost<unknown>(
		adminRoutes.userRefund(userId),
		adminUserRefundInputSchema.parse({ stripeInvoiceId }),
	);

	return adminUserRefundResultSchema.parse(payload);
}
