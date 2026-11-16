// The file of one patient. The /app layout checks the session first.
// The loader fills the patient and the appointments of the patient. Thin: the page lives in the patients feature.
// A failed load shows the error state of the list page: the same text and Try again.
import { createFileRoute } from "@tanstack/react-router";
import {
	PatientDetailPage,
	PatientDetailPageSkeleton,
	PatientsPageError,
	patientQueryOptions,
} from "~/features/patients";

/** /app/patients/$patientId. `params.patientId` is any text from the URL; the query checks it. */
export const Route = createFileRoute("/app/patients/$patientId")({
	loader: ({ context, params }) =>
		context.queryClient.query(patientQueryOptions(params.patientId)),
	pendingComponent: PatientDetailPageSkeleton,
	errorComponent: PatientsPageError,
	component: PatientDetailRoute,
});

function PatientDetailRoute() {
	const { patientId } = Route.useParams();
	return <PatientDetailPage patientId={patientId} />;
}
