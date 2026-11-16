// The detail page of one reservation. The /app layout checks the session first.
// The loader fills the reservation with its folio and its timeline. Thin: the page lives in the reservations feature.
// A failed load shows the error state of the list page: the same text and Try again.
import { createFileRoute } from "@tanstack/react-router";
import {
	ReservationDetailPage,
	ReservationDetailPageSkeleton,
	ReservationsPageError,
	reservationQueryOptions,
} from "~/features/reservations";

/** /app/reservations/$reservationId. `params.reservationId` is any text from the URL; the query checks it. */
export const Route = createFileRoute("/app/reservations/$reservationId")({
	loader: ({ context, params }) =>
		context.queryClient.query(reservationQueryOptions(params.reservationId)),
	pendingComponent: ReservationDetailPageSkeleton,
	errorComponent: ReservationsPageError,
	component: ReservationDetailRoute,
});

function ReservationDetailRoute() {
	const { reservationId } = Route.useParams();
	return <ReservationDetailPage reservationId={reservationId} />;
}
