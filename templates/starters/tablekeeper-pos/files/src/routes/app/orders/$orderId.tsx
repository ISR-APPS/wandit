// The detail page of one check. The /app layout checks the session first.
// The loader fills the check, the list (for the other checks of the same table), and the menu (for the allergens).
// Thin: the page lives in the orders feature. A failed load shows the error state of the list page.
import { createFileRoute } from "@tanstack/react-router";
import {
	OrderDetailPage,
	OrderDetailPageSkeleton,
	OrdersPageError,
} from "~/features/orders";
import {
	menuQueryOptions,
	orderQueryOptions,
	ordersQueryOptions,
} from "~/features/restaurant";

/** /app/orders/$orderId. `params.orderId` is any text from the URL; the query checks it. */
export const Route = createFileRoute("/app/orders/$orderId")({
	loader: ({ context, params }) =>
		Promise.all([
			context.queryClient.query(orderQueryOptions(params.orderId)),
			context.queryClient.query(ordersQueryOptions()),
			context.queryClient.query(menuQueryOptions()),
		]),
	pendingComponent: OrderDetailPageSkeleton,
	errorComponent: OrdersPageError,
	component: OrderDetailRoute,
});

function OrderDetailRoute() {
	const { orderId } = Route.useParams();
	return <OrderDetailPage orderId={orderId} />;
}
