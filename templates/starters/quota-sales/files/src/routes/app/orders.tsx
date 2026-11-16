// The orders list behind login. The /app layout checks the session first.
// The loader fills the list cache. Thin: the page and its states live in the orders feature.
import { createFileRoute } from "@tanstack/react-router";
import {
	OrdersPage,
	OrdersPageError,
	OrdersPageSkeleton,
	ordersQueryOptions,
} from "~/features/orders";

/** /app/orders: every order of the last 90 days. */
export const Route = createFileRoute("/app/orders")({
	loader: ({ context }) => context.queryClient.query(ordersQueryOptions()),
	pendingComponent: OrdersPageSkeleton,
	errorComponent: OrdersPageError,
	component: OrdersPage,
});
