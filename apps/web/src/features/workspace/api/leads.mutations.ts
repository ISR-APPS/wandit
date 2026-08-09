// TanStack Query mutations wrapping leads.services.ts: status change is
// fully optimistic (snapshot + rollback) so the pipeline feels instant even
// over real network latency.

import { useMutation, useQueryClient } from "@tanstack/react-query";

import type { LeadsResponse } from "@wandit/contracts";
import type { LeadStatus } from "./dto";
import { leadKeys } from "./leads.queries";
import { updateLeadStatus } from "./leads.services";

export function useUpdateLeadStatus(projectId: string) {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: ({ leadId, status }: { leadId: string; status: LeadStatus }) =>
			updateLeadStatus(projectId, leadId, status),
		onMutate: async ({ leadId, status }) => {
			const queryKey = leadKeys.projectLists(projectId);
			await queryClient.cancelQueries({ queryKey });
			const previous = queryClient.getQueriesData<LeadsResponse>({ queryKey });
			queryClient.setQueriesData<LeadsResponse>({ queryKey }, (old) => {
				if (!old) return old;
				return {
					...old,
					leads: old.leads.map((lead) =>
						lead.id === leadId ? { ...lead, status } : lead,
					),
				};
			});
			return { previous };
		},
		onError: (_error, _variables, context) => {
			for (const [queryKey, data] of context?.previous ?? []) {
				queryClient.setQueryData(queryKey, data);
			}
		},
		onSettled: () => {
			void queryClient.invalidateQueries({
				queryKey: leadKeys.projectLists(projectId),
			});
		},
	});
}
