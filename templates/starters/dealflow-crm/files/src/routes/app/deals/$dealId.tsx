// The detail page of one deal. The /app layout checks the session first.
// The loader fills the deal, its activities, and its tasks in parallel. Thin: the page lives in the deals feature.
// A failed load shows the error state of the list page: the same text and Try again.
import { createFileRoute } from "@tanstack/react-router";
import {
	dealActivitiesQueryOptions,
	dealTasksQueryOptions,
} from "~/features/activities";
import {
	DealDetailPage,
	DealDetailPageSkeleton,
	DealsPageError,
	dealQueryOptions,
} from "~/features/deals";

/** /app/deals/$dealId. `params.dealId` is any text from the URL; the query answers null for an unknown id. */
export const Route = createFileRoute("/app/deals/$dealId")({
	loader: ({ context, params }) =>
		Promise.all([
			context.queryClient.query(dealQueryOptions(params.dealId)),
			context.queryClient.query(dealActivitiesQueryOptions(params.dealId)),
			context.queryClient.query(dealTasksQueryOptions(params.dealId)),
		]),
	pendingComponent: DealDetailPageSkeleton,
	errorComponent: DealsPageError,
	component: DealDetailRoute,
});

function DealDetailRoute() {
	const { dealId } = Route.useParams();
	return <DealDetailPage dealId={dealId} />;
}
