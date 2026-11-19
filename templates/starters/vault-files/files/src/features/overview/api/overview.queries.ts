// Reads of the home: the storage per type, the quick folders, the newest uploads, and the transfer bars of one grouping.
// The home route loader prefetches them. OverviewPage reads them with useSuspenseQuery.
// Each queryFn reads the sample workspace now. A later turn replaces each body with one Supabase rpc call.
import { queryOptions } from "@tanstack/react-query";
import { readWorkspace } from "~/features/workspace";
import {
	buildOverview,
	type TransferPeriod,
	transferBars,
} from "../lib/series";

/** The type cards, the folder cards, the storage card, and the upload table. */
export function overviewQueryOptions() {
	return queryOptions({
		queryKey: ["overview"],
		queryFn: async () => buildOverview(readWorkspace(Date.now())),
	});
}

/** New files and new versions per bar of `period`. The grouping is part of the key, so each choice caches apart. */
export function transferQueryOptions(period: TransferPeriod) {
	return queryOptions({
		queryKey: ["uploads", "transfer", period],
		queryFn: async () => {
			const now = Date.now();
			return transferBars(readWorkspace(now).uploads, period, now);
		},
	});
}
