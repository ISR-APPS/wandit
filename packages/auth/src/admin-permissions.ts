import {
	parseStoredRoles,
	type StaffRole,
	staffRoles,
} from "@wandit/contracts";
import { createAccessControl } from "better-auth/plugins/access";

// Admin-dashboard access control — the single source of truth for what each
// staff role may do. Shared by the Better Auth admin plugin (typing only), the
// NestJS AdminGuard (@AdminPermission) and the admin SPA (nav/actions).
// One resource per dashboard section; "read" opens the section, the other
// actions gate its mutations. Tweak a role by editing adminRoles below.
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

export const adminRoles = {
	admin: adminAccessControl.newRole(fullAdminStatements),
	support: adminAccessControl.newRole({
		overview: ["read"],
		users: ["read", "ban"],
		organizations: ["read"],
		billing: ["read"],
		publications: ["read"],
		feedback: ["read", "manage"],
		links: ["read"],
		academy: ["read"],
		// Deliberately absent: grant-credits / set-role (money + privilege),
		// affiliates, costs, analytics, settings (finance + product controls), and
		// conversations (customer transcript data).
	}),
} satisfies Record<StaffRole, ReturnType<typeof adminAccessControl.newRole>>;

export type AdminPermissionRequest = {
	[Resource in keyof typeof adminStatement]?: readonly (typeof adminStatement)[Resource][number][];
};

/** True when ANY stored role grants ALL requested actions (plugin semantics). */
export function adminRoleHasPermission(
	roleValue: string | null | undefined,
	permissions: AdminPermissionRequest,
): boolean {
	return parseStoredRoles(roleValue).some((roleName) => {
		if (!staffRoles.includes(roleName as StaffRole)) return false;

		const role = adminRoles[roleName as StaffRole];
		return role.authorize(permissions).success;
	});
}
