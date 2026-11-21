// Reads of the home: the KPI figures, the performance series, the sources per month, the listing mix, and the sales progress.
// The loader of the home route prefetches it. OverviewPage and its cards read it from the cache.
// The queryFn computes the summary from sample rows of ~/features/agency.
// To make it real: one SQL read function (data.md of the app-dashboard skill), called with rpc.
import { queryOptions } from "@tanstack/react-query";
import {
	DAY_MS,
	readLeadRows,
	readListingRows,
	readViewingRows,
} from "~/features/agency";
import {
	buildHomeKpis,
	buildListingMix,
	buildPerformance,
	buildSalesProgress,
	buildSourceMonths,
	COMPARE_DAYS,
} from "../lib/series";

/** Every figure of the home, from one read of the rows, so the KPIs and the cards agree. */
export function homeSummaryQueryOptions() {
	return queryOptions({
		queryKey: ["overview", "summary"],
		queryFn: async () => {
			const now = Date.now();
			const leads = readLeadRows(now);
			const listings = readListingRows(now);
			// The sample rows at an earlier time hold only the facts that were true then.
			const before = now - COMPARE_DAYS * DAY_MS;
			const kpis = buildHomeKpis(
				{ leads, listings },
				{ leads: readLeadRows(before), listings: readListingRows(before) },
				now,
			);
			return {
				kpis,
				performance: buildPerformance(leads, readViewingRows(now), now),
				sourceMonths: buildSourceMonths(leads, now),
				listingMix: buildListingMix(listings),
				salesProgress: buildSalesProgress(
					listings,
					kpis.closedThisQuarter.value,
				),
			};
		},
	});
}
