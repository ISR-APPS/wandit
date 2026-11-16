// The home behind login: the dispatch desk. The /app layout checks the session first.
// The loader fills the shipment list, the delivery figures, and the detail of the Next up shipment. Thin: the page and its states live in the dispatch feature.
import { createFileRoute } from "@tanstack/react-router";
import {
	DISPATCH_DEFAULT_DAYS,
	DispatchPage,
	DispatchPageError,
	DispatchPageSkeleton,
	openQueue,
} from "~/features/dispatch";
import {
	deliveryFiguresQueryOptions,
	deliveryOutcomesQueryOptions,
	lateByReasonQueryOptions,
	shipmentQueryOptions,
	shipmentsQueryOptions,
} from "~/features/shipments";

/** /app: the next shipment to handle, the queue of open shipments, and the deliveries of the period. */
export const Route = createFileRoute("/app/")({
	loader: async ({ context }) => {
		const [shipments] = await Promise.all([
			context.queryClient.query(shipmentsQueryOptions(DISPATCH_DEFAULT_DAYS)),
			context.queryClient.query(
				deliveryOutcomesQueryOptions(DISPATCH_DEFAULT_DAYS),
			),
			context.queryClient.query(
				deliveryFiguresQueryOptions(DISPATCH_DEFAULT_DAYS),
			),
			context.queryClient.query(
				lateByReasonQueryOptions(DISPATCH_DEFAULT_DAYS),
			),
		]);
		// The "Next up" panel shows the steps of its shipment. A prefetch keeps its height stable on the first paint.
		const nextUp = openQueue(shipments)[0];
		if (nextUp) {
			await context.queryClient.query(shipmentQueryOptions(nextUp.id));
		}
	},
	pendingComponent: DispatchPageSkeleton,
	errorComponent: DispatchPageError,
	component: DispatchPage,
});
