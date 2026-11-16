// The detail page of one order. The /app layout checks the session first.
// The loader fills the order with its lines and its customer. Thin: the page lives in the orders feature.
// A failed load shows the error state of the list page: the same text and Try again.
import { createFileRoute } from "@tanstack/react-router";
import {
	OrderDetailPage,
	OrderDetailPageSkeleton,
	OrdersPageError,
	orderQueryOptions,
} from "~/features/orders";

/** /app/orders/$orderId. `params.orderId` is any text from the URL; the query answers null for an unknown one. */
export const Route = createFileRoute("/app/orders/$orderId")({
	loader: ({ context, params }) =>
		context.queryClient.query(orderQueryOptions(params.orderId)),
	pendingComponent: OrderDetailPageSkeleton,
	errorComponent: OrdersPageError,
	component: OrderDetailRoute,
});

function OrderDetailRoute() {
	const { orderId } = Route.useParams();
	return <OrderDetailPage orderId={orderId} />;
}
