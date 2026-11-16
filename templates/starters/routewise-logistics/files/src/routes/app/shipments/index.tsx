// The shipment list behind login. The /app layout checks the session first.
// The loader fills the list of the default period. Thin: the page and its states live in the shipments feature.
import { createFileRoute } from "@tanstack/react-router";
import {
	SHIPMENTS_DEFAULT_DAYS,
	ShipmentsPage,
	ShipmentsPageError,
	ShipmentsPageSkeleton,
	shipmentsQueryOptions,
} from "~/features/shipments";

/** /app/shipments: the open shipments and the shipments closed in the period. */
export const Route = createFileRoute("/app/shipments/")({
	loader: ({ context }) =>
		context.queryClient.query(shipmentsQueryOptions(SHIPMENTS_DEFAULT_DAYS)),
	pendingComponent: ShipmentsPageSkeleton,
	errorComponent: ShipmentsPageError,
	component: ShipmentsPage,
});
