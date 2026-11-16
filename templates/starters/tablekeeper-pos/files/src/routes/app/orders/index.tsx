// The list of the checks of the business day. The /app layout checks the session first.
// The loader fills the orders cache. Thin: the page and its states live in the orders feature.
import { createFileRoute } from "@tanstack/react-router";
import {
	OrdersPage,
	OrdersPageError,
	OrdersPageSkeleton,
} from "~/features/orders";
import { ordersQueryOptions } from "~/features/restaurant";

/** /app/orders: every check of the day, newest first. */
export const Route = createFileRoute("/app/orders/")({
	loader: ({ context }) => context.queryClient.query(ordersQueryOptions()),
	pendingComponent: OrdersPageSkeleton,
	errorComponent: OrdersPageError,
	component: OrdersPage,
});
