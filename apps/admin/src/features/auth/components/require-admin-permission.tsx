import type { AdminPermissionRequest } from "@wandit/auth/admin-permissions";
import type { ReactNode } from "react";
import {
	permissionMapAllows,
	useEffectiveAdminPermissions,
} from "../lib/permissions";
import { AccessDeniedState } from "./access-denied-state";

type RequireAdminPermissionProps = {
	permission: AdminPermissionRequest;
	children: ReactNode;
};

export function RequireAdminPermission({
	permission,
	children,
}: RequireAdminPermissionProps) {
	const { map, isLoading } = useEffectiveAdminPermissions();

	if (isLoading) {
		return null;
	}

	return permissionMapAllows(map, permission) ? (
		children
	) : (
		<AccessDeniedState />
	);
}
