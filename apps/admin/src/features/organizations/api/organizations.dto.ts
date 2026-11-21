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
	AdminStarterPass,
	AdminStarterPassBody,
	AdminWorkspaceRole,
	adminListOrganizationsSorts,
	WorkspaceKind,
} from "@wandit/contracts";
import type { StarterPassAction } from "@/features/users";

export type {
	AdminGrantCreditsInput,
	AdminListOrganizationsResponse,
	AdminOrganizationDetail,
	AdminOrganizationLedgerEntry,
	AdminOrganizationMember,
	AdminOrganizationSubscription,
	AdminOrganizationSummary,
	AdminSetMemberRoleInput,
	AdminStarterPass,
	AdminWorkspaceRole,
	WorkspaceKind,
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
	/** `team` by default. `personal` lists the one personal workspace that each user has. */
	kind: WorkspaceKind;
};

export type GrantOrganizationCreditsInput = AdminGrantCreditsInput & {
	organizationId: string;
};

export type SetOrganizationMemberRoleInput = AdminSetMemberRoleInput & {
	organizationId: string;
	userId: string;
};

/** Staff change of the Starter pass of the team pool. Grant gives a pass, revoke ends the live pass. */
export type ChangeOrganizationStarterPassInput = AdminStarterPassBody & {
	organizationId: string;
	action: StarterPassAction;
};
