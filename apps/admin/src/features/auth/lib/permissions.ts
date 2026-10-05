/**
 * Admin permission helpers for the SPA: the permission map, route gates, and action gates.
 * Routes, navigation, and action buttons call these helpers.
 * The server AdminGuard is the authority; these helpers only hide controls.
 */
import {
	type AdminPermissionRequest,
	adminRoleHasPermission,
	adminStatement,
} from "@wandit/auth/admin-permissions";
import { isAdminRole, normalizeStoredRole } from "@wandit/contracts";

import { useMyAdminPermissionsQuery } from "../api/admin-permissions.queries";
import { useSession } from "./session";

export type AdminPermissionMap = Readonly<Record<string, readonly string[]>>;

const EMPTY_PERMISSION_MAP: AdminPermissionMap = {};
const FULL_ADMIN_PERMISSION_MAP: AdminPermissionMap = adminStatement;

export function hasAdminPermission(
	role: string | null | undefined,
	permission: AdminPermissionRequest,
): boolean {
	return adminRoleHasPermission(role, permission);
}

export function permissionMapAllows(
	map: AdminPermissionMap | null | undefined,
	permission: AdminPermissionRequest,
): boolean {
	if (!map) {
		return false;
	}

	return Object.entries(permission).every(([resource, actions]) =>
		actions?.every((action) => map[resource]?.includes(action)),
	);
}

export function useEffectiveAdminPermissions(): {
	map: AdminPermissionMap;
	isLoading: boolean;
} {
	const { data: session, isPending: isSessionPending } = useSession();
	const role = normalizeStoredRole(session?.user.role);
	const permissionsQuery = useMyAdminPermissionsQuery(
		!isSessionPending && role === "support",
	);

	if (isSessionPending) {
		return { map: EMPTY_PERMISSION_MAP, isLoading: true };
	}

	if (role === "admin") {
		return { map: FULL_ADMIN_PERMISSION_MAP, isLoading: false };
	}

	if (role === "support") {
		return {
			map: permissionsQuery.data?.permissions ?? EMPTY_PERMISSION_MAP,
			isLoading: permissionsQuery.isLoading,
		};
	}

	return { map: EMPTY_PERMISSION_MAP, isLoading: false };
}

export function useAdminPermission(
	permission: AdminPermissionRequest,
): boolean {
	const { map, isLoading } = useEffectiveAdminPermissions();

	return !isLoading && permissionMapAllows(map, permission);
}

/**
 * False when the API rejects a credit grant because the target belongs to the signed-in staff account.
 * `isOwnTarget` is true for that account's own user row, or for an org where it is a member.
 * Admins can grant to their own targets. Support cannot (admin-users.service.ts, admin-organizations.service.ts).
 */
export function canGrantCreditsToTarget(
	sessionRole: string | null | undefined,
	isOwnTarget: boolean,
): boolean {
	return isAdminRole(sessionRole) || !isOwnTarget;
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
