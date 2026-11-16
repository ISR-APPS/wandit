// The order list behind login. The /app layout checks the session first.
// The loader fills the list cache. Thin: the page and its states live in the orders feature.
import { createFileRoute } from "@tanstack/react-router";
import {
	OrdersPage,
	OrdersPageError,
	OrdersPageSkeleton,
	ordersQueryOptions,
	ordersSearchSchema,
} from "~/features/orders";

/** /app/orders: every order of the shop. `?status=` opens the tab of one status. */
export const Route = createFileRoute("/app/orders/")({
	validateSearch: ordersSearchSchema,
	loader: ({ context }) => context.queryClient.query(ordersQueryOptions()),
	pendingComponent: OrdersPageSkeleton,
	errorComponent: OrdersPageError,
	component: OrdersPage,
});
