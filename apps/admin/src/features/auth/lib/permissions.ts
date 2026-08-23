import {
	type AdminPermissionRequest,
	adminRoleHasPermission,
} from "@wandit/auth/admin-permissions";
import { normalizeStoredRole } from "@wandit/contracts";

import { useSession } from "./session";

export function hasAdminPermission(
	role: string | null | undefined,
	permission: AdminPermissionRequest,
): boolean {
	return adminRoleHasPermission(role, permission);
}

export function useAdminPermission(
	permission: AdminPermissionRequest,
): boolean {
	const { data, isPending } = useSession();

	return !isPending && hasAdminPermission(data?.user.role, permission);
}

export function sessionRoleLabel(role: string): "Admin" | "Support" | "User" {
	const normalizedRole = normalizeStoredRole(role);

	if (normalizedRole === "admin") {
		return "Admin";
	}

	if (normalizedRole === "support") {
		return "Support";
	}

	return "User";
}
