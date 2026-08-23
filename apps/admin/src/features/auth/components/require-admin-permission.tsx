import type { AdminPermissionRequest } from "@wandit/auth/admin-permissions";
import type { ReactNode } from "react";
import { hasAdminPermission } from "../lib/permissions";
import { useSession } from "../lib/session";
import { AccessDeniedState } from "./access-denied-state";

type RequireAdminPermissionProps = {
	permission: AdminPermissionRequest;
	children: ReactNode;
};

export function RequireAdminPermission({
	permission,
	children,
}: RequireAdminPermissionProps) {
	const { data, isPending } = useSession();

	if (isPending) {
		return null;
	}

	return hasAdminPermission(data?.user.role, permission) ? (
		children
	) : (
		<AccessDeniedState />
	);
}
