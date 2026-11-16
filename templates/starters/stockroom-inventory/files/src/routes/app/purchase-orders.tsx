// The purchase order list behind login. The /app layout checks the session first.
// The loader fills the list cache. Thin: the page, its panel, and its states live in the purchase-orders feature.
import { createFileRoute } from "@tanstack/react-router";
import {
	PurchaseOrdersPage,
	PurchaseOrdersPageError,
	PurchaseOrdersPageSkeleton,
	purchaseOrdersQueryOptions,
	purchaseOrdersSearchSchema,
} from "~/features/purchase-orders";

/** /app/purchase-orders: every order. `status`, `late`, `supplier`, and `po` (the open panel) live in the URL. */
export const Route = createFileRoute("/app/purchase-orders")({
	validateSearch: purchaseOrdersSearchSchema,
	loader: ({ context }) =>
		context.queryClient.query(purchaseOrdersQueryOptions()),
	pendingComponent: PurchaseOrdersPageSkeleton,
	errorComponent: PurchaseOrdersPageError,
	component: PurchaseOrdersPage,
});
