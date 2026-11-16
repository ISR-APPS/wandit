// The fleet board behind login. The /app layout checks the session first.
// The loader fills the vehicle list. Thin: the page and its states live in the fleet feature.
import { createFileRoute } from "@tanstack/react-router";
import {
	FleetPage,
	FleetPageError,
	FleetPageSkeleton,
	vehiclesQueryOptions,
} from "~/features/fleet";

/** /app/fleet: every vehicle with its status and its load of today. */
export const Route = createFileRoute("/app/fleet")({
	loader: ({ context }) => context.queryClient.query(vehiclesQueryOptions()),
	pendingComponent: FleetPageSkeleton,
	errorComponent: FleetPageError,
	component: FleetPage,
});
