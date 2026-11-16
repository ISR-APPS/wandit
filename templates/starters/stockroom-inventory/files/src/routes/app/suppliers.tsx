// The supplier page behind login. The /app layout checks the session first.
// The loader fills the suppliers and the item and order lists of the supplier panel. Thin: the page lives in the suppliers feature.
import { createFileRoute } from "@tanstack/react-router";
import { itemsQueryOptions } from "~/features/items";
import { purchaseOrdersQueryOptions } from "~/features/purchase-orders";
import {
	SuppliersPage,
	SuppliersPageError,
	SuppliersPageSkeleton,
	suppliersQueryOptions,
	suppliersSearchSchema,
} from "~/features/suppliers";

/** /app/suppliers: every supplier. `supplier` in the URL opens its panel. */
export const Route = createFileRoute("/app/suppliers")({
	validateSearch: suppliersSearchSchema,
	loader: ({ context }) =>
		Promise.all([
			context.queryClient.query(suppliersQueryOptions()),
			context.queryClient.query(itemsQueryOptions()),
			context.queryClient.query(purchaseOrdersQueryOptions()),
		]),
	pendingComponent: SuppliersPageSkeleton,
	errorComponent: SuppliersPageError,
	component: SuppliersPage,
});
