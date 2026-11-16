// Reads of invoices: every invoice with its client and project names, the newest number first.
// The Invoices route, the overview, and the Clients page prefetch it in their loaders.
// The queryFn returns the sample rows today. A later turn replaces its body with a Supabase read.
import { queryOptions } from "@tanstack/react-query";
import { getStudioData, summarizeInvoices } from "~/features/studio";

/** Every invoice, drafts included, the newest number first. */
export function invoicesQueryOptions() {
	return queryOptions({
		queryKey: ["invoices", "list"],
		queryFn: async () => summarizeInvoices(getStudioData()),
	});
}
