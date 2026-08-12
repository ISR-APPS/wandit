// TanStack Query mutations wrapping leads.services.ts: status change is
// fully optimistic (snapshot + rollback) so the pipeline feels instant even
// over real network latency.

import { useMutation, useQueryClient } from "@tanstack/react-query";

import type { LeadsQuery, LeadsResponse } from "@wandit/contracts";
import type { LeadStatus } from "./dto";
import { leadKeys } from "./leads.queries";
import { updateLeadArchive, updateLeadStatus } from "./leads.services";

function archivedVisibilityFromQueryKey(
	queryKey: readonly unknown[],
): LeadsQuery["archived"] {
	const query = queryKey.at(-1);
	if (typeof query !== "object" || query === null || !("archived" in query)) {
		return "exclude";
	}

	const archived = query.archived;
	return archived === "only" || archived === "include" ? archived : "exclude";
}

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

export function useUpdateLeadArchive(projectId: string) {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: ({ leadId, archived }: { leadId: string; archived: boolean }) =>
			updateLeadArchive(projectId, leadId, archived),
		onMutate: async ({ leadId, archived }) => {
			const queryKey = leadKeys.projectLists(projectId);
			await queryClient.cancelQueries({ queryKey });
			const previous = queryClient.getQueriesData<LeadsResponse>({ queryKey });
			const archivedAt = archived ? new Date().toISOString() : null;

			for (const [cachedKey, old] of previous) {
				if (!old) continue;
				const visibility = archivedVisibilityFromQueryKey(cachedKey);
				const hasLead = old.leads.some((lead) => lead.id === leadId);
				if (!hasLead) continue;

				const shouldRemove =
					(archived && visibility === "exclude") ||
					(!archived && visibility === "only");
				queryClient.setQueryData<LeadsResponse>(cachedKey, {
					...old,
					leads: shouldRemove
						? old.leads.filter((lead) => lead.id !== leadId)
						: old.leads.map((lead) =>
								lead.id === leadId ? { ...lead, archivedAt } : lead,
							),
					total: shouldRemove ? Math.max(0, old.total - 1) : old.total,
				});
			}

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
