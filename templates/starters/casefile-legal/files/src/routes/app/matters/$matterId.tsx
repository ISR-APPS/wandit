// The file of one matter. The /app layout checks the session first.
// The loader fills the matter file. Thin: the page lives in the matters feature.
// A failed load shows the error state of the list page: the same text and Try again.
import { createFileRoute } from "@tanstack/react-router";
import {
	MatterDetailPage,
	MatterDetailPageSkeleton,
	MattersPageError,
	matterQueryOptions,
} from "~/features/matters";

/** /app/matters/$matterId. `params.matterId` is any text from the URL; the query returns null for an unknown id. */
export const Route = createFileRoute("/app/matters/$matterId")({
	loader: ({ context, params }) =>
		context.queryClient.query(matterQueryOptions(params.matterId)),
	pendingComponent: MatterDetailPageSkeleton,
	errorComponent: MattersPageError,
	component: MatterDetailRoute,
});

function MatterDetailRoute() {
	const { matterId } = Route.useParams();
	return <MatterDetailPage matterId={matterId} />;
}
