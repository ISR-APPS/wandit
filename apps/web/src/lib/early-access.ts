import { isAdminRole } from "@wandit/contracts";

type EarlyAccessUser = {
	earlyAccess: boolean;
	role?: string | null;
};

export function isEarlyAccessUser(
	user: EarlyAccessUser | null | undefined,
): boolean {
	return user?.earlyAccess === true || isAdminRole(user?.role);
}
