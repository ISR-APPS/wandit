// The assignments page behind login. The /app layout checks the session first.
// The loader fills the submission list and the next due assignments. Thin: the page and its states live in the assignments feature.
import { createFileRoute } from "@tanstack/react-router";
import {
	AssignmentsPage,
	AssignmentsPageError,
	AssignmentsPageSkeleton,
	assignmentsSearchSchema,
	dueNextQueryOptions,
	submissionsQueryOptions,
} from "~/features/assignments";

/** /app/assignments: the work of the students. `?submission=` opens the side panel of one submission. */
export const Route = createFileRoute("/app/assignments")({
	validateSearch: assignmentsSearchSchema,
	loader: ({ context }) =>
		Promise.all([
			context.queryClient.query(submissionsQueryOptions()),
			context.queryClient.query(dueNextQueryOptions()),
		]),
	pendingComponent: AssignmentsPageSkeleton,
	errorComponent: AssignmentsPageError,
	component: AssignmentsPage,
});
