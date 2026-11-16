// The page of one rep. The /app layout checks the session first.
// The loader fills the rep cache. Thin: the page lives in the reps feature.
// A failed load shows the error state of the list page: the same text and Try again.
import { createFileRoute } from "@tanstack/react-router";
import {
	RepDetailPage,
	RepDetailPageSkeleton,
	RepsPageError,
	repQueryOptions,
} from "~/features/reps";

/** /app/reps/$repId. `params.repId` is any text from the URL; the query returns null for an unknown id. */
export const Route = createFileRoute("/app/reps/$repId")({
	loader: ({ context, params }) =>
		context.queryClient.query(repQueryOptions(params.repId)),
	pendingComponent: RepDetailPageSkeleton,
	errorComponent: RepsPageError,
	component: RepDetailRoute,
});

function RepDetailRoute() {
	const { repId } = Route.useParams();
	return <RepDetailPage repId={repId} />;
}
