// The audience page behind login. The /app layout checks the session first.
// The loader fills the audience cache. Thin: the page and its states live in the audiences feature.
import { createFileRoute } from "@tanstack/react-router";
import {
	AudiencesPage,
	AudiencesPageError,
	AudiencesPageSkeleton,
	audiencesQueryOptions,
	audiencesSearchSchema,
} from "~/features/audiences";

/** /app/audiences: every segment. `?type=` sets the type filter, `?audience=` opens the panel of one audience. */
export const Route = createFileRoute("/app/audiences")({
	validateSearch: audiencesSearchSchema,
	loader: ({ context }) => context.queryClient.query(audiencesQueryOptions()),
	pendingComponent: AudiencesPageSkeleton,
	errorComponent: AudiencesPageError,
	component: AudiencesPage,
});
