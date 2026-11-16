// The patient list behind login. The /app layout checks the session first.
// The loader fills the list cache. Thin: the page and its states live in the patients feature.
import { createFileRoute } from "@tanstack/react-router";
import {
	PatientsPage,
	PatientsPageError,
	PatientsPageSkeleton,
	patientsQueryOptions,
} from "~/features/patients";

/** /app/patients: every patient file of the practice. */
export const Route = createFileRoute("/app/patients/")({
	loader: ({ context }) => context.queryClient.query(patientsQueryOptions()),
	pendingComponent: PatientsPageSkeleton,
	errorComponent: PatientsPageError,
	component: PatientsPage,
});
