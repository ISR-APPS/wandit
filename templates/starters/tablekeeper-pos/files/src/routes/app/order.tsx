// The order screen behind login. The /app layout checks the session first.
// The loader fills the menu and the floor board, for the table select. Thin: the page lives in order-entry.
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import {
	OrderEntryPage,
	OrderEntryPageError,
	OrderEntryPageSkeleton,
} from "~/features/order-entry";
import { floorQueryOptions, menuQueryOptions } from "~/features/restaurant";

// `table` is a table id from the URL, for example "t4". An id that is no table leaves the select empty.
const orderSearchSchema = z.object({
	table: z.string().max(10).optional().catch(undefined),
});

/** /app/order. `?table=t4` chooses table T4; the header alerts and the check page link here with it. */
export const Route = createFileRoute("/app/order")({
	validateSearch: orderSearchSchema,
	loader: ({ context }) =>
		Promise.all([
			context.queryClient.query(menuQueryOptions()),
			context.queryClient.query(floorQueryOptions()),
		]),
	pendingComponent: OrderEntryPageSkeleton,
	errorComponent: OrderEntryPageError,
	component: OrderRoute,
});

function OrderRoute() {
	const { table } = Route.useSearch();
	return <OrderEntryPage tableId={table} />;
}
