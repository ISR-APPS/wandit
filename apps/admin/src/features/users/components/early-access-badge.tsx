import { isAdminRole } from "@wandit/contracts";

import { Badge } from "@/components/ui/badge";
import type { AdminUserSummary } from "@/features/users/api/users.dto";

type EarlyAccessBadgeProps = {
	user: Pick<AdminUserSummary, "earlyAccess" | "role">;
};

export function EarlyAccessBadge({ user }: EarlyAccessBadgeProps) {
	const hasAccess = user.earlyAccess || isAdminRole(user.role);

	return hasAccess ? (
		<Badge variant="secondary">Beta access</Badge>
	) : (
		<Badge variant="outline">No access</Badge>
	);
}
