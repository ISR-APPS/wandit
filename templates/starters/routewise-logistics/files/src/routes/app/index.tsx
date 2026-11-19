// The home behind login: the dispatch desk. The /app layout checks the session first.
// The loader fills the shipments, the delivery figures and outcomes of the default period, the drivers, and the fleet.
// Thin: the page and its states live in the dispatch feature.
import { createFileRoute } from "@tanstack/react-router";
import {
	DISPATCH_DEFAULT_DAYS,
	DispatchPage,
	DispatchPageError,
	DispatchPageSkeleton,
} from "~/features/dispatch";
import { driversQueryOptions } from "~/features/drivers";
import { vehiclesQueryOptions } from "~/features/fleet";
import {
	deliveryFiguresQueryOptions,
	deliveryOutcomesQueryOptions,
	shipmentsQueryOptions,
} from "~/features/shipments";

/** /app: the delivery volume, four KPIs, the drivers on duty, and the shipments of the period. */
export const Route = createFileRoute("/app/")({
	loader: ({ context }) =>
		Promise.all([
			context.queryClient.query(shipmentsQueryOptions(DISPATCH_DEFAULT_DAYS)),
			context.queryClient.query(
				deliveryOutcomesQueryOptions(DISPATCH_DEFAULT_DAYS),
			),
			context.queryClient.query(
				deliveryFiguresQueryOptions(DISPATCH_DEFAULT_DAYS),
			),
			context.queryClient.query(driversQueryOptions()),
			context.queryClient.query(vehiclesQueryOptions()),
		]),
	pendingComponent: DispatchPageSkeleton,
	errorComponent: DispatchPageError,
	component: DispatchPage,
});
