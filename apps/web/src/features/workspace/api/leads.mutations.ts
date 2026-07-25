// TanStack Query mutations wrapping leads.services.ts: status change is
// fully optimistic (snapshot + rollback) so the pipeline feels instant even
// over real network latency.

import { useMutation, useQueryClient } from "@tanstack/react-query";

import type { Lead, LeadStatus } from "./dto";
import { leadKeys } from "./leads.queries";
import { updateLeadStatus } from "./leads.services";

export function useUpdateLeadStatus(projectId: string) {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: ({ leadId, status }: { leadId: string; status: LeadStatus }) =>
			updateLeadStatus(projectId, leadId, status),
		onMutate: async ({ leadId, status }) => {
			await queryClient.cancelQueries({ queryKey: leadKeys.list(projectId) });
			const previous = queryClient.getQueryData<Lead[]>(
				leadKeys.list(projectId),
			);
			queryClient.setQueryData<Lead[]>(leadKeys.list(projectId), (old) =>
				old?.map((lead) => (lead.id === leadId ? { ...lead, status } : lead)),
			);
			return { previous };
		},
		onError: (_error, _variables, context) => {
			if (context?.previous) {
				queryClient.setQueryData(leadKeys.list(projectId), context.previous);
			}
		},
		onSettled: () => {
			void queryClient.invalidateQueries({
				queryKey: leadKeys.list(projectId),
			});
		},
	});
}
