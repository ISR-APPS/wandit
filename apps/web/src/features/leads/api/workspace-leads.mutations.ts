// Status changes from the dashboard Leads page reuse the per-project PATCH
// (each row knows its project) with the same optimistic snapshot/rollback
// feel as the workspace tab, applied to the aggregate caches.

import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { LeadStatus, WorkspaceLeadsResponse } from "@wandit/contracts";

import { leadKeys } from "@/features/workspace/api/leads.queries";
import { updateLeadStatus } from "@/features/workspace/api/leads.services";
import { workspaceLeadKeys } from "./workspace-leads.queries";

export function useUpdateWorkspaceLeadStatus() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: ({
			leadId,
			projectId,
			status,
		}: {
			leadId: string;
			projectId: string;
			status: LeadStatus;
		}) => updateLeadStatus(projectId, leadId, status),
		onMutate: async ({ leadId, status }) => {
			const queryKey = workspaceLeadKeys.lists();
			await queryClient.cancelQueries({ queryKey });
			const previous = queryClient.getQueriesData<WorkspaceLeadsResponse>({
				queryKey,
			});
			queryClient.setQueriesData<WorkspaceLeadsResponse>(
				{ queryKey },
				(old) => {
					if (!old) return old;
					return {
						...old,
						leads: old.leads.map((lead) =>
							lead.id === leadId ? { ...lead, status } : lead,
						),
					};
				},
			);
			return { previous };
		},
		onError: (_error, _variables, context) => {
			for (const [queryKey, data] of context?.previous ?? []) {
				queryClient.setQueryData(queryKey, data);
			}
		},
		onSettled: (_data, _error, { projectId }) => {
			void queryClient.invalidateQueries({
				queryKey: workspaceLeadKeys.lists(),
			});
			// Keep the project's own Leads tab in step with the aggregate view.
			void queryClient.invalidateQueries({
				queryKey: leadKeys.projectLists(projectId),
			});
		},
	});
}
