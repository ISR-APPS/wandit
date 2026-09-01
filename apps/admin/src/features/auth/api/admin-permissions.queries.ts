import { useQuery } from "@tanstack/react-query";
import {
	adminMyPermissionsResponseSchema,
	adminRoutes,
} from "@wandit/contracts";

import { apiGet } from "@/lib/api-client";

export const adminMyPermissionsQueryKey = ["admin-my-permissions"] as const;

export function useMyAdminPermissionsQuery(enabled = true) {
	return useQuery({
		queryKey: adminMyPermissionsQueryKey,
		queryFn: async () => {
			const payload = await apiGet<unknown>(adminRoutes.myPermissions);
			return adminMyPermissionsResponseSchema.parse(payload);
		},
		enabled,
		staleTime: 30_000,
	});
}
