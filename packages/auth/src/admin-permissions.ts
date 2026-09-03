import { parseStoredRoles, type StaffRole } from "@wandit/contracts";
import { createAccessControl } from "better-auth/plugins/access";

// Admin-dashboard access control — the single source of truth for what each
// staff role may do. Shared by the Better Auth admin plugin (typing only), the
// NestJS AdminGuard (@AdminPermission) and the admin SPA (nav/actions).
// One resource per dashboard section; "read" opens the section, the other
// actions gate its mutations. Tweak supportViewActions/defaultSupportViews to
// change the per-view or default support policy.
export const adminStatement = {
	overview: ["read"],
	users: ["read", "grant-credits", "ban", "set-role"],
	organizations: ["read", "manage"],
	billing: ["read", "manage"],
	publications: ["read"],
	feedback: ["read", "manage"],
	affiliates: ["read", "manage"],
	links: ["read", "manage"],
	costs: ["read", "manage"],
	academy: ["read", "manage"],
	analytics: ["read", "manage"],
	conversations: ["read", "read-raw"],
	settings: ["read", "manage"],
} as const;

export const adminAccessControl = createAccessControl(adminStatement);

type CompleteAdminRoleStatements = {
	readonly [Resource in keyof typeof adminStatement]: readonly (typeof adminStatement)[Resource][number][];
};

export type AdminView = keyof typeof adminStatement;

export const adminViews = Object.keys(adminStatement) as AdminView[];

const fullAdminStatements = {
	overview: ["read"],
	users: ["read", "grant-credits", "ban", "set-role"],
	organizations: ["read", "manage"],
	billing: ["read", "manage"],
	publications: ["read"],
	feedback: ["read", "manage"],
	affiliates: ["read", "manage"],
	links: ["read", "manage"],
	costs: ["read", "manage"],
	academy: ["read", "manage"],
	analytics: ["read", "manage"],
	conversations: ["read", "read-raw"],
	settings: ["read", "manage"],
} as const satisfies CompleteAdminRoleStatements;

// Actions granted to support on each dashboard view when that view is enabled.
// Keep every statement resource explicit so adding a view fails type-checking
// until its safe support action subset is chosen deliberately.
export const supportViewActions = {
	overview: ["read"],
	users: ["read", "ban"],
	organizations: ["read"],
	billing: ["read"],
	publications: ["read"],
	feedback: ["read", "manage"],
	affiliates: ["read"],
	links: ["read"],
	costs: ["read"],
	academy: ["read"],
	analytics: ["read"],
	conversations: ["read"],
	settings: ["read"],
} as const satisfies CompleteAdminRoleStatements;

export const defaultSupportViews = [
	"overview",
	"users",
	"organizations",
	"billing",
	"publications",
	"feedback",
	"links",
	"academy",
] as const satisfies readonly AdminView[];

export type AdminPermissionRequest = {
	[Resource in keyof typeof adminStatement]?: readonly (typeof adminStatement)[Resource][number][];
};

/** Build the Better Auth statements for the known views in a support grant. */
export function supportStatementsForViews(
	views: readonly AdminView[],
): AdminPermissionRequest {
	const requestedViews = new Set<string>(views);

	return Object.fromEntries(
		adminViews
			.filter((view) => requestedViews.has(view))
			.map((view) => [view, supportViewActions[view]]),
	) as AdminPermissionRequest;
}

export const adminRoles = {
	admin: adminAccessControl.newRole(fullAdminStatements),
	support: adminAccessControl.newRole(
		supportStatementsForViews(defaultSupportViews),
	),
} satisfies Record<StaffRole, ReturnType<typeof adminAccessControl.newRole>>;

/** Effective Better Auth statements for a stored platform role and view grant. */
export function staffEffectiveStatements(
	roleValue: string,
	views: readonly AdminView[] | null,
): AdminPermissionRequest {
	const roleNames = parseStoredRoles(roleValue);
	if (roleNames.includes("admin")) return fullAdminStatements;
	if (roleNames.includes("support")) {
		return supportStatementsForViews(views ?? defaultSupportViews);
	}
	return {};
}

/**
 * True when any stored staff role grants every requested action.
 *
 * The authorization itself always flows through Better Auth's role engine;
 * per-user views only determine the statements used to construct that role.
 */
export function staffHasPermission(
	roleValue: string | null | undefined,
	views: readonly AdminView[] | null,
	required: AdminPermissionRequest,
): boolean {
	return parseStoredRoles(roleValue).some((roleName) => {
		if (roleName === "admin") {
			return adminRoles.admin.authorize(required).success;
		}
		if (roleName === "support") {
			return adminAccessControl
				.newRole(supportStatementsForViews(views ?? defaultSupportViews))
				.authorize(required).success;
		}
		return false;
	});
}

/** True when ANY stored role grants ALL requested actions (plugin semantics). */
export function adminRoleHasPermission(
	roleValue: string | null | undefined,
	permissions: AdminPermissionRequest,
): boolean {
	return staffHasPermission(roleValue, null, permissions);
}
