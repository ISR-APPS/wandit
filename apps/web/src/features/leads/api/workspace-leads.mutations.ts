// Status changes from the dashboard Leads page reuse the per-project PATCH
// (each row knows its project) with the same optimistic snapshot/rollback
// feel as the workspace tab, applied to the aggregate caches.

import { useMutation, useQueryClient } from "@tanstack/react-query";
import type {
	LeadStatus,
	WorkspaceLeadsQuery,
	WorkspaceLeadsResponse,
} from "@wandit/contracts";

import { leadKeys } from "@/features/workspace/api/leads.queries";
import {
	updateLeadArchive,
	updateLeadStatus,
} from "@/features/workspace/api/leads.services";
import { workspaceLeadKeys } from "./workspace-leads.queries";

function archivedVisibilityFromQueryKey(
	queryKey: readonly unknown[],
): WorkspaceLeadsQuery["archived"] {
	const query = queryKey.at(-1);
	if (typeof query !== "object" || query === null || !("archived" in query)) {
		return "exclude";
	}

	const archived = query.archived;
	return archived === "only" || archived === "include" ? archived : "exclude";
}

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

export function useUpdateWorkspaceLeadArchive() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: ({
			leadId,
			projectId,
			archived,
		}: {
			leadId: string;
			projectId: string;
			archived: boolean;
		}) => updateLeadArchive(projectId, leadId, archived),
		onMutate: async ({ leadId, archived }) => {
			const queryKey = workspaceLeadKeys.lists();
			await queryClient.cancelQueries({ queryKey });
			const previous = queryClient.getQueriesData<WorkspaceLeadsResponse>({
				queryKey,
			});
			const archivedAt = archived ? new Date().toISOString() : null;

			for (const [cachedKey, old] of previous) {
				if (!old) continue;
				const visibility = archivedVisibilityFromQueryKey(cachedKey);
				const hasLead = old.leads.some((lead) => lead.id === leadId);
				if (!hasLead) continue;

				const shouldRemove =
					(archived && visibility === "exclude") ||
					(!archived && visibility === "only");
				queryClient.setQueryData<WorkspaceLeadsResponse>(cachedKey, {
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
		onSettled: (_data, _error, { projectId }) => {
			void queryClient.invalidateQueries({
				queryKey: workspaceLeadKeys.lists(),
			});
			void queryClient.invalidateQueries({
				queryKey: leadKeys.projectLists(projectId),
			});
		},
	});
}
