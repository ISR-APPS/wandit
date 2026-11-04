/**
 * HTTP calls of the admin organizations feature.
 * The queries and mutations files call these functions.
 * They send requests to the `adminRoutes` organization routes through the api-client helpers.
 */
import { adminRoutes } from "@wandit/contracts";

import { apiGet, apiPatch, apiPost } from "@/lib/api-client";

import type {
	AdminListOrganizationsResponse,
	GrantOrganizationCreditsInput,
	ListOrganizationsParams,
	OrganizationDetail,
	SetOrganizationMemberRoleInput,
} from "./organizations.dto";

/** An empty q goes as undefined, so the server applies no search. kind selects team or personal workspaces. */
export function listOrganizations(
	params: ListOrganizationsParams,
): Promise<AdminListOrganizationsResponse> {
	return apiGet<AdminListOrganizationsResponse>(adminRoutes.organizations, {
		page: params.page,
		pageSize: params.pageSize,
		q: params.q || undefined,
		sort: params.sort,
		kind: params.kind,
	});
}

export function getOrganization(
	organizationId: string,
): Promise<OrganizationDetail> {
	return apiGet<OrganizationDetail>(adminRoutes.organization(organizationId));
}

export function grantOrganizationCredits({
	organizationId,
	amount,
	reason,
	requestId,
}: GrantOrganizationCreditsInput): Promise<OrganizationDetail> {
	return apiPost<OrganizationDetail>(
		adminRoutes.organizationGrantCredits(organizationId),
		{ amount, reason, requestId },
	);
}

export function setOrganizationMemberRole({
	organizationId,
	userId,
	role,
}: SetOrganizationMemberRoleInput): Promise<OrganizationDetail> {
	return apiPatch<OrganizationDetail>(
		adminRoutes.organizationSetMemberRole(organizationId, userId),
		{ role },
	);
}
