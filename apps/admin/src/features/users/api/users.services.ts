import { adminRoutes } from "@wandit/contracts";

import { apiGet, apiPost } from "@/lib/api-client";

import type {
	AdminListUsersResponse,
	BetaEnrollUserInput,
	ChangeUserRoleInput,
	GrantUserCreditsInput,
	ListUsersParams,
	SetUserAccessInput,
	SetUserBannedInput,
	UserDetail,
} from "./users.dto";

export function listUsers(
	params: ListUsersParams,
): Promise<AdminListUsersResponse> {
	return apiGet<AdminListUsersResponse>(adminRoutes.users, {
		page: params.page,
		pageSize: params.pageSize,
		q: params.q || undefined,
		sort: params.sort,
	});
}

export function getUser(userId: string): Promise<UserDetail> {
	return apiGet<UserDetail>(adminRoutes.user(userId));
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

export function betaEnrollUser({
	userId,
	credits,
	reason,
	idempotencyKey,
}: BetaEnrollUserInput): Promise<UserDetail> {
	return apiPost<UserDetail>(adminRoutes.betaEnroll(userId), {
		credits,
		reason,
		idempotencyKey,
	});
}

export function changeUserRole({
	userId,
	role,
}: ChangeUserRoleInput): Promise<UserDetail> {
	return apiPost<UserDetail>(adminRoutes.setRole(userId), { role });
}

export function setUserAccess({
	userId,
	granted,
}: SetUserAccessInput): Promise<UserDetail> {
	return apiPost<UserDetail>(adminRoutes.setAccess(userId), { granted });
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
