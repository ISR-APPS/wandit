// The admin users feature consumes the shared API contract directly. These
// re-exports (plus thin aliases) are the only user types feature code should
// import — the contract in @wandit/contracts is the source of truth.
import type {
	AdminCreditLedgerEntry,
	AdminGrantCreditsInput,
	AdminListUsersQuery,
	AdminListUsersResponse,
	AdminProjectVersionHtmlResponse,
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
} from "@wandit/contracts";

export type {
	AdminCreditLedgerEntry,
	AdminGrantCreditsInput,
	AdminListUsersResponse,
	AdminProjectVersionHtmlResponse,
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

export type AdminListUsersSort = AdminListUsersQuery["sort"];
export type UserCountryFilter = NonNullable<AdminListUsersQuery["country"]>;
export type UserFreeCreditsFilter = NonNullable<
	AdminListUsersQuery["freeCredits"]
>;
export type UserPlanFilter = NonNullable<AdminListUsersQuery["plan"]>;
export type UserRoleFilter = NonNullable<AdminListUsersQuery["role"]>;
export type UserStatusFilter = NonNullable<AdminListUsersQuery["status"]>;
export type UserVerifiedFilter = NonNullable<AdminListUsersQuery["verified"]>;
export type UserPublishedFilter = NonNullable<AdminListUsersQuery["published"]>;

/**
 * Inclusive net-credits-consumed range the toolbar filter edits as one unit.
 * An unset bound means unbounded on that side; a fully unset filter is
 * represented as `undefined`, never `{}`. Bounds are decimal credits — the
 * server converts to centi-credits; never scale them here.
 */
export type UserCreditsUsedRange = {
	min?: number;
	max?: number;
};

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
	country?: UserCountryFilter;
	freeCredits?: UserFreeCreditsFilter;
	plan?: UserPlanFilter;
	role?: UserRoleFilter;
	status?: UserStatusFilter;
	verified?: UserVerifiedFilter;
	published?: UserPublishedFilter;
	// Decimal credits (the server stores centi-credits and scales ×100).
	creditsUsedMin?: number;
	creditsUsedMax?: number;
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

// `amount` is decimal credits in 0.01 steps; the server converts to centi.
export type GrantUserCreditsInput = AdminGrantCreditsInput & {
	userId: string;
};

export type ChangeUserRoleInput = AdminSetRoleInput & {
	userId: string;
};

export type SetUserBannedInput = AdminSetBannedInput & {
	userId: string;
};
