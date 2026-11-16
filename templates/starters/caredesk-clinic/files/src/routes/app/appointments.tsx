// The appointments page behind login. The /app layout checks the session first.
// The loader fills the appointment cache. The search holds the view, the open appointment, and the practitioner filter.
// Thin: the page and its states live in the appointments feature.
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import {
	APPOINTMENT_VIEWS,
	AppointmentsPage,
	AppointmentsPageError,
	AppointmentsPageSkeleton,
	appointmentsQueryOptions,
} from "~/features/appointments";

// Every value comes from the URL. A wrong value gives the default state, not an error.
const appointmentsSearchSchema = z.object({
	view: z.enum(APPOINTMENT_VIEWS).optional().catch(undefined),
	appointment: z.string().max(40).optional().catch(undefined),
	practitioner: z.string().max(40).optional().catch(undefined),
});

/** /app/appointments. `?view=list` shows the list, `?appointment=apt-1113-07` opens the detail panel. */
export const Route = createFileRoute("/app/appointments")({
	validateSearch: appointmentsSearchSchema,
	loader: ({ context }) =>
		context.queryClient.query(appointmentsQueryOptions()),
	pendingComponent: AppointmentsPageSkeleton,
	errorComponent: AppointmentsPageError,
	component: AppointmentsRoute,
});

function AppointmentsRoute() {
	const { view, appointment, practitioner } = Route.useSearch();
	return (
		<AppointmentsPage
			view={view ?? "day"}
			appointmentId={appointment}
			practitionerId={practitioner}
		/>
	);
}
