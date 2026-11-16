// The leads page behind login. The /app layout checks the session first.
// The loader fills the leads and the viewings: the panel of a lead lists its viewings.
// Thin: the page and its states live in the leads feature.
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { LEAD_STATUSES } from "~/features/agency";
import {
	LeadsPage,
	LeadsPageError,
	LeadsPageSkeleton,
	leadsQueryOptions,
} from "~/features/leads";
import { viewingsQueryOptions } from "~/features/viewings";

// `lead` is a lead id from the URL, for example "L-47703". An id that is no lead opens no panel.
// `status` is the tab of the table. A value that is no status shows the "All" tab.
const leadsSearchSchema = z.object({
	lead: z.string().max(40).optional().catch(undefined),
	status: z.enum(LEAD_STATUSES).optional().catch(undefined),
});

/** /app/leads. `?status=new` picks a tab, and `?lead=L-47703` opens the panel of that lead. */
export const Route = createFileRoute("/app/leads")({
	validateSearch: leadsSearchSchema,
	loader: ({ context }) =>
		Promise.all([
			context.queryClient.query(leadsQueryOptions()),
			context.queryClient.query(viewingsQueryOptions()),
		]),
	pendingComponent: LeadsPageSkeleton,
	errorComponent: LeadsPageError,
	component: LeadsRoute,
});

function LeadsRoute() {
	const { lead, status } = Route.useSearch();
	return <LeadsPage openLeadId={lead} statusFilter={status} />;
}
