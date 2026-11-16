// Reads of clients: every client with its relation, its live projects, and its money.
// The Clients route prefetches it in its loader.
// The queryFn returns the sample rows today. A later turn replaces its body with a Supabase read.
import { queryOptions } from "@tanstack/react-query";
import {
	getStudioData,
	summarizeClients,
	summarizeProjects,
} from "~/features/studio";

/** Every client, in catalog order. The page sorts and filters them. */
export function clientsQueryOptions() {
	return queryOptions({
		queryKey: ["clients", "list"],
		queryFn: async () => {
			const data = getStudioData();
			return summarizeClients(data, summarizeProjects(data));
		},
	});
}
