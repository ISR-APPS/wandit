// The assignments page behind login. The /app layout checks the session first.
// The loader fills the submission list. Thin: the page and its states live in the assignments feature.
import { createFileRoute } from "@tanstack/react-router";
import {
	AssignmentsPage,
	AssignmentsPageError,
	AssignmentsPageSkeleton,
	assignmentsSearchSchema,
	submissionsQueryOptions,
} from "~/features/assignments";

/** /app/assignments: the work of the students. `?submission=` opens the side panel of one submission. */
export const Route = createFileRoute("/app/assignments")({
	validateSearch: assignmentsSearchSchema,
	loader: ({ context }) => context.queryClient.query(submissionsQueryOptions()),
	pendingComponent: AssignmentsPageSkeleton,
	errorComponent: AssignmentsPageError,
	component: AssignmentsPage,
});
