// The admin users feature consumes the shared API contract directly. These
// re-exports (plus thin aliases) are the only user types feature code should
// import — the contract in @wandit/contracts is the source of truth.
import type {
	AdminCreditLedgerEntry,
	AdminGrantCreditsInput,
	AdminListUsersResponse,
	AdminSetBannedInput,
	AdminSetRoleInput,
	AdminUserDetail,
	AdminUserPlan,
	AdminUserProject,
	AdminUserRole,
	AdminUserSubscription,
	AdminUserSummary,
	adminListUsersSorts,
} from "@wandit/contracts";

export type {
	AdminCreditLedgerEntry,
	AdminGrantCreditsInput,
	AdminListUsersResponse,
	AdminSetBannedInput,
	AdminSetRoleInput,
	AdminUserDetail,
	AdminUserPlan,
	AdminUserProject,
	AdminUserRole,
	AdminUserSubscription,
	AdminUserSummary,
};

export type AdminListUsersSort = (typeof adminListUsersSorts)[number];

// Thin aliases so component imports stay tidy.
export type UserSummary = AdminUserSummary;
export type UserDetail = AdminUserDetail;
export type UserRole = AdminUserRole;
export type UserPlan = AdminUserPlan;
export type UserSubscription = AdminUserSubscription;
export type UserProject = AdminUserProject;
export type CreditLedgerEntry = AdminCreditLedgerEntry;

/** Query params the users list UI sends to GET /api/v1/admin/users. */
export type ListUsersParams = {
	page: number;
	pageSize: number;
	q?: string;
	sort: AdminListUsersSort;
};

export type GrantUserCreditsInput = AdminGrantCreditsInput & {
	userId: string;
};

export type ChangeUserRoleInput = AdminSetRoleInput & {
	userId: string;
};

export type SetUserBannedInput = AdminSetBannedInput & {
	userId: string;
};
