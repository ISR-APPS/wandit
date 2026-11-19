// The reservations page behind login. The /app layout checks the session first.
// The loader fills the list and the rooms of the schedule. Thin: the page and its states live in the reservations feature.
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import {
	ReservationsPage,
	ReservationsPageError,
	ReservationsPageSkeleton,
	reservationsQueryOptions,
	roomsQueryOptions,
} from "~/features/reservations";

// `view` comes from the URL. A value that is not a view shows the schedule.
const reservationsSearchSchema = z.object({
	view: z.enum(["list"]).optional().catch(undefined),
});

/** /app/reservations: the room schedule of one week. `?view=list` shows the list of every reservation. */
export const Route = createFileRoute("/app/reservations/")({
	validateSearch: reservationsSearchSchema,
	loader: ({ context }) =>
		Promise.all([
			context.queryClient.query(reservationsQueryOptions()),
			context.queryClient.query(roomsQueryOptions()),
		]),
	pendingComponent: ReservationsPageSkeleton,
	errorComponent: ReservationsPageError,
	component: ReservationsPage,
});
