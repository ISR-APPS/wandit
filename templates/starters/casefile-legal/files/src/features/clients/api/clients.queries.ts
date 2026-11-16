// Reads of clients: the list of every client, and the file of one client for the side sheet.
// The /app/clients route prefetches the list. The sheet reads one file with useQuery after a click.
// The queryFn returns sample rows today. A later turn replaces its body with a Supabase call (STARTER.md).
import { queryOptions } from "@tanstack/react-query";
import { getSampleTables } from "~/features/practice";
import { buildClientFile, buildClientSummaries } from "../lib/client-joins";

/** Every client with its matter counts and totals, in the order of the names. */
export function clientsQueryOptions() {
	return queryOptions({
		queryKey: ["clients", "list"],
		queryFn: async () => buildClientSummaries(getSampleTables()),
	});
}

/** The file of one client: its totals, its matters, and its invoices. null for an unknown id. */
export function clientQueryOptions(clientId: string) {
	return queryOptions({
		queryKey: ["clients", "detail", clientId],
		queryFn: async () => buildClientFile(getSampleTables(), clientId),
	});
}
