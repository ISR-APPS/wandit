// The members list behind login. The /app layout checks the session first.
// The loader fills the list cache. The search holds the plan filter.
// Thin: the page and its states live in the members feature.
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { PLAN_IDS } from "~/features/gym";
import {
	MembersPage,
	MembersPageError,
	MembersPageSkeleton,
	membersQueryOptions,
} from "~/features/members";

// The value comes from the URL. A wrong value shows every plan, not an error.
const membersSearchSchema = z.object({
	plan: z.enum(PLAN_IDS).optional().catch(undefined),
});

/** /app/members. `?plan=annual` shows the members of one plan. */
export const Route = createFileRoute("/app/members/")({
	validateSearch: membersSearchSchema,
	loader: ({ context }) => context.queryClient.query(membersQueryOptions()),
	pendingComponent: MembersPageSkeleton,
	errorComponent: MembersPageError,
	component: MembersRoute,
});

function MembersRoute() {
	const { plan } = Route.useSearch();
	return <MembersPage planId={plan} />;
}
