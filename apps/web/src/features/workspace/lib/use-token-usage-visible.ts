import { isStaffRole } from "@wandit/contracts";

import { useSession } from "@/features/auth";

export function useTokenUsageVisible(): boolean {
	const { data: session } = useSession();
	return import.meta.env.DEV || isStaffRole(session?.user.role);
}
