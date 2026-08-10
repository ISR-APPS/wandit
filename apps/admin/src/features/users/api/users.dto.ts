// The admin users feature consumes the shared API contract directly. These
// re-exports (plus thin aliases) are the only user types feature code should
// import — the contract in @wandit/contracts is the source of truth.
import type {
	AdminBetaEnrollInput,
	AdminBulkSetAccessInput,
	AdminBulkSetAccessResult,
	AdminCreditLedgerEntry,
	AdminGrantCreditsInput,
	AdminListUsersResponse,
	AdminProjectVersionHtmlResponse,
	AdminSetAccessInput,
	AdminSetBannedInput,
	AdminSetRoleInput,
	AdminUserDetail,
	AdminUserPage,
	AdminUserPagesResponse,
	AdminUserPagesSort,
	AdminUserPlan,
	AdminUserProject,
	AdminUserProjectsResponse,
	AdminUserProjectsSort,
	AdminUserRole,
	AdminUserSubscription,
	AdminUserSummary,
	adminListUsersSorts,
	CreditBalanceResponse,
	CreditBucket,
} from "@wandit/contracts";

export type {
	AdminBetaEnrollInput,
	AdminBulkSetAccessInput,
	AdminBulkSetAccessResult,
	AdminCreditLedgerEntry,
	AdminGrantCreditsInput,
	AdminListUsersResponse,
	AdminProjectVersionHtmlResponse,
	AdminSetAccessInput,
	AdminSetBannedInput,
	AdminSetRoleInput,
	AdminUserDetail,
	AdminUserPage,
	AdminUserPagesResponse,
	AdminUserPagesSort,
	AdminUserPlan,
	AdminUserProject,
	AdminUserProjectsResponse,
	AdminUserProjectsSort,
	AdminUserRole,
	AdminUserSubscription,
	AdminUserSummary,
	CreditBalanceResponse,
	CreditBucket,
};

export type AdminListUsersSort = (typeof adminListUsersSorts)[number];

// Thin aliases so component imports stay tidy.
export type UserSummary = AdminUserSummary;
export type UserDetail = AdminUserDetail;
export type UserRole = AdminUserRole;
export type UserPlan = AdminUserPlan;
export type UserSubscription = AdminUserSubscription;
export type UserProject = AdminUserProject;
export type UserProjectsResponse = AdminUserProjectsResponse;
export type CreditLedgerEntry = AdminCreditLedgerEntry;
export type UserLandingPage = AdminUserPage;
export type UserLandingPagesResponse = AdminUserPagesResponse;

/** Query params the users list UI sends to GET /api/v1/admin/users. */
export type ListUsersParams = {
	page: number;
	pageSize: number;
	q?: string;
	sort: AdminListUsersSort;
};

/** Query params for one user's server-paginated landing pages. */
export type ListUserPagesParams = {
	userId: string;
	page: number;
	pageSize: number;
	sort: AdminUserPagesSort;
};

/** Query params for one user's server-paginated projects. */
export type ListUserProjectsParams = {
	userId: string;
	page: number;
	pageSize: number;
	sort: AdminUserProjectsSort;
};

export type GrantUserCreditsInput = AdminGrantCreditsInput & {
	userId: string;
};

export type BetaEnrollUserInput = AdminBetaEnrollInput & {
	userId: string;
};

export type ChangeUserRoleInput = AdminSetRoleInput & {
	userId: string;
};

export type SetUserAccessInput = AdminSetAccessInput & {
	userId: string;
};

export type BulkSetUserAccessInput = AdminBulkSetAccessInput;
export type BulkSetUserAccessResult = AdminBulkSetAccessResult;

export type SetUserBannedInput = AdminSetBannedInput & {
	userId: string;
};
