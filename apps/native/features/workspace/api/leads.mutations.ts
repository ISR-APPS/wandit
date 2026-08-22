// TanStack Query mutations wrapping leads.requests.ts: status change and
// archive are fully optimistic (snapshot + rollback) across every cached
// filter combination, so the pipeline feels instant over mobile latency.
// Toasts live at the call sites — these hooks only move data.

import {
	type InfiniteData,
	useMutation,
	useQueryClient,
} from "@tanstack/react-query";
import type { LeadStatus, LeadsQuery, LeadsResponse } from "@wandit/contracts";

import { leadKeys, sheetSyncKeys } from "./leads.keys";
import {
	syncSheetNow,
	updateLeadArchive,
	updateLeadStatus,
} from "./leads.requests";

type LeadsInfiniteData = InfiniteData<LeadsResponse, string | undefined>;

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
			const previous = queryClient.getQueriesData<LeadsInfiniteData>({
				queryKey,
			});
			queryClient.setQueriesData<LeadsInfiniteData>({ queryKey }, (old) => {
				if (!old) return old;
				return {
					...old,
					pages: old.pages.map((page) => ({
						...page,
						leads: page.leads.map((lead) =>
							lead.id === leadId ? { ...lead, status } : lead,
						),
					})),
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
			const previous = queryClient.getQueriesData<LeadsInfiniteData>({
				queryKey,
			});
			const archivedAt = archived ? new Date().toISOString() : null;

			for (const [cachedKey, old] of previous) {
				if (!old) continue;
				const visibility = archivedVisibilityFromQueryKey(cachedKey);
				const hasLead = old.pages.some((page) =>
					page.leads.some((lead) => lead.id === leadId),
				);
				if (!hasLead) continue;

				// A lead leaving its visibility bucket disappears from that cache
				// entry; one staying put only flips its archivedAt.
				const shouldRemove =
					(archived && visibility === "exclude") ||
					(!archived && visibility === "only");
				queryClient.setQueryData<LeadsInfiniteData>(cachedKey, {
					...old,
					pages: old.pages.map((page) => ({
						...page,
						leads: shouldRemove
							? page.leads.filter((lead) => lead.id !== leadId)
							: page.leads.map((lead) =>
									lead.id === leadId ? { ...lead, archivedAt } : lead,
								),
						total: shouldRemove ? Math.max(0, page.total - 1) : page.total,
					})),
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

/**
 * Full-rewrite sync to the merchant's Google Sheet. The server answers with
 * the fresh state (sheet URL, count, timestamp), so onSuccess writes it
 * straight into the cache — no invalidation round-trip needed.
 */
export function useSyncSheetNow(projectId: string) {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: () => syncSheetNow(projectId),
		onSuccess: (state) => {
			queryClient.setQueryData(sheetSyncKeys.state(projectId), state);
		},
	});
}
