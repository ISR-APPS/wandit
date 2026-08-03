// The admin organizations feature consumes the shared API contract directly.
// These re-exports (plus thin aliases) are the only org types feature code
// should import — @wandit/contracts is the source of truth.
import type {
	AdminGrantCreditsInput,
	AdminListOrganizationsResponse,
	AdminOrganizationDetail,
	AdminOrganizationLedgerEntry,
	AdminOrganizationMember,
	AdminOrganizationSubscription,
	AdminOrganizationSummary,
	AdminSetMemberRoleInput,
	AdminWorkspaceRole,
	adminListOrganizationsSorts,
} from "@wandit/contracts";

export type {
	AdminGrantCreditsInput,
	AdminListOrganizationsResponse,
	AdminOrganizationDetail,
	AdminOrganizationLedgerEntry,
	AdminOrganizationMember,
	AdminOrganizationSubscription,
	AdminOrganizationSummary,
	AdminSetMemberRoleInput,
	AdminWorkspaceRole,
};

export type AdminListOrganizationsSort =
	(typeof adminListOrganizationsSorts)[number];

export type OrganizationSummary = AdminOrganizationSummary;
export type OrganizationDetail = AdminOrganizationDetail;
export type OrganizationMember = AdminOrganizationMember;

/** Query params the organizations list UI sends. */
export type ListOrganizationsParams = {
	page: number;
	pageSize: number;
	q?: string;
	sort: AdminListOrganizationsSort;
};

export type GrantOrganizationCreditsInput = AdminGrantCreditsInput & {
	organizationId: string;
};

export type SetOrganizationMemberRoleInput = AdminSetMemberRoleInput & {
	organizationId: string;
	userId: string;
};
