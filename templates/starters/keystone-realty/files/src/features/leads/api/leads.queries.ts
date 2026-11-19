// Reads of leads: the full list, and the summary of the leads page for one period.
// The leads route and the home route prefetch the list in their loaders. The pages read it with useSuspenseQuery.
// Each queryFn returns sample rows of ~/features/agency. To make it real: replace the body with a Supabase call:
// a select of the leads, newest first, with a limit of 1,000; and one SQL read function for the summary.
import { queryOptions } from "@tanstack/react-query";
import { readLeadRows, readViewingRows } from "~/features/agency";
import { buildLeadsSummary, type PeriodDays } from "../lib/lead-stats";

/** Every lead, newest first. The leads page filters, searches, sorts, and pages them in the browser. */
export function leadsQueryOptions() {
	return queryOptions({
		queryKey: ["leads", "list"],
		queryFn: async () => readLeadRows(Date.now()),
	});
}

/** The period of the leads page when it opens, in days. The route loader fills this period. */
export const LEADS_DEFAULT_DAYS: PeriodDays = 30;

/** The figures of the leads page for the last `days` days. The period is in the key, so each period loads once. */
export function leadsSummaryQueryOptions(days: PeriodDays) {
	return queryOptions({
		queryKey: ["leads", "summary", days],
		queryFn: async () => {
			const now = Date.now();
			return buildLeadsSummary(
				readLeadRows(now),
				readViewingRows(now),
				days,
				now,
			);
		},
	});
}
