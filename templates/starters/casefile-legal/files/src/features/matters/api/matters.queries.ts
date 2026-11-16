// Reads of matters: the list of every matter, and the full file of one matter.
// The board, the matter list, and the detail routes prefetch them in their loaders. The pages read them with useSuspenseQuery.
// The queryFn returns sample rows today. A later turn replaces its body with a Supabase call (STARTER.md).
import { queryOptions } from "@tanstack/react-query";
import { getSampleTables } from "~/features/practice";
import { buildMatterFile, buildMatterSummaries } from "../lib/matter-joins";

/** Every matter with its client, lead, next deadline, and totals, newest opening first. */
export function mattersQueryOptions() {
	return queryOptions({
		queryKey: ["matters", "list"],
		queryFn: async () => buildMatterSummaries(getSampleTables()),
	});
}

/** The file of one matter, or null when the id from the URL does not exist. */
export function matterQueryOptions(matterId: string) {
	return queryOptions({
		queryKey: ["matters", "detail", matterId],
		queryFn: async () => buildMatterFile(getSampleTables(), matterId),
	});
}
