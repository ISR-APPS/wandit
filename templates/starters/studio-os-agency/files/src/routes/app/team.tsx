// The Team page behind login. The /app layout checks the session first.
// The loader fills the team load of the period in the URL. Thin: the page lives in the team feature.
import { createFileRoute } from "@tanstack/react-router";
import {
	TeamPage,
	TeamPageError,
	TeamPageSkeleton,
	teamLoadQueryOptions,
	teamSearchSchema,
} from "~/features/team";

/** /app/team: the capacity of every person. `?days=` sets the period. */
export const Route = createFileRoute("/app/team")({
	validateSearch: teamSearchSchema,
	loaderDeps: ({ search }) => ({ days: search.days }),
	loader: ({ context, deps }) =>
		context.queryClient.query(teamLoadQueryOptions(deps.days)),
	pendingComponent: TeamPageSkeleton,
	errorComponent: TeamPageError,
	component: TeamPage,
});
