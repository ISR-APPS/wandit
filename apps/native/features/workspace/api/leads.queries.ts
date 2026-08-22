// TanStack Query queries for leads. queryFn delegates to leads.requests.ts.
// New leads arrive from outside the app (published-page form posts), so a
// gentle poll while the hub screen is open is their arrival path into the UI
// — the native twin of the web tab's 15s refetchInterval.

import {
	keepPreviousData,
	useInfiniteQuery,
	useQuery,
} from "@tanstack/react-query";
import type { LeadSource, LeadStatus, LeadsQuery } from "@wandit/contracts";

import { leadKeys, sheetSyncKeys } from "./leads.keys";
import { getSheetSyncState, listLeads } from "./leads.requests";

/** The list filters the view controls — everything but the cursor/pageSize. */
export type LeadListFilters = {
	archived: NonNullable<LeadsQuery["archived"]>;
	createdFrom?: string;
	createdTo?: string;
	q?: string;
	source?: LeadSource;
	status?: LeadStatus;
};

/**
 * The untouched-filters shape. The hub pill reads this exact cache entry for
 * its counts, so it must stay identical to the view's initial filter state.
 */
export const DEFAULT_LEAD_FILTERS: LeadListFilters = { archived: "exclude" };

const LEADS_PAGE_SIZE = 25;
const LEADS_POLL_INTERVAL_MS = 15_000;

/**
 * Infinite keyset pagination over one project's leads. Every page carries the
 * project-wide `totals` (filters ignored server-side), so the stat chips and
 * the hub pill read whichever page is freshest.
 */
export function useLeadsInfiniteQuery(
	projectId: string,
	filters: LeadListFilters,
) {
	return useInfiniteQuery({
		queryKey: leadKeys.list(projectId, filters),
		queryFn: ({ pageParam }) =>
			listLeads(projectId, {
				...filters,
				cursor: pageParam,
				pageSize: LEADS_PAGE_SIZE,
			}),
		initialPageParam: undefined as string | undefined,
		getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
		enabled: projectId.length > 0,
		// Keep the previous rows on screen while a changed filter refetches.
		placeholderData: keepPreviousData,
		refetchInterval: LEADS_POLL_INTERVAL_MS,
	});
}

/** Google connection + sheet state driving the Sheets card. */
export function useSheetSyncQuery(projectId: string) {
	return useQuery({
		queryKey: sheetSyncKeys.state(projectId),
		queryFn: () => getSheetSyncState(projectId),
		enabled: projectId.length > 0,
	});
}
