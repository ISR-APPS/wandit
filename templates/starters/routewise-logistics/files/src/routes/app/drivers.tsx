// The driver list behind login. The /app layout checks the session first.
// The loader fills the driver list. Thin: the page and its states live in the drivers feature.
import { createFileRoute } from "@tanstack/react-router";
import {
	DriversPage,
	DriversPageError,
	DriversPageSkeleton,
	driversQueryOptions,
} from "~/features/drivers";

/** /app/drivers: every driver with the run of today and the delivery figures of 30 days. */
export const Route = createFileRoute("/app/drivers")({
	loader: ({ context }) => context.queryClient.query(driversQueryOptions()),
	pendingComponent: DriversPageSkeleton,
	errorComponent: DriversPageError,
	component: DriversPage,
});
