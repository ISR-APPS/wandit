// The page of one shipment. The /app layout checks the session first.
// The loader fills the shipment with its timeline. Thin: the page lives in the shipments feature.
// A failed load shows the error state of the list page: the same text and Try again.
import { createFileRoute } from "@tanstack/react-router";
import {
	ShipmentDetailPage,
	ShipmentDetailPageSkeleton,
	ShipmentsPageError,
	shipmentQueryOptions,
} from "~/features/shipments";

/** /app/shipments/$shipmentId. `params.shipmentId` is any text from the URL; the query answers null for an unknown id. */
export const Route = createFileRoute("/app/shipments/$shipmentId")({
	loader: ({ context, params }) =>
		context.queryClient.query(shipmentQueryOptions(params.shipmentId)),
	pendingComponent: ShipmentDetailPageSkeleton,
	errorComponent: ShipmentsPageError,
	component: ShipmentDetailRoute,
});

function ShipmentDetailRoute() {
	const { shipmentId } = Route.useParams();
	return <ShipmentDetailPage shipmentId={shipmentId} />;
}
