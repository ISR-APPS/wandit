// The members list behind login. The /app layout checks the session first.
// The loader fills the list cache. The search holds the plan and the visits filters.
// Thin: the page and its states live in the members feature.
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { PLAN_IDS } from "~/features/gym";
import {
	MembersPage,
	MembersPageError,
	MembersPageSkeleton,
	membersQueryOptions,
	VISIT_FILTERS,
} from "~/features/members";

// The values come from the URL. A wrong value shows every member, not an error.
const membersSearchSchema = z.object({
	plan: z.enum(PLAN_IDS).optional().catch(undefined),
	visits: z.enum(VISIT_FILTERS).optional().catch(undefined),
});

/** /app/members. `?plan=annual` shows the members of one plan, `?visits=atRisk` the members at risk. */
export const Route = createFileRoute("/app/members/")({
	validateSearch: membersSearchSchema,
	loader: ({ context }) => context.queryClient.query(membersQueryOptions()),
	pendingComponent: MembersPageSkeleton,
	errorComponent: MembersPageError,
	component: MembersRoute,
});

function MembersRoute() {
	const { plan, visits } = Route.useSearch();
	return <MembersPage planId={plan} visits={visits} />;
}
