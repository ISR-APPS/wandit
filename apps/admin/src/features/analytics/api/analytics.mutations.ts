import { useMutation, useQueryClient } from "@tanstack/react-query";

import { adminAnalyticsKeys } from "./analytics.queries";
import { setAdminFunnelContact } from "./analytics.services";

export function useSetFunnelContactMutation() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: setAdminFunnelContact,
		onSuccess: async () => {
			await queryClient.invalidateQueries({
				queryKey: adminAnalyticsKeys.funnelStepUsersAll(),
			});
		},
	});
}
